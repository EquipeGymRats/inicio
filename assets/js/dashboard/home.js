/**
 * home.js
 * Lógica principal da página Home, incluindo perfil, feed, scroll infinito e modal de usuário.
 */

import { api } from '../apiService.js';
import { authService } from '../auth.js';

// --- ESTADO DA PÁGINA ---
let currentUserIsAdmin = false;
let currentWorkout = null;
let currentPage = 1;
let totalPages = 1;
let isLoadingFeed = false;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    setupEventListeners();
});

/**
 * Carrega todos os dados iniciais da página.
 */
async function loadAllData() {
    currentUserIsAdmin = await authService.isAdmin();
    
    loadUserProfile();
    loadTodayWorkout();
    loadTodayNutrition();
    loadPosts(1);
    checkUrlForProfile(); // Verifica se um perfil deve ser aberto via URL
}

/**
 * Configura todos os event listeners da página.
 */
function setupEventListeners() {
    document.getElementById('post-form')?.addEventListener('submit', handlePostCreation);
    document.getElementById('complete-workout-btn')?.addEventListener('click', handleWorkoutCompletion);
    document.querySelector('.feed-card .card-content')?.addEventListener('scroll', handleFeedScroll);
    document.getElementById('feed-posts')?.addEventListener('click', handleFeedClick);
    document.getElementById('view-diet-btn')?.addEventListener('click', () => redirectToPage('nutrition-plan.html'));
    document.getElementById('view-training-btn')?.addEventListener('click', () => redirectToPage('my-training.html'));
    document.getElementById('post-image')?.addEventListener('change', handleFileSelection);
    window.addEventListener('popstate', handleBrowserNavigation);
}

// --- CARREGAMENTO DE DADOS ---

async function loadUserProfile() {
    try {
        const user = await authService.getUserProfile();
        renderProfileCard(user);
    } catch (error) {
        console.error('Erro ao buscar perfil do usuário:', error);
        document.getElementById('profile-card').innerHTML = '<p class="error-msg">Não foi possível carregar o perfil.</p>';
    }
}

async function loadTodayWorkout() {
    const workoutContent = document.getElementById('workout-content');
    const workoutActions = document.querySelector('#workout-day .card-actions');
    try {
        const workout = await api.getTodayWorkout();
        currentWorkout = workout;
        renderTodayWorkout(workout);
    } catch (error) {
        console.error('Erro ao buscar treino do dia:', error);
        if(workoutContent) workoutContent.innerHTML = '<p class="error-msg">Crie um plano de treino para ver o resumo aqui.</p>';
        if (workoutActions) workoutActions.style.display = 'none';
    }
}

async function loadTodayNutrition() {
    const nutritionContent = document.getElementById('nutrition-content');
    const nutritionActions = document.querySelector('#nutrition-day .card-actions');
    try {
        const nutritionPlan = await api.getNutritionPlan();
        renderTodayNutrition(nutritionPlan);
    } catch (error) {
        if(nutritionContent) nutritionContent.innerHTML = '<p class="error-msg">Crie um plano alimentar para ver o resumo aqui.</p>';
        if (nutritionActions) nutritionActions.style.display = 'none';
    }
}

async function loadPosts(page = 1) {
    if (isLoadingFeed) return;
    isLoadingFeed = true;
    const trigger = document.getElementById('feed-scroll-trigger');
    if(trigger) trigger.style.display = 'block';

    try {
        const response = await api.getFeedPosts(page);
        renderFeed(response.posts, page > 1);
        currentPage = response.currentPage;
        totalPages = response.totalPages;
        if (currentPage >= totalPages && trigger) {
            trigger.style.display = 'none';
        }
    } catch (error) {
        console.error('Erro ao buscar feed:', error);
        const feedContainer = document.getElementById('feed-posts');
        if (page === 1 && feedContainer) {
            feedContainer.innerHTML = '<p class="error-msg">Não foi possível carregar o feed.</p>';
        }
    } finally {
        isLoadingFeed = false;
        const finalTrigger = document.getElementById('feed-scroll-trigger');
        if (currentPage >= totalPages && finalTrigger) {
            finalTrigger.style.display = 'none';
        }
    }
}

// --- RENDERIZAÇÃO ---

