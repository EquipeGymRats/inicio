/**
 * home.js
 * Lógica da página Home.
 */

import { api } from '../apiService.js';
import { authService } from '../auth.js';

let currentWorkout = null;

document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    setupEventListeners();
});

function loadAllData() {
    loadUserProfile();
    loadTodayWorkout();
    loadTodayNutrition();
    loadFeed();
}

function setupEventListeners() {
    const postForm = document.getElementById('post-form');
    if (postForm) {
        postForm.addEventListener('submit', handlePostCreation);
    }
    const completeWorkoutBtn = document.getElementById('complete-workout-btn');
    if (completeWorkoutBtn) {
        completeWorkoutBtn.addEventListener('click', handleWorkoutCompletion);
    }

    const viewDietBtn = document.getElementById('view-diet-btn');
    if (viewDietBtn) {
        viewDietBtn.addEventListener('click', handleViewPlanClick);
    }

    const viewTrainingBtn = document.getElementById('view-training-btn');
    if (viewTrainingBtn) {
        viewTrainingBtn.addEventListener('click', handleViewFullPlanClick);
    }
    
    const fileInput = document.getElementById('post-image');
    const fileNameDisplay = document.getElementById('file-name-display');

    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', () => {
            fileNameDisplay.innerHTML = '';
            if (fileInput.files.length > 0) {
                const fileName = fileInput.files[0].name;
                const fileInfoHtml = `<i class="fa-solid fa-paperclip"></i> <span class="file-name-text">${fileName}</span>`;
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-file-btn';
                removeBtn.type = 'button';
                removeBtn.innerHTML = '&times;';
                removeBtn.addEventListener('click', () => {
                    fileInput.value = ''; 
                    fileNameDisplay.innerHTML = '';
                });
                fileNameDisplay.innerHTML = fileInfoHtml;
                fileNameDisplay.appendChild(removeBtn);
            }
        });
    }
}

// --- Funções de Carregamento e Renderização ---

function handleViewPlanClick() {
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const todayName = dayNames[new Date().getDay()];
    window.location.href = `nutrition-plan.html?day=${encodeURIComponent(todayName)}`;
}

async function loadUserProfile() {
    try {
        const user = await authService.getUserProfile();
        renderProfileCard(user); // Apenas uma função de renderização agora
        localStorage.setItem('userProfile', JSON.stringify(user));
    } catch (error) {
        console.error('Erro ao buscar perfil do usuário:', error);
        const cachedUser = JSON.parse(localStorage.getItem('userProfile'));
        if (cachedUser) {
            renderProfileCard(cachedUser);
        } else {
            document.getElementById('profile-card').innerHTML = '<p class="error-msg">Não foi possível carregar o perfil.</p>';
        }
    }
}

// Função refatorada para renderizar o mascote no lado direito do card
function renderProfileCard(user) {
    const profileCard = document.getElementById('profile-card');
    const levelInfo = user.levelInfo;
    const currentLevel = levelInfo.currentLevel;
    const nextLevel = levelInfo.nextLevel;
    
    let xpForThisLevel = currentLevel.minXp;
    let xpForNextLevel = nextLevel ? nextLevel.minXp : user.xp;
    let totalXpNeededForNext = nextLevel ? xpForNextLevel - xpForThisLevel : 1;
    let xpGainedInThisLevel = user.xp - xpForThisLevel;
    const xpPercentage = Math.min((xpGainedInThisLevel / totalXpNeededForNext) * 100, 100);

    // Nova estrutura com 3 seções: avatar, info e mascote
    profileCard.innerHTML = `
        <img src="${user.profilePicture}" alt="Foto do Perfil" class="profile-card-avatar">
        
        <div class="profile-card-info">
            <div class="profile-card-header">
                <span class="profile-card-username">Olá, ${user.username.split(' ')[0]}!</span>
                <span class="profile-card-objective">Foco: ${user.mainObjective || 'Não definido'}</span>
            </div>
            <div class="profile-card-xp">
                <div class="xp-bar">
                    <div class="xp-bar-fill" style="width: ${xpPercentage}%"></div>
                    <span class="xp-bar-text">${user.xp} / ${nextLevel ? xpForNextLevel : 'MAX'} XP</span>
                </div>
            </div>
        </div>

        <div class="profile-card-mascot">
            <img src="${currentLevel.mascotImageUrl}" alt="Mascote do Nível" class="profile-mascot-image">
            <span class="profile-mascot-level">${currentLevel.name}</span>
        </div>
    `;

    const avatarElement = profileCard.querySelector('.profile-card-avatar');
    if (avatarElement && currentLevel.borderColor) {
        avatarElement.style.borderColor = currentLevel.borderColor;
    }
}

