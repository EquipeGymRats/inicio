/**
 * home.js
 * Lógica da página Home.
 * Busca dados da API e renderiza os componentes da página.
 * ESTA VERSÃO FOI CORRIGIDA PARA USAR authService.getUserProfile().
 */

import { api } from '../apiService.js';
import { authService } from '../auth.js'; // Importa o serviço de autenticação

// Variável para armazenar os dados do treino atual, incluindo o dayName
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

    // <<< INÍCIO DA NOVA LÓGICA >>>
    const fileInput = document.getElementById('post-image');
    const fileNameDisplay = document.getElementById('file-name-display');

    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', () => {
            // Limpa qualquer conteúdo anterior (nome do arquivo, botão 'x')
            fileNameDisplay.innerHTML = '';

            if (fileInput.files.length > 0) {
                const fileName = fileInput.files[0].name;

                // Cria o HTML para o ícone e o nome do arquivo
                const fileInfoHtml = `<i class="fa-solid fa-paperclip"></i> <span class="file-name-text">${fileName}</span>`;
                
                // Cria o botão de remover dinamicamente
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-file-btn';
                removeBtn.type = 'button'; // Importante para não submeter o formulário
                removeBtn.innerHTML = '&times;'; // O 'x' para fechar

                // Adiciona o evento de clique ao botão de remover
                removeBtn.addEventListener('click', () => {
                    // Limpa o valor do input de arquivo (ESSA É A AÇÃO PRINCIPAL)
                    fileInput.value = ''; 
                    // Limpa o container do nome do arquivo na tela
                    fileNameDisplay.innerHTML = '';
                });

                // Adiciona o ícone, o nome e o botão ao container
                fileNameDisplay.innerHTML = fileInfoHtml;
                fileNameDisplay.appendChild(removeBtn);

            }
        });
    }
    // <<< FIM DA NOVA LÓGICA >>>
}
// --- Funções de Carregamento e Renderização ---

async function loadUserProfile() {
    try {
        const user = await authService.getUserProfile();
        renderProfileCard(user); // Chama a nova função de renderização
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
    
    const levelInfo = user.levelInfo;
    const nextLevel = levelInfo.nextLevel;
    
    let xpForThisLevel = levelInfo.currentLevel.minXp;
    let xpForNextLevel = nextLevel ? nextLevel.minXp : user.xp;
    let totalXpNeededForNext = nextLevel ? xpForNextLevel - xpForThisLevel : 1;
    let xpGainedInThisLevel = user.xp - xpForThisLevel;
    const xpPercentage = Math.min((xpGainedInThisLevel / totalXpNeededForNext) * 100, 100);

    profileCard.innerHTML = `
        <img src="${user.profilePicture}" alt="Foto do Perfil" class="profile-card-avatar">
        
        <div class="profile-card-info">
            <div class="profile-card-header">
                <span class="profile-card-username">Olá, ${user.username.split(' ')[0]}!</span>
                <span class="profile-card-objective">Foco: ${user.mainObjective || 'Não definido'}</span>
            </div>
            
            <div class="profile-card-xp">
                <h3 class="profile-card-xp-title">${levelInfo.currentLevel.name}</h3>
                <div class="xp-bar">
                    <div class="xp-bar-fill" style="width: ${xpPercentage}%"></div>
                    <span class="xp-bar-text">${user.xp} / ${nextLevel ? xpForNextLevel : 'MAX'} XP</span>
                </div>
            </div>
        </div>
    `;
}

async function loadTodayWorkout() {
    const workoutContent = document.getElementById('workout-content');
    try {
        const workout = await api.getTodayWorkout();
        currentWorkout = workout; 

        if (workout.isRestDay) {
            workoutContent.innerHTML = `<h4>${workout.message}</h4>`;
            document.getElementById('complete-workout-btn').style.display = 'none';
            document.getElementById('workout-status-tag').style.display = 'none';
            return;
        }

        // CORREÇÃO: Trocado workout.name por workout.dayName para exibir o título correto.
        workoutContent.innerHTML = `
            <h4>${workout.dayName}</h4>
            <ul class="exercise-list">
                ${workout.exercises.map(ex => `<li>${ex.name} - ${ex.setsReps}</li>`).join('')}
            </ul>
        `;
        updateWorkoutCardUI(workout);

    } catch (error) {
        console.error('Erro ao buscar treino do dia:', error);
        workoutContent.innerHTML = '<p class="error-msg">Não foi possível carregar o treino.</p>';
    }
}


function updateWorkoutCardUI(workout) {
    const statusTag = document.getElementById('workout-status-tag');
    const completeBtn = document.getElementById('complete-workout-btn');
    
    completeBtn.style.display = 'inline-flex';
    statusTag.style.display = 'inline-block';

    if (workout.isCompleted) {
        statusTag.textContent = 'Concluído';
        statusTag.className = 'status-tag status-completed';
        completeBtn.innerHTML = `<i class="fa-solid fa-check"></i> Concluído`;
        completeBtn.classList.add('completed');
        completeBtn.disabled = true;
    } else {
        statusTag.textContent = 'Pendente';
        statusTag.className = 'status-tag status-pending';
        completeBtn.innerHTML = 'Concluir Treino';
        completeBtn.classList.remove('completed');
        completeBtn.disabled = false;
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

        // Atualiza a UI para o estado "Concluído" imediatamente para feedback visual
        currentWorkout.isCompleted = true;
        updateWorkoutCardUI(currentWorkout);
        
        // Recarrega o perfil para atualizar a barra de XP
        loadUserProfile();

    } catch (error) {
        console.error('Erro ao concluir o treino:', error);
        alert(error.message || 'Não foi possível concluir o treino. Tente novamente.');
        completeBtn.disabled = false;
        completeBtn.innerHTML = 'Concluir Treino'; // Reverte o botão em caso de erro
    }
}

async function loadTodayNutrition() {
    const nutritionContent = document.getElementById('nutrition-content');
    try {
        const nutritionPlan = await api.getTodayNutrition();
        const userInputs = nutritionPlan.userInputs;
        nutritionContent.innerHTML = `
            <div class="nutrition-summary">
                <p>Seu plano atual é focado em <strong>${userInputs.goal}</strong>.</p>
                <p>Tipo de dieta: <strong>${userInputs.dietType}</strong></p>
            </div>
        `;
    } catch (error) {
        console.error('Info: Nenhum plano de nutrição encontrado para o usuário.', error.message);
        nutritionContent.innerHTML = '<p class="error-msg">Você ainda não tem um plano alimentar. Crie o seu na seção "Alimentação"!</p>';
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
        document.getElementById('file-name-display').textContent = ''; // <<< ADICIONE ESTA LINHA
        form.reset(); // Limpa o formulário
        
        if (feedContainer.innerHTML.includes('Ainda não há posts')) {
            feedContainer.innerHTML = newPostHtml;
        } else {
            feedContainer.insertAdjacentHTML('afterbegin', newPostHtml);
        }
        
        form.reset();
    } catch (error) {
        console.error('Erro ao criar post:', error);
        alert('Falha ao criar o post. Tente novamente.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}