function renderProfileCard(user) {
    const profileCard = document.getElementById('profile-card');
    if (!user || !user.levelInfo) {
        if(profileCard) profileCard.innerHTML = '<p class="error-msg">Não foi possível carregar o perfil.</p>';
        return;
    }
    const { levelInfo, xp, mainObjective, username, profilePicture } = user;
    const { currentLevel, nextLevel } = levelInfo;
    const xpForThisLevel = currentLevel.minXp;
    const xpForNextLevel = nextLevel ? nextLevel.minXp : xp;
    const totalXpNeededForNext = nextLevel ? xpForNextLevel - xpForThisLevel : 1;
    const xpGainedInThisLevel = xp - xpForThisLevel;
    const xpPercentage = Math.min((xpGainedInThisLevel / totalXpNeededForNext) * 100, 100);

    profileCard.innerHTML = `
        <img src="${profilePicture}" alt="Foto do Perfil" class="profile-card-avatar">
        <div class="profile-card-info">
            <div class="profile-card-header">
                <div class="author-name-container">
                    <span class="profile-card-username">Olá, ${username.split(' ')[0]}!</span>
                    ${createUserRoleTag(user)}
                </div>
                <span class="profile-card-objective">Foco: ${mainObjective || 'Não definido'}</span>
            </div>
            <div class="profile-card-xp">
                <div class="xp-bar">
                    <div class="xp-bar-fill" style="width: ${xpPercentage}%"></div>
                    <span class="xp-bar-text">${xp} / ${nextLevel ? xpForNextLevel : 'MAX'} XP</span>
                </div>
            </div>
        </div>
        <div class="profile-card-mascot">
            <img src="${currentLevel.mascotImageUrl}" alt="Mascote do Nível" class="profile-mascot-image">
            <span class="profile-mascot-level">${currentLevel.name}</span>
        </div>`;
    
    const avatarElement = profileCard.querySelector('.profile-card-avatar');
    if (avatarElement && currentLevel.borderColor) {
        avatarElement.style.borderColor = currentLevel.borderColor;
        avatarElement.style.boxShadow = `0 0 10px ${currentLevel.borderColor}, 0 0 15px ${currentLevel.borderColor}44`;
    }
}

function renderTodayWorkout(workout) {
    const workoutContent = document.getElementById('workout-content');
    const workoutActions = document.querySelector('#workout-day .card-actions');
    if (!workoutContent) return;

    if (workout.isRestDay) {
        workoutContent.innerHTML = `<h4>${workout.message}</h4>`;
        if (workoutActions) workoutActions.style.display = 'none';
        return;
    }
    workoutContent.innerHTML = `<h4>${workout.dayName}</h4><ul class="exercise-list">${workout.exercises.map(ex => `<li>${ex.name} - ${ex.setsReps}</li>`).join('')}</ul>`;
    if (workoutActions) workoutActions.style.display = 'flex';
    
    const completeBtn = document.getElementById('complete-workout-btn');
    if(completeBtn){
        if (workout.isCompleted) {
            completeBtn.innerHTML = `<i class="fa-solid fa-check"></i> Concluído`;
            completeBtn.disabled = true;
        } else {
            completeBtn.innerHTML = 'Concluir Treino';
            completeBtn.disabled = false;
        }
    }
}

function renderTodayNutrition(nutritionPlan) {
    const nutritionContent = document.getElementById('nutrition-content');
    const nutritionActions = document.querySelector('#nutrition-day .card-actions');
    if(!nutritionContent) return;

    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const todayName = dayNames[new Date().getDay()];
    const todayPlan = nutritionPlan?.plan.find(day => day.dayName === todayName);

    if (!todayPlan || todayPlan.meals.length === 0) {
        nutritionContent.innerHTML = '<p class="info-msg">Dia de alimentação livre ou não definido.</p>';
        if (nutritionActions) nutritionActions.style.display = 'none';
        return;
    }
    const randomTip = nutritionPlan.tips?.[Math.floor(Math.random() * nutritionPlan.tips.length)] || '';
    const tipHtml = randomTip ? `<div class="daily-tip"><i class="fa-solid fa-lightbulb"></i><p>${randomTip}</p></div>` : '';
    nutritionContent.innerHTML = `<ul class="daily-meal-list">${todayPlan.meals.map(meal => `<li class="meal-group"><div class="meal-group-header"><i class="${meal.icon || 'fa-solid fa-utensils'} fa-fw"></i><span>${meal.mealName}</span></div><ul class="food-item-list">${meal.foods.map(food => `<li>${food}</li>`).join('')}</ul></li>`).join('')}</ul>${tipHtml}`;
    if (nutritionActions) nutritionActions.style.display = 'flex';
}

