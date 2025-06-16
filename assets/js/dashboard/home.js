// assets/js/dashboard/home.js
import { api } from './apiService.js';

let postsContainer;

/**
 * Renderiza o esqueleto (skeleton loader) enquanto os posts carregam.
 */
function renderSkeletonLoader() {
    if (!postsContainer) return;

    let skeletonHTML = '';
    for (let i = 0; i < 3; i++) {
        skeletonHTML += `
            <div class="feed-post skeleton">
                <div class="post-author"><div class="author-avatar skeleton-box"></div><div class="author-info"><strong class="skeleton-box skeleton-text-short"></strong><span class="skeleton-box skeleton-text-very-short"></span></div></div>
                <p class="skeleton-box skeleton-text-long"></p><p class="skeleton-box skeleton-text-medium"></p>
            </div>
        `;
    }
    const composerHTML = document.getElementById('home-template').content.querySelector('.feed-composer').outerHTML;
    postsContainer.innerHTML = composerHTML + skeletonHTML;
}

/**
 * Renderiza um único post no feed.
 */
function renderPost(post, prepend = false) {
    if (!postsContainer) return;
    
    const postElement = document.createElement('div');
    postElement.className = 'feed-post';

    const user = post.user || { profilePicture: 'assets/img/default-avatar.png', username: 'Usuário' };

    const postAuthorHTML = `
        <div class="post-author">
            <img src="${user.profilePicture}" alt="Avatar de ${user.username}" class="author-avatar">
            <div class="author-info">
                <strong>${user.username}</strong>
                <span>@${user.username.toLowerCase()}</span>
            </div>
        </div>
    `;
    
    const postImageHTML = post.imageUrl ? `<div class="post-image-container"><img src="${post.imageUrl}" alt="Imagem do post" class="post-image"></div>` : '';

    postElement.innerHTML = `${postAuthorHTML}<p>${post.text}</p>${postImageHTML}<span class="post-timestamp">${new Date(post.createdAt).toLocaleString('pt-BR')}</span>`;

    if (prepend) {
        postsContainer.insertBefore(postElement, postsContainer.children[1]);
    } else {
        postsContainer.appendChild(postElement);
    }
}

/**
 * Adiciona os listeners de evento para a criação de posts.
 * @param {object} user - O objeto do usuário logado.
 */
function setupComposer(user) {
    const composerForm = document.querySelector('.feed-composer');
    if (!composerForm) return;

    // ATUALIZADO: Atualiza o avatar no composer com a foto do usuário
    const composerAvatar = composerForm.querySelector('.composer-avatar');
    if (user && user.profilePicture) {
        composerAvatar.src = user.profilePicture;
    }

    const textArea = composerForm.querySelector('textarea');
    const publishBtn = composerForm.querySelector('.btn-primary');
    const fileInput = document.getElementById('file-input');
    
    publishBtn.addEventListener('click', async () => {
        if (!textArea.value.trim()) return alert("Escreva algo para publicar!");

        const formData = new FormData();
        formData.append('text', textArea.value);
        if (fileInput.files[0]) formData.append('postImage', fileInput.files[0]);

        publishBtn.disabled = true;
        publishBtn.textContent = 'Publicando...';

        try {
            const newPost = await api.createPost(formData);
            renderPost(newPost, true);
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
 * Função principal que inicializa a página Home. (REFEITA)
 */
export async function initHomePage() {
    postsContainer = document.querySelector('.card-feed .scrollable-content');
    if (!postsContainer) return console.error("Container do feed não encontrado.");

    renderSkeletonLoader();
    
    try {
        // Busca os dados do usuário e os posts em paralelo para mais performance
        const [user, posts] = await Promise.all([
            api.getCurrentUser(),
            api.getFeedPosts()
        ]);
        
        // Limpa o esqueleto e renderiza os posts reais
        const composerHTML = document.getElementById('home-template').content.querySelector('.feed-composer').outerHTML;
        postsContainer.innerHTML = composerHTML;
        posts.forEach(post => renderPost(post));

        // Configura a área de criação de post com os dados do usuário
        setupComposer(user);

    } catch (error) {
        console.error("Erro ao carregar a página Home:", error);
        postsContainer.innerHTML += `<p style="padding: 20px; text-align: center;">Não foi possível carregar o conteúdo.</p>`;
    }
}