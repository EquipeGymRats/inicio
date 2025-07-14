import { authService } from './auth.js';

// --- Seletores do DOM ---
const userAuthDisplay = document.getElementById('user-auth-display');
const authText = document.getElementById('auth-text');
const loginLink = document.getElementById('login-link');
const logoutLink = document.getElementById('logout-link');
const authDropdown = document.getElementById('auth-dropdown');

const dropdownToggle = document.getElementById('dropdownMenuToggle');
const dropdownNav = document.getElementById('dropdownNav');

// Seletores dos novos elementos mobile
const mobileAuthText = document.getElementById('mobile-auth-text');
const mobileLoginLink = document.getElementById('mobile-login-link');
const mobileLogoutLink = document.getElementById('mobile-logout-link');

// --- Funções ---

// Função para atualizar o estado de autenticação (header e menu mobile)
async function updateAuthStatus() {
    const isLoggedIn = authService.isLoggedIn();

    if (isLoggedIn) {
        const userProfile = await authService.getUserProfile();
        const username = userProfile?.username ? (userProfile.username.charAt(0).toUpperCase() + userProfile.username.slice(1)) : 'Usuário';

        // Atualiza header do Desktop
        authText.textContent = `Olá, ${username}`;
        loginLink.style.display = 'none';
        logoutLink.style.display = 'block';

        // Atualiza menu Mobile
        if (mobileAuthText) mobileAuthText.textContent = username;
        if (mobileLoginLink) mobileLoginLink.style.display = 'none';
        if (mobileLogoutLink) mobileLogoutLink.style.display = 'block';

    } else {
        // Estado deslogado para header do Desktop
        authText.textContent = 'Perfil';
        loginLink.style.display = 'block';
        logoutLink.style.display = 'none';

        // Estado deslogado para menu Mobile
        if (mobileAuthText) mobileAuthText.textContent = 'Login';
        if (mobileLoginLink) mobileLoginLink.style.display = 'block';
        if (mobileLogoutLink) mobileLogoutLink.style.display = 'none';
    }
}

// --- Event Listeners ---

// Dropdown de perfil (desktop)
if (userAuthDisplay) {
    userAuthDisplay.addEventListener('click', (event) => {
        event.stopPropagation();
        authDropdown.classList.toggle('show');
        dropdownNav.classList.remove('active'); // Garante que o menu mobile feche
    });
}

// Menu hambúrguer (mobile)
if (dropdownToggle) {
    dropdownToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        dropdownNav.classList.toggle('active');
        authDropdown.classList.remove('show'); // Garante que o dropdown de perfil feche
    });
}

// Fechar menus ao clicar fora
document.addEventListener('click', (event) => {
    if (authDropdown && !userAuthDisplay.contains(event.target) && !authDropdown.contains(event.target)) {
        authDropdown.classList.remove('show');
    }
    if (dropdownNav && !dropdownToggle.contains(event.target) && !dropdownNav.contains(event.target)) {
        dropdownNav.classList.remove('active');
    }
});

// Logout (agora unificado para ambos os botões)
const handleLogout = async (e) => {
    e.preventDefault();
    try {
        await authService.logout();
        updateAuthStatus();
        window.location.href = '/inicio';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
};

if (logoutLink) logoutLink.addEventListener('click', handleLogout);
if (mobileLogoutLink) mobileLogoutLink.addEventListener('click', handleLogout);

// Salvar URL de redirecionamento para o login
if (loginLink) {
    loginLink.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.setItem('redirectUrl', window.location.href);
        window.location.href = e.currentTarget.href;
    });
}
if (mobileLoginLink) {
    mobileLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.setItem('redirectUrl', window.location.href);
        window.location.href = e.currentTarget.href;
    });
}


// --- Inicialização ---
document.addEventListener('DOMContentLoaded', updateAuthStatus);
window.addEventListener('authChange', updateAuthStatus);