function renderFeed(posts, append = false) {
    const feedContainer = document.getElementById('feed-posts');
    if (!feedContainer) return;

    if (!append) feedContainer.innerHTML = '';
    if (posts.length === 0 && !append) {
        feedContainer.innerHTML = '<p class="info-msg">Ainda não há posts. Seja o primeiro!</p>';
        return;
    }
    const postsHtml = posts.map(createPostHtml).join('');
    feedContainer.insertAdjacentHTML('beforeend', postsHtml);
}

function createPostHtml(post) {
    const postDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(post.createdAt));
    const borderColor = post.user?.levelInfo?.currentLevel?.borderColor || 'transparent';
    const optionsMenuHtml = currentUserIsAdmin ? `
        <div class="post-options">
            <button class="post-options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            <div class="post-options-menu"><a href="#" class="delete-post-action">Deletar Post</a></div>
        </div>` : '';

    return `
        <div class="post" data-post-id="${post._id}">
            <div class="post-header">
                <div class="post-author-details">
                    <img src="${post.user.profilePicture}" alt="Avatar" class="post-avatar" style="border-color: ${borderColor}; box-shadow: 0 0 7px ${borderColor}80;">
                    <div class="post-author-info">
                        <div class="author-name-container">
                            <div class="author-name">${post.user.username}</div>
                            ${createUserRoleTag(post.user)}
                        </div>
                        <div class="post-date">${postDate}</div>
                    </div>
                </div>
                ${optionsMenuHtml}
            </div>
            <div class="post-content">
                <p>${post.text.replace(/\n/g, '<br>')}</p>
                ${post.imageUrl ? `<img src="${post.imageUrl}" alt="Imagem do post" class="post-image">` : ''}
            </div>
        </div>`;
}

function createUserRoleTag(user) {
    if (user?.role === 'admin') {
        return `<span class="user-role-tag admin-tag"><i class="fa-solid fa-shield-halved"></i> Admin</span>`;
    }
    return '';
}

// --- HANDLERS DE EVENTOS ---

