import { authService } from './auth.js';

const userAuthDisplay = document.getElementById('user-auth-display');
const authText = document.getElementById('auth-text');
const loginLink = document.getElementById('login-link');
const logoutLink = document.getElementById('logout-link');
const authDropdown = document.getElementById('auth-dropdown');

// Atualiza o estado do header de autenticação
async function updateAuthHeader() {
    if (authService.isLoggedIn()) {
        const userProfile = await authService.getUserProfile();

        if (userProfile && userProfile.username) {
            authText.textContent = `Olá, ${userProfile.username.charAt(0).toUpperCase() + userProfile.username.slice(1)}`;
            loginLink.style.display = 'none';
            logoutLink.style.display = 'block';
        } else {
            authText.textContent = 'Perfil';
            loginLink.style.display = 'block';
            logoutLink.style.display = 'none';
            authDropdown.classList.remove('show');
        }
    } else {
        authText.textContent = 'Perfil';
        loginLink.style.display = 'block';
        logoutLink.style.display = 'none';
        authDropdown.classList.remove('show');
    }
}

// Clique no ícone do usuário
if (userAuthDisplay) {
    userAuthDisplay.addEventListener('click', (event) => {
        event.stopPropagation();
        authDropdown.classList.toggle('show');
    });
}

// Fecha dropdown se clicar fora
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

// Logout
if (logoutLink) {
    logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        authService.logout();
        await updateAuthHeader();
        window.location.href = 'index';
    });
}

// Executa na carga da página
updateAuthHeader();
