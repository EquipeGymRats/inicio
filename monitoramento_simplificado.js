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

    let lastFeedbackTime = 0;
    const feedbackThrottleMillis = 2200;
    let isCheckingRepCompletion = false;


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
            resetWorkoutState(); // Já chama updateWorkoutDisplay
            // initiateExerciseButton.innerHTML = '<i class="fas fa-play"></i>'; // Definido em updateWorkoutDisplay
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
                    drawStaticGuide();
                } else {
                    setupCamera(); // Reconfigura se algo estiver errado
                }
            }
            if(!isResting) { // Se não estiver voltando de um descanso
                resetCurrentSetProgress(); // Reseta progresso da série atual
            } else { // Se estava descansando e voltou pra tela, atualiza o display
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
            resetWorkoutState(); // Já chama updateWorkoutDisplay
            isExerciseInProgress = true;
            // Ícone e texto da ação já são definidos por updateWorkoutDisplay chamado em resetWorkoutState
            speakSimpleFeedback(`Reiniciando treino. Série ${currentSet}. ${repsPerSet} repetições.`);
            startGuideAnimation();
            return;
        }
        
        isExerciseInProgress = !isExerciseInProgress;

        if (isExerciseInProgress) {
            setCompleteMessageEl.classList.remove('visible');
            workoutCompleteMessageEl.classList.remove('visible');
            speakSimpleFeedback(`Iniciando série ${currentSet}. ${repsPerSet} repetições.`);
            startGuideAnimation();
        } else { // Pausou
            speakSimpleFeedback("Exercício pausado.");
            stopGuideAnimation();
        }
        updateWorkoutDisplay(); // Atualiza ícone do botão e texto da ação
    });

    function resetWorkoutState() { // Reseta o treino TODO
        currentSet = 1;
        resetCurrentSetProgress(); // Já chama updateWorkoutDisplay
        workoutCompleteMessageEl.classList.remove('visible');
    }

    function resetCurrentSetProgress(){ // Reseta SÓ a série atual
        validReps = 0;
        isExerciseInProgress = false; 
        guideArmAngle = 0;
        guideAnimationPhase = 'lifting';
        holdTimer = 0;
        isCheckingRepCompletion = false;
        stopGuideAnimationAndRest(); 
        
        if (canvasElement.width > 0 && canvasElement.height > 0) {
            setGuideLineProportions();
            drawStaticGuide();
        }
        hideFormFeedback();
        correctRepFeedbackEl.classList.remove('visible');
        updateWorkoutDisplay(); // Essencial para atualizar o botão e texto da ação
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
            guideAnimationPhase = 'lifting';
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

    function handleRepCompletion(isCorrect) {
        isCheckingRepCompletion = false;

        if (isExerciseInProgress && validReps < repsPerSet) {
            if (isCorrect) {
                validReps++;
                // updateWorkoutDisplay(); // Será chamado após a animação do check ou no final da lógica
                showCorrectRepAnimation();
                setTimeout(() => {
                    if (!correctRepFeedbackEl.classList.contains('visible')) {
                        if (formFeedbackMessageEl.classList.contains('error') || formFeedbackMessageEl.classList.contains('tip')) {
                           hideFormFeedback();
                        }
                    }
                }, 750);
            } else {
                 speakSimpleFeedback("Ajuste o movimento.");
                 showFormFeedback("Repetição não contada. Corrija a forma e siga a guia.", "error");
            }
        }
        updateWorkoutDisplay(); // Atualiza contadores e texto de ação

        if (validReps >= repsPerSet && isExerciseInProgress) {
            handleSetCompletion();
        } else if (isExerciseInProgress) {
            guideAnimationPhase = 'lifting';
        }
    }

    function analyzeUserPoseAndGiveFeedback() {
        const currentTime = Date.now();
        if (isCheckingRepCompletion || (currentTime - lastFeedbackTime < feedbackThrottleMillis) ) {
            return true;
        }

        if (isExerciseInProgress && validReps < repsPerSet) {
            let simulatedMovementCorrectDuringRep = true;
            let feedbackMsg = "";

            if (guideAnimationPhase === 'lifting' && guideArmAngle < maxArmAngle * 0.7) {
                if (Math.random() < 0.03) {
                    feedbackMsg = "Suba mais os braços, siga a linha alvo!";
                    simulatedMovementCorrectDuringRep = false;
                }
            } else if (guideAnimationPhase === 'peak_hold') {
                 if (Math.random() < 0.02) {
                    feedbackMsg = "Segure um pouco no topo!";
                    // simulatedMovementCorrectDuringRep = false; // É mais uma dica
                }
            } else if (guideAnimationPhase === 'lowering' && guideArmAngle > maxArmAngle * 0.3) {
                if (Math.random() < 0.03) {
                    feedbackMsg = "Controle a descida, mais devagar.";
                    simulatedMovementCorrectDuringRep = false;
                }
            }

            if (!simulatedMovementCorrectDuringRep && feedbackMsg) {
                showFormFeedback(feedbackMsg, "error");
                speakSimpleFeedback(feedbackMsg);
                lastFeedbackTime = currentTime;
                return false;
            } else if (!formFeedbackMessageEl.classList.contains('success') && !formFeedbackMessageEl.classList.contains('action-state')) {
                if(formFeedbackContainerEl.classList.contains('visible') && (formFeedbackMessageEl.classList.contains('error') ||formFeedbackMessageEl.classList.contains('tip'))) {
                    hideFormFeedback();
                }
            }
            return true;
        }
        return true;
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
                    if (isExerciseInProgress && !isCheckingRepCompletion && validReps < repsPerSet) {
                        isCheckingRepCompletion = true;
                        const movementConsideredCorrectForCounting = Math.random() > 0.2; // 80% chance (simulação)
                        handleRepCompletion(movementConsideredCorrectForCounting);
                    } else if (validReps >= repsPerSet && isExerciseInProgress) {
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

        if (isExerciseInProgress && validReps < repsPerSet && !isCheckingRepCompletion) {
            analyzeUserPoseAndGiveFeedback();
        }

        if (isExerciseInProgress) {
            guideLinesAnimationId = requestAnimationFrame(animateGuideLines);
        }
    }

    function drawGuideFigure(currentAngle, isStatic) {
        if (!canvasElement.width || !canvasElement.height || !torsoX) return;
        const shoulderY = torsoTopY + shoulderOffsetY;
        const headRadius = canvasElement.height * 0.04;

        canvasCtx.strokeStyle = 'var(--line-guide-color)';
        canvasCtx.fillStyle = 'var(--line-guide-color)';
        canvasCtx.lineWidth = Math.max(5, canvasElement.width / 70);
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

        if (isStatic || isExerciseInProgress) {
            const halterHighestY = shoulderY + Math.cos(maxArmAngle) * armLength;
            canvasCtx.strokeStyle = 'var(--line-target-height-color)';
            canvasCtx.lineWidth = 2;
            canvasCtx.setLineDash([4, 4]);
            const lineStartX = torsoX - armLength * 1.1;
            const lineEndX = torsoX + armLength * 1.1;
            canvasCtx.beginPath();
            canvasCtx.moveTo(lineStartX, halterHighestY);
            canvasCtx.lineTo(lineEndX, halterHighestY);
            canvasCtx.stroke();
            canvasCtx.setLineDash([]);
        }
    }
    
    function handleSetCompletion(){
        isExerciseInProgress = false;
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
            // updateWorkoutDisplay será chamado pelo startRestTimer ou skipRest
        } else {
            workoutCompleteMessageEl.classList.add('visible');
            const finalMsg = "Treino finalizado! Você mandou muito bem! Descanse e hidrate-se.";
            speakSimpleFeedback(finalMsg);
            currentSet++; // Incrementa para que updateWorkoutDisplay mostre "Refazer"
        }
        updateWorkoutDisplay(); // Atualiza o botão e o texto da ação
    }

    function startRestTimer(){
        currentRestTimeLeft = restDurationSeconds;
        restTimerDisplayEl.classList.add('visible');
        updateRestTimerDisplay(); // Para mostrar o tempo inicial
        speakSimpleFeedback(`Descanso de ${restDurationSeconds} segundos.`);
        // updateWorkoutDisplay será chamado pelo setInterval para atualizar o texto do botão Pular

        restTimerIntervalId = setInterval(() => {
            currentRestTimeLeft--;
            updateRestTimerDisplay(); // Atualiza o contador visual
            updateWorkoutDisplay(); // Atualiza o texto do botão pular com o tempo restante
            if (currentRestTimeLeft <= 0) {
                skipRest();
            }
        }, 1000);
    }

    function skipRest(){
        if(restTimerIntervalId) clearInterval(restTimerIntervalId);
        restTimerIntervalId = null;
        
        if (isResting) { // Só fala se estava realmente descansando
            speakSimpleFeedback("Descanso interrompido.");
        }
        isResting = false;
        restTimerDisplayEl.classList.remove('visible');
        setCompleteMessageEl.classList.remove('visible');
        hideFormFeedback();

        currentSet++;
        if (currentSet <= totalSets) {
            resetCurrentSetProgress(); // Já chama updateWorkoutDisplay
        } else {
             // Estado de treino completo, currentSet já foi incrementado em handleSetCompletion
             // updateWorkoutDisplay cuidará de mostrar "Refazer"
        }
        updateWorkoutDisplay(); // Garante que o estado final seja refletido
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
        } else { // Pronto para iniciar ou continuar
            iconClass = "fa-play";
            if (validReps > 0 && validReps < repsPerSet) {
                actionText = `Série ${currentSet}/${totalSets} pausada (${validReps}/${repsPerSet}). Toque para continuar.`;
            } else {
                actionText = `Toque para Iniciar Série ${currentSet}/${totalSets}.`;
            }
        }
        initiateExerciseButton.innerHTML = `<i class="fas ${iconClass}"></i>`;
        
        // Só mostra o actionText se não for uma mensagem de sucesso de série/treino já visível
        if (!setCompleteMessageEl.classList.contains('visible') && !workoutCompleteMessageEl.classList.contains('visible')) {
            showFormFeedback(actionText, "action-state");
        } else if (setCompleteMessageEl.classList.contains('visible') && currentSet <= totalSets && !isResting){
            // Caso especial: série completa, mas antes do descanso começar, mostra o texto de iniciar próxima
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
    
    switchToPhase('explanation');
});