async function handleWorkoutCompletion() {
    if (!currentWorkout?.dayName) return;
    const completeBtn = document.getElementById('complete-workout-btn');
    if(!completeBtn) return;

    completeBtn.disabled = true;
    completeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando...`;
    try {
        await api.completeTodayWorkout(currentWorkout.dayName);
        currentWorkout.isCompleted = true;
        renderTodayWorkout(currentWorkout);
        loadUserProfile();
    } catch (error) {
        alert(error.message || 'Não foi possível concluir o treino.');
        completeBtn.disabled = false;
        completeBtn.innerHTML = 'Concluir Treino';
    }
}

async function handlePostCreation(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const fileInput = document.getElementById('post-image');
    const originalFile = fileInput.files[0];

    submitButton.disabled = true;
    submitButton.innerHTML = 'Preparando...';

    try {
        const formData = new FormData(form);
        if (originalFile) {
            submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Comprimindo...';
            const options = { maxSizeMB: 9.5, maxWidthOrHeight: 1920, useWebWorker: true, initialQuality: 0.8 };
            const compressedFile = await imageCompression(originalFile, options);
            formData.set('postImage', compressedFile, compressedFile.name);
        }

        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Postando...';
        await api.createPost(formData);
        // A API de criar post pode não retornar os dados completos do user, então buscamos de novo
        await loadPosts(1); 
        
        form.reset();
        document.getElementById('file-name-display').innerHTML = '';
    } catch (error) {
        alert(error.message || 'Falha ao criar o post.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Postar';
    }
}

function handleFeedScroll(event) {
    const element = event.target;
    const isNearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 100;
    if (isNearBottom && !isLoadingFeed && currentPage < totalPages) {
        loadPosts(currentPage + 1);
    }
}

function handleFileSelection(event) {
    const fileInput = event.target;
    const fileNameDisplay = document.getElementById('file-name-display');
    if(!fileNameDisplay) return;
    fileNameDisplay.innerHTML = '';
    if (fileInput.files.length > 0) {
        const fileName = fileInput.files[0].name;
        fileNameDisplay.innerHTML = `<i class="fa-solid fa-paperclip"></i> <span class="file-name-text">${fileName}</span>`;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file-btn';
        removeBtn.type = 'button';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => {
            fileInput.value = '';
            fileNameDisplay.innerHTML = '';
        };
        fileNameDisplay.appendChild(removeBtn);
    }
}

function handleFeedClick(event) {
    const authorDetails = event.target.closest('.post-author-details');
    const optionsBtn = event.target.closest('.post-options-btn');

    if (authorDetails && !optionsBtn) {
        event.preventDefault();
        const username = authorDetails.querySelector('.author-name').textContent;
        openProfileModal(username);
    }
    handleFeedActions(event);
}

async function handleFeedActions(event) {
    const optionsBtn = event.target.closest('.post-options-btn');
    if (optionsBtn) {
        const menu = optionsBtn.nextElementSibling;
        document.querySelectorAll('.post-options-menu').forEach(m => m !== menu && m.classList.remove('show'));
        menu.classList.toggle('show');
    }

    const deleteBtn = event.target.closest('.delete-post-action');
    if (deleteBtn) {
        event.preventDefault();
        if (confirm('Tem certeza que deseja deletar este post?')) {
            const postElement = deleteBtn.closest('.post');
            const postId = postElement.dataset.postId;
            try {
                await api.deletePost(postId);
                postElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                postElement.style.opacity = '0';
                postElement.style.transform = 'scale(0.95)';
                setTimeout(() => postElement.remove(), 300);
            } catch (error) {
                alert(`Erro ao deletar: ${error.message}`);
            }
        }
    }
}

function handleBrowserNavigation(event) {
    if (!window.location.hash.startsWith('#perfil/')) {
        closeProfileModal();
    } else {
        const username = window.location.hash.split('/')[1];
        if (username) openProfileModal(username);
    }
}

function redirectToPage(url) {
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const todayName = dayNames[new Date().getDay()];
    window.location.href = `${url}?day=${encodeURIComponent(todayName)}`;
}

// ===================================================================
// START: Bloco de Funcionalidade do Modal de Perfil
// ===================================================================

async function openProfileModal(username) {
    if (document.getElementById('profile-modal-backdrop')) return;

    const loadingBackdrop = document.createElement('div');
    loadingBackdrop.id = 'profile-modal-backdrop';
    loadingBackdrop.className = 'modal-backdrop show';
    loadingBackdrop.innerHTML = `<div class="profile-modal" style="justify-content: center; align-items: center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>`;
    document.body.appendChild(loadingBackdrop);
    
    try {
        const userProfile = await api.getUserProfileByUsername(username);
        renderProfileModal(userProfile);
        history.pushState({ username }, `Perfil de ${username}`, `#perfil/${username}`);
    } catch (error) {
        alert(error.message || 'Não foi possível carregar o perfil.');
        closeProfileModal();
    }
}

function closeProfileModal() {
    const modalBackdrop = document.getElementById('profile-modal-backdrop');
    if (modalBackdrop) {
        modalBackdrop.classList.remove('show');
        modalBackdrop.addEventListener('transitionend', () => modalBackdrop.remove(), { once: true });
    }
    if (window.location.hash.startsWith('#perfil/')) {
       history.pushState({}, '', window.location.pathname);
    }
}

