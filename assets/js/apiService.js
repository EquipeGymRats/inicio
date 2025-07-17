// assets/js/apiService.js

/**
 * apiService.js
 * Módulo CENTRALIZADO para todas as chamadas de API de dados (treino, posts, etc.).
 * Ele importa e utiliza o 'authService' para obter o token de autenticação.
 */

// 1. Importa o serviço de autenticação para pegar o token.
import { authService } from './auth.js';

// Define a URL base da API dependendo se está em ambiente local ou de produção.
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal 
    ? 'http://192.168.10.24:3000' // URL para desenvolvimento local
    : 'https://api-gym-cyan.vercel.app'; // URL para produção

/**
 * Função principal e centralizada para fazer requisições à API.
 * @param {string} endpoint - O endpoint da API (ex: '/training/today').
 * @param {string} method - O método HTTP ('GET', 'POST', 'PUT', 'DELETE').
 * @param {object|FormData} [body] - O corpo da requisição.
 * @param {boolean} [isFormData=false] - Define se o corpo é FormData (para uploads).
 * @returns {Promise<any>} - A resposta da API em formato JSON.
 */
async function request(endpoint, method = 'GET', body = null, isFormData = false) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Pega o token de autenticação do authService.
    const token = authService.getToken();

    const headers = new Headers();
    if (token) {
        headers.append('x-auth-token', token);
    }

    const config = {
        method,
        headers,
    };

    if (body) {
        if (isFormData) {
            config.body = body;
        } else {
            headers.append('Content-Type', 'application/json');
            config.body = JSON.stringify(body);
        }
    }

    try {
        const response = await fetch(url, config);

        // Se a resposta não for bem-sucedida (status não for 2xx), trata o erro.
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.error('Não autorizado. Token inválido ou expirado. Deslogando...');
                authService.logout(); // Chama a função de logout centralizada
                sessionStorage.setItem('redirectUrl', window.location.href);
                window.location.href = 'login.html'; // Redireciona para a página de login
            }
            // Tenta extrair uma mensagem de erro do corpo da resposta.
            const errorData = await response.json().catch(() => ({ message: `Erro ${response.status}: ${response.statusText}` }));
            throw new Error(errorData.message);
        }

        // Se a resposta for 204 No Content, não há corpo para ler. Retorna null.
        if (response.status === 204) {
            return null;
        }
        
        // --- ESTA É A PARTE MAIS IMPORTANTE ---
        // Retorna a resposta da API convertida para JSON.
        // Se esta linha não tiver 'return', a função terminará e o valor será 'undefined'.
        return await response.json();

    } catch (error) {
        console.error(`Erro na requisição para ${endpoint}:`, error);
        throw error; // Repassa o erro para quem chamou a função (ex: my-training.js).
    }
}

// Exporta um objeto 'api' com todas as funções de comunicação com o backend.
// Cada função aqui DEVE retornar o resultado da chamada 'request'.
export const api = {
    ping: () => request('/ping'),
    // --- Treino ---
    getTodayWorkout: () => request('/training/today'),
    getTrainingPlan: () => request('/training'),
    completeTodayWorkout: (dayName) => request('/training/complete-day', 'POST', { dayName }),

    // --- Feed ---
    getFeedPosts: (page = 1) => request(`/posts?page=${page}&limit=5`),
    createPost: (formData) => request('/posts', 'POST', formData, true),
    deletePost: (postId) => request(`/posts/${postId}`, 'DELETE'),
    getUserProfileByUsername: (username) => request(`/user/${username}`),

    likePost: (postId) => request(`/posts/${postId}/like`, 'POST'),
    addComment: (postId, text) => request(`/posts/${postId}/comment`, 'POST', { text }),
    getComments: (postId) => request(`/posts/${postId}/comments`),
    getNotifications: () => request('/notifications'),
    markAllNotificationsAsRead: () => request('/notifications/read-all', 'POST'),

    // --- Nutrição ---
    getNutritionPlan: () => request('/nutrition'),
    
    // --- Lembretes ---
    getReminders: () => request('/reminders'),
    createReminder: (data) => request('/reminders', 'POST', data),
    updateReminder: (id, data) => request(`/reminders/${id}`, 'PUT', data),
    deleteReminder: (id) => request(`/reminders/${id}`, 'DELETE'),
    savePushSubscription: (subscription) => request('/push/subscribe', 'POST', { subscription }),

};