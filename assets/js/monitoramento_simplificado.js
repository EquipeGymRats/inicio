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

    // Criar elemento para feedback de execução
    const executionFeedbackEl = document.createElement('div');
    executionFeedbackEl.className = 'execution-feedback';
    document.querySelector('.camera-view-container').appendChild(executionFeedbackEl);

    // Criar elementos para guias visuais
    const shoulderGuideLine = document.createElement('div');
    shoulderGuideLine.className = 'shoulder-guide-line';
    shoulderGuideLine.style.display = 'none';
    document.querySelector('.camera-view-container').appendChild(shoulderGuideLine);

    const leftAngleGuide = document.createElement('div');
    leftAngleGuide.className = 'target-angle-guide left';
    leftAngleGuide.style.display = 'none';
    document.querySelector('.camera-view-container').appendChild(leftAngleGuide);

    const rightAngleGuide = document.createElement('div');
    rightAngleGuide.className = 'target-angle-guide right';
    rightAngleGuide.style.display = 'none';
    document.querySelector('.camera-view-container').appendChild(rightAngleGuide);

    // Criar elemento para o boneco de exemplo
    const exampleFigureContainer = document.createElement('div');
    exampleFigureContainer.className = 'example-figure-container';
    exampleFigureContainer.innerHTML = `
        <div class="example-figure">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <!-- Cabeça -->
                <circle cx="50" cy="20" r="8" fill="#FFD700" />
                
                <!-- Corpo -->
                <line x1="50" y1="28" x2="50" y2="60" stroke="#FFD700" stroke-width="4" />
                
                <!-- Braços - posição inicial -->
                <g class="arms" data-position="down">
                    <line x1="50" y1="35" x2="30" y2="45" stroke="#FFD700" stroke-width="4" class="left-arm" />
                    <line x1="50" y1="35" x2="70" y2="45" stroke="#FFD700" stroke-width="4" class="right-arm" />
                </g>
                
                <!-- Pernas -->
                <line x1="50" y1="60" x2="40" y2="85" stroke="#FFD700" stroke-width="4" />
                <line x1="50" y1="60" x2="60" y2="85" stroke="#FFD700" stroke-width="4" />
            </svg>
        </div>
    `;
    document.querySelector('.camera-view-container').appendChild(exampleFigureContainer);

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
    let lastHandGestureTime = 0;
    const handGestureThrottleMillis = 1500; // Evita múltiplas detecções em sequência
    let handGestureDetected = false;
    let handGestureFeedbackShown = false;
    
    // Variáveis para o boneco de exemplo
    let showingExampleFigure = false;
    let exampleFigureTimer = null;
    let noProgressCounter = 0;
    const MAX_NO_PROGRESS = 10; // Aumentado para ser menos sensível
    let wasExerciseInProgressBeforeExample = false; // Armazena o estado anterior
    let exampleShownInCurrentSession = false; // Controla se já mostrou exemplo nesta sessão
    
    // Dimensões do canvas baseadas no vídeo
    let videoWidth, videoHeight;

    // --- FUNÇÕES DE SETUP INICIAIS E GERENCIAMENTO DE TELA ---
    function switchToPhase(phaseName) {
        textExplanationSection.classList.remove('active');
        cameraMonitoringSection.classList.remove('active');
        hideFormFeedback();
        hideExecutionFeedback();
        correctRepFeedbackEl.classList.remove('visible');
        hideExampleFigure();

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
            video: { 
                facingMode: useFrontCamera ? 'user' : 'environment', 
                width: { ideal: 1920 }, 
                height: { ideal: 1080 },
                // Reduzir zoom
                zoom: 1.0
            },
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

        // Se o exemplo está sendo mostrado, esconde-o e retoma o exercício
        if (showingExampleFigure) {
            hideExampleFigure();
            isExerciseInProgress = wasExerciseInProgressBeforeExample;
            updateInitiateButtonIcon();
            return;
        }

        isExerciseInProgress = !isExerciseInProgress;

        if (isExerciseInProgress) {
            setCompleteMessageEl.classList.remove('visible');
            workoutCompleteMessageEl.classList.remove('visible');
            speakSimpleFeedback(`Iniciando série ${currentSet}. ${repsPerSet} repetições.`);
            hideFormFeedback();
            hideExecutionFeedback();
            lastFeedbackTime = 0;
            repPhase = 'down';
            repCountedForThisCycle = false;
            formCorrectAtPeak = false; // Reseta flag da forma no pico
            noProgressCounter = 0;
            exampleShownInCurrentSession = false; // Reseta o controle de exemplo
        } else { // Pausou
            speakSimpleFeedback("Exercício pausado.");
            showFormFeedback("Exercício pausado.", "action-state");
            hideExampleFigure();
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
        handGestureDetected = false;
        handGestureFeedbackShown = false;
        noProgressCounter = 0;
        exampleShownInCurrentSession = false;
        hideExampleFigure();
        hideExecutionFeedback();

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
        document.querySelector('.camera-view-container').classList.remove('resting-progress');
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

    function showExecutionFeedback(message) {
        executionFeedbackEl.textContent = message;
        executionFeedbackEl.classList.add('visible');
    }

    function hideExecutionFeedback() {
        executionFeedbackEl.classList.remove('visible');
        setTimeout(() => {
            if (!executionFeedbackEl.classList.contains('visible')) {
                executionFeedbackEl.textContent = '';
            }
        }, 300);
    }

    function showCorrectRepAnimation() {
        correctRepFeedbackEl.classList.add('visible');
        setTimeout(() => {
            correctRepFeedbackEl.classList.remove('visible');
        }, 700);
    }

    // --- FUNÇÕES PARA BONECO DE EXEMPLO ---
    function showExampleFigure() {
        if (showingExampleFigure || exampleShownInCurrentSession) return;
        
        // Armazena o estado atual do exercício
        wasExerciseInProgressBeforeExample = isExerciseInProgress;
        
        // Pausa o exercício enquanto mostra o exemplo
        if (isExerciseInProgress) {
            isExerciseInProgress = false;
            updateInitiateButtonIcon();
        }
        
        showingExampleFigure = true;
        exampleShownInCurrentSession = true; // Marca que já mostrou exemplo nesta sessão
        exampleFigureContainer.classList.add('visible');
        
        // Iniciar animação do boneco
        animateExampleFigure();
        
        // Mostrar feedback
        showExecutionFeedback("Observe o exemplo e tente imitar o movimento");
        speakSimpleFeedback("Observe o exemplo de como fazer o exercício corretamente.");
        
        // Definir timer para esconder o exemplo após um tempo
        if (exampleFigureTimer) clearTimeout(exampleFigureTimer);
        exampleFigureTimer = setTimeout(() => {
            hideExampleFigure();
            // Retoma o exercício automaticamente após o exemplo
            if (wasExerciseInProgressBeforeExample) {
                isExerciseInProgress = true;
                updateInitiateButtonIcon();
                showFormFeedback("Continue o exercício", "tip");
            }
        }, 8000); // 8 segundos de exemplo
    }
    
    function hideExampleFigure() {
        if (!showingExampleFigure) return;
        
        showingExampleFigure = false;
        exampleFigureContainer.classList.remove('visible');
        hideExecutionFeedback();
        
        if (exampleFigureTimer) {
            clearTimeout(exampleFigureTimer);
            exampleFigureTimer = null;
        }
        
        noProgressCounter = 0; // Reseta o contador
    }
    
    function animateExampleFigure() {
        if (!showingExampleFigure) return;
        
        const arms = exampleFigureContainer.querySelector('.arms');
        const leftArm = exampleFigureContainer.querySelector('.left-arm');
        const rightArm = exampleFigureContainer.querySelector('.right-arm');
        const currentPosition = arms.getAttribute('data-position');
        
        // Alternar entre posições
        if (currentPosition === 'down') {
            // Animar para cima
            animateArm(leftArm, 'x2', 30, 10, 1000);
            animateArm(rightArm, 'x2', 70, 90, 1000);
            arms.setAttribute('data-position', 'up');
            
            setTimeout(() => {
                if (showingExampleFigure) {
                    // Manter no topo por um momento
                    setTimeout(() => {
                        if (showingExampleFigure) {
                            // Animar para baixo
                            animateArm(leftArm, 'x2', 10, 30, 1000);
                            animateArm(rightArm, 'x2', 90, 70, 1000);
                            arms.setAttribute('data-position', 'down');
                            
                            // Continuar o ciclo
                            setTimeout(() => {
                                if (showingExampleFigure) {
                                    animateExampleFigure();
                                }
                            }, 1500);
                        }
                    }, 1000);
                }
            }, 1000);
        }
    }
    
    function animateArm(element, attribute, startValue, endValue, duration) {
        const startTime = Date.now();
        
        function update() {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function para movimento mais natural
            const easeProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
            
            const currentValue = startValue + (endValue - startValue) * easeProgress;
            element.setAttribute(attribute, currentValue);
            
            if (progress < 1 && showingExampleFigure) {
                requestAnimationFrame(update);
            }
        }
        
        update();
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

    function updateGuideLines(landmarks) {
        if (!landmarks || !shoulderGuideLine) return;

        const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
        const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
        const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
        const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

        if (!leftShoulder || !rightShoulder || leftShoulder.visibility < 0.5 || rightShoulder.visibility < 0.5) {
            shoulderGuideLine.style.display = 'none';
            leftAngleGuide.style.display = 'none';
            rightAngleGuide.style.display = 'none';
            return;
        }

        // Posicionar linha do ombro
        const shoulderY = (leftShoulder.y + rightShoulder.y) / 2 * canvasElement.height;
        shoulderGuideLine.style.top = `${shoulderY}px`;
        shoulderGuideLine.style.display = 'block';

        // Posicionar guias de ângulo para os braços
        if (leftElbow && leftShoulder && leftHip && leftElbow.visibility > 0.5 && leftShoulder.visibility > 0.5 && leftHip.visibility > 0.5) {
            const shoulderXLeft = leftShoulder.x * canvasElement.width;
            const armLength = Math.hypot(
                shoulderXLeft - leftElbow.x * canvasElement.width,
                shoulderY - leftElbow.y * canvasElement.height
            );
            
            leftAngleGuide.style.height = `${armLength}px`;
            leftAngleGuide.style.left = `${shoulderXLeft}px`;
            leftAngleGuide.style.top = `${shoulderY}px`;
            leftAngleGuide.style.transformOrigin = 'top center';
            leftAngleGuide.style.transform = `rotate(${90}deg)`;
            leftAngleGuide.style.display = 'block';
        } else {
            leftAngleGuide.style.display = 'none';
        }

        if (rightElbow && rightShoulder && rightHip && rightElbow.visibility > 0.5 && rightShoulder.visibility > 0.5 && rightHip.visibility > 0.5) {
            const shoulderXRight = rightShoulder.x * canvasElement.width;
            const armLength = Math.hypot(
                shoulderXRight - rightElbow.x * canvasElement.width,
                shoulderY - rightElbow.y * canvasElement.height
            );
            
            rightAngleGuide.style.height = `${armLength}px`;
            rightAngleGuide.style.left = `${shoulderXRight}px`;
            rightAngleGuide.style.top = `${shoulderY}px`;
            rightAngleGuide.style.transformOrigin = 'top center';
            rightAngleGuide.style.transform = `rotate(${90}deg)`;
            rightAngleGuide.style.display = 'block';
        } else {
            rightAngleGuide.style.display = 'none';
        }
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
        
        // Linha horizontal na altura dos ombros (mais destacada)
        canvasCtx.strokeStyle = '#3498DB'; // Azul mais vibrante
        canvasCtx.lineWidth = 4;
        canvasCtx.setLineDash([]);
        
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, shoulderY);
        canvasCtx.lineTo(canvasElement.width, shoulderY);
        canvasCtx.stroke();
        
        // Adicionar sombra para destacar
        canvasCtx.shadowColor = '#3498DB';
        canvasCtx.shadowBlur = 10;
        
        // Linhas guia para os braços (tracejadas)
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
        if (!isExerciseInProgress || showingExampleFigure) return;

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
            showExecutionFeedback("Não consigo ver seus braços claramente");
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
            formFeedback = "Mantenha os cotovelos mais esticados";
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
             formFeedback = "Não levante os braços acima da linha dos ombros";
             currentFormCorrect = false;
        }

        // Atualiza a flag geral de correção da forma
        isUserFormCorrect = currentFormCorrect;

        // Exibir feedback de forma
        const now = Date.now();
        if (!isUserFormCorrect && formFeedback && (now - lastFeedbackTime > feedbackThrottleMillis)) {
            showExecutionFeedback(formFeedback);
            speakSimpleFeedback(formFeedback);
            lastFeedbackTime = now;
        } else if (isUserFormCorrect && executionFeedbackEl.classList.contains('visible')) {
            hideExecutionFeedback();
        }

        // --- Lógica de Contagem de Repetições --- 
        if (currentArmAngle > REPETITION_THRESHOLD_LIFT && repPhase === 'up') {
            repPhase = 'peak';
            formCorrectAtPeak = isUserFormCorrect; // Armazena se a forma estava correta ao atingir o pico
            noProgressCounter = 0; // Resetar contador de não progresso
        } else if (currentArmAngle < REPETITION_THRESHOLD_LOWER && (repPhase === 'peak' || repPhase === 'lowering')) {
            if (repPhase === 'peak' || repPhase === 'lowering') { // Garante que veio de cima
                 if (!repCountedForThisCycle && formCorrectAtPeak) { // Só conta se atingiu o pico com forma correta
                    validReps++;
                    repCountedForThisCycle = true;
                    showCorrectRepAnimation();
                    updateWorkoutDisplay();
                    noProgressCounter = 0; // Resetar contador de não progresso

                    if (validReps >= repsPerSet) {
                        completeSet();
                        return;
                    }
                 } else if (!repCountedForThisCycle && !formCorrectAtPeak && repPhase === 'peak') {
                     // Atingiu a base vindo do pico, mas a forma estava errada no pico
                     // Dar um feedback? Ex: "Repetição inválida, corrija a forma."
                     if (now - lastFeedbackTime > feedbackThrottleMillis) {
                         showExecutionFeedback("Forma incorreta no pico, repetição não contada");
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
            noProgressCounter = 0; // Resetar contador de não progresso
            // Limpa feedback de erro ao iniciar nova subida
            hideExecutionFeedback();
        } else if (currentArmAngle < REPETITION_THRESHOLD_LIFT && currentArmAngle > REPETITION_THRESHOLD_LOWER && repPhase === 'peak') {
            repPhase = 'lowering';
            noProgressCounter = 0; // Resetar contador de não progresso
        } else {
            // Se não houve mudança de fase, incrementar contador de não progresso
            noProgressCounter++;
            
            // Verificar se o usuário está parado sem progresso
            if (noProgressCounter > MAX_NO_PROGRESS && !showingExampleFigure && !exampleShownInCurrentSession) {
                showExampleFigure();
            }
        }

        // Mostrar dicas se a forma estiver correta e sem erros recentes
        if (isUserFormCorrect && !executionFeedbackEl.classList.contains('visible') && (now - lastFeedbackTime > tipThrottleMillis)) {
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
    function isOpenHandGesture(landmarks) {
        if (!landmarks || landmarks.length === 0) return false;
        
        // Verificar se todos os dedos estão estendidos
        // Índices dos landmarks da mão no MediaPipe Hands
        const THUMB_TIP = 4;
        const INDEX_FINGER_TIP = 8;
        const MIDDLE_FINGER_TIP = 12;
        const RING_FINGER_TIP = 16;
        const PINKY_TIP = 20;
        
        const WRIST = 0;
        const PALM_CENTER = 9; // Aproximadamente o centro da palma
        
        // Verificar se as pontas dos dedos estão acima da palma (dedos estendidos)
        const thumbExtended = landmarks[THUMB_TIP].y < landmarks[WRIST].y;
        const indexExtended = landmarks[INDEX_FINGER_TIP].y < landmarks[PALM_CENTER].y;
        const middleExtended = landmarks[MIDDLE_FINGER_TIP].y < landmarks[PALM_CENTER].y;
        const ringExtended = landmarks[RING_FINGER_TIP].y < landmarks[PALM_CENTER].y;
        const pinkyExtended = landmarks[PINKY_TIP].y < landmarks[PALM_CENTER].y;
        
        // Considerar mão aberta se pelo menos 4 dedos estiverem estendidos
        const extendedFingers = [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
            .filter(extended => extended).length;
            
        return extendedFingers >= 4;
    }

    function processHandGestures(multiHandLandmarks) {}

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
            
            // Atualiza as guias visuais HTML
            updateGuideLines(results.poseLandmarks);

            // Desenha os landmarks do usuário com estilo melhorado
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, 
                          {color: 'rgba(255, 215, 0, 0.8)', lineWidth: 3});
            drawLandmarks(canvasCtx, results.poseLandmarks, 
                          {color: 'rgba(255, 215, 0, 0.9)', fillColor: 'rgba(255, 215, 0, 0.2)', 
                           lineWidth: 1, radius: 3});

            // Processa a pose para feedback e contagem se estiver em exercício
            if (isExerciseInProgress && !showingExampleFigure) {
                processUserPose(results.poseLandmarks);
            } else if (!isResting && !textExplanationSection.classList.contains('active') && !showingExampleFigure) {
                if (!formFeedbackContainerEl.classList.contains('visible')) {
                    showFormFeedback("Posicione-se e prepare-se para iniciar.", "action-state");
                }
            }

        } else {
            lastUserLandmarks = null;
            if (isExerciseInProgress && !showingExampleFigure) {
                showExecutionFeedback("Não detectamos você. Posicione-se melhor.");
                isUserFormCorrect = false;
            } else if (!isResting && !textExplanationSection.classList.contains('active') && !showingExampleFigure) {
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

        if (showingExampleFigure) {
            icon.classList.add('fa-play');
            initiateExerciseButton.setAttribute('aria-label', 'Continuar Exercício');
        } else if (isExerciseInProgress) {
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
        document.querySelector('.camera-view-container').classList.add('resting-progress');
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
        document.querySelector('.camera-view-container').classList.remove('resting-progress');
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
                 showFormFeedback(`Pronto para Série ${currentSet}. Clique em Iniciar ou faça um gesto de mão aberta ✋`, "action-state");
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
