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
    const setCompleteMessageEl = document.getElementById('setCompleteMessage');
    const workoutCompleteMessageEl = document.getElementById('workoutCompleteMessage');
    const restTimerDisplayEl = document.getElementById('restTimerDisplay');
    const restTimeValueEl = document.getElementById('restTimeValue');

    // NOVO: Referências para feedback de forma
    const formFeedbackContainerEl = document.getElementById('formFeedbackContainer');
    const formFeedbackMessageEl = document.getElementById('formFeedbackMessage');


    let currentStream;
    let useFrontCamera = true;
    let guideLinesAnimationId;
    let isExerciseInProgress = false;
    let isResting = false;
    let restTimerIntervalId = null;

    let currentSet = 1;
    const totalSets = 4;
    let validReps = 0;
    const repsPerSet = 10;
    const restDurationSeconds = 60; // 1 minuto
    let currentRestTimeLeft = 0;

    let guideArmAngle = 0;
    const maxArmAngle = Math.PI / 2.1;
    const animationSpeed = 0.025;
    let guideAnimationPhase = 'lifting';
    let holdTimer = 0;
    const peakHoldDuration = 25;
    const restHoldDuration = 15;

    let torsoTopY, torsoBottomY, torsoX, shoulderOffsetY, armLength;

    // --- Novas Configurações para Feedback ---
    let lastFeedbackTime = 0;
    const feedbackThrottleMillis = 2500; // Não dar feedback mais rápido que X ms


    function switchToPhase(phaseName) {
        textExplanationSection.classList.remove('active');
        cameraMonitoringSection.classList.remove('active');
        hideFormFeedback(); // Esconde feedback ao trocar de fase

        if (phaseName === 'explanation') {
            textExplanationSection.classList.add('active');
            stopGuideAnimationAndRest();
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
                currentStream = null;
                videoElement.srcObject = null;
            }
            resetWorkoutState();
            updateWorkoutDisplay();
            initiateExerciseButton.innerHTML = '<i class="fas fa-play"></i> Iniciar Série';
            speakSimpleFeedback("Instruções para elevação lateral. Leia com atenção e clique em 'Entendi' para iniciar.");

        } else if (phaseName === 'monitoring') {
            cameraMonitoringSection.classList.add('active');
            if (!currentStream || !currentStream.active) {
                setupCamera();
            } else {
                if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                    canvasElement.width = videoElement.videoWidth;
                    canvasElement.height = videoElement.videoHeight;
                    setGuideLineProportions();
                    drawStaticGuide();
                } else {
                    setupCamera();
                }
            }
            if(!isResting) {
                resetCurrentSetProgress(); // Garante que repetições sejam zeradas se voltarmos
                updateWorkoutDisplay();
                // Pode ser muito verboso falar isso toda vez que volta para a tela
                // showFormFeedback("Posicione-se em frente à câmera. A guia mostrará o movimento.", "tip");
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
            video: { facingMode: useFrontCamera ? 'user' : 'environment', width: { ideal: 360 }, height: { ideal: 480 }},
            audio: false
        };
        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = currentStream;
            videoElement.onloadedmetadata = () => {
                if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                    canvasElement.width = videoElement.videoWidth;
                    canvasElement.height = videoElement.videoHeight;
                    setGuideLineProportions(); 
                    drawStaticGuide();            
                    cameraLoadingIndicator.style.display = 'none';
                } else { cameraLoadingIndicator.textContent = 'Erro: Câmera s/ dimensões.'; }
            };
            videoElement.onerror = () => { cameraLoadingIndicator.textContent = 'Erro ao carregar vídeo.'; currentStream = null; };
        } catch (error) { cameraLoadingIndicator.textContent = `Erro: ${error.name}`; currentStream = null;}
    }
    function setGuideLineProportions() {
        if (!canvasElement.width || !canvasElement.height) return;
        const canvasH = canvasElement.height; const canvasW = canvasElement.width;
        torsoTopY = canvasH * 0.25; torsoBottomY = canvasH * 0.60; torsoX = canvasW / 2;
        shoulderOffsetY = canvasH * 0.05; armLength = canvasH * 0.28;
    }

    toggleUserCameraBtn.addEventListener('click', () => {
        if (isExerciseInProgress || isResting) {
            // Pausa o exercício ou para o descanso antes de trocar a câmera
            if (isExerciseInProgress) initiateExerciseButton.click(); // Simula clique para pausar
            if (isResting) skipRest(); // Pula o descanso
        }
        useFrontCamera = !useFrontCamera;
        if (cameraMonitoringSection.classList.contains('active')) setupCamera();
    });

    initiateExerciseButton.addEventListener('click', () => {
        if (!currentStream || !currentStream.active || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
            alert("Aguarde a câmera carregar ou verifique as permissões.");
            if (!currentStream || !currentStream.active) setupCamera();
            return;
        }

        if (isResting) {
            skipRest();
            return;
        }

        if (currentSet > totalSets) {
            resetWorkoutState();
            updateWorkoutDisplay();
            isExerciseInProgress = true; // Inicia diretamente
            initiateExerciseButton.innerHTML = '<i class="fas fa-pause"></i> Pausar';
            speakSimpleFeedback(`Reiniciando treino. Série ${currentSet}. ${repsPerSet} repetições.`);
            showFormFeedback("Mantenha o movimento suave e controlado.", "tip");
            startGuideAnimation();
            return;
        }
        
        isExerciseInProgress = !isExerciseInProgress;

        if (isExerciseInProgress) {
            initiateExerciseButton.innerHTML = '<i class="fas fa-pause"></i> Pausar';
            setCompleteMessageEl.classList.remove('visible');
            workoutCompleteMessageEl.classList.remove('visible');
            speakSimpleFeedback(`Iniciando série ${currentSet}. ${repsPerSet} repetições.`);
            showFormFeedback("Mantenha o movimento suave e controlado.", "tip");
            startGuideAnimation();
        } else { // Pausou
            initiateExerciseButton.innerHTML = '<i class="fas fa-play"></i> Continuar';
            speakSimpleFeedback("Exercício pausado.");
            hideFormFeedback(); // Limpa feedback ao pausar
            stopGuideAnimation();
        }
    });

    function resetWorkoutState() {
        currentSet = 1;
        resetCurrentSetProgress(); 
        workoutCompleteMessageEl.classList.remove('visible');
        // hideFormFeedback(); // Já chamado em resetCurrentSetProgress
    }

    function resetCurrentSetProgress(){
        validReps = 0;
        isExerciseInProgress = false; 
        guideArmAngle = 0;
        guideAnimationPhase = 'lifting';
        holdTimer = 0;
        stopGuideAnimationAndRest(); 
        
        if (canvasElement.width > 0 && canvasElement.height > 0) {
            setGuideLineProportions();
            drawStaticGuide();
        }
        hideFormFeedback(); // Limpa feedback de forma no reset da série
        updateWorkoutDisplay();
    }
    
    function drawStaticGuide() {
        if (!canvasElement.width || !canvasElement.height || !torsoX) return;
        clearCanvas(); canvasCtx.save();
        if (useFrontCamera && videoElement.classList.contains('mirrored')) {
            canvasCtx.translate(canvasElement.width, 0); canvasCtx.scale(-1, 1);
        }
        drawGuideFigure(0, true);
        canvasCtx.restore();
    }

    function startGuideAnimation() {
         if (!guideLinesAnimationId && isExerciseInProgress) {
            guideLinesAnimationId = requestAnimationFrame(animateGuideLines);
        }
    }
    function stopGuideAnimation() {
        if (guideLinesAnimationId) {
            cancelAnimationFrame(guideLinesAnimationId);
            guideLinesAnimationId = null;
        }
    }
    function stopGuideAnimationAndRest(){
        stopGuideAnimation();
        if(restTimerIntervalId){
            clearInterval(restTimerIntervalId);
            restTimerIntervalId = null;
        }
        isResting = false;
        restTimerDisplayEl.classList.remove('visible');
    }

    // --- Funções de Feedback de Forma ---
    function showFormFeedback(message, type = 'info') { // type pode ser 'info', 'tip', 'error', 'success'
        if (!formFeedbackMessageEl || !formFeedbackContainerEl) return;
        formFeedbackMessageEl.textContent = message;
        formFeedbackMessageEl.className = 'feedback-message'; // Reseta classes
        if (type) {
            formFeedbackMessageEl.classList.add(type);
        }
        formFeedbackContainerEl.classList.add('visible'); // Usa classe para animar se quiser
    }

    function hideFormFeedback() {
        if (!formFeedbackMessageEl || !formFeedbackContainerEl) return;
        formFeedbackMessageEl.textContent = '';
        formFeedbackContainerEl.classList.remove('visible');
    }

    // --- PONTO CRÍTICO: Detecção de Pose e Comparação (SIMULADO) ---
    function analyzeUserPoseAndGiveFeedback() {
        // ESTA FUNÇÃO É UM PLACEHOLDER.
        // AQUI VOCÊ INTEGRARIA UMA BIBLIOTECA DE DETECÇÃO DE POSE (Ex: MediaPipe Pose, TensorFlow.js PoseNet/MoveNet)
        // 1. Obter os keypoints da pose do usuário a partir do videoElement.
        // 2. Comparar os ângulos relevantes (ombros, cotovelos) com a `guideArmAngle`.
        // 3. Determinar se o movimento está correto, muito rápido, incompleto, etc.

        const currentTime = Date.now();
        if (currentTime - lastFeedbackTime < feedbackThrottleMillis) {
            return; // Não sobrecarregar o usuário com feedback
        }

        if (isExerciseInProgress && validReps < repsPerSet) {
            // Simulação de erros comuns:
            if (Math.random() < 0.08) { // 8% de chance de um erro simulado por frame (ajustar)
                const errors = [
                    { msg: "Eleve mais os braços, até a altura dos ombros.", tip: "Mantenha os cotovelos levemente flexionados." },
                    { msg: "Controle a descida, não deixe os braços caírem.", tip: "Sinta o músculo trabalhando na volta." },
                    { msg: "Evite usar impulso com o corpo.", tip: "Concentre a força nos ombros." },
                    { msg: "Pescoço relaxado, olhe para frente.", tip: "A postura é fundamental."}
                ];
                const randomError = errors[Math.floor(Math.random() * errors.length)];
                showFormFeedback(randomError.msg, "error");
                speakSimpleFeedback(randomError.msg);
                lastFeedbackTime = currentTime;
            } else if (Math.random() < 0.05) { // 5% chance de uma dica geral
                 showFormFeedback("Mantenha o abdômen contraído!", "tip");
                 // speakSimpleFeedback("Lembre-se do abdômen!"); // Pode ser muito verboso
                 lastFeedbackTime = currentTime;
            }
            // Se não houver erro "detectado", poderia limpar o feedback ou mostrar "Bom movimento!"
            // else if (formFeedbackContainerEl.classList.contains('visible') && !formFeedbackMessageEl.classList.contains('success')) {
            //     // Limpa apenas se não for uma mensagem de sucesso de série anterior
            //      hideFormFeedback();
            // }
        }
    }

    function animateGuideLines() {
        if (!isExerciseInProgress || !canvasElement.width || !canvasElement.height || !torsoX) {
            stopGuideAnimation(); return;
        }
        clearCanvas(); canvasCtx.save();
        if (useFrontCamera && videoElement.classList.contains('mirrored')) {
            canvasCtx.translate(canvasElement.width, 0); canvasCtx.scale(-1, 1);
        }

        switch (guideAnimationPhase) {
            case 'lifting':
                guideArmAngle += animationSpeed;
                if (guideArmAngle >= maxArmAngle) { guideArmAngle = maxArmAngle; guideAnimationPhase = 'peak_hold'; holdTimer = 0; }
                break;
            case 'peak_hold':
                holdTimer++;
                if (holdTimer >= peakHoldDuration) guideAnimationPhase = 'lowering';
                break;
            case 'lowering':
                guideArmAngle -= animationSpeed;
                if (guideArmAngle <= 0) {
                    guideArmAngle = 0; guideAnimationPhase = 'rest_hold'; holdTimer = 0;
                    if (isExerciseInProgress && validReps < repsPerSet) {
                        validReps++;
                        updateWorkoutDisplay();
                        // Poderia ter um feedback sonoro sutil por repetição válida aqui, se desejado.
                        // speakSimpleFeedback(`${validReps}`); // Ex: Contar repetições em voz alta
                    }
                }
                break;
            case 'rest_hold':
                holdTimer++;
                if (holdTimer >= restHoldDuration) {
                    if (validReps >= repsPerSet) {
                        handleSetCompletion();
                        canvasCtx.restore();
                        return;
                    }
                    guideAnimationPhase = 'lifting';
                }
                break;
        }
        drawGuideFigure(guideArmAngle, false);
        canvasCtx.restore();

        // *** CHAMADA PARA ANÁLISE DE POSE (SIMULADA) ***
        analyzeUserPoseAndGiveFeedback();

        if (isExerciseInProgress) guideLinesAnimationId = requestAnimationFrame(animateGuideLines);
    }

    function drawGuideFigure(currentAngle, isStatic) {
        if (!canvasElement.width || !canvasElement.height || !torsoX) return;
        const shoulderY = torsoTopY + shoulderOffsetY;
        const headRadius = canvasElement.height * 0.04;

        canvasCtx.strokeStyle = 'var(--line-guide-color)';
        canvasCtx.fillStyle = 'var(--line-guide-color)';
        canvasCtx.lineWidth = Math.max(5, canvasElement.width / 60);
        canvasCtx.lineCap = 'round';

        canvasCtx.beginPath(); canvasCtx.moveTo(torsoX, torsoTopY); canvasCtx.lineTo(torsoX, torsoBottomY); canvasCtx.stroke();
        canvasCtx.beginPath(); canvasCtx.arc(torsoX, torsoTopY - headRadius * 0.7, headRadius, 0, Math.PI * 2); canvasCtx.fill();

        const leftArmEndX = torsoX - Math.sin(currentAngle) * armLength;
        const leftArmEndY = shoulderY + Math.cos(currentAngle) * armLength;
        const rightArmEndX = torsoX + Math.sin(currentAngle) * armLength;
        const rightArmEndY = shoulderY + Math.cos(currentAngle) * armLength;

        canvasCtx.beginPath(); canvasCtx.moveTo(torsoX, shoulderY); canvasCtx.lineTo(leftArmEndX, leftArmEndY); canvasCtx.stroke();
        canvasCtx.beginPath(); canvasCtx.moveTo(torsoX, shoulderY); canvasCtx.lineTo(rightArmEndX, rightArmEndY); canvasCtx.stroke();

        canvasCtx.fillStyle = 'var(--line-dumbbell-color)';
        const dW = Math.max(8, canvasElement.width / 30);
        const dH = Math.max(12, canvasElement.width / 22);

        canvasCtx.save();
        canvasCtx.translate(leftArmEndX, leftArmEndY);
        canvasCtx.rotate(-currentAngle);
        canvasCtx.fillRect(-dW / 2, -dH / 2, dW, dH);
        canvasCtx.restore();

        canvasCtx.save();
        canvasCtx.translate(rightArmEndX, rightArmEndY);
        canvasCtx.rotate(currentAngle);
        canvasCtx.fillRect(-dW / 2, -dH / 2, dW, dH);
        canvasCtx.restore();
    }
    
    function handleSetCompletion(){
        isExerciseInProgress = false;
        stopGuideAnimation();
        setCompleteMessageEl.classList.add('visible');
        
        const successMessages = [
            `Série ${currentSet} completa! Ótimo trabalho!`,
            `Excelente! Série ${currentSet} finalizada com boa forma!`,
            `Muito bem! Série ${currentSet} concluída.`
        ];
        const randomSuccessMsg = successMessages[Math.floor(Math.random() * successMessages.length)];
        showFormFeedback(randomSuccessMsg, "success"); // Mostra no container de feedback
        speakSimpleFeedback(randomSuccessMsg);


        if (currentSet < totalSets) {
            isResting = true;
            startRestTimer();
            initiateExerciseButton.innerHTML = `<i class="fas fa-forward"></i> Pular Descanso (${formatTime(restDurationSeconds)})`;
        } else {
            workoutCompleteMessageEl.classList.add('visible');
            const finalMsg = "Treino finalizado! Você mandou muito bem! Descanse e hidrate-se.";
            // showFormFeedback(finalMsg, "success"); // O anterior já é bom, este pode ser redundante
            speakSimpleFeedback(finalMsg);
            initiateExerciseButton.innerHTML = '<i class="fas fa-redo"></i> Refazer Treino';
            currentSet++;
        }
        updateWorkoutDisplay();
    }

    function startRestTimer(){
        currentRestTimeLeft = restDurationSeconds;
        restTimerDisplayEl.classList.add('visible');
        updateRestTimerDisplay();
        speakSimpleFeedback(`Descanso de ${restDurationSeconds} segundos.`);
        showFormFeedback(`Tempo de descanso. Próxima série: ${currentSet + 1}.`, "tip");


        restTimerIntervalId = setInterval(() => {
            currentRestTimeLeft--;
            updateRestTimerDisplay();
            initiateExerciseButton.innerHTML = `<i class="fas fa-forward"></i> Pular (${formatTime(currentRestTimeLeft)})`;

            if (currentRestTimeLeft <= 0) {
                skipRest();
            }
        }, 1000);
    }

    function skipRest(){
        if(restTimerIntervalId) clearInterval(restTimerIntervalId);
        restTimerIntervalId = null;
        
        if (isResting) { // Só fala e muda feedback se estava realmente descansando
            speakSimpleFeedback("Descanso pulado.");
        }
        isResting = false;
        restTimerDisplayEl.classList.remove('visible');
        setCompleteMessageEl.classList.remove('visible');

        currentSet++;
        if (currentSet <= totalSets) {
            resetCurrentSetProgress();
            initiateExerciseButton.innerHTML = `<i class="fas fa-play"></i> Iniciar Série (${currentSet}/${totalSets})`;
            showFormFeedback("Prepare-se para a próxima série!", "tip");
        } else {
             workoutCompleteMessageEl.classList.add('visible');
             initiateExerciseButton.innerHTML = '<i class="fas fa-redo"></i> Refazer Treino';
             // A mensagem de treino completo já foi dada em handleSetCompletion
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
        
        if(isResting){
             initiateExerciseButton.innerHTML = `<i class="fas fa-forward"></i> Pular (${formatTime(currentRestTimeLeft)})`;
        } else if (currentSet > totalSets){
             initiateExerciseButton.innerHTML = '<i class="fas fa-redo"></i> Refazer Treino';
        } else if (isExerciseInProgress){
            initiateExerciseButton.innerHTML = '<i class="fas fa-pause"></i> Pausar';
        }
        else {
            initiateExerciseButton.innerHTML = `<i class="fas fa-play"></i> Iniciar Série (${currentSet}/${totalSets})`;
        }
    }

    function clearCanvas() { canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); }
    function speakSimpleFeedback(message) { 
         try {
            if ('speechSynthesis' in window && window.speechSynthesis) {
                window.speechSynthesis.cancel(); // Cancela falas anteriores para não acumular
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = 'pt-BR'; utterance.rate = 1.1; // Um pouco mais rápido
                window.speechSynthesis.speak(utterance);
            }
        } catch (e) { console.error("Erro na síntese de voz:", e); }
    }
    
    switchToPhase('explanation');
});