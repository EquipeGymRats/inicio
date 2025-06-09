import { authService } from './auth.js'; // Certifique-se de que o auth.js está no mesmo diretório ou ajuste o caminho.

const userAuthDisplay = document.getElementById('user-auth-display');
const authText = document.getElementById('auth-text');
const loginLink = document.getElementById('login-link');
const logoutLink = document.getElementById('logout-link');
const authDropdown = document.getElementById('auth-dropdown');
const menuToggle = document.getElementById('menu-toggle'); // O checkbox do menu hambúrguer
const mainNav = document.getElementById('main-nav'); // A navegação principal

// Função para atualizar o estado do header de autenticação
async function updateAuthHeader() {
    const isMobile = window.innerWidth <= 768; // Define se é mobile com base no CSS

    if (authService.isLoggedIn()) {
        const userProfile = await authService.getUserProfile();

        if (userProfile && userProfile.username) {
            authText.textContent = isMobile ? '' : `Olá, ${userProfile.username.charAt(0).toUpperCase() + userProfile.username.slice(1)}`;
            authText.style.display = isMobile ? 'none' : 'inline'; // Esconde o texto no mobile
            loginLink.style.display = 'none';
            logoutLink.style.display = 'block';
        } else {
            authText.textContent = isMobile ? '' : 'Perfil';
            authText.style.display = isMobile ? 'none' : 'inline';
            loginLink.style.display = 'block';
            logoutLink.style.display = 'none';
            authDropdown.classList.remove('show');
        }
    } else {
        authText.textContent = isMobile ? '' : 'Perfil';
        authText.style.display = isMobile ? 'none' : 'inline';
        loginLink.style.display = 'block';
        logoutLink.style.display = 'none';
        authDropdown.classList.remove('show');
    }
}

// Clique no ícone do usuário para alternar o dropdown
if (userAuthDisplay) {
    userAuthDisplay.addEventListener('click', (event) => {
        event.stopPropagation(); // Impede que o clique se propague para o documento
        authDropdown.classList.toggle('show');
        // Fecha o menu hambúrguer se o dropdown de perfil for aberto
        if (menuToggle && menuToggle.checked) {
            menuToggle.checked = false;
        }
    });
}

// Fecha dropdown de autenticação se clicar fora
document.addEventListener('click', (event) => {
    if (
        authDropdown &&
        userAuthDisplay &&
        !userAuthDisplay.contains(event.target) &&
        !authDropdown.contains(event.target)
    ) {
        authDropdown.classList.remove('show');
    }
});

const dropdownToggle = document.getElementById('dropdownMenuToggle');
const dropdownNav = document.getElementById('dropdownNav');

if (dropdownToggle && dropdownNav) {
    dropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownNav.style.display = dropdownNav.style.display === 'flex' ? 'none' : 'flex';
    });

    document.addEventListener('click', (e) => {
        if (!dropdownNav.contains(e.target) && e.target !== dropdownToggle) {
            dropdownNav.style.display = 'none';
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            dropdownNav.style.display = 'none';
        }
    });
}


// Fecha o menu hambúrguer e o dropdown de autenticação ao redimensionar a janela
window.addEventListener('resize', () => {
    if (menuToggle) {
        menuToggle.checked = false; // Fecha o menu hambúrguer
    }
    if (authDropdown) {
        authDropdown.classList.remove('show'); // Fecha o dropdown de autenticação
    }
    updateAuthHeader(); // Atualiza o texto do perfil com base no novo tamanho da tela
});

// Fecha o menu hambúrguer e o dropdown de autenticação ao clicar em um item de navegação
if (mainNav) {
    mainNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (menuToggle && window.innerWidth <= 768) { // Apenas se estiver em mobile
                menuToggle.checked = false;
            }
            if (authDropdown) {
                authDropdown.classList.remove('show');
            }
        });
    });
}


// Logout
if (logoutLink) {
    logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await authService.logout();
            updateAuthHeader();
            // Redirecionar para a página inicial ou de login após o logout
            window.location.href = 'index'; // Ou para 'login'
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
            // Mostrar uma mensagem de erro ao usuário
            alert('Não foi possível fazer logout. Tente novamente.');
        }
    });
}

// Inicializa o header de autenticação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', updateAuthHeader);

// Adiciona um listener para o evento de login/logout personalizado, caso você o emita do auth.js
window.addEventListener('authChange', updateAuthHeader);