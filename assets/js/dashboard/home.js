/**
 * home.js
 * Lógica da página Home com scroll infinito baseado em evento de SCROLL.
 */

import { api } from '../apiService.js';
import { authService } from '../auth.js';

// --- ESTADO DA PÁGINA ---
let currentUserIsAdmin = false; // <<< NOVO: Guarda o status de admin do usuário logado
let currentWorkout = null;
let currentPage = 1;
let totalPages = 1;
let isLoadingFeed = false;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    setupEventListeners();
});

async function loadAllData() {
    currentUserIsAdmin = await authService.isAdmin();
    
    loadUserProfile();
    loadTodayWorkout();
    loadTodayNutrition();
    loadPosts(1);
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
    
    const feedContent = document.querySelector('.feed-card .card-content');
    if (feedContent) {
        feedContent.addEventListener('scroll', handleFeedScroll);
    }

    const feedPostsContainer = document.getElementById('feed-posts');
    if(feedPostsContainer) {
        feedPostsContainer.addEventListener('click', handleFeedActions);
    }

    const viewDietBtn = document.getElementById('view-diet-btn');
    if (viewDietBtn) {
        viewDietBtn.addEventListener('click', () => {
             const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
             const todayName = dayNames[new Date().getDay()];
             window.location.href = `nutrition-plan.html?day=${encodeURIComponent(todayName)}`;
        });
    }
    const viewTrainingBtn = document.getElementById('view-training-btn');
    if (viewTrainingBtn) {
        viewTrainingBtn.addEventListener('click', () => {
            window.location.href = `my-training.html`;
        });
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

// --- LÓGICA DO SCROLL INFINITO (NOVA FUNÇÃO) ---

/**
 * Chamado pelo evento de scroll do feed.
 * Verifica se o usuário chegou perto do final do conteúdo.
 */
function handleFeedScroll(event) {
    const element = event.target;
    
    // Calcula se a posição do scroll está perto do final
    // (scrollTop + clientHeight) é a posição da parte de baixo da área visível
    // scrollHeight é a altura total do conteúdo
    const isNearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 100; // 100px de buffer

    if (isNearBottom && !isLoadingFeed && currentPage < totalPages) {
        console.log('Scroll perto do final. Carregando mais posts...');
        loadPosts(currentPage + 1);
    }
}


/**
 * Carrega os posts de uma página específica.
 */
async function loadPosts(page = 1) {
    if (isLoadingFeed) return;

    isLoadingFeed = true;
    const trigger = document.getElementById('feed-scroll-trigger');
    if (trigger) trigger.style.display = 'block';

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
        if (page === 1) {
            document.getElementById('feed-posts').innerHTML = '<p class="error-msg">Não foi possível carregar o feed.</p>';
        }
    } finally {
        isLoadingFeed = false;
        if (trigger && currentPage >= totalPages) {
           trigger.style.display = 'none';
        }
    }
}

/**
 * Renderiza os posts no container do feed.
 */
function renderFeed(posts, append = false) {
    const feedContainer = document.getElementById('feed-posts');
    
    if (!append) {
        feedContainer.innerHTML = '';
    }

    if (posts.length === 0 && !append) {
        feedContainer.innerHTML = '<p class="info-msg">Ainda não há posts. Seja o primeiro!</p>';
        return;
    }

    const postsHtml = posts.map(createPostHtml).join('');
    feedContainer.insertAdjacentHTML('beforeend', postsHtml);
}


// --- Funções de Renderização e Ações (sem alterações) ---
async function loadUserProfile() {
    try {
        const user = await authService.getUserProfile();
        renderProfileCard(user);
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

function renderProfileCard(user) {
    const profileCard = document.getElementById('profile-card');
    if (!user || !user.levelInfo) {
        profileCard.innerHTML = '<p class="error-msg">Não foi possível carregar o perfil.</p>';
        return;
    }
    const levelInfo = user.levelInfo;
    const currentLevel = levelInfo.currentLevel;
    const nextLevel = levelInfo.nextLevel;
    let xpForThisLevel = currentLevel.minXp;
    let xpForNextLevel = nextLevel ? nextLevel.minXp : user.xp;
    let totalXpNeededForNext = nextLevel ? xpForNextLevel - xpForThisLevel : 1;
    let xpGainedInThisLevel = user.xp - xpForThisLevel;
    const xpPercentage = Math.min((xpGainedInThisLevel / totalXpNeededForNext) * 100, 100);
    
    // Gera a tag de admin para o perfil
    const roleTagHtml = createUserRoleTag(user);

    profileCard.innerHTML = `
        <img src="${user.profilePicture}" alt="Foto do Perfil" class="profile-card-avatar">
        <div class="profile-card-info">
            <div class="profile-card-header">
                <div class="author-name-container">
                    <span class="profile-card-username">Olá, ${user.username.split(' ')[0]}!</span>
                    ${roleTagHtml}
                </div>
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
    try {
        const workout = await api.getTodayWorkout();
        currentWorkout = workout;
        if (workout.isRestDay) {
            workoutContent.innerHTML = `<h4>${workout.message}</h4>`;
            if (workoutActions) workoutActions.style.display = 'none';
            return;
        }
        workoutContent.innerHTML = `<h4>${workout.dayName}</h4><ul class="exercise-list">${workout.exercises.map(ex => `<li>${ex.name} - ${ex.setsReps}</li>`).join('')}</ul>`;
        if (workoutActions) workoutActions.style.display = 'flex';
        updateWorkoutCardUI(workout);
    } catch (error) {
        console.error('Erro ao buscar treino do dia:', error);
        workoutContent.innerHTML = '<p class="error-msg">Crie um plano de treino para ver o resumo aqui.</p>';
        if (workoutActions) workoutActions.style.display = 'none';
    }
}

function updateWorkoutCardUI(workout) {
    const statusTag = document.getElementById('workout-status-tag');
    const completeBtn = document.getElementById('complete-workout-btn');
    if (!statusTag || !completeBtn) return;
    statusTag.style.display = 'inline-block';
    if (workout.isCompleted) {
        statusTag.textContent = 'Concluído';
        statusTag.className = 'status-completed';
        completeBtn.innerHTML = `<i class="fa-solid fa-check"></i> Concluído`;
        completeBtn.disabled = true;
    } else {
        statusTag.textContent = 'Pendente';
        statusTag.className = 'status-pending';
        completeBtn.innerHTML = 'Concluir Treino';
        completeBtn.disabled = false;
    }
}

async function handleWorkoutCompletion() {
    if (!currentWorkout || !currentWorkout.dayName) return;
    const completeBtn = document.getElementById('complete-workout-btn');
    completeBtn.disabled = true;
    completeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando...`;
    try {
        await api.completeTodayWorkout(currentWorkout.dayName);
        currentWorkout.isCompleted = true;
        updateWorkoutCardUI(currentWorkout);
        loadUserProfile();
    } catch (error) {
        alert(error.message || 'Não foi possível concluir o treino.');
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
            tipHtml = `<div class="daily-tip"><i class="fa-solid fa-lightbulb"></i><p>${randomTip}</p></div>`;
        }
        nutritionContent.innerHTML = `<ul class="daily-meal-list">${todayPlan.meals.map(meal => `<li class="meal-group"><div class="meal-group-header"><i class="${meal.icon || 'fa-solid fa-utensils'} fa-fw"></i><span>${meal.mealName}</span></div><ul class="food-item-list">${meal.foods.map(food => `<li>${food}</li>`).join('')}</ul></li>`).join('')}</ul>${tipHtml}`;
        if(nutritionActions) nutritionActions.style.display = 'flex';
    } catch (error) {
        nutritionContent.innerHTML = '<p class="error-msg">Crie um plano alimentar para ver o resumo aqui.</p>';
        if(nutritionActions) nutritionActions.style.display = 'none';
    }
}

async function handleFeedActions(event) {
    const optionsBtn = event.target.closest('.post-options-btn');
    const deleteBtn = event.target.closest('.delete-post-action');

    // Abre/Fecha o menu de opções
    if (optionsBtn) {
        const menu = optionsBtn.nextElementSibling;
        const allMenus = document.querySelectorAll('.post-options-menu');
        // Fecha todos os outros menus antes de abrir o novo
        allMenus.forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });
        menu.classList.toggle('show');
    }

    // Deleta o post
    if (deleteBtn) {
        event.preventDefault();
        const postElement = deleteBtn.closest('.post');
        const postId = postElement.dataset.postId;

        if (confirm('Tem certeza que deseja deletar este post? Esta ação é irreversível.')) {
            try {
                await api.deletePost(postId);
                // Animação de remoção e depois remove o elemento
                postElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                postElement.style.opacity = '0';
                postElement.style.transform = 'scale(0.95)';
                setTimeout(() => postElement.remove(), 300);
            } catch (error) {
                alert(`Erro ao deletar o post: ${error.message}`);
            }
        }
    }
}

