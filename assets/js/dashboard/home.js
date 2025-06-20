// assets/js/dashboard/home.js
import { api } from './apiService.js';

/**
 * ATUALIZADO: Recebe o container da página para garantir que os seletores funcionem nos elementos corretos.
 * @param {object} todayData - Os dados do treino de hoje ou de descanso.
 * @param {HTMLElement} pageContainer - O elemento principal da página atual.
 */
function renderTodayWorkout(todayData, pageContainer) {
    // Busca os elementos DENTRO do container da página, não no documento inteiro.
    const workoutCardContent = pageContainer.querySelector('.card-treino .card-content');
    const workoutCardFooter = pageContainer.querySelector('.card-treino .card-footer');
    const workoutCardHeader = pageContainer.querySelector('.card-treino .card-header h3');

    if (!workoutCardContent || !workoutCardFooter || !workoutCardHeader) {
        console.error("Elementos do card de treino não encontrados no container da página.");
        return;
    }

    if (todayData.isRestDay) {
        workoutCardHeader.textContent = 'Dia de Descanso';
        workoutCardContent.innerHTML = `<p>${todayData.message || 'Aproveite para recarregar as energias!'}</p>`;
        workoutCardFooter.style.display = 'none';
        return;
    }

    if (todayData.workout && todayData.workout.exercises.length > 0) {
        const { exercises } = todayData.workout;
        const focusGroup = exercises[0]?.muscleGroups[0] || 'Geral';
        workoutCardHeader.textContent = `Treino do Dia: ${focusGroup}`;
        const exercisesToShow = exercises.slice(0, 4);

        const exerciseListHTML = exercisesToShow.map(exercise => {
            const setsRepsHTML = exercise.sets && exercise.reps 
                ? `<span class="workout-sets-reps">${exercise.sets}x${exercise.reps}</span>`
                : '';
            return `
                <li>
                    <i class="fas fa-angle-right"></i>
                    <span class="workout-exercise-name" title="Clique para ver o nome completo">${exercise.name}</span>
                    ${setsRepsHTML}
                </li>
            `;
        }).join('');
        
        workoutCardContent.innerHTML = `
            <h4>Foco em ${todayData.objective || 'seu objetivo'}.</h4>
            <ul class="workout-list">
                ${exerciseListHTML}
            </ul>
        `;
        
        const workoutList = workoutCardContent.querySelector('.workout-list');
        if (workoutList) {
            workoutList.addEventListener('click', (event) => {
                const clickedLi = event.target.closest('li');
                if (clickedLi) {
                    const nameSpan = clickedLi.querySelector('.workout-exercise-name');
                    if (nameSpan) {
                        nameSpan.classList.toggle('expanded');
                    }
                }
            });
        }

        workoutCardFooter.style.display = 'flex';
        const primaryBtn = workoutCardFooter.querySelector('.btn-primary');
        if (primaryBtn) {
            primaryBtn.style.display = 'block';
        }

    } else {
        workoutCardHeader.textContent = 'Treino Pendente';
        workoutCardContent.innerHTML = `<p>Seu treino para hoje ainda não foi configurado.</p>`;
        workoutCardFooter.style.display = 'none';
    }
}

/**
 * ATUALIZADO: Recebe o container da página.
 * @param {HTMLElement} pageContainer - O elemento principal da página atual.
 */
function renderSkeletonLoader(pageContainer) {
    const postsContainer = pageContainer.querySelector('.card-feed .scrollable-content');
    if (!postsContainer) return;

    let skeletonHTML = '';
    for (let i = 0; i < 3; i++) {
        skeletonHTML += `<div class="feed-post skeleton"><div class="post-author"><div class="author-avatar skeleton-box"></div><div class="author-info"><strong class="skeleton-box skeleton-text-short"></strong><span class="skeleton-box skeleton-text-very-short"></span></div></div><p class="skeleton-box skeleton-text-long"></p><p class="skeleton-box skeleton-text-medium"></p></div>`;
    }
    // Usa o template do documento para pegar o composer, pois ele é estático
    const composerHTML = document.getElementById('home-template').content.querySelector('.feed-composer').outerHTML;
    postsContainer.innerHTML = composerHTML + skeletonHTML;
}

