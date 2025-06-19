// assets/js/dashboard/apiService.js

// O authService é essencial para pegarmos o token de autenticação.
import { authService } from '../auth.js';

// A URL base da sua API. Altere se for diferente.
const API_BASE_URL = 'https://api-gym-cyan.vercel.app';

/**
 * Função genérica para fazer requisições JSON para a API.
 * @param {string} endpoint - O endpoint da API (ex: '/posts').
 * @param {string} method - O método HTTP (GET, POST, etc.).
 * @param {object} body - O corpo da requisição para métodos POST/PUT.
 * @returns {Promise<any>} - A resposta da API em JSON.
 */
async function request(endpoint, method = 'GET', body = null) {
    const token = authService.getToken();
    if (!token) {
        // Se não houver token, redireciona para a página de login.
        window.location.href = 'login.html';
        throw new Error('Usuário não autenticado.');
    }

    const options = {
        method,
        headers: {
            'x-auth-token': token
        }
    };

    if (body && method !== 'GET') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

    if (response.status === 401) {
        authService.logout();
        window.location.href = 'login.html';
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ocorreu um erro na requisição.');
    }

    return response.json();
}


/**
 * Função específica para requisições com upload de arquivo (FormData).
 * @param {string} endpoint - O endpoint da API.
 * @param {string} method - O método HTTP.
 * @param {FormData} formData - O objeto FormData com os dados do formulário.
 * @returns {Promise<any>} - A resposta da API em JSON.
 */
async function requestWithFile(endpoint, method = 'POST', formData) {
    const token = authService.getToken();
    // if (!token) {
    //     window.location.href = 'login.html';
    //     throw new Error('Usuário não autenticado.');
    // }

    const options = {
        method,
        headers: {
            'x-auth-token': token
            // OBS: Não definimos 'Content-Type', o navegador faz isso automaticamente para FormData.
        },
        body: formData
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    
    // ... (tratamento de erro similar à função 'request')
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro no envio do formulário.');
    }

    return response.json();
}


// Exportamos um objeto com os métodos da nossa API de forma organizada.
export const api = {
    getFeedPosts: () => request('/posts'),
    createPost: (formData) => requestWithFile('/posts', 'POST', formData),
    getCurrentUser: () => request('/auth/profile') // <-- ADICIONE ESTA LINHA
    // Futuramente, adicionaremos mais métodos aqui (getWorkouts, etc.)
};