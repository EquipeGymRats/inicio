// assets/js/dashboard/home.js
import { authService } from '../auth.js'; // Certifique-se de que o auth.js está no mesmo diretório ou ajuste o caminho.

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializa a autenticação e obtém os dados do usuário
    const authData = await authService.isLoggedIn();
    if (!authData) {
        // Se não estiver autenticado, não faz nada (o auth.js já redireciona)
        return;
    }
    
    // Elementos da UI
    const userNameSpan = document.getElementById('user-name');
    const userNameSidebar = document.querySelector('.user-name-sidebar');
    const userLevelSidebar = document.querySelector('.user-level-sidebar');
    
    // Popula informações do usuário na UI
    if (authData.user) {
        const firstName = authData.user.name.split(' ')[0];
        userNameSpan.textContent = firstName;
        userNameSidebar.textContent = authData.user.name;
        userLevelSidebar.textContent = `Nível: ${authData.user.level || 'Iniciante'}`;
    }

    // Gerencia o carregamento dos cards
    loadWorkoutCard();
    loadNutritionCard();
    loadFeedCard();
});

/**
 * Carrega o card "Treino do Dia".
 * Verifica o cache antes de buscar na API.
 */
async function loadWorkoutCard() {
    const workoutContent = document.getElementById('workout-content');
    const workoutSkeleton = document.getElementById('workout-skeleton');

    // Mostra o skeleton loader
    workoutSkeleton.style.display = 'block';

    try {
        const cachedWorkout = sessionStorage.getItem('workoutOfTheDay');

        if (cachedWorkout) {
            // Se houver cache, usa os dados
            const data = JSON.parse(cachedWorkout);
            console.log('Workout of the day loaded from cache.');
            renderWorkout(data);
        } else {
            // Se não, busca da API (simulado)
            console.log('Fetching workout of the day from API...');
            const data = await fetchWorkoutOfTheDay();
            sessionStorage.setItem('workoutOfTheDay', JSON.stringify(data)); // Salva no cache
            renderWorkout(data);
        }
    } catch (error) {
        console.error('Error loading workout card:', error);
        workoutContent.innerHTML = '<p>Não foi possível carregar o treino. Tente novamente mais tarde.</p>';
    } finally {
        // Esconde o skeleton loader
        workoutSkeleton.style.display = 'none';
    }
}

/**
 * Renderiza o conteúdo do treino no card.
 * @param {object} data - Os dados do treino.
 */
function renderWorkout(data) {
    const workoutContent = document.getElementById('workout-content');
    const workoutDaySpan = document.getElementById('workout-day');

    workoutDaySpan.textContent = data.day;
    
    const exerciseList = data.exercises.map(ex => `
        <li>
            <i class="fas fa-check-circle"></i>
            <span>${ex.name} - ${ex.sets}x${ex.reps}</span>
        </li>
    `).join('');

    workoutContent.innerHTML = `<ul>${exerciseList}</ul>`;
    
    // Garante que o conteúdo real esteja visível
    const card = document.getElementById('workout-card');
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
}


/**
 * Simula a busca de dados do treino do dia na API.
 */
function fetchWorkoutOfTheDay() {
    return new Promise(resolve => {
        setTimeout(() => {
            const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
            resolve({
                day: today.charAt(0).toUpperCase() + today.slice(1),
                exercises: [
                    { name: "Supino Reto", sets: 4, reps: 10 },
                    { name: "Desenvolvimento com Halteres", sets: 3, reps: 12 },
                    { name: "Puxada Frontal", sets: 3, reps: 12 },
                    { name: "Agachamento Livre", sets: 4, reps: 10 },
                    { name: "Abdominal na Prancha", sets: 3, reps: '30s' }
                ]
            });
        }, 1500); // Simula um delay de 1.5s da rede
    });
}


/**
 * Carrega o card de Nutrição (atualmente um placeholder).
 */
function loadNutritionCard() {
    const nutritionSkeleton = document.getElementById('nutrition-skeleton');
    const nutritionRealContent = document.getElementById('nutrition-real-content');
    const card = document.getElementById('nutrition-card');

    setTimeout(() => {
        nutritionSkeleton.style.display = 'none';
        nutritionRealContent.classList.remove('hidden');
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, 2000); // Simula um carregamento um pouco mais lento
}

/**
 * Carrega o card do Feed (atualmente um placeholder).
 */
function loadFeedCard() {
    const feedSkeleton = document.getElementById('feed-skeleton');
    const feedRealContent = document.getElementById('feed-real-content');
    const card = document.getElementById('feed-card');
    
    setTimeout(() => {
        feedSkeleton.style.display = 'none';
        feedRealContent.classList.remove('hidden');
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, 2500); // Simula um carregamento ainda mais lento
}

// Lógica do menu sidebar (se já não existir em outro arquivo)
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.querySelector('.sidebar');

menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});
