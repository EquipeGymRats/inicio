document.addEventListener('DOMContentLoaded', () => {
    const textExplanationSection = document.getElementById('textExplanationSection');
    const cameraMonitoringSection = document.getElementById('cameraMonitoringSection');
    const startCameraButton = document.getElementById('startCameraButton');
    const showExplanationAgainButton = document.getElementById('showExplanationAgainButton');

    const videoElement = document.getElementById('userVideoFeed');
    const canvasElement = document.getElementById('guideLinesCanvas');
    const canvasCtx = canvasElement.getContext('2d');
    const cameraLoadingIndicator = document.getElementById('cameraLoadingIndicator');

    const toggleUserCameraBtn = document.getElementById('toggleUserCamera');
    const initiateExerciseButton = document.getElementById('initiateExerciseButton');
    
    const currentSetDisplayEl = document.getElementById('currentSetDisplay');
    const validRepsCounterEl = document.getElementById('validRepsCounter');
    const totalSetsDisplayEl = document.getElementById('totalSetsDisplay');
    const repsPerSetDisplayEl = document.getElementById('repsPerSetDisplay');
    const setCompleteMessageEl = document.getElementById('setCompleteMessage');
    const workoutCompleteMessageEl = document.getElementById('workoutCompleteMessage');
    const restTimerDisplayEl = document.getElementById('restTimerDisplay');
    const restTimeValueEl = document.getElementById('restTimeValue');

    const formFeedbackContainerEl = document.getElementById('formFeedbackContainer');
    const formFeedbackMessageEl = document.getElementById('formFeedbackMessage');
    const correctRepFeedbackEl = document.getElementById('correctRepFeedback');

    let currentStream;
    let useFrontCamera = true;
    let isExerciseInProgress = false;
    let isResting = false;
    let restTimerIntervalId = null;

    let currentSet = 1;
    const totalSets = 4;
    let validReps = 0;
    const repsPerSet = 10;
    const restDurationSeconds = 60; // 1 minuto
    let currentRestTimeLeft = 0;

    // MediaPipe Pose setup
    let pose; // O objeto Pose do MediaPipe
    let hands; // O objeto Hands do MediaPipe
    let camera; // O objeto Camera do MediaPipe
    let lastUserLandmarks = null; // Últimos pontos de referência detectados do usuário
    let lastHandLandmarks = null; // Últimos pontos de referência das mãos

    // Parâmetros para detecção de pose (Elevação Lateral)
    const MIN_ARM_ANGLE_RAD = 15 * Math.PI / 180; // Braço baixo (aumentado um pouco)
    const MAX_ARM_ANGLE_RAD = 90 * Math.PI / 180; // Braço na altura do ombro (90 graus com o corpo)
    const FLEXION_TOLERANCE_DEG = 35; // Tolerância MAIOR para flexão do cotovelo (em graus) - permite mais dobra
    const REPETITION_THRESHOLD_LIFT = MAX_ARM_ANGLE_RAD * 0.85; // 85% da altura máxima para considerar "pico"
    const REPETITION_THRESHOLD_LOWER = MIN_ARM_ANGLE_RAD * 1.8; // 180% do ângulo mínimo para considerar "base"

    // Variáveis de estado da repetição
    let repPhase = 'down'; // 'down', 'up', 'peak', 'lowering'
    let repCountedForThisCycle = false;
    let isUserFormCorrect = true;
    let formCorrectAtPeak = false; // Flag para verificar forma no pico
    let lastFeedbackTime = 0;
    const feedbackThrottleMillis = 3000; // Tempo mínimo entre feedbacks de erro (aumentado)
    const tipThrottleMillis = 5000; // Tempo mínimo entre dicas

    // Variáveis para controle de gesto
    let lastThumbsUpTime = 0;
    const thumbsUpThrottleMillis = 1500; // Evita múltiplas detecções em sequência
    let thumbsUpDetected = false;
    let thumbsUpFeedbackShown = false;

    // Dimensões do canvas baseadas no vídeo
    let videoWidth, videoHeight;

    // --- FUNÇÕES DE SETUP INICIAIS E GERENCIAMENTO DE TELA ---
    function switchToPhase(phaseName) {
        textExplanationSection.classList.remove('active');
        cameraMonitoringSection.classList.remove('active');
        hideFormFeedback();
        correctRepFeedbackEl.classList.remove('visible');

        if (phaseName === 'explanation') {
            textExplanationSection.classList.add('active');
            stopAnimationAndRest();
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
                currentStream = null;
                videoElement.srcObject = null;
            }
            if (pose) {
                pose.close();
                pose = null;
            }
            if (hands) {
                hands.close();
                hands = null;
            }
            if (camera) {
                camera.stop();
                camera = null;
            }
            resetWorkoutState();
            speakSimpleFeedback("Instruções para elevação lateral. Siga as dicas na tela.");

        } else if (phaseName === 'monitoring') {
            cameraMonitoringSection.classList.add('active');
            videoElement.classList.remove('resting-blur'); // Garante que não comece com blur

            if (!pose) {
                initializePoseDetection();
            }
            if (!hands) {
                initializeHandsDetection();
            }
            if (!currentStream || !currentStream.active) {
                setupCamera();
            } else {
                // Se stream já existe, garante que o tamanho do canvas está correto
                if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                    setCanvasDimensions();
                    if (camera && !camera.isStarted) camera.start(); // Reinicia se parou
                } else {
                    // Se metadados não carregaram ainda, setupCamera tratará disso
                    setupCamera();
                }
            }
            if (!isResting) {
                resetCurrentSetProgress();
            } else {
                updateWorkoutDisplay();
            }
        }
    }

    startCameraButton.addEventListener('click', () => switchToPhase('monitoring'));
    showExplanationAgainButton.addEventListener('click', () => switchToPhase('explanation'));

    function setCanvasDimensions() {
        videoWidth = videoElement.videoWidth;
        videoHeight = videoElement.videoHeight;
        canvasElement.width = videoWidth;
        canvasElement.height = videoHeight;
        console.log(`Canvas dimensions set: ${videoWidth}x${videoHeight}`);
    }

    async function setupCamera() {
        cameraLoadingIndicator.style.display = 'flex';
        console.log("setupCamera: Iniciando...");
        cameraLoadingIndicator.textContent = 'Carregando Câmera...';

        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        videoElement.classList.toggle('mirrored', useFrontCamera);

        const constraints = {
            video: { facingMode: useFrontCamera ? 'user' : 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
        };
        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log("setupCamera: Câmera obtida.");
            videoElement.srcObject = currentStream;

            // Usar 'loadeddata' pode ser mais confiável que 'loadedmetadata' para dimensões
            videoElement.onloadeddata = () => {
                console.log("setupCamera: Dados do vídeo carregados.");
                setCanvasDimensions();
                cameraLoadingIndicator.style.display = 'none';

                if (!pose) {
                    initializePoseDetection(); // Inicializa se não existir
                }
                if (!hands) {
                    initializeHandsDetection(); // Inicializa detecção de mãos
                }
                if (camera && !camera.isStarted) {
                    camera.start(); // Reinicia o MediaPipe Camera se já existir mas parado
                } else if (!camera) {
                    startCameraFeed(); // Cria e inicia o MediaPipe Camera
                }
            };
            videoElement.onerror = (e) => { console.error("setupCamera: Erro no elemento de vídeo:", e); cameraLoadingIndicator.textContent = `Erro: ${e.message || e.name}`; currentStream = null; };
        } catch (error) {
            console.error("setupCamera: Erro ao obter câmera -", error.name, error.message);
            cameraLoadingIndicator.textContent = `Erro: ${error.name}`;
            if (error.name === "NotAllowedError") {
                 cameraLoadingIndicator.textContent = 'Permissão da câmera negada.';
                 alert('Você precisa permitir o acesso à câmera para usar esta funcionalidade.');
            } else {
                 cameraLoadingIndicator.textContent = `Erro (${error.name}). Tente outra câmera.`;
            }
            currentStream = null;
        }
    }

    // --- FUNÇÕES DE CONTROLE DO TREINO ---
    toggleUserCameraBtn.addEventListener('click', () => {
        // Pausa o exercício ou descanso antes de trocar
        const wasInProgress = isExerciseInProgress;
        const wasResting = isResting;
        if (wasInProgress) initiateExerciseButton.click(); // Pausa
        if (wasResting) skipRest(); // Termina descanso

        useFrontCamera = !useFrontCamera;
        if (cameraMonitoringSection.classList.contains('active')) {
            // Para a câmera antiga antes de iniciar a nova
            if (camera) camera.stop();
            if (currentStream) currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
            videoElement.srcObject = null;
            setupCamera(); // Configura a nova câmera
        }
    });

    initiateExerciseButton.addEventListener('click', () => {
        if (!currentStream || !currentStream.active || videoElement.readyState < 2 || videoElement.videoWidth === 0 || !pose) {
            alert("Aguarde a câmera carregar e o sistema de monitoramento iniciar.");
            if (!currentStream || !currentStream.active) setupCamera();
            else if (!pose) initializePoseDetection();
            return;
        }

        if (isResting) {
            skipRest();
            return;
        }

        if (currentSet > totalSets) {
            resetWorkoutState();
            speakSimpleFeedback(`Treino completo! Clique em Iniciar para recomeçar.`);
            isExerciseInProgress = false;
            updateWorkoutDisplay();
            updateInitiateButtonIcon();
            return;
        }

        isExerciseInProgress = !isExerciseInProgress;

        if (isExerciseInProgress) {
            setCompleteMessageEl.classList.remove('visible');
            workoutCompleteMessageEl.classList.remove('visible');
            speakSimpleFeedback(`Iniciando série ${currentSet}. ${repsPerSet} repetições.`);
            hideFormFeedback();
            lastFeedbackTime = 0;
            repPhase = 'down';
            repCountedForThisCycle = false;
            formCorrectAtPeak = false; // Reseta flag da forma no pico
        } else { // Pausou
            speakSimpleFeedback("Exercício pausado.");
            showFormFeedback("Exercício pausado.", "action-state");
        }
        updateWorkoutDisplay();
        updateInitiateButtonIcon();
    });

    function resetWorkoutState() {
        currentSet = 1;
        resetCurrentSetProgress();
        workoutCompleteMessageEl.classList.remove('visible');
    }

    function resetCurrentSetProgress() {
        validReps = 0;
        isExerciseInProgress = false;
        repPhase = 'down';
        repCountedForThisCycle = false;
        isUserFormCorrect = true;
        formCorrectAtPeak = false;
        lastFeedbackTime = 0;
        thumbsUpDetected = false;
        thumbsUpFeedbackShown = false;

        stopAnimationAndRest();
        clearCanvas();

        hideFormFeedback();
        correctRepFeedbackEl.classList.remove('visible');
        updateWorkoutDisplay();
        updateInitiateButtonIcon();
    }

    function stopAnimationAndRest() {
        if (restTimerIntervalId) {
            clearInterval(restTimerIntervalId);
            restTimerIntervalId = null;
        }
        isResting = false;
        restTimerDisplayEl.classList.remove('visible');
        videoElement.classList.remove('resting-blur');
    }

    function showFormFeedback(message, type = 'info') {
        if (!formFeedbackMessageEl || !formFeedbackContainerEl) return;
        formFeedbackMessageEl.textContent = message;
        formFeedbackMessageEl.className = 'feedback-message'; // Reseta classes
        if (type) {
            formFeedbackMessageEl.classList.add(type);
        }
        formFeedbackContainerEl.classList.add('visible');
    }

    function hideFormFeedback() {
        if (!formFeedbackMessageEl || !formFeedbackContainerEl) return;
        formFeedbackContainerEl.classList.remove('visible');
        // Pequeno delay para limpar o texto após a animação de fade out
        setTimeout(() => {
            if (!formFeedbackContainerEl.classList.contains('visible')) {
                formFeedbackMessageEl.textContent = '';
                formFeedbackMessageEl.className = 'feedback-message'; // Limpa classes de tipo
            }
        }, 300);
    }

    function showCorrectRepAnimation() {
        correctRepFeedbackEl.classList.add('visible');
        // speakSimpleFeedback("Boa!"); // Feedback sonoro pode ser repetitivo
        setTimeout(() => {
            correctRepFeedbackEl.classList.remove('visible');
        }, 700);
    }

    // --- LÓGICA DE DETECÇÃO DE POSE (MediaPipe) ---
    function initializePoseDetection() {
        console.log("initializePoseDetection: Iniciando...");
        pose = new Pose({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }});
        console.log("initializePoseDetection: Objeto Pose instanciado.");

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false, // Desabilitado para performance
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        pose.onResults(onPoseResults);
        console.log("initializePoseDetection: Opções e onResults configurados.");

        if (currentStream && currentStream.active) {
            console.log("initializePoseDetection: Stream já ativo, iniciando camera feed.");
            startCameraFeed();
        }
    }

    // --- LÓGICA DE DETECÇÃO DE MÃOS (MediaPipe) ---
    function initializeHandsDetection() {
        console.log("initializeHandsDetection: Iniciando...");
        hands = new Hands({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }});
        console.log("initializeHandsDetection: Objeto Hands instanciado.");

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onHandsResults);
        console.log("initializeHandsDetection: Opções e onResults configurados.");
    }

    function startCameraFeed() {
        console.log("startCameraFeed: Iniciando...");
        if (camera) camera.stop(); // Garante que uma câmera antiga não esteja rodando

        camera = new Camera(videoElement, {
            onFrame: async () => {
                // Garante que o vídeo e o pose estão prontos
                if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                    try {
                        if (pose) {
                            await pose.send({image: videoElement});
                        }
                        if (hands) {
                            await hands.send({image: videoElement});
                        }
                    } catch (error) {
                         console.error("Erro ao enviar frame para o MediaPipe:", error);
                    }
                }
            },
            width: videoWidth, // Usa as dimensões já definidas
            height: videoHeight
        });
        camera.start().then(() => {
             console.log("startCameraFeed: Câmera MediaPipe iniciada.");
             camera.isStarted = true; // Flag para controle
        }).catch(err => {
             console.error("Erro ao iniciar câmera MediaPipe:", err);
             camera.isStarted = false;
        });
    }

    // --- FUNÇÕES DE ANÁLISE DE POSE ---
    function getAngle(p1, p2, p3) {
        if (!p1 || !p2 || !p3 || p1.visibility < 0.5 || p2.visibility < 0.5 || p3.visibility < 0.5) {
            return null;
        }
        const angle = Math.atan2(p3.y - p2.y, p3.x - p2.x) -
                      Math.atan2(p1.y - p2.y, p1.x - p2.x);
        return Math.abs(angle);
    }

    function getAngleDegrees(p1, p2, p3) {
        const radians = getAngle(p1, p2, p3);
        return radians === null ? null : radians * 180 / Math.PI;
    }

    function drawTargetGuideLines(landmarks) {
        if (!landmarks || !canvasCtx || !canvasElement) return;

        const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

        if (!leftShoulder || !rightShoulder || leftShoulder.visibility < 0.5 || rightShoulder.visibility < 0.5) {
            return;
        }

        const shoulderY = (leftShoulder.y + rightShoulder.y) / 2 * canvasElement.height;
        const shoulderXLeft = leftShoulder.x * canvasElement.width;
        const shoulderXRight = rightShoulder.x * canvasElement.width;
        
        // Estimativa do comprimento do braço baseado na distância ombro-cotovelo, se visível
        const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
        const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
        let armLengthEstimate = Math.abs(shoulderXLeft - shoulderXRight) * 0.8; // Fallback
        if(leftElbow && leftElbow.visibility > 0.5) {
            armLengthEstimate = Math.hypot(shoulderXLeft - leftElbow.x * canvasElement.width, shoulderY - leftElbow.y * canvasElement.height) * 1.8; // Estimativa total
        } else if (rightElbow && rightElbow.visibility > 0.5) {
             armLengthEstimate = Math.hypot(shoulderXRight - rightElbow.x * canvasElement.width, shoulderY - rightElbow.y * canvasElement.height) * 1.8;
        }

        canvasCtx.save();
        canvasCtx.strokeStyle = 'rgba(52, 152, 219, 0.7)'; // Azul
        canvasCtx.lineWidth = 3;
        canvasCtx.setLineDash([5, 5]);

        // Linha guia esquerda (para fora do ombro)
        canvasCtx.beginPath();
        canvasCtx.moveTo(shoulderXLeft, shoulderY);
        canvasCtx.lineTo(shoulderXLeft - armLengthEstimate, shoulderY);
        canvasCtx.stroke();

        // Linha guia direita
        canvasCtx.beginPath();
        canvasCtx.moveTo(shoulderXRight, shoulderY);
        canvasCtx.lineTo(shoulderXRight + armLengthEstimate, shoulderY);
        canvasCtx.stroke();

        canvasCtx.restore();
    }

    function processUserPose(landmarks) {
        if (!isExerciseInProgress) return;

        const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
        const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
        const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];

        const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
        const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
        const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

        const leftArmAbductionAngle = getAngle(leftHip, leftShoulder, leftElbow);
        const rightArmAbductionAngle = getAngle(rightHip, rightShoulder, rightElbow);
        const leftElbowAngleDeg = getAngleDegrees(leftShoulder, leftElbow, leftWrist);
        const rightElbowAngleDeg = getAngleDegrees(rightShoulder, rightElbow, rightWrist);

        let currentArmAngle = null;
        if (leftArmAbductionAngle !== null && rightArmAbductionAngle !== null) {
            currentArmAngle = (leftArmAbductionAngle + rightArmAbductionAngle) / 2;
        } else if (leftArmAbductionAngle !== null) {
            currentArmAngle = leftArmAbductionAngle;
        } else if (rightArmAbductionAngle !== null) {
            currentArmAngle = rightArmAbductionAngle;
        } else {
            showFormFeedback("Não consigo ver seus braços claramente.", "error");
            isUserFormCorrect = false;
            return;
        }

        // --- Verificação de Forma e Feedback ---
        let formFeedback = "";
        let currentFormCorrect = true; // Verifica a forma neste frame

        // 1. Verificar flexão excessiva do cotovelo (ângulo interno muito pequeno)
        const minElbowAngleAllowed = 180 - FLEXION_TOLERANCE_DEG; // Ex: 180 - 35 = 145 graus
        if ((leftElbowAngleDeg !== null && leftElbowAngleDeg < minElbowAngleAllowed) ||
            (rightElbowAngleDeg !== null && rightElbowAngleDeg < minElbowAngleAllowed)) {
            formFeedback = "Mantenha os cotovelos mais esticados (levemente dobrados).";
            currentFormCorrect = false;
        }

        // 2. Verificar se braços não sobem o suficiente (apenas se cotovelos ok)
        //    Só dá feedback se estiver na fase 'up' ou 'peak' por um tempo sem atingir
        if (currentFormCorrect && (repPhase === 'up' || repPhase === 'peak') && currentArmAngle < REPETITION_THRESHOLD_LIFT * 0.9) {
             // Poderia adicionar um timer aqui para só dar feedback se ficar muito tempo baixo
             // formFeedback = "Levante os braços até a altura dos ombros (linha guia).";
             // currentFormCorrect = false; // Considera erro se persistentemente baixo
        }

        // 3. Verificar se braços sobem demais (acima da linha dos ombros)
        if (currentFormCorrect && currentArmAngle > MAX_ARM_ANGLE_RAD * 1.15) { // 15% acima do alvo
             formFeedback = "Não levante os braços acima da linha dos ombros.";
             currentFormCorrect = false;
        }

        // Atualiza a flag geral de correção da forma
        isUserFormCorrect = currentFormCorrect;

        // Exibir feedback de forma
        const now = Date.now();
        if (!isUserFormCorrect && formFeedback && (now - lastFeedbackTime > feedbackThrottleMillis)) {
            showFormFeedback(formFeedback, "error");
            speakSimpleFeedback(formFeedback);
            lastFeedbackTime = now;
        } else if (isUserFormCorrect && formFeedbackContainerEl.classList.contains('visible') && formFeedbackMessageEl.classList.contains('error')) {
            hideFormFeedback();
        }

        // --- Lógica de Contagem de Repetições --- 
        if (currentArmAngle > REPETITION_THRESHOLD_LIFT && repPhase === 'up') {
            repPhase = 'peak';
            formCorrectAtPeak = isUserFormCorrect; // Armazena se a forma estava correta ao atingir o pico
        } else if (currentArmAngle < REPETITION_THRESHOLD_LOWER && (repPhase === 'peak' || repPhase === 'lowering')) {
            if (repPhase === 'peak' || repPhase === 'lowering') { // Garante que veio de cima
                 if (!repCountedForThisCycle && formCorrectAtPeak) { // Só conta se atingiu o pico com forma correta
                    validReps++;
                    repCountedForThisCycle = true;
                    showCorrectRepAnimation();
                    updateWorkoutDisplay();

                    if (validReps >= repsPerSet) {
                        completeSet();
                        return;
                    }
                 } else if (!repCountedForThisCycle && !formCorrectAtPeak && repPhase === 'peak') {
                     // Atingiu a base vindo do pico, mas a forma estava errada no pico
                     // Dar um feedback? Ex: "Repetição inválida, corrija a forma."
                     if (now - lastFeedbackTime > feedbackThrottleMillis) {
                         showFormFeedback("Forma incorreta no pico, repetição não contada.", "error");
                         // speakSimpleFeedback("Forma incorreta no pico.");
                         lastFeedbackTime = now;
                     }
                 }
                 // Independentemente de contar ou não, a fase muda para 'down'
                 repPhase = 'down';
                 formCorrectAtPeak = false; // Reseta para o próximo ciclo
            }
        } else if (currentArmAngle > REPETITION_THRESHOLD_LOWER && currentArmAngle < REPETITION_THRESHOLD_LIFT && repPhase === 'down') {
            repPhase = 'up';
            repCountedForThisCycle = false; // Prepara para a próxima contagem
            formCorrectAtPeak = false; // Reseta
            // Limpa feedback de erro ao iniciar nova subida
            if (formFeedbackContainerEl.classList.contains('visible') && formFeedbackMessageEl.classList.contains('error')) {
                 hideFormFeedback();
            }
        } else if (currentArmAngle < REPETITION_THRESHOLD_LIFT && currentArmAngle > REPETITION_THRESHOLD_LOWER && repPhase === 'peak') {
            repPhase = 'lowering';
        }

        // Mostrar dicas se a forma estiver correta e sem erros recentes
        if (isUserFormCorrect && !formFeedbackContainerEl.classList.contains('visible') && (now - lastFeedbackTime > tipThrottleMillis)) {
            if (repPhase === 'up') {
                showFormFeedback("Suba até a linha guia.", "tip");
                lastFeedbackTime = now; // Atualiza tempo para não repetir dica logo
            } else if (repPhase === 'lowering') {
                showFormFeedback("Desça controladamente.", "tip");
                lastFeedbackTime = now;
            }
        }
    }

    // --- FUNÇÕES DE ANÁLISE DE GESTOS DE MÃO ---
    // function isThumbsUpGesture(landmarks) {
    //     if (!landmarks || landmarks.length === 0) return false;
        
    //     // Índices dos landmarks da mão no MediaPipe Hands
    //     const THUMB_TIP = 4;
    //     const THUMB_IP = 3;
    //     const THUMB_MCP = 2;
    //     const INDEX_FINGER_MCP = 5;
    //     const MIDDLE_FINGER_MCP = 9;
    //     const RING_FINGER_MCP = 13;
    //     const PINKY_MCP = 17;
        
    //     // Verificar se o polegar está estendido para cima
    //     const thumbTip = landmarks[THUMB_TIP];
    //     const thumbIp = landmarks[THUMB_IP];
    //     const thumbMcp = landmarks[THUMB_MCP];
        
    //     // Verificar se os outros dedos estão dobrados (usando os MCPs como referência)
    //     const indexMcp = landmarks[INDEX_FINGER_MCP];
    //     const middleMcp = landmarks[MIDDLE_FINGER_MCP];
    //     const ringMcp = landmarks[RING_FINGER_MCP];
    //     const pinkyMcp = landmarks[PINKY_MCP];
        
    //     // Calcular a direção do polegar (deve estar apontando para cima)
    //     const thumbDirection = thumbTip.y < thumbIp.y && thumbIp.y < thumbMcp.y;
        
    //     // Verificar se o polegar está mais alto que os outros dedos
    //     const thumbHighest = thumbTip.y < indexMcp.y && 
    //                         thumbTip.y < middleMcp.y && 
    //                         thumbTip.y < ringMcp.y && 
    //                         thumbTip.y < pinkyMcp.y;
        
    //     return thumbDirection && thumbHighest;
    // }

    function processHandGestures(multiHandLandmarks) {
        if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
            thumbsUpDetected = false;
            return;
        }
        
        const now = Date.now();
        
        // Verifica se alguma das mãos está fazendo o gesto de joia
        for (const landmarks of multiHandLandmarks) {
            if (isThumbsUpGesture(landmarks)) {
                // Evita múltiplas detecções em sequência
                if (now - lastThumbsUpTime > thumbsUpThrottleMillis) {
                    thumbsUpDetected = true;
                    lastThumbsUpTime = now;
                    
                    // Alterna o estado do exercício (pausa/despausa)
                    if (!isResting) {
                        initiateExerciseButton.click();
                        
                        // Mostra feedback visual do gesto detectado
                        if (!thumbsUpFeedbackShown) {
                            showFormFeedback("Gesto de joia detectado! " + 
                                            (isExerciseInProgress ? "Exercício iniciado." : "Exercício pausado."), 
                                            isExerciseInProgress ? "success" : "action-state");
                            thumbsUpFeedbackShown = true;
                            setTimeout(() => {
                                thumbsUpFeedbackShown = false;
                            }, 2000);
                        }
                    }
                    return;
                }
            }
        }
        
        // Se chegou aqui, não detectou o gesto
        thumbsUpDetected = false;
    }

    // --- FUNÇÕES DE DESENHO NO CANVAS ---
    function clearCanvas() {
        if (canvasCtx && canvasElement) {
             canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        }
    }

    // --- Callbacks onResults Atualizados ---
    function onPoseResults(results) {
        if (!canvasCtx || !canvasElement) return; // Sai se o canvas não estiver pronto

        clearCanvas();
        canvasCtx.save();

        if (useFrontCamera && videoElement.classList.contains('mirrored')) {
            canvasCtx.translate(canvasElement.width, 0);
            canvasCtx.scale(-1, 1);
        }

        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

        if (results.poseLandmarks) {
            lastUserLandmarks = results.poseLandmarks;

            // Desenha as linhas guia de altura alvo ANTES do usuário, para ficarem por baixo
            drawTargetGuideLines(results.poseLandmarks);

            // Desenha os landmarks do usuário com estilo melhorado
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, 
                          {color: 'rgba(255, 215, 0, 0.8)', lineWidth: 3});
            drawLandmarks(canvasCtx, results.poseLandmarks, 
                          {color: 'rgba(255, 215, 0, 0.9)', fillColor: 'rgba(255, 215, 0, 0.2)', 
                           lineWidth: 1, radius: 3});

            // Processa a pose para feedback e contagem se estiver em exercício
            if (isExerciseInProgress) {
                processUserPose(results.poseLandmarks);
            } else if (!isResting && !textExplanationSection.classList.contains('active')) {
                if (!formFeedbackContainerEl.classList.contains('visible')) {
                    showFormFeedback("Posicione-se e prepare-se para iniciar.", "action-state");
                }
            }

        } else {
            lastUserLandmarks = null;
            if (isExerciseInProgress) {
                showFormFeedback("Não detectamos você. Posicione-se melhor.", "error");
                isUserFormCorrect = false;
            } else if (!isResting && !textExplanationSection.classList.contains('active')) {
                 showFormFeedback("Aguardando detecção...", "action-state");
                 // Limpa guias se não detectar
                 clearCanvas();
                 canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            }
        }

        canvasCtx.restore();
        updateInitiateButtonIcon();
    }

    function onHandsResults(results) {
        // Armazena os landmarks das mãos
        lastHandLandmarks = results.multiHandLandmarks;
        
        // Processa gestos se não estiver em descanso
        if (!isResting && results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            processHandGestures(results.multiHandLandmarks);
        }
        
        // Não precisamos desenhar os landmarks das mãos, apenas detectar o gesto
    }

    // --- FUNÇÕES DE CONTROLE DO TREINO (Atualizações) ---
    function updateInitiateButtonIcon() {
        const icon = initiateExerciseButton.querySelector('i');
        if (!icon) return;
        icon.className = 'fas'; // Reseta classes do ícone

        if (isExerciseInProgress) {
            icon.classList.add('fa-pause');
            initiateExerciseButton.setAttribute('aria-label', 'Pausar Exercício');
        } else if (isResting) {
             icon.classList.add('fa-forward'); // Ícone para pular descanso
             initiateExerciseButton.setAttribute('aria-label', 'Pular Descanso');
        } else {
            icon.classList.add('fa-play');
            initiateExerciseButton.setAttribute('aria-label', 'Iniciar Exercício');
        }
    }

    function completeSet() {
        isExerciseInProgress = false;
        speakSimpleFeedback(`Série ${currentSet} completa! Descansando.`);
        setCompleteMessageEl.classList.add('visible');
        currentSet++;
        updateWorkoutDisplay();

        if (currentSet <= totalSets) {
            startRestTimer();
        } else {
            completeWorkout();
        }
        updateInitiateButtonIcon();
    }

    function completeWorkout() {
        isExerciseInProgress = false;
        isResting = false;
        speakSimpleFeedback("Treino completo! Parabéns!");
        workoutCompleteMessageEl.classList.add('visible');
        setCompleteMessageEl.classList.remove('visible');
        updateWorkoutDisplay();
        updateInitiateButtonIcon();
    }

    function startRestTimer() {
        isResting = true;
        currentRestTimeLeft = restDurationSeconds;
        restTimerDisplayEl.classList.add('visible');
        videoElement.classList.add('resting-blur'); // Aplica blur SÓ ao vídeo
        updateRestTimerDisplay();

        restTimerIntervalId = setInterval(() => {
            currentRestTimeLeft--;
            updateRestTimerDisplay();
            if (currentRestTimeLeft <= 0) {
                skipRest();
            }
        }, 1000);
        updateInitiateButtonIcon();
    }

    function skipRest() {
        if (restTimerIntervalId) {
            clearInterval(restTimerIntervalId);
            restTimerIntervalId = null;
        }
        isResting = false;
        restTimerDisplayEl.classList.remove('visible');
        videoElement.classList.remove('resting-blur'); // Remove blur do vídeo
        setCompleteMessageEl.classList.remove('visible');

        if (currentSet <= totalSets) {
            resetCurrentSetProgress();
            speakSimpleFeedback(`Prepare-se para a série ${currentSet}.`);
            isExerciseInProgress = false; // Espera o play
        } else {
            completeWorkout();
        }
        updateWorkoutDisplay();
        updateInitiateButtonIcon();
    }

    function updateRestTimerDisplay() {
        const minutes = Math.floor(currentRestTimeLeft / 60).toString().padStart(2, '0');
        const seconds = (currentRestTimeLeft % 60).toString().padStart(2, '0');
        restTimeValueEl.textContent = `${minutes}:${seconds}`;
    }

    // --- FUNÇÕES DE FEEDBACK SONORO (Simplificado) ---
    function speakSimpleFeedback(text) {
        try {
            if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
                 window.speechSynthesis.cancel(); // Cancela fala anterior se estiver falando
            }
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'pt-BR';
                utterance.rate = 1.1;
                window.speechSynthesis.speak(utterance);
            } else {
                console.warn("API de Síntese de Voz não suportada.");
            }
        } catch (error) {
            console.error("Erro ao tentar usar a síntese de voz:", error);
        }
    }

    // --- INICIALIZAÇÃO ---
    function updateWorkoutDisplay() {
        currentSetDisplayEl.textContent = Math.min(currentSet, totalSets);
        totalSetsDisplayEl.textContent = totalSets;
        validRepsCounterEl.textContent = validReps;
        repsPerSetDisplayEl.textContent = repsPerSet;

        initiateExerciseButton.disabled = false;

        if (currentSet > totalSets && !isExerciseInProgress && !isResting) {
            workoutCompleteMessageEl.classList.add('visible');
            setCompleteMessageEl.classList.remove('visible');
            showFormFeedback("Treino Concluído!", "success");
        } else if (validReps >= repsPerSet && !isResting && !isExerciseInProgress) {
            setCompleteMessageEl.classList.add('visible');
             // Feedback já foi dado em completeSet
        } else {
            setCompleteMessageEl.classList.remove('visible');
            workoutCompleteMessageEl.classList.remove('visible');
        }

        // Atualiza feedback de estado geral (se não houver erro/dica ativa)
        if (!formFeedbackContainerEl.classList.contains('visible') || formFeedbackMessageEl.classList.contains('action-state') || formFeedbackMessageEl.classList.contains('tip')) {
             if (isResting) {
                 showFormFeedback(`Descansando... Próxima série: ${currentSet}`, "action-state");
             } else if (!isExerciseInProgress && currentSet <= totalSets && validReps === 0) {
                 showFormFeedback(`Pronto para Série ${currentSet}. Clique em Iniciar ou faça um gesto de joia 👍`, "action-state");
             } else if (!isExerciseInProgress && currentSet <= totalSets && validReps > 0) {
                 showFormFeedback(`Série ${currentSet} pausada. ${validReps}/${repsPerSet} reps.`, "action-state");
             } else if (isExerciseInProgress) {
                 // Limpa o feedback de estado se o exercício está ativo e sem erros/dicas
                 if (!formFeedbackContainerEl.classList.contains('visible')) {
                      // Não mostra nada, espera dica ou erro
                 } else if (formFeedbackMessageEl.classList.contains('action-state')) {
                      hideFormFeedback();
                 }
             } else if (currentSet > totalSets) {
                 showFormFeedback("Treino Concluído!", "success");
             }
        }
    }

    // Inicializa a aplicação mostrando a explicação
    switchToPhase('explanation');
    updateWorkoutDisplay();

}); // Fim do DOMContentLoaded