async function loadTodayWorkout() {
    const workoutContent = document.getElementById('workout-content');
    const workoutActions = document.querySelector('#workout-day .card-actions');
    const statusTag = document.getElementById('workout-status-tag');

    try {
        const workout = await api.getTodayWorkout();
        currentWorkout = workout; 

        if (workout.isRestDay) {
            workoutContent.innerHTML = `<h4>${workout.message}</h4>`;
            if (workoutActions) workoutActions.style.display = 'none';
            if (statusTag) statusTag.style.display = 'none';
            return;
        }

        workoutContent.innerHTML = `
            <h4>${workout.dayName}</h4>
            <ul class="exercise-list">
                ${workout.exercises.map(ex => `<li>${ex.name} - ${ex.setsReps}</li>`).join('')}
            </ul>
        `;
        if (workoutActions) workoutActions.style.display = 'flex';
        updateWorkoutCardUI(workout);

    } catch (error) {
        console.error('Erro ao buscar treino do dia:', error);
        workoutContent.innerHTML = '<p class="error-msg">Crie um plano de treino para ver o resumo aqui.</p>';
        if (workoutActions) workoutActions.style.display = 'none';
        if (statusTag) statusTag.style.display = 'none';
    }
}

function updateWorkoutCardUI(workout) {
    const statusTag = document.getElementById('workout-status-tag');
    const completeBtn = document.getElementById('complete-workout-btn');
    
    if (statusTag) statusTag.style.display = 'inline-block';

    if (workout.isCompleted) {
        if (statusTag) {
            statusTag.textContent = 'Concluído';
            statusTag.className = 'status-tag status-completed';
        }
        if (completeBtn) {
            completeBtn.innerHTML = `<i class="fa-solid fa-check"></i> Concluído`;
            completeBtn.classList.add('completed');
            completeBtn.disabled = true;
        }
    } else {
        if (statusTag) {
            statusTag.textContent = 'Pendente';
            statusTag.className = 'status-tag status-pending';
        }
        if (completeBtn) {
            completeBtn.innerHTML = 'Concluir Treino';
            completeBtn.classList.remove('completed');
            completeBtn.disabled = false;
        }
    }
}

