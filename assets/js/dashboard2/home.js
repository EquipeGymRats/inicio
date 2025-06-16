// assets/js/home.js
import { api } from './apiService.js';
import { authService } from '../auth.js';

/**
 * Renderiza o conteúdo do card de treino do dia.
 * @param {object} plan - O plano de treino do usuário.
 */
function renderTodayWorkout(plan) {
    const container = document.querySelector('#treino-do-dia-card .card-content');
    if (!container) return;

    if (!plan || !plan.plan || plan.plan.length === 0) {
        container.innerHTML = '<p>Nenhum plano de treino ativo. Gere um novo para começar!</p>';
        return;
    }

    // Mapeia o índice do dia da semana para o nome correspondente em português
    const dayMap = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const todayIndex = new Date().getDay();
    const todayName = dayMap[todayIndex];

    const todayWorkout = plan.plan.find(day => day.dayName.toLowerCase() === todayName.toLowerCase());

    if (todayWorkout && todayWorkout.exercises.length > 0) {
        let exercisesHtml = '<ul style="padding-left: 0; list-style: none; margin: 0;">';
        // Mostra no máximo 3 exercícios para manter o card limpo
        todayWorkout.exercises.slice(0, 3).forEach(ex => {
            exercisesHtml += `<li style="margin-bottom: 8px;">- ${ex.name} (${ex.setsReps})</li>`;
        });
        if (todayWorkout.exercises.length > 3) {
            exercisesHtml += `<li style="margin-top: 10px;">... e mais!</li>`;
        }
        exercisesHtml += '</ul>';
        container.innerHTML = exercisesHtml;
    } else {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px 0;">
                <i class="fas fa-couch" style="font-size: 2em; opacity: 0.7;"></i>
                <p style="margin-top: 10px;">Hoje é dia de descanso!</p>
            </div>
        `;
    }
}

/**
 * Renderiza um único post no feed.
 * @param {object} post - O objeto do post.
 * @param {boolean} prepend - Se o post deve ser adicionado no início da lista.
 */
function renderPost(post, prepend = false) {
    const postsContainer = document.getElementById('feed-posts-container');
    if(!postsContainer) return;

    const postElement = document.createElement('div');
    postElement.className = 'feed-post';
    postElement.innerHTML = `
        <img src="${post.user.profilePicture}" alt="${post.user.username}" class="post-author-pic">
        <div class="post-content">
            <p><strong>${post.user.username}</strong></p>
            <p>${post.text}</p>
            ${post.imageUrl ? `<img src="${post.imageUrl}" alt="Post image" class="post-image">` : ''}
            <div class="post-meta">${new Date(post.createdAt).toLocaleString('pt-BR')}</div>
        </div>
    `;

    if (prepend) {
        postsContainer.prepend(postElement);
    } else {
        postsContainer.appendChild(postElement);
    }
}


// Função principal que inicializa a página Home
export async function initHomePage() {
    console.log("Iniciando a Página Home...");
    
    // --- Carregamento de Dados em Paralelo ---
    try {
        const [user, posts, workoutPlan] = await Promise.all([
            authService.getUserProfile(),
            api.getFeedPosts(),
            api.getWorkouts().catch(e => {
                console.warn("Nenhum plano de treino encontrado, continuando...");
                return null; // Retorna nulo se não houver plano, evitando que a página quebre
            })
        ]);

        // 1. Personaliza a saudação e o mascote
        if(user) {
            document.getElementById('home-greeting').textContent = `Olá, ${user.username}!`;
            document.getElementById('mascote-image').src = user.levelInfo.currentLevel.image;
            document.getElementById('mascote-level-name').textContent = user.levelInfo.currentLevel.name;
        }

        // 2. Renderiza o Treino do Dia
        renderTodayWorkout(workoutPlan);

        // 3. Renderiza o feed
        const postsContainer = document.getElementById('feed-posts-container');
        postsContainer.innerHTML = ''; // Limpa antes de renderizar
        posts.forEach(post => renderPost(post));

    } catch (error) {
        console.error("Erro ao carregar dados da Home Page:", error);
        // Pode adicionar uma mensagem de erro na UI aqui se desejar
    }

    // --- Lógica para Criar Post ---
    const submitBtn = document.getElementById('submit-post-btn');
    const textInput = document.getElementById('post-text-input');
    const imageInput = document.getElementById('post-image-input');

    // Remove event listener antigo para evitar duplicação se a página for recarregada
    submitBtn.replaceWith(submitBtn.cloneNode(true));
    document.getElementById('submit-post-btn').addEventListener('click', async () => {
        if (!textInput.value.trim()) {
            alert("Escreva algo para postar!");
            return;
        }

        const formData = new FormData();
        formData.append('text', textInput.value);
        if (imageInput.files[0]) {
            formData.append('postImage', imageInput.files[0]);
        }
        
        try {
            submitBtn.disabled = true; // Desabilita o botão durante o envio
            const newPost = await api.createPost(formData);
            renderPost(newPost, true); // Adiciona o novo post no topo do feed

            // Limpa os campos
            textInput.value = '';
            imageInput.value = null;
        } catch (error) {
            alert(`Erro ao postar: ${error.message}`);
        } finally {
            submitBtn.disabled = false; // Reabilita o botão
        }
    });

    // --- Lógica da Mensagem Motivacional ---
    const motivationalMessages = [
        "A dor que você sente hoje é a força que você sentirá amanhã.",
        "O corpo alcança o que a mente acredita.",
        "Não pare quando estiver cansado. Pare quando terminar.",
        "Cada treino é um passo a mais na sua jornada.",
        "Seu único limite é você."
    ];
    const motivacaoEl = document.getElementById('motivacao-text');
    if (motivacaoEl) {
        const randomIndex = Math.floor(Math.random() * motivationalMessages.length);
        motivacaoEl.textContent = motivationalMessages[randomIndex];
    }
}