/**
 * ATUALIZADO: Recebe o container da página.
 * @param {object} post - O objeto do post a ser renderizado.
 * @param {HTMLElement} pageContainer - O elemento principal da página atual.
 * @param {boolean} prepend - Se o post deve ser adicionado no início.
 */
function renderPost(post, pageContainer, prepend = false) {
    const postsContainer = pageContainer.querySelector('.card-feed .scrollable-content');
    if (!postsContainer) return;
    
    const postElement = document.createElement('div');
    postElement.className = 'feed-post';

    const user = post.user || { profilePicture: 'assets/img/default-avatar.png', username: 'Usuário' };
    const postAuthorHTML = `<div class="post-author"><img src="${user.profilePicture}" alt="Avatar de ${user.username}" class="author-avatar"><div class="author-info"><strong>${user.username}</strong><span>@${user.username.toLowerCase()}</span></div></div>`;
    const postImageHTML = post.imageUrl ? `<div class="post-image-container"><img src="${post.imageUrl}" alt="Imagem do post" class="post-image"></div>` : '';

    postElement.innerHTML = `${postAuthorHTML}<p>${post.text}</p>${postImageHTML}<span class="post-timestamp">${new Date(post.createdAt).toLocaleString('pt-BR')}</span>`;

    if (prepend) {
        postsContainer.insertBefore(postElement, postsContainer.children[1]);
    } else {
        postsContainer.appendChild(postElement);
    }
}

/**
 * ATUALIZADO: Recebe o container da página.
 * @param {object} user - O objeto do usuário logado.
 * @param {HTMLElement} pageContainer - O elemento principal da página atual.
 */
function setupComposer(user, pageContainer) {
    const composerForm = pageContainer.querySelector('.feed-composer');
    if (!composerForm) return;

    const composerAvatar = composerForm.querySelector('.composer-avatar');
    if (user && user.profilePicture) {
        composerAvatar.src = user.profilePicture;
    }

    const textArea = composerForm.querySelector('textarea');
    const publishBtn = composerForm.querySelector('.btn-primary');
    const fileInput = pageContainer.querySelector('#file-input');
    
    publishBtn.addEventListener('click', async () => {
        if (!textArea.value.trim()) return alert("Escreva algo para publicar!");
        const formData = new FormData();
        formData.append('text', textArea.value);
        if (fileInput.files[0]) formData.append('postImage', fileInput.files[0]);

        publishBtn.disabled = true;
        publishBtn.textContent = 'Publicando...';

        try {
            const newPost = await api.createPost(formData);
            newPost.user = { username: user.username, profilePicture: user.profilePicture };
            renderPost(newPost, pageContainer, true); // Passa o container para a função de renderização
            textArea.value = '';
            fileInput.value = '';
        } catch (error) {
            alert(`Erro ao publicar: ${error.message}`);
        } finally {
            publishBtn.disabled = false;
            publishBtn.textContent = 'Publicar';
        }
    });
}

/**
 * Função principal que inicializa a página Home. (REFEITA COM CORREÇÃO DE ESCOPO)
 */
export async function initHomePage() {
    // Pega a referência do container que foi efetivamente adicionado à página.
    const pageContainer = document.querySelector('.page-content-wrapper');
    if (!pageContainer) return console.error("Container de conteúdo da página (.page-content-wrapper) não encontrado.");

    renderSkeletonLoader(pageContainer);
    
    try {
        const [user, posts, todayWorkout] = await Promise.all([
            api.getCurrentUser(),
            api.getFeedPosts(),
            api.getTodayWorkout().catch(error => {
                console.warn("Não foi possível carregar o treino do dia:", error.message);
                return { isRestDay: true, message: "Não foi possível carregar o treino." };
            })
        ]);
        
        // Passa o container para as funções de renderização
        renderTodayWorkout(todayWorkout, pageContainer);
        
        const postsContainer = pageContainer.querySelector('.card-feed .scrollable-content');
        if(postsContainer){
            const composerHTML = document.getElementById('home-template').content.querySelector('.feed-composer').outerHTML;
            postsContainer.innerHTML = composerHTML;
            posts.forEach(post => renderPost(post, pageContainer));
        }

        setupComposer(user, pageContainer);

    } catch (error) {
        console.error("Erro ao carregar a página Home:", error);
        pageContainer.innerHTML = `<p style="padding: 20px; text-align: center;">Não foi possível carregar o conteúdo.</p>`;
    }
}