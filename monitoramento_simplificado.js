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

    const formFeedbackContainerEl = document.getElementById('formFeedbackContainer');
    const formFeedbackMessageEl = document.getElementById('formFeedbackMessage');
    const correctRepFeedbackEl = document.getElementById('correctRepFeedback');


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
    const restDurationSeconds = 60;
    let currentRestTimeLeft = 0;

    let guideArmAngle = 0;
    const maxArmAngle = Math.PI / 2.1; // Ângulo máximo para elevação (pouco abaixo de 90 graus)
    const animationSpeed = 0.025;
    let guideAnimationPhase = 'lifting';
    let holdTimer = 0;
    const peakHoldDuration = 25; // Frames no pico
    const restHoldDuration = 15; // Frames no descanso entre reps da guia

    let torsoTopY, torsoBottomY, torsoX, shoulderOffsetY, armLength;

    let lastFeedbackTime = 0;
    const feedbackThrottleMillis = 2200; // Evita spam de feedback
    let isCheckingRepCompletion = false; // Flag para controle da checagem de rep


    function switchToPhase(phaseName) {
        textExplanationSection.classList.remove('active');
        cameraMonitoringSection.classList.remove('active');
        hideFormFeedback();
        correctRepFeedbackEl.classList.remove('visible');

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
            speakSimpleFeedback("Instruções para elevação lateral. Observe a linha guia na tela para a altura correta do movimento.");

        } else if (phaseName === 'monitoring') {
            cameraMonitoringSection.classList.add('active');
            if (!currentStream || !currentStream.active) {
                setupCamera();
            } else {
                if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                    canvasElement.width = videoElement.videoWidth;
                    canvasElement.height = videoElement.videoHeight;
                    setGuideLineProportions();
                    drawStaticGuide(); // Redesenha a guia estática com a linha de altura
                } else {
                    setupCamera();
                }
            }
            if(!isResting) {
                resetCurrentSetProgress();
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
                    drawStaticGuide(); // Garante que a linha de altura apareça
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
            if (isExerciseInProgress) initiateExerciseButton.click();
            if (isResting) skipRest();
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

        if (currentSet > totalSets) { // Refazer treino
            resetWorkoutState();
            // updateWorkoutDisplay(); // Chamado dentro de resetWorkoutState
            isExerciseInProgress = true;
            initiateExerciseButton.innerHTML = '<i class="fas fa-pause"></i> Pausar';
            speakSimpleFeedback(`Reiniciando treino. Série ${currentSet}. ${repsPerSet} repetições.`);
            showFormFeedback("Concentre-se na forma correta!", "tip");
            startGuideAnimation();
            return;
        }
        
        isExerciseInProgress = !isExerciseInProgress;

        if (isExerciseInProgress) {
            initiateExerciseButton.innerHTML = '<i class="fas fa-pause"></i> Pausar';
            setCompleteMessageEl.classList.remove('visible');
            workoutCompleteMessageEl.classList.remove('visible');
            speakSimpleFeedback(`Iniciando série ${currentSet}. ${repsPerSet} repetições.`);
            showFormFeedback("Concentre-se na forma correta e observe a linha de altura!", "tip");
            startGuideAnimation();
        } else { // Pausou
            initiateExerciseButton.innerHTML = '<i class="fas fa-play"></i> Continuar';
            speakSimpleFeedback("Exercício pausado.");
            hideFormFeedback();
            stopGuideAnimation();
        }
    });

    function resetWorkoutState() {
        currentSet = 1;
        resetCurrentSetProgress(); 
        workoutCompleteMessageEl.classList.remove('visible');
    }

    function resetCurrentSetProgress(){
        validReps = 0;
        isExerciseInProgress = false; 
        guideArmAngle = 0;
        guideAnimationPhase = 'lifting';
        holdTimer = 0;
        isCheckingRepCompletion = false; // Reseta flag
        stopGuideAnimationAndRest(); 
        
        if (canvasElement.width > 0 && canvasElement.height > 0) {
            setGuideLineProportions();
            drawStaticGuide(); // Redesenha guia estática com linha de altura
        }
        hideFormFeedback();
        correctRepFeedbackEl.classList.remove('visible');
        updateWorkoutDisplay();
    }
    
    function drawStaticGuide() {
        if (!canvasElement.width || !canvasElement.height || !torsoX) return;
        clearCanvas(); canvasCtx.save();
        if (useFrontCamera && videoElement.classList.contains('mirrored')) {
            canvasCtx.translate(canvasElement.width, 0); canvasCtx.scale(-1, 1);
        }
        drawGuideFigure(0, true); // true para isStatic, vai desenhar a linha de altura
        canvasCtx.restore();
    }

    function startGuideAnimation() {
         if (!guideLinesAnimationId && isExerciseInProgress) {
            guideAnimationPhase = 'lifting'; // Garante que comece levantando
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
        // Adiciona um pequeno delay para o texto sumir depois da animação de "saída" do container
        setTimeout(() => {
            if (!formFeedbackContainerEl.classList.contains('visible')) { // Checa se ainda está escondido
                 formFeedbackMessageEl.textContent = '';
            }
        }, 300);
    }

    function showCorrectRepAnimation() {
        correctRepFeedbackEl.classList.add('visible');
        speakSimpleFeedback("Boa!"); // Feedback sonoro curto e positivo
        setTimeout(() => {
            correctRepFeedbackEl.classList.remove('visible');
        }, 700);
    }

    function handleRepCompletion(isCorrect) {
        isCheckingRepCompletion = false; // Libera flag

        if (isExerciseInProgress && validReps < repsPerSet) {
            if (isCorrect) {
                validReps++;
                updateWorkoutDisplay();
                showCorrectRepAnimation();
                setTimeout(() => { // Limpa feedback de erro/dica se a rep foi boa
                    if (!correctRepFeedbackEl.classList.contains('visible')) { // Só limpa se o check já sumiu
                        if (formFeedbackMessageEl.classList.contains('error') || formFeedbackMessageEl.classList.contains('tip')) {
                           hideFormFeedback();
                        }
                    }
                }, 750);
            } else {
                 // Feedback de erro já deve ter sido dado por analyzeUserPoseAndGiveFeedback
                 // Mas podemos reforçar ou garantir que uma mensagem de "tente novamente" apareça.
                 speakSimpleFeedback("Ajuste o movimento.");
                 showFormFeedback("Repetição não contada. Corrija a forma e siga a guia.", "error");
            }
        }

        // Verifica se a série foi completada APÓS processar a repetição
        if (validReps >= repsPerSet && isExerciseInProgress) {
            handleSetCompletion(); // handleSetCompletion vai parar o isExerciseInProgress
        } else if (isExerciseInProgress) { // Se a série não acabou e o exercício ainda está ativo
            guideAnimationPhase = 'lifting'; // Prepara para a próxima animação da guia
        }
    }

    function analyzeUserPoseAndGiveFeedback() {
        // *** SIMULAÇÃO DA DETECÇÃO DE POSE ***
        const currentTime = Date.now();
        // Só dá feedback contínuo se não estiver no meio de uma checagem de fim de repetição
        // E respeita o throttle
        if (isCheckingRepCompletion || (currentTime - lastFeedbackTime < feedbackThrottleMillis) ) {
            return true; // Assume correto para não interromper se estiver em throttle ou checando rep
        }

        if (isExerciseInProgress && validReps < repsPerSet) {
            let simulatedMovementCorrectDuringRep = true;
            let feedbackMsg = "";

            // Simular detecção de erro com base na fase da guia:
            if (guideAnimationPhase === 'lifting' && guideArmAngle < maxArmAngle * 0.7) { // Subindo, mas muito baixo
                if (Math.random() < 0.03) { // Chance baixa de erro simulado
                    feedbackMsg = "Suba mais os braços, siga a linha alvo!";
                    simulatedMovementCorrectDuringRep = false;
                }
            } else if (guideAnimationPhase === 'peak_hold') { // No pico
                 if (Math.random() < 0.02) {
                    feedbackMsg = "Segure um pouco no topo!";
                    simulatedMovementCorrectDuringRep = false; // Na verdade uma dica, mas para simular
                }
            } else if (guideAnimationPhase === 'lowering' && guideArmAngle > maxArmAngle * 0.3) { // Descendo, mas muito alto
                if (Math.random() < 0.03) {
                    feedbackMsg = "Controle a descida, mais devagar.";
                    simulatedMovementCorrectDuringRep = false;
                }
            }

            if (!simulatedMovementCorrectDuringRep && feedbackMsg) {
                showFormFeedback(feedbackMsg, "error");
                speakSimpleFeedback(feedbackMsg);
                lastFeedbackTime = currentTime;
                return false; // Para `handleRepCompletion` se chamada neste ciclo
            } else if (!formFeedbackMessageEl.classList.contains('success')) { // Não limpa msg de sucesso da série
                // Limpa feedback de erro/dica se o movimento parece ok agora
                if(formFeedbackContainerEl.classList.contains('visible') && (formFeedbackMessageEl.classList.contains('error') ||formFeedbackMessageEl.classList.contains('tip'))) {
                    hideFormFeedback();
                }
            }
            return true; // Assume correto para feedback contínuo se nenhum erro simulado ocorreu
        }
        return true; // Default para outros estados
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
                    if (isExerciseInProgress && !isCheckingRepCompletion && validReps < repsPerSet) { // Checa se reps não foram completadas
                        isCheckingRepCompletion = true;
                        // Para simulação, vamos assumir que a análise contínua já deu o feedback
                        // e a decisão de "correto" para contagem é mais um placeholder aqui
                        const movementConsideredCorrectForCounting = Math.random() > 0.15; // 85% de chance de contar (simulação)
                        handleRepCompletion(movementConsideredCorrectForCounting);
                    } else if (validReps >= repsPerSet && isExerciseInProgress) {
                        // Se as repetições foram completadas mas handleSetCompletion não foi chamado ainda
                        handleSetCompletion();
                    }
                }
                break;
            case 'rest_hold':
                holdTimer++;
                if (holdTimer >= restHoldDuration && validReps < repsPerSet && isExerciseInProgress && !isCheckingRepCompletion) {
                    guideAnimationPhase = 'lifting';
                }
                break;
        }

        drawGuideFigure(guideArmAngle, false);
        canvasCtx.restore();

        // Feedback contínuo (não apenas no final da rep)
        if (isExerciseInProgress && validReps < repsPerSet && !isCheckingRepCompletion) {
            analyzeUserPoseAndGiveFeedback();
        }

        if (isExerciseInProgress) { // Só continua se o exercício não foi parado por handleSetCompletion
            guideLinesAnimationId = requestAnimationFrame(animateGuideLines);
        }
    }

    function drawGuideFigure(currentAngle, isStatic) {
        if (!canvasElement.width || !canvasElement.height || !torsoX) return;
        const shoulderY = torsoTopY + shoulderOffsetY;
        const headRadius = canvasElement.height * 0.04;

        // Desenho do boneco guia (cabeça, tronco, braços, halteres)
        canvasCtx.strokeStyle = 'var(--line-guide-color)';
        canvasCtx.fillStyle = 'var(--line-guide-color)';
        canvasCtx.lineWidth = Math.max(5, canvasElement.width / 70); // Linhas um pouco mais finas
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
        const dW = Math.max(7, canvasElement.width / 35); 
        const dH = Math.max(10, canvasElement.width / 25);
        canvasCtx.save(); canvasCtx.translate(leftArmEndX, leftArmEndY); canvasCtx.rotate(-currentAngle); canvasCtx.fillRect(-dW / 2, -dH / 2, dW, dH); canvasCtx.restore();
        canvasCtx.save(); canvasCtx.translate(rightArmEndX, rightArmEndY); canvasCtx.rotate(currentAngle); canvasCtx.fillRect(-dW / 2, -dH / 2, dW, dH); canvasCtx.restore();

        // Linha Guia para Altura Máxima do Braço
        if (isStatic || isExerciseInProgress) {
            const targetShoulderHeightY = shoulderY; // Altura do ombro
            // Calcula a posição Y do halter no ângulo máximo (maxArmAngle)
            // Como o ângulo é em relação à vertical para baixo no cosseno, e para o lado no seno,
            // para a elevação lateral, o braço sobe. O ângulo de 0 é braço para baixo.
            // maxArmAngle é o ângulo com a vertical. Queremos a altura quando o braço está a ~90 graus com o tronco.
            // No canvas, Y aumenta para baixo.
            // Se currentAngle = 0 (braço para baixo), Y do halter = shoulderY + armLength
            // Se currentAngle = PI/2 (braço reto para o lado), Y do halter = shoulderY
            
            // A altura alvo é quando o braço está horizontal, ou seja, Y do halter = Y do ombro.
            // No entanto, maxArmAngle é definido como Math.PI / 2.1, o que significa que o braço
            // da *guia* não fica perfeitamente horizontal (90 graus = PI/2).
            // A linha deve representar a altura do halter da *guia* no seu ponto mais alto.
            const halterHighestY = shoulderY + Math.cos(maxArmAngle) * armLength;


            canvasCtx.strokeStyle = 'var(--line-target-height-color)';
            canvasCtx.lineWidth = 2;
            canvasCtx.setLineDash([4, 4]);

            const lineStartX = torsoX - armLength * 1.1; // Extende um pouco além do boneco
            const lineEndX = torsoX + armLength * 1.1;
            
            canvasCtx.beginPath();
            canvasCtx.moveTo(lineStartX, halterHighestY);
            canvasCtx.lineTo(lineEndX, halterHighestY);
            canvasCtx.stroke();
            
            canvasCtx.setLineDash([]); // Reseta o tracejado
        }
    }
    
    function handleSetCompletion(){
        isExerciseInProgress = false; // Essencial para parar o loop de animação
        stopGuideAnimation();
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
            initiateExerciseButton.innerHTML = `<i class="fas fa-forward"></i> Pular Descanso (${formatTime(restDurationSeconds)})`;
        } else {
            workoutCompleteMessageEl.classList.add('visible');
            const finalMsg = "Treino finalizado! Você mandou bem! Descanse e hidrate-se.";
            // showFormFeedback(finalMsg, "success"); // Mensagem anterior já é boa
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
        
        if (isResting) {
            speakSimpleFeedback("Descanso interrompido.");
        }
        isResting = false;
        restTimerDisplayEl.classList.remove('visible');
        setCompleteMessageEl.classList.remove('visible'); // Esconde msg de série completa anterior
        hideFormFeedback(); // Limpa feedback de descanso

        currentSet++;
        if (currentSet <= totalSets) {
            resetCurrentSetProgress();
            initiateExerciseButton.innerHTML = `<i class="fas fa-play"></i> Iniciar Série (${currentSet}/${totalSets})`;
            showFormFeedback("Prepare-se para a próxima série!", "tip");
        } else {
             workoutCompleteMessageEl.classList.add('visible');
             initiateExerciseButton.innerHTML = '<i class="fas fa-redo"></i> Refazer Treino';
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
             initiateExerciseButton.innerHTML = `<i class="fas fa-forward"></i> Pular Descanso (${formatTime(currentRestTimeLeft)})`;
        } else if (currentSet > totalSets){ // Estado pós-treino completo, pronto para refazer
             initiateExerciseButton.innerHTML = '<i class="fas fa-redo"></i> Refazer Treino';
        } else if (isExerciseInProgress){
            initiateExerciseButton.innerHTML = '<i class="fas fa-pause"></i> Pausar';
        }
        else { // Pronto para iniciar uma nova série
            initiateExerciseButton.innerHTML = `<i class="fas fa-play"></i> Iniciar Série (${currentSet}/${totalSets})`;
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
    
    // Inicializa na tela de explicação
    switchToPhase('explanation');
});