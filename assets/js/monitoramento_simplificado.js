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
    const totalSetsDisplayEl = document.getElementById('totalSetsDisplay'); // Adicionado
    const repsPerSetDisplayEl = document.getElementById('repsPerSetDisplay'); // Adicionado
    const setCompleteMessageEl = document.getElementById('setCompleteMessage');
    const workoutCompleteMessageEl = document.getElementById('workoutCompleteMessage');
    const restTimerDisplayEl = document.getElementById('restTimerDisplay');
    const restTimeValueEl = document.getElementById('restTimeValue');

    const formFeedbackContainerEl = document.getElementById('formFeedbackContainer');
    const formFeedbackMessageEl = document.getElementById('formFeedbackMessage');
    const correctRepFeedbackEl = document.getElementById('correctRepFeedback');

    let currentStream;
    let useFrontCamera = true;
    let animationFrameId; 
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
    let camera; // O objeto Camera do MediaPipe
    let lastUserLandmarks = null; // Últimos pontos de referência detectados do usuário

    // Parâmetros para detecção de pose (Elevação Lateral)
    const MIN_ARM_ANGLE_RAD = 10 * Math.PI / 180; // Braço baixo (quase reto para baixo)
    const MAX_ARM_ANGLE_RAD = 90 * Math.PI / 180; // Braço na altura do ombro (90 graus com o corpo)
    const FLEXION_TOLERANCE_DEG = 20; // Tolerância para flexão do cotovelo (em graus)
    const REPETITION_THRESHOLD_LIFT = MAX_ARM_ANGLE_RAD * 0.9; // 90% da altura máxima para considerar "pico"
    const REPETITION_THRESHOLD_LOWER = MIN_ARM_ANGLE_RAD * 1.5; // 150% do ângulo mínimo para considerar "base"

    // Variáveis de estado da repetição
    let repPhase = 'down'; // 'down' (braços abaixados), 'up' (levantando), 'peak' (no topo), 'lowering' (abaixando)
    let repCountedForThisCycle = false; // Garante que a repetição seja contada uma vez por ciclo completo
    let isUserFormCorrect = true; // Feedback de forma geral
    let lastFeedbackTime = 0;
    const feedbackThrottleMillis = 2500; // Tempo mínimo entre feedbacks de erro de voz


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
            if (pose) { // Limpa o MediaPipe
                pose.close();
                pose = null;
            }
            if (camera) {
                camera.stop();
                camera = null;
            }
            resetWorkoutState(); 
            speakSimpleFeedback("Instruções para elevação lateral. Mantenha a forma correta seguindo o boneco guia.");

        } else if (phaseName === 'monitoring') {
            cameraMonitoringSection.classList.add('active');
            cameraMonitoringSection.classList.remove('resting-blur');
            videoElement.classList.remove('resting-blur');

            if (!pose) { // Inicializa MediaPipe Pose
                initializePoseDetection();
            }
            if (!currentStream || !currentStream.active) {
                setupCamera();
            } else {
                if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                    videoWidth = videoElement.videoWidth;
                    videoHeight = videoElement.videoHeight;
                    canvasElement.width = videoWidth;
                    canvasElement.height = videoHeight;
                    // O desenho agora depende dos landmarks, que virão do MediaPipe
                } else {
                    setupCamera();
                }
            }
            if(!isResting) { 
                resetCurrentSetProgress();
            } else { 
                updateWorkoutDisplay();
            }
        }
    }

    startCameraButton.addEventListener('click', () => switchToPhase('monitoring'));
    showExplanationAgainButton.addEventListener('click', () => switchToPhase('explanation'));

    async function setupCamera() { 
        cameraLoadingIndicator.style.display = 'flex';
        cameraLoadingIndicator.textContent = 'Carregando Câmera...';

        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        videoElement.classList.toggle('mirrored', useFrontCamera);

        const constraints = {
            video: { facingMode: useFrontCamera ? 'user' : 'environment', width: { ideal: 640 }, height: { ideal: 480 }},
            audio: false
        };
        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = currentStream;
            videoElement.onloadedmetadata = () => {
                videoWidth = videoElement.videoWidth;
                videoHeight = videoElement.videoHeight;
                canvasElement.width = videoWidth;
                canvasElement.height = videoHeight;
                cameraLoadingIndicator.style.display = 'none';

                if (camera) camera.start(); // Reinicia o MediaPipe Camera
                else initializePoseDetection(); // Inicializa se não estiver
            };
            videoElement.onerror = (e) => { cameraLoadingIndicator.textContent = `Erro: ${e.name}`; currentStream = null; };
        } catch (error) { cameraLoadingIndicator.textContent = `Erro: ${error.name}`; currentStream = null;}
    }

    // --- FUNÇÕES DE CONTROLE DO TREINO ---
    toggleUserCameraBtn.addEventListener('click', () => {
        if (isExerciseInProgress || isResting) {
            if (isExerciseInProgress) initiateExerciseButton.click(); 
            if (isResting) skipRest(); 
        }
        useFrontCamera = !useFrontCamera;
        if (cameraMonitoringSection.classList.contains('active')) setupCamera();
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
            isExerciseInProgress = true;
            speakSimpleFeedback(`Reiniciando treino. Série ${currentSet}. ${repsPerSet} repetições.`);
            return; // A animação será iniciada pelo MediaPipe callbacks
        }
        
        isExerciseInProgress = !isExerciseInProgress;

        if (isExerciseInProgress) {
            setCompleteMessageEl.classList.remove('visible');
            workoutCompleteMessageEl.classList.remove('visible');
            speakSimpleFeedback(`Iniciando série ${currentSet}. ${repsPerSet} repetições.`);
        } else { // Pausou
            speakSimpleFeedback("Exercício pausado.");
            hideFormFeedback(); 
        }
        updateWorkoutDisplay(); 
    });

    function resetWorkoutState() { 
        currentSet = 1;
        resetCurrentSetProgress();
        workoutCompleteMessageEl.classList.remove('visible');
    }

    function resetCurrentSetProgress(){ 
        validReps = 0;
        isExerciseInProgress = false; 
        repPhase = 'down'; // Reseta a fase da repetição
        repCountedForThisCycle = false;
        isUserFormCorrect = true; 
        lastFeedbackTime = 0;

        stopAnimationAndRest(); 
        clearCanvas(); // Limpa o canvas

        hideFormFeedback();
        correctRepFeedbackEl.classList.remove('visible');
        updateWorkoutDisplay(); 
    }
    
    function stopAnimationAndRest(){
        // Não precisamos de animationFrameId para o MediaPipe loop
        // O loop do MediaPipe para quando a câmera é parada ou o pose.close() é chamado.
        if(restTimerIntervalId){
            clearInterval(restTimerIntervalId);
            restTimerIntervalId = null;
        }
        isResting = false;
        restTimerDisplayEl.classList.remove('visible');
        cameraMonitoringSection.classList.remove('resting-blur');
        videoElement.classList.remove('resting-blur');
    }

    function showFormFeedback(message, type = 'info') {
        if (!formFeedbackMessageEl || !formFeedbackContainerEl) return;
        formFeedbackMessageEl.textContent = message;
        formFeedbackMessageEl.className = 'feedback-message';
        if (type) {
            formFeedbackMessageEl.classList.add(type);
        }
        formFeedbackContainerEl.classList.add('visible');
    }

    function hideFormFeedback() {
        if (!formFeedbackMessageEl || !formFeedbackContainerEl) return;
        formFeedbackContainerEl.classList.remove('visible');
        setTimeout(() => {
            if (!formFeedbackContainerEl.classList.contains('visible')) {
                 formFeedbackMessageEl.textContent = '';
            }
        }, 300);
    }

    function showCorrectRepAnimation() {
        correctRepFeedbackEl.classList.add('visible');
        speakSimpleFeedback("Boa!");
        setTimeout(() => {
            correctRepFeedbackEl.classList.remove('visible');
        }, 700);
    }

    // --- LÓGICA DE DETECÇÃO DE POSE (MediaPipe) ---
    function initializePoseDetection() {
        pose = new Pose({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }});

        pose.setOptions({
            modelComplexity: 1, // 0, 1, ou 2 (quanto maior, mais preciso, mas mais lento)
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        pose.onResults(onResults);

        // Se a câmera já estiver ligada, inicie o feed para o MediaPipe
        if (currentStream && currentStream.active) {
            startCameraFeed();
        }
    }

    function startCameraFeed() {
        if (camera) camera.stop(); // Garante que uma câmera antiga não esteja rodando

        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                    await pose.send({image: videoElement});
                }
            },
            width: videoWidth,
            height: videoHeight
        });
        camera.start();
    }

    // Callback quando o MediaPipe encontra resultados de pose
    function onResults(results) {
        if (!isExerciseInProgress && !isResting) { // Se não estiver treinando, só mostra o vídeo com o boneco estático
            clearCanvas();
            canvasCtx.save();
            if (useFrontCamera && videoElement.classList.contains('mirrored')) {
                canvasCtx.translate(canvasElement.width, 0);
                canvasCtx.scale(-1, 1);
            }
            canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            
            // Desenha os landmarks detectados mesmo fora do treino para o usuário se posicionar
            if (results.poseLandmarks) {
                 drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                                {color: '#00FF00', lineWidth: 4});
                 drawLandmarks(canvasCtx, results.poseLandmarks,
                                {color: '#FF0000', lineWidth: 2});
            }
            canvasCtx.restore();
            // Mostra o boneco guia na posição inicial para o usuário entender
            drawGuideFigure(MIN_ARM_ANGLE_RAD, true); 
            return;
        }

        clearCanvas();
        canvasCtx.save();
        if (useFrontCamera && videoElement.classList.contains('mirrored')) {
            canvasCtx.translate(canvasElement.width, 0);
            canvasCtx.scale(-1, 1);
        }
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

        if (results.poseLandmarks) {
            lastUserLandmarks = results.poseLandmarks; // Armazena os landmarks

            // Desenha os landmarks do usuário para visualização
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                           {color: 'var(--line-user-correct-color)', lineWidth: 4});
            drawLandmarks(canvasCtx, results.poseLandmarks,
                          {color: 'var(--line-user-incorrect-color)', lineWidth: 2});

            // Lógica principal de análise de pose e contagem de repetições
            processUserPose(results.poseLandmarks);
        } else {
            lastUserLandmarks = null;
            showFormFeedback("Não detectamos você. Posicione-se melhor na frente da câmera.", "tip");
            isUserFormCorrect = false; // Não há pose, então a forma não está correta
        }

        canvasCtx.restore();
    }

    // --- FUNÇÕES DE ANÁLISE DE POSE ---
    function getAngle(p1, p2, p3) {
        // Retorna o ângulo em radianos entre 3 pontos (p2 é o vértice)
        const angle = Math.atan2(p3.y - p2.y, p3.x - p2.x) - 
                      Math.atan2(p1.y - p2.y, p1.x - p2.x);
        return Math.abs(angle); // Ângulo absoluto
    }

    function processUserPose(landmarks) {
        if (!landmarks[POSE_LANDMARKS.LEFT_SHOULDER] ||
            !landmarks[POSE_LANDMARKS.LEFT_ELBOW] ||
            !landmarks[POSE_LANDMARKS.LEFT_WRIST] ||
            !landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] ||
            !landmarks[POSE_LANDMARKS.RIGHT_ELBOW] ||
            !landmarks[POSE_LANDMARKS.RIGHT_WRIST]) {
            showFormFeedback("Certifique-se de que seus ombros, cotovelos e pulsos estejam visíveis.", "tip");
            isUserFormCorrect = false;
            return;
        }

        // Calcula o ângulo do ombro (simulando a elevação lateral)
        // Usamos o ângulo entre o quadril, ombro e cotovelo para inferir a elevação lateral.
        // Ou, mais diretamente, o ângulo entre o ombro, o cotovelo e um ponto abaixo do ombro (vertical).
        
        // Para elevação lateral, queremos o ângulo entre o ombro, o cotovelo e um ponto vertical abaixo do ombro.
        // Ou, o ângulo entre o ombro, o cotovelo e o pulso para verificar a flexão do cotovelo.
        // E o ângulo geral do braço em relação ao tronco.

        const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
        const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
        const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
        const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
        const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
        const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

        // Calcular o ângulo do braço em relação ao tronco (aproximado para elevação lateral)
        // Usaremos o ângulo entre quadril, ombro e cotovelo.
        const leftArmAngle = getAngle(leftHip, leftShoulder, leftElbow);
        const rightArmAngle = getAngle(rightHip, rightShoulder, rightElbow);
        
        // Queremos o braço afastando do corpo.
        // Um ângulo menor significa braço mais para baixo (perto do corpo)
        // Um ângulo maior (próximo a 90 graus) significa braço para fora (elevação lateral)
        const userCurrentArmAngle = (leftArmAngle + rightArmAngle) / 2; // Média dos dois braços
        
        // Verificar flexão do cotovelo
        const leftElbowFlexion = getAngle(leftShoulder, leftElbow, leftWrist) * 180 / Math.PI;
        const rightElbowFlexion = getAngle(rightShoulder, rightElbow, rightWrist) * 180 / Math.PI;

        const isElbowsStraightEnough = (leftElbowFlexion > (180 - FLEXION_TOLERANCE_DEG) || leftElbowFlexion < (180 + FLEXION_TOLERANCE_DEG)) &&
                                       (rightElbowFlexion > (180 - FLEXION_TOLERANCE_DEG) || rightElbowFlexion < (180 + FLEXION_TOLERANCE_DEG));

        isUserFormCorrect = true; // Assume correto no início da análise de forma

        // Feedback de forma do cotovelo
        if (!isElbowsStraightEnough) {
            showFormFeedback("Mantenha os cotovelos quase esticados!", "error");
            speakSimpleFeedback("Cotovelos muito flexionados!");
            isUserFormCorrect = false;
        }

        // Lógica de contagem de repetições e feedback de altura
        if (isExerciseInProgress) {
            // Desenha a linha guia da altura correta
            drawGuideLine(MAX_ARM_ANGLE_RAD);

            // Transição para fase de levantamento
            if (repPhase === 'down' && userCurrentArmAngle > MIN_ARM_ANGLE_RAD + (MAX_ARM_ANGLE_RAD - MIN_ARM_ANGLE_RAD) * 0.1) { // Começou a levantar
                repPhase = 'up';
                repCountedForThisCycle = false; // Reseta a contagem para este novo ciclo
                hideFormFeedback(); // Limpa feedback anterior se estava incorreto
            }

            // Atingiu o pico
            if (repPhase === 'up' && userCurrentArmAngle >= REPETITION_THRESHOLD_LIFT) {
                repPhase = 'peak';
                showFormFeedback("Mantenha no topo por um instante!", "info"); // Feedback temporário
                // Se o usuário subiu demais, também é um erro
                if (userCurrentArmAngle > MAX_ARM_ANGLE_RAD * 1.1 && (Date.now() - lastFeedbackTime > feedbackThrottleMillis)) {
                    showFormFeedback("Não suba os braços tão alto!", "error");
                    speakSimpleFeedback("Não suba os braços tão alto.");
                    lastFeedbackTime = Date.now();
                    isUserFormCorrect = false;
                }
            }

            // Descendo (a partir do pico)
            if (repPhase === 'peak' && userCurrentArmAngle < REPETITION_THRESHOLD_LIFT) {
                repPhase = 'lowering';
            }

            // Retornou à posição inicial e completa a repetição
            if (repPhase === 'lowering' && userCurrentArmAngle <= REPETITION_THRESHOLD_LOWER) {
                repPhase = 'down'; // Voltou à posição inicial
                if (!repCountedForThisCycle) { // Se a repetição ainda não foi contada neste ciclo
                    // Considera que a repetição só é válida se a forma esteve correta durante o movimento
                    if (isUserFormCorrect) { // A forma geral do movimento foi boa
                        validReps++;
                        showCorrectRepAnimation();
                        hideFormFeedback(); // Esconde feedback de erro
                    } else {
                        // Se chegou aqui e a forma não estava correta, já houve feedback de erro.
                        // Poderíamos dar um feedback de "Repetição Inválida" aqui se quisermos.
                        // showFormFeedback("Repetição inválida. Corrija sua forma!", "error");
                    }
                    repCountedForThisCycle = true; // Marca que a repetição foi contada
                }
            }

            // Feedback de altura durante o levantamento
            if (repPhase === 'up' && userCurrentArmAngle < REPETITION_THRESHOLD_LIFT && 
                (Date.now() - lastFeedbackTime > feedbackThrottleMillis)) {
                if (!isUserFormCorrect) { // Só dá feedback se já não está correto
                    showFormFeedback("Suba mais os braços!", "error");
                    speakSimpleFeedback("Suba mais os braços.");
                    lastFeedbackTime = Date.now();
                }
            }

            // Feedback de profundidade durante a descida
            if (repPhase === 'lowering' && userCurrentArmAngle > REPETITION_THRESHOLD_LOWER && 
                (Date.now() - lastFeedbackTime > feedbackThrottleMillis)) {
                if (!isUserFormCorrect) {
                    showFormFeedback("Abaixe mais os braços!", "error");
                    speakSimpleFeedback("Abaixe mais os braços.");
                    lastFeedbackTime = Date.now();
                }
            }

            // Se a forma geral estiver correta e não houver feedback ativo de erro
            if (isUserFormCorrect && formFeedbackContainerEl.classList.contains('visible') && 
                (formFeedbackMessageEl.classList.contains('error') || formFeedbackMessageEl.classList.contains('tip'))) {
                hideFormFeedback();
            }

            updateWorkoutDisplay();
            if (validReps >= repsPerSet && isExerciseInProgress) {
                handleSetCompletion();
            }
        }
    }

    // --- FUNÇÕES DE DESENHO NO CANVAS ---

    // Função auxiliar para obter coordenadas normalizadas para o canvas
    function normalizePoint(landmark) {
        return {
            x: landmark.x * canvasElement.width,
            y: landmark.y * canvasElement.height,
            z: landmark.z,
            visibility: landmark.visibility
        };
    }

    // Função para desenhar o boneco guia
    function drawGuideFigure(guideAngle, isStatic = false) {
        if (!canvasElement.width || !canvasElement.height) return;
        const canvasH = canvasElement.height;
        const canvasW = canvasElement.width;

        // Posição central do boneco guia (pode ser ajustada para lateral se necessário)
        const guideTorsoX = canvasW / 2; // Centralizado por padrão
        const guideTorsoTopY = canvasH * 0.25;
        const guideShoulderY = guideTorsoTopY + (canvasH * 0.05); // Ombro um pouco abaixo do topo do tronco
        const armLength = canvasH * 0.28;
        const headRadius = canvasH * 0.04;

        // Desenha o boneco guia em cinza
        canvasCtx.strokeStyle = 'var(--line-guide-color)';
        canvasCtx.fillStyle = 'var(--line-guide-color)';
        canvasCtx.lineWidth = Math.max(5, canvasW / 70);
        canvasCtx.lineCap = 'round';

        // Tronco e cabeça
        canvasCtx.beginPath();
        canvasCtx.moveTo(guideTorsoX, guideTorsoTopY);
        canvasCtx.lineTo(guideTorsoX, canvasH * 0.60); // Tronco até ~60% da altura do canvas
        canvasCtx.stroke();
        canvasCtx.beginPath();
        canvasCtx.arc(guideTorsoX, guideTorsoTopY - headRadius * 0.7, headRadius, 0, Math.PI * 2);
        canvasCtx.fill();

        // Braços (simulando a elevação lateral)
        // Braços estendidos horizontalmente
        const leftArmEndX = guideTorsoX - Math.sin(guideAngle) * armLength;
        const leftArmEndY = guideShoulderY + Math.cos(guideAngle) * armLength;
        const rightArmEndX = guideTorsoX + Math.sin(guideAngle) * armLength;
        const rightArmEndY = guideShoulderY + Math.cos(guideAngle) * armLength;

        canvasCtx.beginPath();
        canvasCtx.moveTo(guideTorsoX, guideShoulderY);
        canvasCtx.lineTo(leftArmEndX, leftArmEndY);
        canvasCtx.stroke();
        canvasCtx.beginPath();
        canvasCtx.moveTo(guideTorsoX, guideShoulderY);
        canvasCtx.lineTo(rightArmEndX, rightArmEndY);
        canvasCtx.stroke();

        // Desenha halteres para o guia
        canvasCtx.fillStyle = 'var(--line-dumbbell-color)';
        const dW = Math.max(7, canvasW / 35); 
        const dH = Math.max(10, canvasW / 25);
        canvasCtx.save(); canvasCtx.translate(leftArmEndX, leftArmEndY); canvasCtx.rotate(-guideAngle); canvasCtx.fillRect(-dW / 2, -dH / 2, dW, dH); canvasCtx.restore();
        canvasCtx.save(); canvasCtx.translate(rightArmEndX, rightArmEndY); canvasCtx.rotate(guideAngle); canvasCtx.fillRect(-dW / 2, -dH / 2, dW, dH); canvasCtx.restore();
    }

    // Função para desenhar a linha guia de altura no ponto ideal
    function drawGuideLine(guideAngle) {
        if (!canvasElement.width || !canvasElement.height || !lastUserLandmarks) return;
        
        const canvasH = canvasElement.height;
        const canvasW = canvasElement.width;

        // Calcule a posição Y da linha guia baseada na posição do ombro do usuário
        // Isso fará com que a linha guia se adapte ao tamanho do usuário no vídeo
        const userLeftShoulder = normalizePoint(lastUserLandmarks[POSE_LANDMARKS.LEFT_SHOULDER]);
        const userRightShoulder = normalizePoint(lastUserLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER]);
        const userShoulderY = (userLeftShoulder.y + userRightShoulder.y) / 2;
        
        // A altura da linha guia deve estar no nível do ombro (para elevação lateral)
        // Ajuste conforme necessário para o exercício. Para elevação lateral, o halter sobe até o ombro.
        const targetLineY = userShoulderY; 

        canvasCtx.strokeStyle = 'var(--line-target-height-color)';
        canvasCtx.lineWidth = 4;
        canvasCtx.setLineDash([8, 8]); // Linha tracejada
        
        // Desenha a linha horizontal que o usuário deve atingir
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, targetLineY); // Vai de um lado ao outro do canvas
        canvasCtx.lineTo(canvasW, targetLineY);
        canvasCtx.stroke();
        canvasCtx.setLineDash([]); // Reseta para outras linhas
    }

    // --- FUNÇÕES DE STATUS E FEEDBACK ---
    function handleSetCompletion(){
        isExerciseInProgress = false;
        setCompleteMessageEl.classList.add('visible');
        correctRepFeedbackEl.classList.remove('visible');
        
        const successMessages = [
            `Série ${currentSet} completa! Bom trabalho!`,
            `Excelente! Série ${currentSet} finalizada!`,
            `Muito bem! Série ${currentSet} concluída.`
        ];
        const randomSuccessMsg = successMessages[Math.floor(Math.random() * successMessages.length)];
        showFormFeedback(randomSuccessMsg, "success");
        speakSimpleFeedback(randomSuccessMsg);

        if (currentSet < totalSets) {
            isResting = true;
            startRestTimer();
        } else {
            workoutCompleteMessageEl.classList.add('visible');
            const finalMsg = "Treino finalizado! Você mandou muito bem! Descanse e hidrate-se.";
            speakSimpleFeedback(finalMsg);
            currentSet++; 
            cameraMonitoringSection.classList.add('resting-blur'); 
            videoElement.classList.add('resting-blur');
        }
        updateWorkoutDisplay(); 
    }

    function startRestTimer(){
        currentRestTimeLeft = restDurationSeconds;
        restTimerDisplayEl.classList.add('visible');
        cameraMonitoringSection.classList.add('resting-blur'); 
        videoElement.classList.add('resting-blur');
        updateRestTimerDisplay(); 
        speakSimpleFeedback(`Descanso de ${restDurationSeconds} segundos.`);

        restTimerIntervalId = setInterval(() => {
            currentRestTimeLeft--;
            updateRestTimerDisplay(); 
            updateWorkoutDisplay(); 
            if (currentRestTimeLeft <= 0) {
                skipRest();
            }
        }, 1000);
    }

    function skipRest(){
        if(restTimerIntervalId) clearInterval(restTimerIntervalId);
        restTimerIntervalId = null;
        
        if (isResting) { 
            speakSimpleFeedback("Descanso interrompido.");
        }
        isResting = false;
        restTimerDisplayEl.classList.remove('visible');
        setCompleteMessageEl.classList.remove('visible');
        hideFormFeedback();
        cameraMonitoringSection.classList.remove('resting-blur'); 
        videoElement.classList.remove('resting-blur');

        currentSet++;
        if (currentSet <= totalSets) {
            resetCurrentSetProgress(); 
        } 
        updateWorkoutDisplay(); 
    }

    function formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }
    
    function updateRestTimerDisplay(){
        restTimeValueEl.textContent = formatTime(currentRestTimeLeft);
    }

    function updateWorkoutDisplay(){
        currentSetDisplayEl.textContent = Math.min(currentSet, totalSets);
        validRepsCounterEl.textContent = validReps;
        totalSetsDisplayEl.textContent = totalSets; // Atualiza o total de séries
        repsPerSetDisplayEl.textContent = repsPerSet; // Atualiza o total de repetições por série
        
        let actionText = "";
        let iconClass = "fa-play";

        if(isResting){
            iconClass = "fa-forward";
            actionText = `Descansando. Toque para pular (${formatTime(currentRestTimeLeft)})`;
        } else if (currentSet > totalSets){
            iconClass = "fa-redo";
            actionText = "Treino completo! Toque para refazer.";
        } else if (isExerciseInProgress){
            iconClass = "fa-pause";
            actionText = `Série ${currentSet}/${totalSets} em andamento. Toque para pausar.`;
        } else { 
            iconClass = "fa-play";
            if (validReps > 0 && validReps < repsPerSet) {
                actionText = `Série ${currentSet}/${totalSets} pausada (${validReps}/${repsPerSet}). Toque para continuar.`;
            } else {
                actionText = `Toque para Iniciar Série ${currentSet}/${totalSets}.`;
            }
        }
        initiateExerciseButton.innerHTML = `<i class="fas ${iconClass}"></i>`;
        
        if (!setCompleteMessageEl.classList.contains('visible') && !workoutCompleteMessageEl.classList.contains('visible')) {
            showFormFeedback(actionText, "action-state");
        } else if (setCompleteMessageEl.classList.contains('visible') && currentSet <= totalSets && !isResting){
             showFormFeedback(`Toque para Iniciar Série ${currentSet}/${totalSets}.`, "action-state");
        }
    }

    function clearCanvas() { canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); }

    function speakSimpleFeedback(message) { 
        try {
            if ('speechSynthesis' in window && window.speechSynthesis) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = 'pt-BR'; utterance.rate = 1.15; utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        } catch (e) { console.error("Erro na síntese de voz:", e); }
    }
    
    // Inicializa o processo
    switchToPhase('explanation');
});