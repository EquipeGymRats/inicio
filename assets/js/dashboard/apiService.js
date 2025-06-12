// assets/js/apiService.js

import { authService } from '../auth.js'; // Certifique-se que auth.js está na mesma pasta

// URL do seu backend local. MUITO IMPORTANTE!
const API_BASE_URL = 'https://api-gym-cyan.vercel.app';

// Função genérica para fazer requisições à API
async function request(endpoint, method = 'GET', body = null) {
    const token = authService.getToken();
    if (!token) {
        console.error("Nenhum token de autenticação encontrado. Redirecionando para login.");
        window.location.href = 'login.html';
        throw new Error('Usuário não autenticado.');
    }

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token // Header correto conforme seu middleware
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        console.log(`Fazendo requisição: ${method} ${API_BASE_URL}${endpoint}`); // Log para debug
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

        if (response.status === 401) {
            authService.logout();
            window.location.href = 'login.html';
            throw new Error('Sessão expirada. Faça login novamente.');
        }
        
        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.message || 'Ocorreu um erro na requisição.');
        }

        return responseData;

    } catch (error) {
        console.error(`Falha na requisição para ${endpoint}:`, error);
        throw error; // Propaga o erro para ser tratado na função que chamou
    }
}

// Objeto que exporta todas as funções de comunicação com a API
export const api = {
    getWorkouts: () => request('/training'),
    getTrainingLogs: () => request('/training/logs'),
    markWorkoutDone: (dayName) => request('/training/complete-day', 'POST', { dayName }),
    getProgressStats: () => request('/training/stats'), // <<< ADICIONE ESTA LINHA
    // Adicione outras chamadas de API aqui conforme necessário
};