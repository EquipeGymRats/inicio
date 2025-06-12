// assets/js/dashboard.js

import { authService } from './auth.js';
import { api } from './dashboard/apiService.js';
import { initProgressaoPage } from './dashboard/progressao.js';
import { LEVELS as allLevels } from './dashboard/levelsConfig.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores Globais de Elementos ---
    const pageContent = document.getElementById('page-content');
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const logoutButton = document.getElementById('logout-button');
    const xpValueEl = document.getElementById('xp-value');
    const xpProgressBarInner = document.getElementById('xp-progress-bar-inner');
    const xpPercentageEl = document.getElementById('xp-percentage');
    const openGoalsSidebarBtn = document.getElementById('open-goals-modal-sidebar');
    const goalsModal = document.getElementById('goals-modal');
    const closeGoalsModalBtn = document.getElementById('close-goals-modal');
    const goalsListContainer = document.getElementById('goals-list-container');
    const completionOverlay = document.getElementById('completion-overlay');
    const completionIcon = document.getElementById('completion-icon');
    const completionMessage = document.getElementById('completion-message');
    const xpGainAnimation = document.getElementById('xp-gain-animation');
    const xpGainSpan = xpGainAnimation ? xpGainAnimation.querySelector('span') : null;
    let userProfileData = null; // Cache local para dados do perfil

    if (!pageContent) {
        console.error("Erro Crítico: O elemento 'page-content' não foi encontrado.");
        return;
    }

    // --- FUNÇÃO AUXILIAR DE DELAY ---
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // ======================================================
    // --- NAVEGAÇÃO E ROTEAMENTO ---
    // ======================================================

    function loadPage(pageId) {
        navItems.forEach(item => {
            item.classList.toggle('active', item.getAttribute('href') === `#${pageId}`);
        });
        const template = document.getElementById(`${pageId}-template`);
        if (template) {
            pageContent.innerHTML = '';
            pageContent.appendChild(template.content.cloneNode(true));
            
            switch (pageId) {
                case 'treino':
                    initTreinoPage();
                    break;
                case 'progressao': 
                    initProgressaoPage().then(() => {
                        const openBtn = document.getElementById('open-goals-modal-progress');
                        if(openBtn) openBtn.addEventListener('click', openGoalsModal);
                    });
                    break;
            }
        } else {
            pageContent.innerHTML = `<h2>Página "${pageId}" não encontrada</h2>`;
        }
    }

    function handleNavigation(event) {
        event.preventDefault();
        const pageId = event.currentTarget.getAttribute('href').substring(1);
        if (window.location.hash !== `#${pageId}`) window.history.pushState(null, '', `#${pageId}`);
        loadPage(pageId);
    }
    navItems.forEach(item => item.addEventListener('click', handleNavigation));

    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            authService.logout();
            window.location.href = 'login.html';
        });
    }

    // ======================================================
    // --- LÓGICA DO MODAL DE METAS ---
    // ======================================================

    function openGoalsModal() {
        if (!goalsModal || !userProfileData) {
            console.error("Dados do perfil ou modal não estão prontos.");
            return;
        }
        goalsListContainer.innerHTML = '';
        const defaultImage = 'assets/images/levels/default-level.png';

        allLevels.forEach((level, index) => {
            const item = document.createElement('div');
            item.className = 'goal-item';
            let statusIcon = '', statusClass = '', progressPercentage = 0, progressText = '';
            const isCurrentLevel = level.name === userProfileData.levelInfo.currentLevel.name;
            const nextLevel = index < allLevels.length - 1 ? allLevels[index + 1] : null;

            if (userProfileData.xp >= level.minXp) {
                statusClass = 'completed';
                statusIcon = '<i class="fas fa-check-circle"></i>';
                if (isCurrentLevel) {
                    statusClass = 'current';
                    statusIcon = '<i class="fas fa-stream"></i>';
                    if (nextLevel) {
                        const xpDiff = nextLevel.minXp - level.minXp;
                        const xpGained = userProfileData.xp - level.minXp;
                        progressPercentage = xpDiff > 0 ? Math.min((xpGained / xpDiff) * 100, 100) : 100;
                        progressText = `Progresso: ${Math.round(progressPercentage)}% para ${nextLevel.name}`;
                    } else {
                        progressText = 'Nível máximo alcançado!';
                        progressPercentage = 100;
                    }
                } else {
                    progressText = `Concluído`;
                    progressPercentage = 100;
                }
            } else {
                statusClass = 'locked';
                statusIcon = '<i class="fas fa-lock"></i>';
                progressText = `Faltam ${level.minXp - userProfileData.xp} XP para desbloquear`;
            }

            item.classList.add(statusClass);
            const imageUrl = level.image || defaultImage;

            item.innerHTML = `
                <img src="${imageUrl}" alt="${level.name}" class="goal-image">
                <div class="goal-details">
                    <h4>${level.name} ${isCurrentLevel ? '<span style="color: var(--gymrats-highlight-yellow); font-size: 0.9em; font-weight: normal;">(Atual)</span>' : ''}</h4>
                    <p>Requer: ${level.minXp} XP</p>
                    ${(statusClass === 'current' || statusClass === 'completed') && nextLevel ? `
                        <div class="goal-progress">
                            <div class="goal-progress-bar" style="width: ${progressPercentage}%;"></div>
                        </div>
                        <p class="goal-progress-text">${progressText}</p>
                    ` : `<p class="goal-progress-text">${progressText}</p>`}
                </div>
                <div class="goal-status">${statusIcon}</div>
            `;
            goalsListContainer.appendChild(item);
        });
        goalsModal.classList.add('show');
    }

    function closeGoalsModal() {
        if (goalsModal) goalsModal.classList.remove('show');
    }
    
    if(openGoalsSidebarBtn) openGoalsSidebarBtn.addEventListener('click', openGoalsModal);
    if(closeGoalsModalBtn) closeGoalsModalBtn.addEventListener('click', closeGoalsModal);
    if(goalsModal) goalsModal.addEventListener('click', (e) => { if(e.target === goalsModal) closeGoalsModal(); });


    // ======================================================
    // --- LÓGICA DA PÁGINA "MEU TREINO" ---
    // ======================================================

    async function initTreinoPage() {
        const workoutGrid = document.getElementById('workout-grid');
        const spinnerContainer = document.getElementById('treino-loading-spinner');
        if (!workoutGrid || !spinnerContainer) return;

        spinnerContainer.style.display = 'flex';
        workoutGrid.innerHTML = '';
        workoutGrid.appendChild(spinnerContainer);

        try {
            const [planResponse, logsResponse] = await Promise.all([api.getWorkouts(), api.getTrainingLogs()]);
            spinnerContainer.style.display = 'none';

            if (!planResponse.plan || planResponse.plan.length === 0) {
                workoutGrid.innerHTML = '<p style="text-align: center; color: var(--gymrats-text-secondary);">Nenhum plano de treino encontrado.</p>';
                return;
            }

            planResponse.plan.forEach(day => {
                const isCompletedToday = logsResponse.some(log => new Date(log.dateCompleted).toDateString() === new Date().toDateString() && log.trainingDayName === day.dayName);
                const card = createDayCard(day, isCompletedToday);
                workoutGrid.appendChild(card);
            });

            document.querySelectorAll('.complete-workout-btn:not([disabled])').forEach(button => {
                button.addEventListener('click', handleMarkDoneClick);
            });
        } catch (error) {
            spinnerContainer.style.display = 'none';
            workoutGrid.innerHTML = `<p style="color: #e74c3c; text-align: center; font-weight: bold;">Falha ao carregar seu treino: ${error.message}</p>`;
        }
    }

    function createDayCard(day, isCompletedToday) {
        const card = document.createElement('div');
        card.className = 'day-card';
        const isRestDay = !day.exercises || day.exercises.length === 0;
        if (isRestDay) {
            card.classList.add('rest-day');
            card.innerHTML = `<h3 class="day-card-header">${day.dayName}</h3><div class="rest-day-content"><i class="fas fa-couch"></i><span>Dia de Descanso</span></div>`;
        } else {
            let exercisesHtml = '<ul class="day-card-exercises">';
            day.exercises.forEach(ex => { exercisesHtml += `<li>${ex.name} (${ex.setsReps})</li>`; });
            exercisesHtml += '</ul>';
            card.innerHTML = `<h3 class="day-card-header">${day.dayName}</h3>${exercisesHtml}<button class="complete-workout-btn ${isCompletedToday ? 'completed' : ''}" data-day-name="${day.dayName}" ${isCompletedToday ? 'disabled' : ''}><span class="btn-text">${isCompletedToday ? 'Concluído Hoje' : 'Marcar como Feito'}</span><i class="fas fa-check checkmark"></i><div class="spinner"></div></button>`;
        }
        return card;
    }

    async function handleMarkDoneClick(event) {
        const button = event.currentTarget;
        const dayName = button.dataset.dayName;
        button.classList.add('loading');
        button.disabled = true;

        try {
            const response = await api.markWorkoutDone(dayName);
            button.classList.remove('loading');
            button.classList.add('completed');

            if (response.weekCompleted) {
                startWeeklyCompletionSequence(response);
            } else if (response.allDone) {
                animateXpCounter(response.newXp, response.gainedXp);
            }
        } catch (error) {
            button.classList.remove('loading');
            button.disabled = error.message.includes('já foi concluído');
            if(error.message.includes('já foi concluído')) button.classList.add('completed');
            alert(`Erro: ${error.message}`);
        }
    }

    // ======================================================
    // --- ANIMAÇÕES E EFEITOS VISUAIS ---
    // ======================================================

    function updateSidebarProgress(userProfile) {
        if (!userProfile) return;
        userProfileData = userProfile;
        if (xpValueEl) xpValueEl.textContent = userProfile.xp || 0;
        if (xpProgressBarInner && userProfile.levelInfo) {
            xpProgressBarInner.style.width = `${userProfile.levelInfo.progressPercentage}%`;
        }
        if (xpPercentageEl && userProfile.levelInfo) {
            xpPercentageEl.textContent = `${userProfile.levelInfo.progressPercentage}%`;
        }
    }
    
    async function startWeeklyCompletionSequence(response) {
        if (!completionOverlay) return;
        
        completionIcon.style.display = 'block';
        completionMessage.style.display = 'none';
        xpGainAnimation.style.display = 'none';
        completionOverlay.classList.add('show');
        
        await delay(1200);
        
        completionMessage.style.display = 'inline-block';
        await typewriterEffect(completionMessage, 'Parabéns! Você completou todos os treinos da semana!');
        
        await delay(1000);

        xpGainAnimation.style.display = 'block';
        await Promise.all([
            animateBonusXp(xpGainSpan, response.gainedXp),
            animateXpCounter(response.newXp, response.gainedXp)
        ]);

        await delay(2000);
        completionOverlay.classList.remove('show');
    }

    function typewriterEffect(element, text) {
        return new Promise(resolve => {
            let i = 0;
            element.innerHTML = "";
            element.style.width = '0ch';
            element.style.animation = `blinkCursor 0.75s step-end infinite`;
            const typing = setInterval(() => {
                if (i < text.length) {
                    element.innerHTML += text.charAt(i);
                    element.style.width = `${i + 1}ch`;
                    i++;
                } else {
                    clearInterval(typing);
                    element.style.borderRight = 'none';
                    resolve();
                }
            }, 50);
        });
    }

    function animateXpCounter(targetXp, gainedXp) {
        return new Promise(resolve => {
            if (!xpValueEl) return resolve();
            const startXp = targetXp - gainedXp;
            const duration = 1000, frameDuration = 1000 / 60;
            const totalFrames = Math.round(duration / frameDuration);
            const xpIncrement = (targetXp - startXp) / totalFrames;
            let currentFrame = 0;
            const counter = setInterval(() => {
                currentFrame++;
                xpValueEl.textContent = Math.floor(startXp + (xpIncrement * currentFrame));
                if (currentFrame >= totalFrames) {
                    clearInterval(counter);
                    xpValueEl.textContent = targetXp;
                    authService.getUserProfile().then(profile => {
                        updateSidebarProgress(profile);
                        resolve();
                    });
                }
            }, frameDuration);
        });
    }
    
    function animateBonusXp(element, bonusAmount) {
        return new Promise(resolve => {
            if (!element) return resolve();
            let start = 0;
            const duration = 1000;
            const increment = bonusAmount / (duration / 16);
            function step() {
                start += increment;
                if (start >= bonusAmount) {
                    element.textContent = `+${bonusAmount} XP`;
                    resolve();
                } else {
                    element.textContent = `+${Math.floor(start)} XP`;
                    requestAnimationFrame(step);
                }
            }
            step();
        });
    }
    
    // ======================================================
    // --- INICIALIZAÇÃO DO DASHBOARD ---
    // ======================================================

    async function initializeDashboard() {
        if (!authService.isLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }
        try {
            const userProfile = await authService.getUserProfile();
            updateSidebarProgress(userProfile);
        } catch (error) {
            console.error("Não foi possível carregar os dados iniciais.", error);
        }
        const initialPage = window.location.hash.substring(1) || 'home';
        loadPage(initialPage);
    }

    initializeDashboard();
});