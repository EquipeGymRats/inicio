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


    let currentStream;
    let useFrontCamera = true;
    let guideLinesAnimationId;
    let isExerciseInProgress = false; // Se a animação da GUIA está rodando
    let isResting = false;
    let restTimerIntervalId = null;

    // --- Configurações do Treino ---
    let currentSet = 1;
    const totalSets = 4;
    let validReps = 0;
    const repsPerSet = 10;
    const restDurationSeconds = 60; // 1 minuto
    let currentRestTimeLeft = 0;


    let guideArmAngle = 0;
    const maxArmAngle = Math.PI / 2.1;
    const animationSpeed = 0.025; // Um pouco mais rápido para dar sensação de "melhor movimento"
    let guideAnimationPhase = 'lifting';
    let holdTimer = 0;
    const peakHoldDuration = 25; // Ajustar para um pico mais definido
    const restHoldDuration = 15;

    let torsoTopY, torsoBottomY, torsoX, shoulderOffsetY, armLength;
    const dumbbellWidth = 20, dumbbellHeight = 10; // Tamanho simulado dos halteres


    function switchToPhase(phaseName) {
        // ... (lógica de switchToPhase como na versão anterior)
        textExplanationSection.classList.remove('active');
        cameraMonitoringSection.classList.remove('active');

        if (phaseName === 'explanation') {
            textExplanationSection.classList.add('active');
            stopGuideAnimationAndRest();
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
                currentStream = null;
                videoElement.srcObject = null;
            }
            resetWorkoutState(); // Reseta todo o progresso do treino
            updateWorkoutDisplay();
            initiateExerciseButton.innerHTML = '<i class="fas fa-play"></i> Iniciar Série';

        } else if (phaseName === 'monitoring') {
            cameraMonitoringSection.classList.add('active');
            if (!currentStream || !currentStream.active) {
                setupCamera();
            } else {
                // Se stream já existe, garantir que o canvas está pronto e desenhar guia estática
                 if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                    canvasElement.width = videoElement.videoWidth;
                    canvasElement.height = videoElement.videoHeight;
                    setGuideLineProportions();
                    drawStaticGuide(); // Desenha o estado inicial da guia
                } else {
                    setupCamera(); // Reconfigura se algo estiver errado
                }
            }
            // O estado do botão será gerenciado por resetWorkoutState ou pela lógica de descanso
            // Se estiver voltando para esta tela e não estava em descanso, reseta para o início da série atual
            if(!isResting) {
                resetCurrentSetProgress();
                updateWorkoutDisplay();
            }
        }
    }

    startCameraButton.addEventListener('click', () => switchToPhase('monitoring'));
    showExplanationAgainButton.addEventListener('click', () => switchToPhase('explanation'));

    async function setupCamera() { /* ... (Como na versão anterior, sem alterações diretas aqui) ... */ 
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
    function setGuideLineProportions() { /* ... (Como na versão anterior) ... */
        if (!canvasElement.width || !canvasElement.height) return;
        const canvasH = canvasElement.height; const canvasW = canvasElement.width;
        torsoTopY = canvasH * 0.25; torsoBottomY = canvasH * 0.60; torsoX = canvasW / 2;
        shoulderOffsetY = canvasH * 0.05; armLength = canvasH * 0.28; // Braço um pouco menor para caber halteres
    }

    toggleUserCameraBtn.addEventListener('click', () => { /* ... (Como na versão anterior) ... */
        if (isExerciseInProgress || isResting) initiateExerciseButton.click(); // Pausa ou pula descanso
        useFrontCamera = !useFrontCamera;
        if (cameraMonitoringSection.classList.contains('active')) setupCamera();
    });

    initiateExerciseButton.addEventListener('click', () => {
        if (!currentStream || !currentStream.active || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
            alert("Aguarde a câmera carregar ou verifique as permissões.");
            if (!currentStream || !currentStream.active) setupCamera();
            return;
        }

        if (isResting) { // Pular Descanso
            skipRest();
            return;
        }

        if (currentSet > totalSets) { // Treino completo, botão é "Refazer"
            resetWorkoutState();
            updateWorkoutDisplay();
            isExerciseInProgress = true;
            initiateExerciseButton.innerHTML = '<i class="fas fa-pause"></i> Pausar';
            startGuideAnimation();
            return;
        }
        
        isExerciseInProgress = !isExerciseInProgress;

        if (isExerciseInProgress) {
            initiateExerciseButton.innerHTML = '<i class="fas fa-pause"></i> Pausar';
            setCompleteMessageEl.classList.remove('visible');
            workoutCompleteMessageEl.classList.remove('visible');
            startGuideAnimation();
        } else { // Pausou
            initiateExerciseButton.innerHTML = '<i class="fas fa-play"></i> Continuar';
            stopGuideAnimation();
        }
    });

    function resetWorkoutState() { // Reseta o treino TODO
        currentSet = 1;
        resetCurrentSetProgress(); // Reseta a série atual
        workoutCompleteMessageEl.classList.remove('visible');
    }

    function resetCurrentSetProgress(){ // Reseta SÓ a série atual
        validReps = 0;
        isExerciseInProgress = false;
        // initiateExerciseButton.innerHTML = `<i class="fas fa-play"></i> Iniciar Série (${currentSet}/${totalSets})`; // Atualizado em updateWorkoutDisplay
        
        guideArmAngle = 0;
        guideAnimationPhase = 'lifting';
        holdTimer = 0;
        stopGuideAnimationAndRest(); // Garante que timers de descanso parem
        
        if (canvasElement.width > 0 && canvasElement.height > 0) {
            setGuideLineProportions();
            drawStaticGuide();
        }
        updateWorkoutDisplay(); // Atualiza a UI com os valores resetados
    }
    
    function drawStaticGuide() { /* ... (Como na versão anterior, mas chama drawGuideFigure com halteres) ... */
        if (!canvasElement.width || !canvasElement.height || !torsoX) return;
        clearCanvas(); canvasCtx.save();
        if (useFrontCamera && videoElement.classList.contains('mirrored')) {
            canvasCtx.translate(canvasElement.width, 0); canvasCtx.scale(-1, 1);
        }
        drawGuideFigure(0, true); // true para indicar que é um desenho estático (sem "movimento")
        canvasCtx.restore();
    }

    function startGuideAnimation() { /* ... (Como antes) ... */
         if (!guideLinesAnimationId && isExerciseInProgress) {
            guideLinesAnimationId = requestAnimationFrame(animateGuideLines);
        }
    }
    function stopGuideAnimation() { /* ... (Como antes) ... */
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


    function animateGuideLines() {
        if (!isExerciseInProgress || !canvasElement.width || !canvasElement.height || !torsoX) {
            stopGuideAnimation(); return;
        }
        clearCanvas(); canvasCtx.save();
        if (useFrontCamera && videoElement.classList.contains('mirrored')) {
            canvasCtx.translate(canvasElement.width, 0); canvasCtx.scale(-1, 1);
        }

        // Lógica de animação da guia
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
                    }
                }
                break;
            case 'rest_hold':
                holdTimer++;
                if (holdTimer >= restHoldDuration) {
                    if (validReps >= repsPerSet) { // Série Completa
                        handleSetCompletion();
                        canvasCtx.restore(); // Restaura antes de retornar para não ter múltiplos restores
                        return; // Sai da animação, vai para o descanso
                    }
                    guideAnimationPhase = 'lifting'; // Próxima repetição da guia
                }
                break;
        }
        drawGuideFigure(guideArmAngle, false); // false = animando
        canvasCtx.restore();
        if (isExerciseInProgress) guideLinesAnimationId = requestAnimationFrame(animateGuideLines);
    }

    function drawGuideFigure(currentAngle, isStatic) {
        if (!canvasElement.width || !canvasElement.height || !torsoX) return;
        const shoulderY = torsoTopY + shoulderOffsetY;
        const headRadius = canvasElement.height * 0.04;

        canvasCtx.strokeStyle = 'var(--line-guide-color)';
        canvasCtx.fillStyle = 'var(--line-guide-color)';
        canvasCtx.lineWidth = Math.max(5, canvasElement.width / 60); // Linhas um pouco mais grossas
        canvasCtx.lineCap = 'round';

        // Tronco e Cabeça (como antes)
        canvasCtx.beginPath(); canvasCtx.moveTo(torsoX, torsoTopY); canvasCtx.lineTo(torsoX, torsoBottomY); canvasCtx.stroke();
        canvasCtx.beginPath(); canvasCtx.arc(torsoX, torsoTopY - headRadius * 0.7, headRadius, 0, Math.PI * 2); canvasCtx.fill();

        // Braços
        const leftArmEndX = torsoX - Math.sin(currentAngle) * armLength;
        const leftArmEndY = shoulderY + Math.cos(currentAngle) * armLength;
        const rightArmEndX = torsoX + Math.sin(currentAngle) * armLength;
        const rightArmEndY = shoulderY + Math.cos(currentAngle) * armLength;

        canvasCtx.beginPath(); canvasCtx.moveTo(torsoX, shoulderY); canvasCtx.lineTo(leftArmEndX, leftArmEndY); canvasCtx.stroke();
        canvasCtx.beginPath(); canvasCtx.moveTo(torsoX, shoulderY); canvasCtx.lineTo(rightArmEndX, rightArmEndY); canvasCtx.stroke();

        // Desenhar Halteres nas pontas dos braços
        canvasCtx.fillStyle = 'var(--line-dumbbell-color)';
        const dW = Math.max(8, canvasElement.width / 30); // Largura do halter responsiva
        const dH = Math.max(12, canvasElement.width / 22); // Altura do halter responsiva

        // Halter Esquerdo (desenhado perpendicular ao braço)
        canvasCtx.save();
        canvasCtx.translate(leftArmEndX, leftArmEndY);
        canvasCtx.rotate(-currentAngle); // Rotaciona o halter para ficar "deitado" no fim do braço
        canvasCtx.fillRect(-dW / 2, -dH / 2, dW, dH);
        canvasCtx.restore();

        // Halter Direito
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
        speakSimpleFeedback(`Série ${currentSet} completa!`);

        if (currentSet < totalSets) {
            isResting = true;
            startRestTimer();
            initiateExerciseButton.innerHTML = `<i class="fas fa-forward"></i> Pular Descanso (${formatTime(restDurationSeconds)})`;
        } else { // Todas as séries completas
            workoutCompleteMessageEl.classList.add('visible');
            speakSimpleFeedback("Treino finalizado! Parabéns!");
            initiateExerciseButton.innerHTML = '<i class="fas fa-redo"></i> Refazer Treino';
            currentSet++; // Para que no próximo clique ele entre na condição de refazer
        }
        updateWorkoutDisplay(); // Atualiza contagem de séries
    }

    function startRestTimer(){
        currentRestTimeLeft = restDurationSeconds;
        restTimerDisplayEl.classList.add('visible');
        updateRestTimerDisplay();

        restTimerIntervalId = setInterval(() => {
            currentRestTimeLeft--;
            updateRestTimerDisplay();
            initiateExerciseButton.innerHTML = `<i class="fas fa-forward"></i> Pular (${formatTime(currentRestTimeLeft)})`;

            if (currentRestTimeLeft <= 0) {
                skipRest(); // Chama a mesma lógica de pular para finalizar o descanso
            }
        }, 1000);
    }

    function skipRest(){
        if(restTimerIntervalId) clearInterval(restTimerIntervalId);
        restTimerIntervalId = null;
        isResting = false;
        restTimerDisplayEl.classList.remove('visible');
        setCompleteMessageEl.classList.remove('visible'); // Esconde msg de série completa

        currentSet++;
        if (currentSet <= totalSets) {
            resetCurrentSetProgress(); // Prepara para a próxima série
            initiateExerciseButton.innerHTML = `<i class="fas fa-play"></i> Iniciar Série (${currentSet}/${totalSets})`;
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
        currentSetDisplayEl.textContent = Math.min(currentSet, totalSets); // Não mostra série 5/4
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

    function clearCanvas() { /* ... (Como antes) ... */ canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); }
    function speakSimpleFeedback(message) { /* ... (Como antes) ... */ 
         try {
            if ('speechSynthesis' in window && window.speechSynthesis) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = 'pt-BR'; utterance.rate = 1.2;
                window.speechSynthesis.speak(utterance);
            }
        } catch (e) { console.error("Erro na síntese de voz:", e); }
    }
    
    switchToPhase('explanation'); // Inicia na fase de explicação
});