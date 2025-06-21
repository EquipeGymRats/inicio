import { api } from '../apiService.js';

document.addEventListener('DOMContentLoaded', () => {
    let fullTrainingPlan = null;

    // Elementos da página e das animações
    const grid = document.getElementById('schedule-grid');
    const modal = document.getElementById('workout-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const cardCheckAnimationEl = document.getElementById('card-check-animation');
    const fullscreenCelebrationEl = document.getElementById('fullscreen-celebration');
    
    // --- FUNÇÕES DE ANIMAÇÃO ---

     // CORREÇÃO: Adicionado 'window.scrollY' para corrigir o posicionamento com a rolagem
    function triggerCardCheckAnimation(buttonElement) {
        const card = buttonElement.closest('.day-card');
        if (!card) return;

        const cardRect = card.getBoundingClientRect();
        
        // Soma a posição de rolagem vertical ao 'top' do card
        cardCheckAnimationEl.style.top = `${cardRect.top + window.scrollY}px`; 
        cardCheckAnimationEl.style.left = `${cardRect.left + window.scrollX}px`;
        cardCheckAnimationEl.style.width = `${cardRect.width}px`;
        cardCheckAnimationEl.style.height = `${cardRect.height}px`;
        cardCheckAnimationEl.style.display = 'flex';

        cardCheckAnimationEl.classList.add('show');
        
        setTimeout(() => {
            cardCheckAnimationEl.classList.remove('show');
            setTimeout(() => {
                cardCheckAnimationEl.style.display = 'none';
            }, 500);
        }, 1000);
    }


    function triggerFullscreenCelebration(xpGained) {
        const celebrationTextEl = document.getElementById('celebration-text');
        const celebrationXpEl = document.getElementById('celebration-xp');
        const checkmarkSVG = fullscreenCelebrationEl.querySelector('.checkmark');
        
        // Reseta os elementos para que a animação possa rodar novamente
        celebrationTextEl.style.animation = 'none';
        celebrationXpEl.classList.remove('show');
        checkmarkSVG.style.display = 'none'; // Esconde para forçar o reinício da animação SVG

        // Força um "repaint" para garantir que o reset da animação funcione
        setTimeout(() => {
            checkmarkSVG.style.display = 'block';
            celebrationTextEl.textContent = 'Semana Concluída!';
            celebrationTextEl.style.animation = 'typing 2.5s steps(30, end), blink-caret .75s step-end infinite';
            celebrationTextEl.style.width = '100%';

            fullscreenCelebrationEl.style.display = 'flex';

            setTimeout(() => {
                celebrationXpEl.textContent = `+${xpGained} XP`;
                celebrationXpEl.classList.add('show');
            }, 2800);

            setTimeout(() => {
                fullscreenCelebrationEl.style.display = 'none';
            }, 5000);
        }, 50);
    }

    // --- FUNÇÕES AUXILIARES DE RENDERIZAÇÃO ---
    function createMuscleTagsHtml(exercises) {
        if (!exercises || exercises.length === 0) return '';
        const allMuscles = exercises.flatMap(ex => ex.muscleGroups);
        const uniqueMuscles = [...new Set(allMuscles)].slice(0, 3);
        return `<div class="muscle-group-list">
            ${uniqueMuscles.map(muscle => `<span class="muscle-tag">${muscle}</span>`).join('')}
        </div>`;
    }

    function createDifficultyRatingHtml(avgDifficulty) {
        let dots = '';
        for (let i = 1; i <= 5; i++) {
            dots += `<div class="difficulty-dot ${i <= avgDifficulty ? 'filled' : ''}"></div>`;
        }
        return `<div class="difficulty-rating"><span>Dificuldade:</span>${dots}</div>`;
    }

    

    // --- FUNÇÕES PRINCIPAIS DE LÓGICA ---
    async function loadTrainingPlan() {
        try {
            fullTrainingPlan = await api.getTrainingPlan();
            renderOverview(fullTrainingPlan);
            renderSchedule(fullTrainingPlan.plan);
        } catch (error) {
            console.error('Erro ao carregar plano de treino:', error);
            grid.innerHTML = `<p class="error-msg">${error.message || 'Crie um plano de treino para vê-lo aqui.'}</p>`;
        }
    }

// Renderiza a visão geral (Nível, Objetivo, Frequência)
    function renderOverview(plan) {
        // CORREÇÃO: Alvo agora é o container de detalhes, não a seção inteira
        const overviewDetailsContainer = document.getElementById('overview-details');
        if (overviewDetailsContainer) {
            overviewDetailsContainer.innerHTML = `
                <div class="overview-item"><i class="fa-solid fa-bullseye"></i> Objetivo: ${plan.objective}</div>
                <div class="overview-item"><i class="fa-solid fa-layer-group"></i> Nível: ${plan.level}</div>
                <div class="overview-item"><i class="fa-solid fa-calendar-days"></i> Frequência: ${plan.frequency} dias</div>
            `;
        }
    }

    function renderSchedule(planDays) {
        grid.innerHTML = '';
        planDays.forEach(day => {
            const isRestDay = !day.exercises || day.exercises.length === 0;
            const avgDifficulty = isRestDay ? 0 : Math.round(day.exercises.reduce((sum, ex) => sum + ex.difficulty, 0) / day.exercises.length);
            
            const card = document.createElement('div');
            card.className = `day-card ${isRestDay ? 'rest-day' : ''} ${day.isCompleted ? 'completed' : ''}`;
            
            card.innerHTML = `
                <div class="day-card-header">
                    <h3>${day.dayName}</h3>
                </div>
                <div class="day-card-details">
                    ${isRestDay ? '<span>Aproveite para recarregar as energias!</span>' : `
                        <div class="details-row">
                            ${createMuscleTagsHtml(day.exercises)}
                        </div>
                        <div class="details-row">
                            ${createDifficultyRatingHtml(avgDifficulty)}
                        </div>
                    `}
                </div>
                <div class="day-card-actions">
                ${!isRestDay ? `
                    <button class="btn btn-secondary view-details-btn" data-day-name="${day.dayName}">
                        <i class="fa-solid fa-eye"></i> Ver Detalhes
                    </button>
                    <button class="btn btn-primary complete-day-btn" data-day-name="${day.dayName}" ${day.isCompleted ? 'disabled' : ''}>
                        ${day.isCompleted ? '<i class="fa-solid fa-check"></i> Concluído' : '<i class="fa-solid fa-plus"></i> Marcar como Feito'}
                    </button>
                ` : ''}
                </div>
            `;
            grid.appendChild(card);
        });
    }

// my-training.js

    function populateModal(dayName) {
        const dayData = fullTrainingPlan.plan.find(d => d.dayName === dayName);
        if (!dayData) return;

        modalTitle.textContent = dayData.dayName;
        
        // O HTML agora inclui ícones para cada detalhe
        modalBody.innerHTML = `<div class="exercise-accordion">
            ${dayData.exercises.map(ex => `
            <div class="exercise-item">
                <div class="exercise-summary">
                    <h4>${ex.name}</h4>
                    <i class="fa-solid fa-chevron-down"></i>
                </div>
                <div class="exercise-details">
                    <p><i class="fa-solid fa-dumbbell fa-fw"></i> <strong>Séries e Repetições:</strong> ${ex.setsReps}</p>
                    <div class="details-row">${createMuscleTagsHtml([ex])}</div>
                    <p><i class="fa-solid fa-lightbulb fa-fw"></i> <strong>Dica de Execução:</strong> ${ex.tips}</p>
                    <p><i class="fa-solid fa-list-ol fa-fw"></i> <strong>Passo a Passo:</strong></p>
                    <ol class="tutorial-steps">
                    ${ex.tutorialSteps.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                    <div class="details-row">${createDifficultyRatingHtml(ex.difficulty)}</div>
                </div>
            </div>
            `).join('')}
        </div>`;
        
        // --- LÓGICA PARA ABRIR O PRIMEIRO ITEM ---
        const firstExerciseDetails = modalBody.querySelector('.exercise-details');
        const firstExerciseIcon = modalBody.querySelector('.exercise-summary i');

        if (firstExerciseDetails && firstExerciseIcon) {
            firstExerciseDetails.classList.add('open');
            firstExerciseIcon.style.transform = 'rotate(180deg)';
        }
        // --- FIM DA LÓGICA ---
        
        modal.style.display = 'block';
    }
    
    // --- EVENT LISTENERS ---
    grid.addEventListener('click', async (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        const dayName = target.dataset.dayName;

        if (target.classList.contains('view-details-btn')) {
            populateModal(dayName);
        }

        if (target.classList.contains('complete-day-btn')) {
            target.disabled = true;
            target.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
            
            try {
                const response = await api.completeTodayWorkout(dayName);
                
                target.innerHTML = `<i class="fa-solid fa-check"></i> Concluído`;
                target.closest('.day-card').classList.add('completed');
                
                if (response.weekCompleted) {
                    triggerFullscreenCelebration(response.gainedXp);
                } else {
                    triggerCardCheckAnimation(target);
                }

            } catch (error) {
                alert(error.message || 'Não foi possível marcar como concluído.');
                target.disabled = false;
                target.innerHTML = '<i class="fa-solid fa-plus"></i> Marcar como Feito';
            }
        }
    });

    modalBody.addEventListener('click', (event) => {
        const summary = event.target.closest('.exercise-summary');
        if (summary) {
            const details = summary.nextElementSibling;
            const icon = summary.querySelector('i');
            const isOpen = details.classList.toggle('open');
            icon.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    });

    modalCloseBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    loadTrainingPlan();
});