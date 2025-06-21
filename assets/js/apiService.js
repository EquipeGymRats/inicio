/**
 * apiService.js
 * Módulo para chamadas de API de dados (treino, posts, etc.).
 * IMPORTA e UTILIZA o 'authService' para obter o token de autenticação.
 */

// 1. Importa o seu serviço de autenticação
import { authService } from './auth.js'; // Garanta que o caminho para o seu auth.js está correto


const API_BASE_URL = 'https://api-gym-cyan.vercel.app'; // A mesma URL base do seu auth.js

/**
 * Função centralizada para fazer requisições de DADOS à API.
 * @param {string} endpoint - O endpoint da API (ex: '/training/today').
 * @param {string} method - O método HTTP ('GET', 'POST', 'PUT', 'DELETE').
 * @param {object|FormData} [body] - O corpo da requisição.
 * @param {boolean} [isFormData=false] - Define se o corpo é FormData (para uploads).
 * @returns {Promise<any>} - A resposta da API em formato JSON.
 */
async function request(endpoint, method = 'GET', body = null, isFormData = false) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // 2. Usa a função do seu auth.js para pegar o token
    const token = authService.getToken();

    const headers = new Headers();
    if (token) {
        // 3. Usa o cabeçalho 'x-auth-token' como você especificou
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

        if (!response.ok) {
            // 4. Se o token for inválido, usa a função de logout do seu auth.js
            if (response.status === 401 || response.status === 403) {
                console.error('Não autorizado. Token inválido ou expirado. Deslogando...');
                authService.logout(); // Chama a função de logout centralizada
                window.location.href = '/login.html'; // Redireciona para a página de login
            }
            const errorData = await response.json();
            throw new Error(errorData.message || `Erro ${response.status}`);
        }

        if (response.status === 204) {
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Erro na requisição para ${endpoint}:`, error);
        throw error;
    }
}

// 5. Exporta o objeto 'api' apenas com as funções relacionadas a DADOS
export const api = {
    // --- Treino ---
    getTodayWorkout: async () => {
        const response = await request('/training/today');
        if (response.isRestDay) {
            return response;
        }
        // A API de hoje retorna um objeto aninhado. O frontend espera o objeto de treino direto.
        return response.workout; 
    },
    
    completeTodayWorkout: (dayName) => request('/training/complete-day', 'POST', { dayName }),
    getTrainingPlan: () => request('/training'),
    // --- Feed ---
    getFeedPosts: () => request('/posts'),

    createPost: (formData) => request('/posts', 'POST', formData, true),

    // --- Nutrição ---
    getTodayNutrition: () => request('/nutrition'),
    getNutritionPlan: () => request('/nutrition'),

    // --- Lembretes ---
    getReminders: () => request('/reminders'),
    createReminder: (data) => request('/reminders', 'POST', data),
    updateReminder: (id, data) => request(`/reminders/${id}`, 'PUT', data),
    deleteReminder: (id) => request(`/reminders/${id}`, 'DELETE'),
    savePushSubscription: (subscription) => request('/push/subscribe', 'POST', { subscription }),
};