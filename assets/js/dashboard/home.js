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
let apiStatusCheckInterval = null;
let isApiUnstable = false;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    setupEventListeners();
    checkApiStatus();
});

/**
 * Inicia o monitoramento do status da API
 */
/**
 * Verifica se a API está funcionando corretamente
 */
async function checkApiStatus() {
    try {
        await api.ping();
        if (isApiUnstable) {
            hideApiUnstableWarning();
        }
    } catch (error) {
        console.warn('API parece estar instável:', error);
        if (!isApiUnstable) {
            showApiUnstableWarning();
        }
    }
}

/**
 * Mostra o aviso de instabilidade da API
 */
function showApiUnstableWarning() {
    isApiUnstable = true;
    const existingWarning = document.getElementById('api-unstable-warning');
    if (existingWarning) return;
    
    const warning = document.createElement('div');
    warning.id = 'api-unstable-warning';
    warning.className = 'api-unstable-warning';
    warning.innerHTML = `
        <div class="api-warning-content">
            <i class="fas fa-exclamation-triangle"></i>
            <span>Sistema instável - Algumas funcionalidades podem não funcionar corretamente</span>
            <button class="api-warning-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    document.body.insertBefore(warning, document.body.firstChild);
}

/**
 * Esconde o aviso de instabilidade da API
 */
function hideApiUnstableWarning() {
    isApiUnstable = false;
    const warning = document.getElementById('api-unstable-warning');
    if (warning) {
        warning.style.animation = 'slideUp 0.3s ease-out';
        warning.addEventListener('animationend', () => warning.remove());
    }
}

/**
 * Carrega todos os dados iniciais da página.
 */
async function loadAllData() {
    try {
        currentUserIsAdmin = await authService.isAdmin();
        loadUserProfile();
        loadTodayWorkout();
        loadTodayNutrition();
        loadPosts(1);
        checkUrlForProfile();
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        showApiUnstableWarning();
    }
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

    // === MELHORIA: Event Listeners para Contadores de Caracteres ===
    const postTextarea = document.getElementById('post-textarea');
    if (postTextarea) {
        postTextarea.addEventListener('input', handleCharCounter);
    }
    document.getElementById('feed-posts')?.addEventListener('input', (event) => {
        if (event.target.matches('.comment-input')) {
            handleCharCounter(event);
        }
    });

    window.addEventListener('popstate', handleBrowserNavigation);
    window.addEventListener('beforeunload', () => {
        if (apiStatusCheckInterval) clearInterval(apiStatusCheckInterval);
    });
}

// --- CARREGAMENTO DE DADOS ---

async function loadUserProfile() {
    try {
        const user = await authService.getUserProfile();
        renderProfileCard(user);
    } catch (error) {
        console.error('Erro ao buscar perfil do usuário:', error);
        document.getElementById('profile-card').innerHTML = '<p class="error-msg">Não foi possível carregar o perfil.</p>';
        if (error.message.includes('API não está acessível') || error.message.includes('fetch')) {
            showApiUnstableWarning();
        }
    }
}

async function loadTodayWorkout() {
    const workoutContent = document.getElementById('workout-content');
    const workoutActions = document.querySelector('#workout-day .card-actions');
    try {
        const response = await api.getTodayWorkout();
        if (response.isRestDay) {
            renderTodayWorkout(response);
        } else {
            currentWorkout = response.workout;
            renderTodayWorkout(response.workout);
        }
    } catch (error) {
        console.error('Erro ao buscar treino do dia:', error);
        if(workoutContent) workoutContent.innerHTML = `<div class="empty-state-container"><i class="fas fa-dumbbell empty-state-icon"></i><h5 class="empty-state-title">Comece a Treinar</h5><p class="empty-state-text">Nenhum plano de treino encontrado. Crie um para ver seu resumo diário aqui!</p></div>`; 
        if (workoutActions) workoutActions.style.display = 'none';
        if (error.message.includes('API não está acessível') || error.message.includes('fetch')) showApiUnstableWarning();
    }
}

async function loadTodayNutrition() {
    const nutritionContent = document.getElementById('nutrition-content');
    const nutritionActions = document.querySelector('#nutrition-day .card-actions');
    try {
        const nutritionPlan = await api.getNutritionPlan();
        renderTodayNutrition(nutritionPlan);
    } catch (error) {
        if(nutritionContent) nutritionContent.innerHTML = `<div class="empty-state-container"><i class="fas fa-utensils empty-state-icon"></i><h5 class="empty-state-title">Defina sua Dieta</h5><p class="empty-state-text">Nenhum plano alimentar encontrado. Gere o seu para ver o resumo das refeições do dia.</p></div>`;
        if (nutritionActions) nutritionActions.style.display = 'none';
        if (error.message.includes('API não está acessível') || error.message.includes('fetch')) showApiUnstableWarning();
    }
}

async function loadPosts(page = 1) {
    const feedContainer = document.getElementById('feed-posts');
    if (!feedContainer) return;
    if (isLoadingFeed) return;
    isLoadingFeed = true;
    
    const trigger = document.getElementById('feed-scroll-trigger');
    if (trigger) trigger.style.display = 'block';

    try {
        const response = await api.getFeedPosts(page);
        renderFeed(response.posts, page > 1);
        currentPage = response.currentPage;
        totalPages = response.totalPages;
        if (currentPage >= totalPages && trigger) trigger.style.display = 'none';
    } catch (error) {
        console.error('Erro ao buscar feed:', error);
        if (page === 1) {
            feedContainer.innerHTML = `<div class="empty-state-container" id="feed-error-state"><i class="fas fa-exclamation-triangle empty-state-icon" style="color: #E74C3C;"></i><h5 class="empty-state-title">Ocorreu um Erro</h5><p class="empty-state-text">Não conseguimos carregar seu feed. Pode ser um problema de conexão.</p><button class="btn btn-secondary" id="retry-feed-button">Tentar Novamente</button></div>`;
            document.getElementById('retry-feed-button')?.addEventListener('click', () => location.reload());
        }
        if (error.message.includes('API não está acessível') || error.message.includes('fetch')) showApiUnstableWarning();
    } finally {
        isLoadingFeed = false;
        if (trigger && currentPage >= totalPages) trigger.style.display = 'none';
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
        <img src="${profilePicture || 'assets/imagens/default-avatar.png'}" alt="Foto do Perfil" class="profile-card-avatar">
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
    if (!post.user) {
        console.warn(`Post com ID ${post._id} não possui um usuário associado.`, post);
        return '';
    }

    const isLikedClass = post.isLiked ? 'liked' : '';
    const heartIconClass = post.isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    const roleTagHtml = createUserRoleTag(post.user);
    const optionsMenuHtml = currentUserIsAdmin ? `
        <div class="post-options">
            <button class="post-options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            <div class="post-options-menu"><a href="#" class="delete-post-action">Deletar Post</a></div>
        </div>` : '';

    return `
        <div class="post" data-post-id="${post._id}">
            <div class="post-header">
                <div class="post-author-details">
                     <img src="${post.user.profilePicture || 'assets/imagens/default-avatar.png'}" alt="Avatar" class="post-avatar">
                     <div class="post-author-info">
                         <div class="author-name-container">
                             <div class="author-name">${post.user.username}</div>
                             ${roleTagHtml}
                         </div>
                         <div class="post-date">${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(post.createdAt))}</div>
                     </div>
                </div>
                ${currentUserIsAdmin ? `
                    <div class="post-options">
                        <button class="post-options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                        <div class="post-options-menu"><a href="#" class="delete-post-action">Deletar Post</a></div>
                    </div>` : ''}
            </div>
            <div class="post-content">
                <p>${post.text.replace(/\n/g, '<br>')}</p>
                ${post.imageUrl ? `<img src="${post.imageUrl}" alt="Imagem do post" class="post-image">` : ''}
            </div>
            <div class="post-actions">
                <button class="action-btn like-btn ${post.isLiked ? 'liked' : ''}">
                    <i class="${post.isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}"></i>
                    <span class="like-count">${post.likeCount}</span>
                </button>
                <button class="action-btn comment-btn">
                    <i class="fa-regular fa-comment"></i>
                    <span class="comment-count">${post.commentCount}</span>
                </button>
            </div>
            <div class="comment-section">
                <div class="comment-input-area">
                    <div class="comment-input-wrapper">
                        <input type="text" class="comment-input" placeholder="Adicione um comentário..." maxlength="300">
                        <span class="char-counter">300</span>
                    </div>
                    <button class="comment-submit-btn"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>
        </div>`;
}

function createUserRoleTag(user) {
    if (user?.role === 'admin') {
        return `<span class="user-role-tag admin-tag"><i class="fa-solid fa-shield-halved"></i> Admin</span>`;
    }
    return '';
}

function createCommentHtml(comment) {
    return `
        <div class="comment" data-comment-id="${comment._id}">
            <img src="${comment.user.profilePicture || 'assets/imagens/default-avatar.png'}" alt="Avatar" class="comment-avatar">
            <div class="comment-content">
                <strong class="comment-author">${comment.user.username}</strong>
                <p class="comment-text">${comment.text}</p>
            </div>
        </div>`;
}

function createCommentSkeletonHtml() {
    return Array(2).fill('').map(() => `
        <div class="comment-skeleton">
            <div class="skeleton skeleton-avatar" style="width: 32px; height: 32px; flex-shrink: 0;"></div>
            <div style="flex-grow: 1;">
                <div class="skeleton skeleton-text" style="width: 30%; height: 12px; margin-bottom: 6px;"></div>
                <div class="skeleton skeleton-text" style="width: 80%; height: 14px;"></div>
            </div>
        </div>
    `).join('');
}

// --- HANDLERS DE EVENTOS ---
// (O resto das funções de handler permanecem as mesmas)

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
        console.log(error.message || 'Não foi possível concluir o treino.');
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
        await loadPosts(1);
        
        form.reset();
        document.getElementById('file-name-display').innerHTML = '';
        
        // === MELHORIA: Reseta o contador do post ===
        const postCounter = document.getElementById('post-char-counter');
        if (postCounter) {
            postCounter.textContent = '300';
            postCounter.classList.remove('visible', 'warning', 'error');
        }
    } catch (error) {
        console.log(error.message || 'Falha ao criar o post.');
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
    if (!fileNameDisplay) return;

    fileNameDisplay.innerHTML = ''; // Limpa o conteúdo
    fileNameDisplay.style.display = 'none'; // Garante que esteja oculto

    if (fileInput.files.length > 0) {
        fileNameDisplay.style.display = 'inline-flex'; // Mostra o elemento
        const fileName = fileInput.files[0].name;
        
        // Adiciona o ícone e o nome do arquivo
        const textSpan = document.createElement('span');
        textSpan.className = 'file-name-text';
        textSpan.textContent = fileName;
        
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-paperclip';

        fileNameDisplay.appendChild(icon);
        fileNameDisplay.appendChild(textSpan);

        // Cria e adiciona o botão de remover
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file-btn';
        removeBtn.type = 'button';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => {
            fileInput.value = ''; // Limpa o input
            fileNameDisplay.innerHTML = ''; // Limpa o display
            fileNameDisplay.style.display = 'none'; // Oculta o display
        };
        fileNameDisplay.appendChild(removeBtn);
    }
}

// Função para tratar todos os cliques no feed
function handleFeedClick(event) {
    const likeBtn = event.target.closest('.like-btn');
    const commentBtn = event.target.closest('.comment-btn');
    const submitCommentBtn = event.target.closest('.comment-submit-btn');
    const authorDetails = event.target.closest('.post-author-details');
    const optionsBtn = event.target.closest('.post-options-btn');

    if (likeBtn) {
        const postElement = likeBtn.closest('.post');
        handleLikePost(postElement.dataset.postId, likeBtn);
    } else if (commentBtn) {
        const postElement = commentBtn.closest('.post');
        const commentSection = postElement.querySelector('.comment-section');
        const isVisible = commentSection.style.display === 'block';
        commentSection.style.display = isVisible ? 'none' : 'block';
        if (!isVisible && !commentSection.dataset.loaded) {
            loadComments(postElement.dataset.postId, commentSection);
        }
    } else if (submitCommentBtn) {
        const postElement = submitCommentBtn.closest('.post');
        const input = postElement.querySelector('.comment-input');
        if (input.value.trim()) {
            handleAddComment(postElement.dataset.postId, input.value, postElement);
            input.value = '';
        }
    } else if (authorDetails && !optionsBtn) {
        event.preventDefault();
        const username = authorDetails.querySelector('.author-name').textContent;
        openProfileModal(username);
    }
    handleFeedActions(event);
}

// Funções assíncronas para interagir com a API
async function handleLikePost(postId, buttonElement) {
    try {
        const response = await api.likePost(postId);
        buttonElement.classList.toggle('liked', response.isLiked);
        buttonElement.querySelector('i').className = response.isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
        buttonElement.querySelector('.like-count').textContent = response.likeCount;
    } catch (error) {
        console.error("Erro ao curtir:", error);
    }
}

async function handleAddComment(postId, text, postElement) {
    try {
        const newComment = await api.addComment(postId, text);
        const listContainer = postElement.querySelector('.comment-list');
        listContainer.insertAdjacentHTML('beforeend', createCommentHtml(newComment));
        
        // === MELHORIA: Reseta o contador do comentário ===
        const commentCounter = postElement.querySelector('.comment-input-wrapper .char-counter');
        if (commentCounter) {
            commentCounter.textContent = '300';
            commentCounter.classList.remove('visible', 'warning', 'error');
        }
        
        const countSpan = postElement.querySelector('.comment-count');
        countSpan.textContent = parseInt(countSpan.textContent, 10) + 1;
    } catch (error) {
        console.error("Erro ao comentar:", error);
    }
}

async function loadComments(postId, commentSectionElement) {
    let listContainer = commentSectionElement.querySelector('.comment-list');
    if (!listContainer) {
        listContainer = document.createElement('div');
        listContainer.className = 'comment-list';
        commentSectionElement.prepend(listContainer);
    }

    listContainer.innerHTML = createCommentSkeletonHtml(); // Mostra o skeleton
    commentSectionElement.dataset.loaded = "true";

    try {
        const comments = await api.getComments(postId);
        listContainer.innerHTML = comments.length > 0 ? comments.map(createCommentHtml).join('') : '<p class="info-msg" style="text-align: center; padding: 1rem 0;">Seja o primeiro a comentar!</p>';
    } catch (error) {
        listContainer.innerHTML = '<p class="error-msg">Não foi possível carregar os comentários.</p>';
    }
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
                console.log(`Erro ao deletar: ${error.message}`);
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
// Bloco de Funcionalidade do Modal de Perfil
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
        console.log(error.message || 'Não foi possível carregar o perfil.');
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
        <div class="profile-modal profile-modal-centered">
            <div class="modal-profile-info">
                <img src="${userProfile.profilePicture}" alt="Avatar de ${userProfile.username}" class="profile-modal-avatar">
                <h2 class="profile-modal-username">${userProfile.username}</h2>
                <p class="profile-modal-level">${levelInfo.name}</p>
                <div class="profile-info-item"><i class="fa-solid fa-calendar"></i> Usuário desde ${joinDate.replace('.', '')}</div>
                <button class="follow-button ${userProfile.isFollowing ? 'following' : ''}" data-user-id="${userProfile._id}">
                    ${userProfile.isFollowing ? '<i class="fa-solid fa-check"></i> Seguindo' : '<i class="fa-solid fa-plus"></i> Seguir'}
                </button>
            </div>
            <div class="modal-profile-details">
                <button class="modal-close-btn">&times;</button>
                <div class="modal-tabs">
                    <button class="modal-tab-btn active" data-tab="treino"><i class='fa-solid fa-dumbbell'></i> <span>Treino do Dia</span></button>
                    <button class="modal-tab-btn" data-tab="dieta"><i class='fa-solid fa-utensils'></i> <span>Dieta</span></button>
                </div>
                <div class="modal-content-container">
                    <div id="tab-treino" class="modal-content active">
                        <div class="modal-content-title"><i class='fa-solid fa-dumbbell'></i> Treino do Dia</div>
                        ${workoutHtml}
                    </div>
                    <div id="tab-dieta" class="modal-content">
                        <div class="modal-content-title"><i class='fa-solid fa-utensils'></i> Dieta</div>
                        ${nutritionHtml}
                    </div>
                </div>
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

    const tabBtns = modalBackdrop.querySelectorAll('.modal-tab-btn');
    const tabContents = modalBackdrop.querySelectorAll('.modal-content');
    tabBtns.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            modalBackdrop.querySelector('.modal-tab-btn.active')?.classList.remove('active');
            modalBackdrop.querySelector('.modal-content.active')?.classList.remove('active');
            btn.classList.add('active');
            tabContents[idx].classList.add('active');
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
            console.log('Não foi possível realizar a ação.');
        } finally {
            followBtn.disabled = false;
        }
    });

    modalBackdrop.querySelectorAll('.modal-content').forEach(content => {
        if (content.scrollHeight > 280) {
            content.classList.remove('expanded');
            const overlay = document.createElement('div');
            overlay.className = 'see-more-overlay';
            overlay.innerHTML = '<button class="see-more-btn">Ver mais</button>';
            content.appendChild(overlay);
            overlay.querySelector('.see-more-btn').addEventListener('click', () => {
                content.classList.add('expanded');
                overlay.remove();
            });
        }
    });
}

function checkUrlForProfile() {
    if (window.location.hash.startsWith('#perfil/')) {
        const username = window.location.hash.split('/')[1];
        if (username) openProfileModal(username);
    }
}

/**
 * === MELHORIA: Nova função para lidar com o contador de caracteres ===
 * @param {Event} event O evento de input do textarea ou input.
 */
function handleCharCounter(event) {
    const inputElement = event.target;
    const maxLength = inputElement.maxLength;
    const currentLength = inputElement.value.length;
    const charsLeft = maxLength - currentLength;

    // Encontra o contador associado
    let counterElement;
    if (inputElement.id === 'post-textarea') {
        counterElement = document.getElementById('post-char-counter');
    } else {
        counterElement = inputElement.nextElementSibling; // Pega o span irmão
    }

    if (!counterElement) return;

    // Atualiza o texto e a visibilidade
    counterElement.textContent = charsLeft;
    counterElement.classList.add('visible');

    // Atualiza as classes de aviso
    counterElement.classList.toggle('warning', charsLeft < 21 && charsLeft > 0);
    counterElement.classList.toggle('error', charsLeft <= 0);

    // Esconde o contador se o campo estiver vazio
    if (currentLength === 0) {
        counterElement.classList.remove('visible');
    }
}