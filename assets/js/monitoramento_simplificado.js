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

    const executionFeedbackEl = document.createElement('div');
    executionFeedbackEl.className = 'execution-feedback';
    document.querySelector('.camera-view-container').appendChild(executionFeedbackEl);

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

    const exampleFigureContainer = document.createElement('div');
    exampleFigureContainer.className = 'example-figure-container';
    exampleFigureContainer.innerHTML = `
        <div class="example-figure">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="20" r="8" fill="#ffd75d" />
                <line x1="50" y1="28" x2="50" y2="60" stroke="#ffd75d" stroke-width="4" />
                <g class="arms" data-position="down">
                    <line x1="50" y1="35" x2="30" y2="45" stroke="#ffd75d" stroke-width="4" class="left-arm" />
                    <line x1="50" y1="35" x2="70" y2="45" stroke="#ffd75d" stroke-width="4" class="right-arm" />
                </g>
                <line x1="50" y1="60" x2="40" y2="85" stroke="#ffd75d" stroke-width="4" />
                <line x1="50" y1="60" x2="60" y2="85" stroke="#ffd75d" stroke-width="4" />
            </svg>
        </div>
    `;
    document.querySelector('.camera-view-container').appendChild(exampleFigureContainer);

    // --- CORREÇÃO: Definindo as conexões do corpo, excluindo o rosto ---
    // Os landmarks do rosto no MediaPipe Pose vão do 0 ao 10.
    // Estamos filtrando a lista padrão para manter apenas as conexões onde ambos os pontos são maiores que 10.
    const BODY_CONNECTIONS = POSE_CONNECTIONS.filter(connection => connection[0] > 10 && connection[1] > 10);

    let currentStream;
    let useFrontCamera = true;
    let isExerciseInProgress = false;
    let isResting = false;
    let restTimerIntervalId = null;

    let currentSet = 1;
    const totalSets = 4;
    let validReps = 0;
    const repsPerSet = 10;
    const restDurationSeconds = 60;
    let currentRestTimeLeft = 0;

    let pose;
    let camera;
    let lastUserLandmarks = null;
    
    const MIN_ARM_ANGLE_RAD = 15 * Math.PI / 180;
    const MAX_ARM_ANGLE_RAD = 90 * Math.PI / 180;
    const FLEXION_TOLERANCE_DEG = 35;
    const REPETITION_THRESHOLD_LIFT = MAX_ARM_ANGLE_RAD * 0.85;
    const REPETITION_THRESHOLD_LOWER = MIN_ARM_ANGLE_RAD * 1.8;

    let repPhase = 'down';
    let repCountedForThisCycle = false;
    let isUserFormCorrect = true;
    let formCorrectAtPeak = false;
    let lastFeedbackTime = 0;
    const feedbackThrottleMillis = 3000;
    const tipThrottleMillis = 5000;

    let showingExampleFigure = false;
    let exampleFigureTimer = null;
    let noProgressCounter = 0;
    const MAX_NO_PROGRESS = 10;
    let wasExerciseInProgressBeforeExample = false;
    let exampleShownInCurrentSession = false;
    
    let videoWidth, videoHeight;

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
            if (camera) {
                camera.stop();
                camera = null;
            }
            resetWorkoutState();
            speakSimpleFeedback("Instruções para elevação lateral. Siga as dicas na tela.");

        } else if (phaseName === 'monitoring') {
            cameraMonitoringSection.classList.add('active');
            videoElement.classList.remove('resting-blur');

            if (!pose) {
                initializePoseDetection();
            }
            if (!currentStream || !currentStream.active) {
                setupCamera();
            } else {
                if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                    setCanvasDimensions();
                    if (camera && !camera.isStarted) camera.start();
                } else {
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
        console.log("setupCamera: Iniciando com as constraints mais simples...");
        cameraLoadingIndicator.textContent = 'Carregando Câmera...';
    
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        videoElement.classList.toggle('mirrored', useFrontCamera);
    
        const constraints = {
            video: {
                facingMode: useFrontCamera ? 'user' : 'environment'
            },
            audio: false
        };
    
        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = currentStream;
    
            videoElement.onloadeddata = () => {
                setCanvasDimensions();
                cameraLoadingIndicator.style.display = 'none';
    
                if (!pose) initializePoseDetection();
                
                if (camera && !camera.isStarted) {
                    camera.start();
                } else if (!camera) {
                    startCameraFeed();
                }
            };
            videoElement.onerror = (e) => { 
                console.error("setupCamera: Erro no elemento de vídeo:", e); 
                cameraLoadingIndicator.textContent = `Erro no player de vídeo.`;
                currentStream = null; 
            };
        } catch (error) {
            console.error("setupCamera: Erro ao obter câmera -", error.name, error.message);
            currentStream = null;
    
            if (error.name === "NotReadableError" || error.name === "OverconstrainedError") {
                 cameraLoadingIndicator.textContent = 'Erro: A câmera já está em uso por outro app? Tente recarregar.';
                 console.log('Não foi possível acessar sua câmera. Verifique se ela não está sendo usada por outro aplicativo (Zoom, Discord, etc.) e atualize a página.');
            } else if (error.name === "NotAllowedError") {
                 cameraLoadingIndicator.textContent = 'Permissão da câmera negada.';
                 console.log('Você precisa permitir o acesso à câmera para usar esta funcionalidade.');
            } else {
                 cameraLoadingIndicator.textContent = `Erro de câmera (${error.name}). Tente trocar de câmera (frontal/traseira).`;
            }
        }
    }

    toggleUserCameraBtn.addEventListener('click', () => {
        const wasInProgress = isExerciseInProgress;
        const wasResting = isResting;
        if (wasInProgress) initiateExerciseButton.click();
        if (wasResting) skipRest();

        useFrontCamera = !useFrontCamera;
        if (cameraMonitoringSection.classList.contains('active')) {
            if (camera) camera.stop();
            if (currentStream) currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
            videoElement.srcObject = null;
            setupCamera();
        }
    });

    initiateExerciseButton.addEventListener('click', () => {
        if (!currentStream || !currentStream.active || videoElement.readyState < 2 || videoElement.videoWidth === 0 || !pose) {
            console.log("Aguarde a câmera carregar e o sistema de monitoramento iniciar.");
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
            formCorrectAtPeak = false;
            noProgressCounter = 0;
            exampleShownInCurrentSession = false;
        } else {
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
                formFeedbackMessageEl.className = 'feedback-message';
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

    function showExampleFigure() {
        if (showingExampleFigure || exampleShownInCurrentSession) return;
        
        wasExerciseInProgressBeforeExample = isExerciseInProgress;
        
        if (isExerciseInProgress) {
            isExerciseInProgress = false;
            updateInitiateButtonIcon();
        }
        
        showingExampleFigure = true;
        exampleShownInCurrentSession = true; 
        exampleFigureContainer.classList.add('visible');
        
        animateExampleFigure();
        
        showExecutionFeedback("Observe o exemplo e tente imitar o movimento");
        speakSimpleFeedback("Observe o exemplo de como fazer o exercício corretamente.");
        
        if (exampleFigureTimer) clearTimeout(exampleFigureTimer);
        exampleFigureTimer = setTimeout(() => {
            hideExampleFigure();
            if (wasExerciseInProgressBeforeExample) {
                isExerciseInProgress = true;
                updateInitiateButtonIcon();
                showFormFeedback("Continue o exercício", "tip");
            }
        }, 8000);
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
        
        noProgressCounter = 0;
    }
    
    function animateExampleFigure() {
        if (!showingExampleFigure) return;
        
        const arms = exampleFigureContainer.querySelector('.arms');
        const leftArm = exampleFigureContainer.querySelector('.left-arm');
        const rightArm = exampleFigureContainer.querySelector('.right-arm');
        const currentPosition = arms.getAttribute('data-position');
        
        if (currentPosition === 'down') {
            animateArm(leftArm, 'x2', 30, 10, 1000);
            animateArm(rightArm, 'x2', 70, 90, 1000);
            arms.setAttribute('data-position', 'up');
            
            setTimeout(() => {
                if (showingExampleFigure) {
                    setTimeout(() => {
                        if (showingExampleFigure) {
                            animateArm(leftArm, 'x2', 10, 30, 1000);
                            animateArm(rightArm, 'x2', 90, 70, 1000);
                            arms.setAttribute('data-position', 'down');
                            
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
            const easeProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
            const currentValue = startValue + (endValue - startValue) * easeProgress;
            element.setAttribute(attribute, currentValue);
            
            if (progress < 1 && showingExampleFigure) {
                requestAnimationFrame(update);
            }
        }
        
        update();
    }

    function initializePoseDetection() {
        pose = new Pose({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }});

        pose.setOptions({
            modelComplexity: 0,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        pose.onResults(onPoseResults);
    }

    function startCameraFeed() {
        if (camera) camera.stop(); 
    
        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                    try {
                        if (pose) {
                            await pose.send({image: videoElement});
                        }
                    } catch (error) {
                         console.error("Erro ao enviar frame para o MediaPipe:", error);
                    }
                }
            },
        });
        
        camera.start().then(() => {
             console.log("startCameraFeed: Câmera MediaPipe iniciada.");
             camera.isStarted = true;
        }).catch(err => {
             console.error("Erro ao iniciar câmera MediaPipe:", err);
             camera.isStarted = false;
        });
    }

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

        const shoulderY = (leftShoulder.y + rightShoulder.y) / 2 * canvasElement.height;
        shoulderGuideLine.style.top = `${shoulderY}px`;
        shoulderGuideLine.style.display = 'block';

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
        
        const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
        const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
        let armLengthEstimate = Math.abs(shoulderXLeft - shoulderXRight) * 0.8;
        if(leftElbow && leftElbow.visibility > 0.5) {
            armLengthEstimate = Math.hypot(shoulderXLeft - leftElbow.x * canvasElement.width, shoulderY - leftElbow.y * canvasElement.height) * 1.8;
        } else if (rightElbow && rightElbow.visibility > 0.5) {
             armLengthEstimate = Math.hypot(shoulderXRight - rightElbow.x * canvasElement.width, shoulderY - rightElbow.y * canvasElement.height) * 1.8;
        }

        canvasCtx.save();
        
        canvasCtx.strokeStyle = '#3498DB';
        canvasCtx.lineWidth = 4;
        canvasCtx.setLineDash([]);
        
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, shoulderY);
        canvasCtx.lineTo(canvasElement.width, shoulderY);
        canvasCtx.stroke();
        
        canvasCtx.shadowColor = '#3498DB';
        canvasCtx.shadowBlur = 10;
        
        canvasCtx.strokeStyle = 'rgba(52, 152, 219, 0.7)';
        canvasCtx.lineWidth = 3;
        canvasCtx.setLineDash([5, 5]);

        canvasCtx.beginPath();
        canvasCtx.moveTo(shoulderXLeft, shoulderY);
        canvasCtx.lineTo(shoulderXLeft - armLengthEstimate, shoulderY);
        canvasCtx.stroke();

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

        let formFeedback = "";
        let currentFormCorrect = true;

        const minElbowAngleAllowed = 180 - FLEXION_TOLERANCE_DEG;
        if ((leftElbowAngleDeg !== null && leftElbowAngleDeg < minElbowAngleAllowed) ||
            (rightElbowAngleDeg !== null && rightElbowAngleDeg < minElbowAngleAllowed)) {
            formFeedback = "Mantenha os cotovelos mais esticados";
            currentFormCorrect = false;
        }

        if (currentFormCorrect && currentArmAngle > MAX_ARM_ANGLE_RAD * 1.15) {
             formFeedback = "Não levante os braços acima da linha dos ombros";
             currentFormCorrect = false;
        }

        isUserFormCorrect = currentFormCorrect;

        const now = Date.now();
        if (!isUserFormCorrect && formFeedback && (now - lastFeedbackTime > feedbackThrottleMillis)) {
            showExecutionFeedback(formFeedback);
            speakSimpleFeedback(formFeedback);
            lastFeedbackTime = now;
        } else if (isUserFormCorrect && executionFeedbackEl.classList.contains('visible')) {
            hideExecutionFeedback();
        }

        if (currentArmAngle > REPETITION_THRESHOLD_LIFT && repPhase === 'up') {
            repPhase = 'peak';
            formCorrectAtPeak = isUserFormCorrect;
            noProgressCounter = 0;
        } else if (currentArmAngle < REPETITION_THRESHOLD_LOWER && (repPhase === 'peak' || repPhase === 'lowering')) {
            if (repPhase === 'peak' || repPhase === 'lowering') {
                 if (!repCountedForThisCycle && formCorrectAtPeak) {
                    validReps++;
                    repCountedForThisCycle = true;
                    showCorrectRepAnimation();
                    updateWorkoutDisplay();
                    noProgressCounter = 0;

                    if (validReps >= repsPerSet) {
                        completeSet();
                        return;
                    }
                 } else if (!repCountedForThisCycle && !formCorrectAtPeak && repPhase === 'peak') {
                     if (now - lastFeedbackTime > feedbackThrottleMillis) {
                         showExecutionFeedback("Forma incorreta no pico, repetição não contada");
                         lastFeedbackTime = now;
                     }
                 }
                 repPhase = 'down';
                 formCorrectAtPeak = false;
            }
        } else if (currentArmAngle > REPETITION_THRESHOLD_LOWER && currentArmAngle < REPETITION_THRESHOLD_LIFT && repPhase === 'down') {
            repPhase = 'up';
            repCountedForThisCycle = false;
            formCorrectAtPeak = false;
            noProgressCounter = 0;
            hideExecutionFeedback();
        } else if (currentArmAngle < REPETITION_THRESHOLD_LIFT && currentArmAngle > REPETITION_THRESHOLD_LOWER && repPhase === 'peak') {
            repPhase = 'lowering';
            noProgressCounter = 0;
        } else {
            noProgressCounter++;
            
            if (noProgressCounter > MAX_NO_PROGRESS && !showingExampleFigure && !exampleShownInCurrentSession) {
                showExampleFigure();
            }
        }

        if (isUserFormCorrect && !executionFeedbackEl.classList.contains('visible') && (now - lastFeedbackTime > tipThrottleMillis)) {
            if (repPhase === 'up') {
                showFormFeedback("Suba até a linha guia.", "tip");
                lastFeedbackTime = now;
            } else if (repPhase === 'lowering') {
                showFormFeedback("Desça controladamente.", "tip");
                lastFeedbackTime = now;
            }
        }
    }

    function clearCanvas() {
        if (canvasCtx && canvasElement) {
             canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        }
    }

    function onPoseResults(results) {
        if (!canvasCtx || !canvasElement) return;

        clearCanvas();
        canvasCtx.save();

        if (useFrontCamera && videoElement.classList.contains('mirrored')) {
            canvasCtx.translate(canvasElement.width, 0);
            canvasCtx.scale(-1, 1);
        }

        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

        if (results.poseLandmarks) {
            lastUserLandmarks = results.poseLandmarks;

            drawTargetGuideLines(results.poseLandmarks);
            updateGuideLines(results.poseLandmarks);

            // CORREÇÃO: Usando a lista de conexões personalizada (BODY_CONNECTIONS)
            drawConnectors(canvasCtx, results.poseLandmarks, BODY_CONNECTIONS, 
                          {color: 'rgba(255, 215, 0, 0.8)', lineWidth: 3});
            
            drawLandmarks(canvasCtx, results.poseLandmarks, 
                          {color: 'rgba(255, 215, 0, 0.9)', fillColor: 'rgba(255, 215, 0, 0.2)', 
                           lineWidth: 1, radius: 3});

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
                 clearCanvas();
                 canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            }
        }

        canvasCtx.restore();
        updateInitiateButtonIcon();
    }

    function updateInitiateButtonIcon() {
        const icon = initiateExerciseButton.querySelector('i');
        if (!icon) return;
        icon.className = 'fas'; 

        if (showingExampleFigure) {
            icon.classList.add('fa-play');
            initiateExerciseButton.setAttribute('aria-label', 'Continuar Exercício');
        } else if (isExerciseInProgress) {
            icon.classList.add('fa-pause');
            initiateExerciseButton.setAttribute('aria-label', 'Pausar Exercício');
        } else if (isResting) {
             icon.classList.add('fa-forward');
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
        videoElement.classList.add('resting-blur');
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
        videoElement.classList.remove('resting-blur');
        document.querySelector('.camera-view-container').classList.remove('resting-progress');
        setCompleteMessageEl.classList.remove('visible');

        if (currentSet <= totalSets) {
            resetCurrentSetProgress();
            speakSimpleFeedback(`Prepare-se para a série ${currentSet}.`);
            isExerciseInProgress = false;
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

    function speakSimpleFeedback(text) {
        try {
            if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
                 window.speechSynthesis.cancel();
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
        } else {
            setCompleteMessageEl.classList.remove('visible');
            workoutCompleteMessageEl.classList.remove('visible');
        }

        if (!formFeedbackContainerEl.classList.contains('visible') || formFeedbackMessageEl.classList.contains('action-state') || formFeedbackMessageEl.classList.contains('tip')) {
             if (isResting) {
                 showFormFeedback(`Descansando... Próxima série: ${currentSet}`, "action-state");
             } else if (!isExerciseInProgress && currentSet <= totalSets && validReps === 0) {
                 showFormFeedback(`Pronto para Série ${currentSet}. Clique para Iniciar.`, "action-state");
             } else if (!isExerciseInProgress && currentSet <= totalSets && validReps > 0) {
                 showFormFeedback(`Série ${currentSet} pausada. ${validReps}/${repsPerSet} reps.`, "action-state");
             } else if (isExerciseInProgress) {
                 if (!formFeedbackContainerEl.classList.contains('visible')) {
                 } else if (formFeedbackMessageEl.classList.contains('action-state')) {
                      hideFormFeedback();
                 }
             } else if (currentSet > totalSets) {
                 showFormFeedback("Treino Concluído!", "success");
             }
        }
    }

    switchToPhase('explanation');
    updateWorkoutDisplay();

});