function renderProfileModal(userProfile) {
    const joinDate = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(userProfile.createdAt));
    const levelInfo = userProfile.levelInfo.currentLevel;

    const dayNames = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    const todayName = dayNames[new Date().getDay()];

    let workoutHtml = '<p class="info-msg">O usuário não possui um plano de treino ativo.</p>';
    if (userProfile.training?.plan) {
        const todayWorkout = userProfile.training.plan.find(d => d.dayName.toLowerCase() === todayName);
        workoutHtml = (todayWorkout && todayWorkout.exercises.length > 0)
            ? `<h4 class="modal-content-title">${todayWorkout.dayName}</h4><ul class="modal-content-list">${todayWorkout.exercises.map(ex => `<li>${ex.name}</li>`).join('')}</ul>`
            : '<p class="info-msg">Hoje é dia de descanso para este usuário.</p>';
    }

    const nutritionHtml = userProfile.nutrition?.plan
        ? `<ul class="modal-content-list">${userProfile.nutrition.plan.map(day => `<li><strong>${day.dayName}:</strong> ${day.meals.length} refeições</li>`).join('')}</ul>`
        : '<p class="info-msg">O usuário não possui um plano de alimentação ativo.</p>';

    const modalHtml = `
        <div class="profile-modal" id="profile-modal-content">
            <button class="modal-close-btn">&times;</button>
            <div class="profile-modal-header">
                <img src="${userProfile.profilePicture}" alt="Avatar de ${userProfile.username}" class="profile-modal-avatar">
                <h2 class="profile-modal-username">${userProfile.username}</h2>
                <p class="profile-modal-level">${levelInfo.name}</p>
                <p class="profile-modal-since">Usuário desde ${joinDate.replace('.', '')}</p>
            </div>
            <div class="modal-tabs">
                <button class="modal-tab-btn active" data-tab="treino">Treino do Dia</button>
                <button class="modal-tab-btn" data-tab="dieta">Dieta</button>
            </div>
            <div class="modal-content-container">
                <div id="tab-treino" class="modal-content active">${workoutHtml}</div>
                <div id="tab-dieta" class="modal-content">${nutritionHtml}</div>
            </div>
            <div class="profile-modal-actions">
                <button class="follow-button ${userProfile.isFollowing ? 'following' : ''}" data-user-id="${userProfile._id}">
                    ${userProfile.isFollowing ? '<i class="fa-solid fa-check"></i> Seguindo' : '<i class="fa-solid fa-plus"></i> Seguir'}
                </button>
            </div>
        </div>`;

    const modalBackdrop = document.getElementById('profile-modal-backdrop');
    if(!modalBackdrop) return;
    modalBackdrop.innerHTML = modalHtml;
    
    const avatar = modalBackdrop.querySelector('.profile-modal-avatar');
    if (avatar && levelInfo.borderColor) {
        avatar.style.borderColor = levelInfo.borderColor;
        avatar.style.boxShadow = `0 0 15px ${levelInfo.borderColor}aa`;
    }

    modalBackdrop.querySelector('.modal-close-btn')?.addEventListener('click', closeProfileModal);
    modalBackdrop.addEventListener('click', e => e.target.id === 'profile-modal-backdrop' && closeProfileModal());

    modalBackdrop.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modalBackdrop.querySelector('.modal-tab-btn.active')?.classList.remove('active');
            modalBackdrop.querySelector('.modal-content.active')?.classList.remove('active');
            btn.classList.add('active');
            modalBackdrop.querySelector(`#tab-${btn.dataset.tab}`)?.classList.add('active');
        });
    });

    const followBtn = modalBackdrop.querySelector('.follow-button');
    followBtn?.addEventListener('click', async () => {
        const userId = followBtn.dataset.userId;
        const isFollowing = followBtn.classList.contains('following');
        followBtn.disabled = true;
        try {
            await (isFollowing ? api.unfollowUser(userId) : api.followUser(userId));
            followBtn.classList.toggle('following');
            followBtn.innerHTML = followBtn.classList.contains('following')
                ? '<i class="fa-solid fa-check"></i> Seguindo'
                : '<i class="fa-solid fa-plus"></i> Seguir';
        } catch (error) {
            console.error("Erro ao seguir/deixar de seguir:", error);
            alert('Não foi possível realizar a ação.');
        } finally {
            followBtn.disabled = false;
        }
    });
}

function checkUrlForProfile() {
    if (window.location.hash.startsWith('#perfil/')) {
        const username = window.location.hash.split('/')[1];
        if (username) openProfileModal(username);
    }
}
// ===================================================================
// END: Bloco de Funcionalidade do Modal de Perfil
// ===================================================================
