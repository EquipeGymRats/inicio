// assets/js/treino.js

import { authService } from './auth.js';
import { exerciseDatabase } from './treino/exerciseDatabase.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const trainingForm = document.getElementById('training-form');
    const formSection = document.getElementById('form-section');
    const outputSection = document.getElementById('output-section');
    const trainingPlanDiv = document.getElementById('training-plan');
    const summaryLevel = document.getElementById('summary-level');
    const summaryObjective = document.getElementById('summary-objective');
    const summaryFrequency = document.getElementById('summary-frequency');
    const saveTrainingBtn = document.getElementById('save-training-btn');
    const newTrainingBtn = document.getElementById('new-training-btn');
    const notificationToast = document.getElementById('notification-toast');
    const loadingSpinner = document.getElementById('loading-spinner');
    const prevDayBtn = document.getElementById('prev-day');
    const nextDayBtn = document.getElementById('next-day');
    const currentDayNameSpan = document.getElementById('current-day-name');

    // --- Variáveis Globais ---
    let currentTrainingPlan = null;
    let currentDayIndex = 0;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const BASE_URL = isLocal 
        ? 'http://localhost:3000' // URL para desenvolvimento local
        : 'https://api-gym-cyan.vercel.app'; // URL para produção


    // Inicializa o Modal de Exercícios (cria uma vez para reutilizar)
    initExerciseModal();

    // --- Funções da UI ---

    function showToast(message, duration = 4000) {
        notificationToast.textContent = message;
        notificationToast.classList.add('show');
        setTimeout(() => notificationToast.classList.remove('show'), duration);
    }

    function getYoutubeVideoId(url) {
        if (!url) return null;
        const regExp = /^.*(http:\/\/googleusercontent.com\/youtube.com\/8\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    function initExerciseModal() {
        if (document.getElementById('exercise-modal-overlay')) return;

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'exercise-modal-overlay';
        modalOverlay.id = 'exercise-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="exercise-modal">
                <button class="modal-close" id="modal-close"><i class="fas fa-times"></i></button>
                <div class="modal-header">
                    <h3 class="modal-title" id="modal-title"></h3>
                    <div class="modal-subtitle">
                        <i class="fas fa-repeat"></i>
                        <span id="modal-sets-reps"></span>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="modal-section"><h4 class="modal-section-title"><i class="fas fa-lightbulb"></i> Dica de Execução</h4><div class="tip-card" id="modal-tip"></div></div>
                    <div class="modal-section"><h4 class="modal-section-title"><i class="fas fa-video"></i> Tutorial em Vídeo</h4><div class="video-container" id="modal-video"></div></div>
                    <div class="modal-section"><h4 class="modal-section-title"><i class="fas fa-list-ol"></i> Passo a Passo</h4><ul class="tutorial-steps" id="modal-steps"></ul></div>
                    <div class="modal-section"><h4 class="modal-section-title"><i class="fas fa-dumbbell"></i> Músculos Trabalhados</h4><div class="muscle-groups" id="modal-muscles"></div></div>
                    <div class="modal-section"><h4 class="modal-section-title"><i class="fas fa-chart-line"></i> Nível de Dificuldade</h4><div class="difficulty-meter" id="modal-difficulty"></div></div>
                </div>
            </div>`;
        document.body.appendChild(modalOverlay);
        document.getElementById('modal-close').addEventListener('click', closeExerciseModal);
        modalOverlay.addEventListener('click', (e) => e.target === modalOverlay && closeExerciseModal());
    }

    function openExerciseModal(exerciseData) {
        const modalOverlay = document.getElementById('exercise-modal-overlay');
        
        document.getElementById('modal-title').textContent = exerciseData.name;
        document.getElementById('modal-sets-reps').textContent = exerciseData.setsReps;
        document.getElementById('modal-tip').textContent = exerciseData.tips;
        document.getElementById('modal-steps').innerHTML = exerciseData.tutorialSteps.map(step => `<li>${step}</li>`).join('');
        document.getElementById('modal-muscles').innerHTML = exerciseData.muscleGroups.map(muscle => `<span class="muscle-tag">${muscle}</span>`).join('');

        const difficultyContainer = document.getElementById('modal-difficulty');
        difficultyContainer.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const dot = document.createElement('div');
            dot.className = `difficulty-dot ${i <= exerciseData.difficulty ? 'active' : ''}`;
            difficultyContainer.appendChild(dot);
        }

        const youtubeUrl = exerciseDatabase[exerciseData.name];
        const videoContainer = document.getElementById('modal-video');
        console.log("YouTube URL:", exerciseData.name);

        if (youtubeUrl) {
            const videoId = getYoutubeVideoId(youtubeUrl);
            videoContainer.innerHTML = videoId
                ? `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" title="Tutorial do Exercício" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
                : `<div class="video-placeholder"><i class="fas fa-film"></i><p>Link de vídeo inválido no banco de dados.</p></div>`;
        } else {
            videoContainer.innerHTML = `<div class="video-placeholder"><i class="fas fa-exclamation-triangle"></i><p>Vídeo para este exercício ainda não foi adicionado.</p></div>`;
        }

        modalOverlay.classList.add('active');
    }

    function closeExerciseModal() {
        const modalOverlay = document.getElementById('exercise-modal-overlay');
        modalOverlay.classList.remove('active');
        document.getElementById('modal-video').innerHTML = '';
    }

    // --- Lógica de Renderização e Backend ---

    function displayCurrentDayTraining() {
        if (!currentTrainingPlan?.plan) {
            trainingPlanDiv.innerHTML = '<p class="day-off-message">Nenhum treino disponível.</p>';
            return;
        }

        const day = currentTrainingPlan.plan[currentDayIndex];
        currentDayNameSpan.textContent = day.dayName;

        let dayContent = '';
        if (day.exercises && day.exercises.length > 0) {
            dayContent = '<ul class="exercise-list">';
            day.exercises.forEach((exercise, index) => {
                dayContent += `
                    <li data-exercise-index="${index}">
                        <div class="exercise-content">
                            <span class="exercise-name" data-number="${index + 1}">${exercise.name}</span>
                            <div class="exercise-details">
                                <span class="exercise-sets-reps"><i class="fas fa-repeat"></i> ${exercise.setsReps}</span>
                                <div class="exercise-tips"><i class="fas fa-lightbulb"></i><span>${exercise.tips}</span></div>
                            </div>
                        </div>
                    </li>`;
            });
            dayContent += '</ul>';
        } else {
            dayContent = '<p class="day-off-message"><i class="fas fa-couch"></i> Dia de Descanso</p>';
        }
        trainingPlanDiv.innerHTML = dayContent;

        trainingPlanDiv.querySelectorAll('li[data-exercise-index]').forEach(li => {
            li.addEventListener('click', () => {
                const exerciseIndex = parseInt(li.dataset.exerciseIndex, 10);
                const exerciseObject = currentTrainingPlan.plan[currentDayIndex].exercises[exerciseIndex];
                openExerciseModal(exerciseObject);
            });
        });

        prevDayBtn.disabled = currentDayIndex === 0;
        nextDayBtn.disabled = currentDayIndex >= currentTrainingPlan.plan.length - 1;
    }

    function renderTrainingPlan(planData) {
        currentTrainingPlan = planData;
        summaryLevel.textContent = planData.level?.charAt(0).toUpperCase() + planData.level?.slice(1) || "N/A";
        summaryObjective.textContent = planData.objective?.charAt(0).toUpperCase() + planData.objective?.slice(1) || "N/A";
        summaryFrequency.textContent = `${planData.frequency || 0}x por semana`;

        try {
            document.querySelector(`input[name="level"][value="${planData.level}"]`).checked = true;
            document.querySelector(`input[name="objective"][value="${planData.objective}"]`).checked = true;
            document.querySelector(`input[name="frequency"][value="${planData.frequency}"]`).checked = true;
            document.querySelector(`input[name="equipment"][value="${planData.equipment}"]`).checked = true;
            const timeInput = document.getElementById('time-per-session');
            timeInput.value = planData.timePerSession;
            document.getElementById('slider-time-value').textContent = `${planData.timePerSession} minutos`;
        } catch (e) {
            console.warn("Não foi possível preencher o formulário com os dados do treino carregado.");
        }

        currentDayIndex = 0;
        displayCurrentDayTraining();

        formSection.classList.add('hidden');
        loadingSpinner.classList.add('hidden');
        outputSection.classList.remove('hidden');
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        const token = authService.getToken();
        if (!token) {
            showToast("Você precisa estar logado para gerar um treino.");
            return;
        }

        loadingSpinner.classList.remove('hidden');
        const formData = {
            level: document.querySelector('input[name="level"]:checked').value,
            objective: document.querySelector('input[name="objective"]:checked').value,
            frequency: document.querySelector('input[name="frequency"]:checked').value,
            equipment: document.querySelector('input[name="equipment"]:checked').value,
            timePerSession: parseInt(document.getElementById('time-per-session').value, 10)
        };

        try {
            const response = await fetch(`${BASE_URL}/training/generate-treino`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify(formData)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'O servidor respondeu com um erro.');
            }
            const planData = await response.json();
            renderTrainingPlan(planData);
            showToast("Seu novo treino foi gerado com sucesso!");
            saveTrainingBtn.disabled = false;
            saveTrainingBtn.textContent = 'Salvar Treino';
        } catch (error) {
            showToast(`Erro ao gerar treino: ${error.message}`);
            loadingSpinner.classList.add('hidden');
        }
    }

    async function saveTraining() {
        if (!currentTrainingPlan) {
            showToast("Nenhum treino para salvar!", 3000);
            return;
        }

        const token = authService.getToken();
        if (!token) {
            showToast("Faça login para salvar seu treino.", 5000);
            return;
        }

        // <<< 1. MODIFICAÇÃO: Incluir a assinatura no objeto a ser salvo
        // O currentTrainingPlan já terá a assinatura vinda da API
        const trainingToSave = {
            level: currentTrainingPlan.level,
            objective: currentTrainingPlan.objective,
            frequency: currentTrainingPlan.frequency,
            equipment: currentTrainingPlan.equipment,
            timePerSession: currentTrainingPlan.timePerSession,
            plan: currentTrainingPlan.plan,
            signature: currentTrainingPlan.signature // << Envia a assinatura recebida
        };

        if (!trainingToSave.signature) {
            showToast("Erro: Assinatura de integridade não encontrada. Tente gerar o treino novamente.", 5000);
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/training/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token,
                },
                body: JSON.stringify(trainingToSave)
            });

            if (response.ok) {
                showToast("Treino salvo com sucesso!", 3000);
                saveTrainingBtn.disabled = true;
                saveTrainingBtn.textContent = 'Treino Salvo!';
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || 'Erro do servidor ao salvar.');
            }
        } catch (error) {
            showToast(`Erro ao salvar treino: ${error.message}`, 5000);
        }
    }

    async function loadPreviousTraining() {
        const token = authService.getToken();
        if (!token) {
            console.log("Usuário não logado, não carregando treino anterior.");
            return; // Sai silenciosamente se não houver token
        }

        loadingSpinner.classList.remove('hidden');

        try {
            const response = await fetch(`${BASE_URL}/training/`, {
                headers: { 'x-auth-token': token },
            });

            if (response.ok) {
                const planData = await response.json();
                renderTrainingPlan(planData);
                showToast("Treino anterior carregado com sucesso!");
                saveTrainingBtn.disabled = true; // Já está salvo
                saveTrainingBtn.textContent = 'Treino Salvo!';
            } else if (response.status === 404) {
                showToast("Nenhum treino salvo encontrado. Gere um novo!", 4000);
            } else {
                throw new Error((await response.json()).message || 'Erro do servidor');
            }
        } catch (error) {
            showToast(`Erro ao carregar treino: ${error.message}`, 5000);
        } finally {
            loadingSpinner.classList.add('hidden');
        }
    }

    // --- Adicionando Event Listeners ---
    trainingForm.addEventListener('submit', handleFormSubmit);
    saveTrainingBtn.addEventListener('click', saveTraining);

    prevDayBtn.addEventListener('click', () => {
        if (currentDayIndex > 0) {
            currentDayIndex--;
            displayCurrentDayTraining();
        }
    });

    nextDayBtn.addEventListener('click', () => {
        if (currentTrainingPlan && currentDayIndex < currentTrainingPlan.plan.length - 1) {
            currentDayIndex++;
            displayCurrentDayTraining();
        }
    });

    newTrainingBtn.addEventListener('click', () => {
        outputSection.classList.add('hidden');
        formSection.classList.remove('hidden');
        trainingForm.reset();
        document.getElementById('slider-time-value').textContent = `60 minutos`;
        currentTrainingPlan = null;
        saveTrainingBtn.disabled = false;
        saveTrainingBtn.textContent = 'Salvar Treino';
    });

    const timeInput = document.getElementById('time-per-session');
    const timeValueSpan = document.getElementById('slider-time-value');
    timeInput.addEventListener('input', () => {
        timeValueSpan.textContent = `${timeInput.value} minutos`;
    });

    // --- Inicialização ---
    loadPreviousTraining();
});