async function handleWorkoutCompletion() {
    if (!currentWorkout || !currentWorkout.dayName) {
        alert('Informações do treino não carregadas. Tente recarregar a página.');
        return;
    }

    const completeBtn = document.getElementById('complete-workout-btn');
    
    completeBtn.disabled = true;
    completeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando...`;

    try {
        const response = await api.completeTodayWorkout(currentWorkout.dayName);
        alert(response.message); 
        currentWorkout.isCompleted = true;
        updateWorkoutCardUI(currentWorkout);
        loadUserProfile();
    } catch (error) {
        console.error('Erro ao concluir o treino:', error);
        alert(error.message || 'Não foi possível concluir o treino. Tente novamente.');
        completeBtn.disabled = false;
        completeBtn.innerHTML = 'Concluir Treino';
    }
}

async function loadTodayNutrition() {
    const nutritionContent = document.getElementById('nutrition-content');
    const nutritionActions = document.querySelector('#nutrition-day .card-actions');
    
    try {
        const nutritionPlan = await api.getNutritionPlan();
        if (!nutritionPlan || !nutritionPlan.plan) {
            throw new Error('Plano de nutrição não encontrado.');
        }

        const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
        const todayName = dayNames[new Date().getDay()];
        const todayPlan = nutritionPlan.plan.find(day => day.dayName === todayName);

        if (!todayPlan || todayPlan.meals.length === 0) {
            nutritionContent.innerHTML = '<p class="info-msg">Dia de alimentação livre ou não definido no plano.</p>';
            if(nutritionActions) nutritionActions.style.display = 'none';
            return;
        }
        
        let tipHtml = '';
        if (nutritionPlan.tips && nutritionPlan.tips.length > 0) {
            const randomTip = nutritionPlan.tips[Math.floor(Math.random() * nutritionPlan.tips.length)];
            tipHtml = `
                <div class="daily-tip">
                    <i class="fa-solid fa-lightbulb"></i>
                    <p>${randomTip}</p>
                </div>
            `;
        }

        nutritionContent.innerHTML = `
            <ul class="daily-meal-list">
                ${todayPlan.meals.map(meal => `
                    <li class="meal-group">
                        <div class="meal-group-header">
                            <i class="${meal.icon || 'fa-solid fa-utensils'} fa-fw"></i>
                            <span>${meal.mealName}</span>
                        </div>
                        <ul class="food-item-list">
                            ${meal.foods.map(food => `<li>${food}</li>`).join('')}
                        </ul>
                    </li>
                `).join('')}
            </ul>
            ${tipHtml} 
        `;
        if(nutritionActions) nutritionActions.style.display = 'flex';

    } catch (error) {
        console.error('Info: Nenhum plano de nutrição encontrado para o usuário.', error.message);
        nutritionContent.innerHTML = '<p class="error-msg">Crie um plano alimentar para ver o resumo aqui.</p>';
        if(nutritionActions) nutritionActions.style.display = 'none';
    }
}

async function loadFeed() {
    const feedPostsContainer = document.getElementById('feed-posts');
    try {
        const posts = await api.getFeedPosts();
        renderFeed(posts);
    } catch (error) {
        console.error('Erro ao buscar feed:', error);
        feedPostsContainer.innerHTML = '<p class="error-msg">Não foi possível carregar o feed.</p>';
    }
}

function renderFeed(posts) {
    const feedPostsContainer = document.getElementById('feed-posts');
    if (posts.length === 0) {
        feedPostsContainer.innerHTML = '<p>Ainda não há posts na comunidade. Seja o primeiro!</p>';
        return;
    }
    feedPostsContainer.innerHTML = posts.map(createPostHtml).join('');
}

function createPostHtml(post) {
    const postDate = new Date(post.createdAt);
    const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(postDate);

    return `
        <div class="post">
            <div class="post-header">
                <div class="post-author-details">
                    <img src="${post.user.profilePicture}" alt="Avatar" class="post-avatar">
                    <div class="post-author-info">
                        <div class="author-name">${post.user.username}</div>
                        <div class="post-date">${formattedDate}</div>
                    </div>
                </div>
                <button class="post-options-btn">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
            </div>
            <div class="post-content">
                <p>${post.text}</p>
                ${post.imageUrl ? `<img src="${post.imageUrl}" alt="Imagem do post" class="post-image">` : ''}
            </div>
        </div>
    `;
}

function handleViewFullPlanClick() {
        window.location.href = `my-training.html`;
}

async function handlePostCreation(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;

    submitButton.disabled = true;
    submitButton.innerHTML = 'Postando...';
    
    const formData = new FormData(form);
    try {
        const newPost = await api.createPost(formData);
        const feedContainer = document.getElementById('feed-posts');
        const newPostHtml = createPostHtml(newPost);
        document.getElementById('file-name-display').innerHTML = '';
        form.reset();
        
        if (feedContainer.innerHTML.includes('Ainda não há posts')) {
            feedContainer.innerHTML = newPostHtml;
        } else {
            feedContainer.insertAdjacentHTML('afterbegin', newPostHtml);
        }
        
    } catch (error) {
        console.error('Erro ao criar post:', error);
        alert('Falha ao criar o post. Tente novamente.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}