function createUserRoleTag(user) {
    if (!user || !user.role || user.role === 'user') return '';
    switch (user.role) {
        case 'admin':
            return `<span class="user-role-tag admin-tag"><i class="fa-solid fa-shield-halved"></i> Admin</span>`;
        case 'vip':
            return `<span class="user-role-tag vip-tag"><i class="fa-solid fa-star"></i> VIP</span>`;
        default:
            return '';
    }
}

function createPostHtml(post) {
    const postDate = new Date(post.createdAt);
    const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(postDate);
    const roleTagHtml = createUserRoleTag(post.user);
  

    // <<< MUDANÇA: Adiciona o menu de opções condicionalmente >>>
    const optionsMenuHtml = currentUserIsAdmin ? `
        <div class="post-options">
            <button class="post-options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            <div class="post-options-menu">
                <a href="#" class="delete-post-action">Deletar Post</a>
            </div>
        </div>
    ` : '';

    return `
        <div class="post" data-post-id="${post._id}">
            <div class="post-header">
                <div class="post-author-details">
                    <img src="${post.user.profilePicture}" alt="Avatar" class="post-avatar">
                    <div class="post-author-info">
                        <div class="author-name-container">
                            <div class="author-name">${post.user.username}</div>
                            ${roleTagHtml}
                        </div>
                        <div class="post-date">${formattedDate}</div>
                    </div>
                </div>
                ${optionsMenuHtml}
            </div>
            <div class="post-content">
                <p>${post.text.replace(/\n/g, '<br>')}</p>
                ${post.imageUrl ? `<img src="${post.imageUrl}" alt="Imagem do post" class="post-image">` : ''}
            </div>
        </div>
    `;
}

async function handlePostCreation(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = 'Postando...';
    try {
        const formData = new FormData(form);
        const newPost = await api.createPost(formData);
        const feedContainer = document.getElementById('feed-posts');
        const newPostHtml = createPostHtml(newPost);
        const emptyMsg = feedContainer.querySelector('.info-msg');
        if (emptyMsg) {
            feedContainer.innerHTML = '';
        }
        feedContainer.insertAdjacentHTML('afterbegin', newPostHtml);
        form.reset();
        document.getElementById('file-name-display').innerHTML = '';
    } catch (error) {
        alert('Falha ao criar o post. Tente novamente.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Postar';
    }
}