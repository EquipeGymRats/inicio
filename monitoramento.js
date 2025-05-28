document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('cameraFeed');
    const overlayCanvas = document.getElementById('overlayCanvas');
    const canvasCtx = overlayCanvas.getContext('2d');
    const toggleCameraButton = document.getElementById('toggleCameraButton');
    const startStopButton = document.getElementById('startStopButton');
    const textFeedback = document.getElementById('textFeedback');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const repCorrectIndicator = document.getElementById('repCorrectIndicator');
    const repCounterElement = document.getElementById('repCounter');

    let currentStream;
    let isMonitoring = false;
    let useFrontCamera = true;
    let animationFrameId;

    let repCount = 0;
    let exercisePhase = 'idle'; // idle, lifting, peak, lowering, rep_completed_pending_feedback
    let peakReached = false;
    let repStartTime = 0;

    const MIN_REPS_BEFORE_FEEDBACK = 2;
    let currentRepMistakes = new Set();
    let lastFeedbackGiven = {};
    const FEEDBACK_DEBOUNCE_TIME = 4000; // ms

    let simulatedShoulderY, simulatedShoulderLeftX, simulatedShoulderRightX;
    let simulatedHandLeftX, simulatedHandLeftY, simulatedHandRightX, simulatedHandRightY;
    let simulatedElbowAngleLeft = 170, simulatedElbowAngleRight = 170;
    let simulatedTorsoLean = 0;

    const GUIDE_COLOR = 'rgba(255, 215, 0, 0.7)';
    const CORRECT_PATH_COLOR = 'rgba(46, 204, 113, 0.5)';
    const ERROR_HIGHLIGHT_COLOR = 'rgba(231, 76, 60, 0.8)';
    const WARNING_COLOR = 'rgba(243, 156, 18, 0.8)';

    setupCamera();

    async function setupCamera() {
        loadingIndicator.style.display = 'flex';
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        videoElement.classList.toggle('mirrored', useFrontCamera);

        const constraints = {
            video: {
                facingMode: useFrontCamera ? 'user' : 'environment',
                width: { ideal: 640 }, // Reduzir para melhor performance em mobile
                height: { ideal: 480 }
            },
            audio: false
        };
        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = currentStream;
            videoElement.onloadedmetadata = () => {
                // Ajustar o aspect ratio da area da camera
                const cameraArea = document.querySelector('.camera-area');
                 if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                    const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
                    // Forçar a area da camera a ter o mesmo aspect ratio do video real
                    // Isso evita barras pretas ou canvas desalinhado se o aspect-ratio CSS for diferente
                    cameraArea.style.paddingBottom = `${(1 / aspectRatio) * 100}%`;
                    cameraArea.style.height = '0'; // Técnica para manter aspect ratio com padding
                    cameraArea.style.aspectRatio = 'unset'; // Remove o aspect-ratio fixo do CSS
                }

                overlayCanvas.width = videoElement.videoWidth;
                overlayCanvas.height = videoElement.videoHeight;

                initializeSimulatedPositions();
                loadingIndicator.style.display = 'none';
                if (isMonitoring) startDrawingLoop();
            };
        } catch (error) {
            console.error('Erro ao acessar a câmera:', error);
            textFeedback.textContent = 'Erro ao acessar câmera. Verifique as permissões.';
            speakFeedback('Erro ao acessar a câmera.'); // Não precisa de tipo aqui
            loadingIndicator.style.display = 'none';
        }
    }

    function initializeSimulatedPositions() {
        const canvasWidth = overlayCanvas.width;
        const canvasHeight = overlayCanvas.height;
        simulatedShoulderY = canvasHeight * 0.4;
        simulatedShoulderLeftX = canvasWidth * 0.35;
        simulatedShoulderRightX = canvasWidth * 0.65;

        simulatedHandLeftX = simulatedShoulderLeftX + 10;
        simulatedHandLeftY = canvasHeight * 0.75;
        simulatedHandRightX = simulatedShoulderRightX - 10;
        simulatedHandRightY = canvasHeight * 0.75;
    }

    toggleCameraButton.addEventListener('click', () => {
        if(isMonitoring) { // Pausar se estiver monitorando
            startStopButton.click();
        }
        useFrontCamera = !useFrontCamera;
        setupCamera(); // Configura e já lida com o mirrored class
        textFeedback.textContent = `Câmera ${useFrontCamera ? 'frontal' : 'traseira'} ativada.`;
    });

    startStopButton.addEventListener('click', () => {
        isMonitoring = !isMonitoring;
        if (isMonitoring) {
            startStopButton.innerHTML = '<i class="fas fa-stop"></i> Parar';
            speakFeedback('Monitoramento iniciado. Elevação Lateral.', 'status_start');
            resetExerciseState();
            startDrawingLoop();
        } else {
            startStopButton.innerHTML = '<i class="fas fa-play"></i> Iniciar';
            textFeedback.textContent = 'Monitoramento pausado.';
            speakFeedback('Monitoramento pausado.', 'status_stop');
            cancelAnimationFrame(animationFrameId);
            clearCanvas();
        }
    });

    function resetExerciseState() {
        repCount = 0;
        repCounterElement.textContent = `Repetições: ${repCount}`;
        exercisePhase = 'idle';
        peakReached = false;
        repStartTime = 0; // Importante resetar para a simulação
        currentRepMistakes.clear();
        lastFeedbackGiven = {};
        textFeedback.textContent = 'Prepare-se para iniciar!';
        textFeedback.style.color = 'var(--color-light-gray)';
    }

    function drawingLoop() {
        if (!isMonitoring || !currentStream || !currentStream.active || videoElement.paused || videoElement.ended) {
             if(isMonitoring) { // Se era pra estar monitorando mas a stream caiu
                console.warn("Stream da câmera inativa. Parando monitoramento.");
                startStopButton.click(); // Simula o clique para parar
             }
            return;
        }


        clearCanvas();
        canvasCtx.save();
        if (useFrontCamera) {
            canvasCtx.translate(overlayCanvas.width, 0);
            canvasCtx.scale(-1, 1);
        }

        simulateMovement();
        drawGuideLines();
        drawSimulatedUserPose();
        analyzeAndFeedback();

        canvasCtx.restore();
        animationFrameId = requestAnimationFrame(drawingLoop);
    }

    function simulateMovement() {
        const time = Date.now();
        if (exercisePhase === 'idle' && repStartTime === 0) {
            if (isMonitoring) repStartTime = time;
        }
        if (repStartTime === 0) return;

        const cycleDuration = 3500; // Aumentar um pouco a duração da repetição
        const progress = ((time - repStartTime) % cycleDuration) / cycleDuration;

        const movementAmplitudeY = simulatedShoulderY - (overlayCanvas.height * 0.75);
        const movementAmplitudeX = overlayCanvas.width * 0.15; // Abrir um pouco mais

        const liftDurationRatio = 0.4; // 40% para subir
        const peakDurationRatio = 0.1; // 10% no pico
        // lowerDurationRatio = 1 - liftDurationRatio - peakDurationRatio; // 50% para descer

        if (progress < liftDurationRatio) {
            exercisePhase = 'lifting';
            const liftProgress = progress / liftDurationRatio;
            simulatedHandLeftY = (overlayCanvas.height * 0.75) + (movementAmplitudeY * liftProgress);
            simulatedHandRightY = (overlayCanvas.height * 0.75) + (movementAmplitudeY * liftProgress);
            simulatedHandLeftX = (simulatedShoulderLeftX + 10) - (movementAmplitudeX * liftProgress);
            simulatedHandRightX = (simulatedShoulderRightX - 10) + (movementAmplitudeX * liftProgress);
            peakReached = false;
        } else if (progress < liftDurationRatio + peakDurationRatio) {
            exercisePhase = 'peak';
            simulatedHandLeftY = simulatedShoulderY;
            simulatedHandRightY = simulatedShoulderY;
            simulatedHandLeftX = (simulatedShoulderLeftX + 10) - movementAmplitudeX;
            simulatedHandRightX = (simulatedShoulderRightX - 10) + movementAmplitudeX;
            if (!peakReached) peakReached = true;
        } else {
            exercisePhase = 'lowering';
            const lowerProgress = (progress - (liftDurationRatio + peakDurationRatio)) / (1 - liftDurationRatio - peakDurationRatio);
            simulatedHandLeftY = simulatedShoulderY - (movementAmplitudeY * lowerProgress);
            simulatedHandRightY = simulatedShoulderY - (movementAmplitudeY * lowerProgress);
            simulatedHandLeftX = ((simulatedShoulderLeftX + 10) - movementAmplitudeX) + (movementAmplitudeX * lowerProgress);
            simulatedHandRightX = ((simulatedShoulderRightX - 10) + movementAmplitudeX) - (movementAmplitudeX * lowerProgress);

            if (peakReached && lowerProgress > 0.95 && exercisePhase !== 'rep_completed_pending_feedback') {
                exercisePhase = 'rep_completed_pending_feedback';
            }
        }

        // Simular pequenos erros
        const errorChance = Math.random();
        if (repCount > 0) { // Não introduzir erros na primeira repetição simulada
            if (errorChance < 0.15) simulatedElbowAngleLeft = 130; else simulatedElbowAngleLeft = 170;
            if (errorChance < 0.10) simulatedHandLeftY = simulatedShoulderY - 30; // Subiu demais (apenas uma mão para variar)
            if (errorChance < 0.08) simulatedTorsoLean = Math.random() > 0.5 ? 12 : -12; else simulatedTorsoLean = 0;
        } else { // Sem erros na primeira repetição
            simulatedElbowAngleLeft = 170;
            simulatedElbowAngleRight = 170;
            simulatedTorsoLean = 0;
        }
    }

    function drawGuideLines() {
        const canvasWidth = overlayCanvas.width;
        const canvasHeight = overlayCanvas.height;
        canvasCtx.lineWidth = Math.max(2, canvasWidth / 200); // Linhas mais finas em telas menores
        const fontSize = Math.max(10, canvasWidth / 35);
        canvasCtx.font = `${fontSize}px Arial`;
        canvasCtx.textAlign = 'center';

        canvasCtx.strokeStyle = GUIDE_COLOR;
        canvasCtx.fillStyle = GUIDE_COLOR;
        canvasCtx.beginPath();
        canvasCtx.moveTo(canvasWidth * 0.1, simulatedShoulderY);
        canvasCtx.lineTo(canvasWidth * 0.9, simulatedShoulderY);
        canvasCtx.stroke();
        canvasCtx.fillText('Altura Ombros', canvasWidth / 2, simulatedShoulderY - fontSize * 0.8);

        const initialHandY = canvasHeight * 0.75;
        canvasCtx.setLineDash([canvasWidth/80, canvasWidth/80]);
        canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        const initialHandMarkerLength = canvasWidth * 0.08;
        canvasCtx.beginPath();
        canvasCtx.moveTo(simulatedShoulderLeftX + 10 - initialHandMarkerLength/2, initialHandY);
        canvasCtx.lineTo(simulatedShoulderLeftX + 10 + initialHandMarkerLength/2, initialHandY);
        canvasCtx.stroke();
        canvasCtx.beginPath();
        canvasCtx.moveTo(simulatedShoulderRightX - 10 - initialHandMarkerLength/2, initialHandY);
        canvasCtx.lineTo(simulatedShoulderRightX - 10 + initialHandMarkerLength/2, initialHandY);
        canvasCtx.stroke();
        canvasCtx.setLineDash([]);

        canvasCtx.strokeStyle = CORRECT_PATH_COLOR;
        canvasCtx.lineWidth = Math.max(15, canvasWidth / 25); // Faixa mais larga
        const arcRadius = Math.abs(initialHandY - simulatedShoulderY);
        canvasCtx.beginPath();
        canvasCtx.arc(simulatedShoulderLeftX, simulatedShoulderY, arcRadius, Math.PI * 0.55, Math.PI * 0.45, true);
        canvasCtx.stroke();
        canvasCtx.beginPath();
        canvasCtx.arc(simulatedShoulderRightX, simulatedShoulderY, arcRadius, Math.PI * 0.55, Math.PI * 0.45, true);
        canvasCtx.stroke();

        const torsoTopY = canvasHeight * 0.25;
        const torsoBottomY = canvasHeight * 0.65;
        const torsoWidth = canvasWidth * 0.08;
        canvasCtx.strokeStyle = GUIDE_COLOR;
        canvasCtx.lineWidth = Math.max(2, canvasWidth / 200);
        canvasCtx.beginPath();
        canvasCtx.moveTo(canvasWidth/2 - torsoWidth/2, torsoTopY);
        canvasCtx.lineTo(canvasWidth/2 - torsoWidth/2, torsoBottomY);
        canvasCtx.stroke();
        canvasCtx.beginPath();
        canvasCtx.moveTo(canvasWidth/2 + torsoWidth/2, torsoTopY);
        canvasCtx.lineTo(canvasWidth/2 + torsoWidth/2, torsoBottomY);
        canvasCtx.stroke();
        canvasCtx.fillStyle = GUIDE_COLOR;
        canvasCtx.fillText('Tronco', canvasWidth / 2, torsoTopY - fontSize * 0.8);
        canvasCtx.lineWidth = Math.max(2, canvasWidth/150); // Reset
    }

    function drawSimulatedUserPose() {
        const shoulderRadius = Math.max(5, overlayCanvas.width / 50);
        const handRadius = Math.max(6, overlayCanvas.width / 40);
        const elbowRadius = Math.max(4, overlayCanvas.width / 60);
        canvasCtx.lineWidth = Math.max(3, overlayCanvas.width / 100);


        canvasCtx.fillStyle = 'lightblue'; // Ombros
        canvasCtx.beginPath(); canvasCtx.arc(simulatedShoulderLeftX, simulatedShoulderY, shoulderRadius, 0, Math.PI * 2); canvasCtx.fill();
        canvasCtx.beginPath(); canvasCtx.arc(simulatedShoulderRightX, simulatedShoulderY, shoulderRadius, 0, Math.PI * 2); canvasCtx.fill();

        function drawArm(shoulderX, shoulderY, handX, handY, elbowAngleDegrees, side) {
            const armLength = Math.hypot(handX - shoulderX, handY - shoulderY);
            if (armLength < 1) return; // Evitar divisão por zero se pontos coincidirem

            const segmentLength = armLength / 2;
            const angleShoulderToHand = Math.atan2(handY - shoulderY, handX - shoulderX);

            let elbowX = shoulderX + segmentLength * Math.cos(angleShoulderToHand);
            let elbowY = shoulderY + segmentLength * Math.sin(angleShoulderToHand);

            const offsetFactor = 20 * (1 - Math.min(1, elbowAngleDegrees / 170)); // Mais offset se mais dobrado
            const offsetAngle = angleShoulderToHand + (side === 'left' ? Math.PI / 2 : -Math.PI / 2);
            if (elbowAngleDegrees < 165) { // Só aplicar offset se estiver visivelmente dobrado
                elbowX += Math.cos(offsetAngle) * offsetFactor;
                elbowY += Math.sin(offsetAngle) * offsetFactor;
            }

            let armStrokeStyle = 'white';
            let handFillStyle = 'white';
            let elbowFillStyle = 'lightgreen';

            if(currentRepMistakes.has('hands_too_high') && handY < simulatedShoulderY - 5) handFillStyle = ERROR_HIGHLIGHT_COLOR;
            if(currentRepMistakes.has('not_reaching_height') && exercisePhase ==='peak' && handY > simulatedShoulderY + 5) handFillStyle = WARNING_COLOR;


            const elbowErrorKey = side === 'left' ? 'elbow_left_bent' : 'elbow_right_bent';
            if (currentRepMistakes.has(elbowErrorKey)) elbowFillStyle = ERROR_HIGHLIGHT_COLOR;

            // Ombro ao Cotovelo
            canvasCtx.strokeStyle = armStrokeStyle;
            canvasCtx.beginPath(); canvasCtx.moveTo(shoulderX, shoulderY); canvasCtx.lineTo(elbowX, elbowY); canvasCtx.stroke();
            // Cotovelo à Mão
            canvasCtx.beginPath(); canvasCtx.moveTo(elbowX, elbowY); canvasCtx.lineTo(handX, handY); canvasCtx.stroke();

            canvasCtx.fillStyle = handFillStyle;
            canvasCtx.beginPath(); canvasCtx.arc(handX, handY, handRadius, 0, Math.PI * 2); canvasCtx.fill();
            canvasCtx.fillStyle = elbowFillStyle;
            canvasCtx.beginPath(); canvasCtx.arc(elbowX, elbowY, elbowRadius, 0, Math.PI * 2); canvasCtx.fill();
        }

        drawArm(simulatedShoulderLeftX, simulatedShoulderY, simulatedHandLeftX, simulatedHandLeftY, simulatedElbowAngleLeft, 'left');
        drawArm(simulatedShoulderRightX, simulatedShoulderY, simulatedHandRightX, simulatedHandRightY, simulatedElbowAngleRight, 'right');

        canvasCtx.save();
        canvasCtx.translate(overlayCanvas.width / 2, simulatedShoulderY);
        canvasCtx.rotate(simulatedTorsoLean * Math.PI / 180);
        canvasCtx.fillStyle = currentRepMistakes.has('torso_lean') ? ERROR_HIGHLIGHT_COLOR : 'rgba(100,100,200,0.4)';
        const torsoRectHeight = (overlayCanvas.height*0.65 - overlayCanvas.height*0.25);
        const torsoRectWidth = overlayCanvas.width * 0.1;
        canvasCtx.fillRect(-torsoRectWidth/2, -(simulatedShoulderY - overlayCanvas.height * 0.25), torsoRectWidth, torsoRectHeight);
        canvasCtx.restore();
    }

    function analyzeAndFeedback() {
        currentRepMistakes.clear();

        if (simulatedHandLeftY < simulatedShoulderY - 15 || simulatedHandRightY < simulatedShoulderY - 15) currentRepMistakes.add('hands_too_high');
        if (simulatedElbowAngleLeft < 150) currentRepMistakes.add('elbow_left_bent');
        if (simulatedElbowAngleRight < 150) currentRepMistakes.add('elbow_right_bent');
        if (exercisePhase === 'peak' && (simulatedHandLeftY > simulatedShoulderY + 15 || simulatedHandRightY > simulatedShoulderY + 15 )) currentRepMistakes.add('not_reaching_height');
        if (Math.abs(simulatedTorsoLean) > 8) currentRepMistakes.add('torso_lean'); // Aumentar tolerância

        if (exercisePhase === 'rep_completed_pending_feedback') {
            repCount++;
            repCounterElement.textContent = `Repetições: ${repCount}`;
            exercisePhase = 'idle';
            repStartTime = 0;

            if (repCount >= MIN_REPS_BEFORE_FEEDBACK || currentRepMistakes.size > 0) { // Dar feedback se houver erro mesmo antes do min_reps
                if (currentRepMistakes.size > 0) {
                    let feedbackMsg = "Na próxima, atenção: ";
                    let spokenMsg = "";
                    let mistakeType = "";

                    if (currentRepMistakes.has('hands_too_high')) {
                        feedbackMsg += "não eleve demais os braços. ";
                        spokenMsg = "Mantenha na altura dos ombros."; mistakeType = 'hands_too_high';
                    } else if (currentRepMistakes.has('torso_lean')) {
                        feedbackMsg += "mantenha o tronco mais reto. ";
                        spokenMsg = "Tronco firme."; mistakeType = 'torso_lean';
                    } else if (currentRepMistakes.has('elbow_left_bent') || currentRepMistakes.has('elbow_right_bent')) {
                        feedbackMsg += "mantenha os cotovelos levemente flexionados, quase retos. ";
                        spokenMsg = "Cuidado com os cotovelos."; mistakeType = 'elbow_bent';
                    } else if (currentRepMistakes.has('not_reaching_height')) {
                        feedbackMsg += "eleve os braços até a linha dos ombros. ";
                        spokenMsg = "Suba um pouco mais."; mistakeType = 'not_reaching_height';
                    }
                    textFeedback.textContent = feedbackMsg.trim();
                    textFeedback.style.color = WARNING_COLOR;
                    if (spokenMsg) speakFeedback(spokenMsg, mistakeType);

                } else { // Repetição correta após o limiar
                    textFeedback.textContent = "Excelente repetição!";
                    textFeedback.style.color = 'var(--color-green-correct)';
                    speakFeedback("Perfeito!", 'rep_correct');
                    showRepCorrectVisualFeedback();
                }
            } else if (currentRepMistakes.size === 0) { // Correto, antes do limiar
                 textFeedback.textContent = `Boa! Repetição ${repCount} correta.`;
                 textFeedback.style.color = 'var(--color-green-correct)';
                 showRepCorrectVisualFeedback();
            } else { // Errado, antes do limiar
                textFeedback.textContent = "Continue, estamos aquecendo...";
                textFeedback.style.color = 'var(--color-light-gray)';
            }
            // currentRepMistakes foi limpo no início desta função se a repetição acabou
            // Mas para o desenho da pose, precisamos dos erros da ÚLTIMA fase de movimento
            // Então, não limpamos aqui, a limpeza ocorre no início da análise da PRÓXIMA frame.
            // No entanto, para o feedback pós-rep, os erros já foram processados.
        } else if (exercisePhase !== 'idle') {
            // Se não for feedback pós-repetição e não houver mensagem de erro/sucesso, mostrar "Executando"
            if (textFeedback.style.color !== WARNING_COLOR && textFeedback.style.color !== 'var(--color-green-correct)') {
                textFeedback.textContent = "Executando...";
                textFeedback.style.color = 'var(--color-light-gray)';
            }
        }
    }

    function showRepCorrectVisualFeedback() {
        repCorrectIndicator.classList.add('show');
        setTimeout(() => {
            repCorrectIndicator.classList.remove('show');
        }, 1200);
    }

    function speakFeedback(message, type) {
        const now = Date.now();
        if (type && lastFeedbackGiven[type] && (now - lastFeedbackGiven[type]) < FEEDBACK_DEBOUNCE_TIME) {
            return;
        }
        if(type) lastFeedbackGiven[type] = now;

        try {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel(); // Cancela falas anteriores para não acumular
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = 'pt-BR';
                window.speechSynthesis.speak(utterance);
            }
        } catch (e) { console.error("Erro na síntese de voz:", e); }
    }

    function clearCanvas() {
        canvasCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }

    // Ajuste dinâmico do aspect ratio da area da camera e canvas (movido para onloadedmetadata)
});