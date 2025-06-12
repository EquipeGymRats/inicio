// assets/js/progressao.js

import { api } from './apiService.js';
import { authService } from '../auth.js';

function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        element.textContent = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function renderWeeklyChart(ctx, data) {
    const labels = data.map(d => `Semana ${d._id.substring(5)}`);
    const values = data.map(d => d.count);
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Treinos Concluídos',
                data: values,
                backgroundColor: 'rgba(255, 215, 93, 0.7)',
                borderColor: 'rgba(255, 215, 93, 1)',
                borderWidth: 1, borderRadius: 5,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { color: '#B0B0B0', stepSize: 1 } },
                x: { ticks: { color: '#B0B0B0' } }
            }
        }
    });
}

function renderFrequencyChart(ctx, data) {
    const labels = data.map(d => d._id);
    const values = data.map(d => d.count);
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['rgba(255, 215, 93, 0.8)', 'rgba(0, 191, 255, 0.8)', 'rgba(50, 205, 50, 0.8)', 'rgba(231, 76, 60, 0.8)', 'rgba(142, 68, 173, 0.8)'],
                borderColor: '#1A1A1A',
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top', labels: { color: '#F0F0F0' } } }
        }
    });
}

export async function initProgressaoPage() {
    console.log("Iniciando a aba de Progressão...");
    try {
        const [stats, user] = await Promise.all([api.getProgressStats(), authService.getUserProfile()]);
        
        const streakEl = document.getElementById('streak-value');
        const totalWorkoutsEl = document.getElementById('total-workouts-value');
        const totalXpEl = document.getElementById('total-xp-value');
        const goalLevelNameEl = document.getElementById('goal-level-name');
        const weeklyCtx = document.getElementById('weekly-chart')?.getContext('2d');
        const frequencyCtx = document.getElementById('frequency-chart')?.getContext('2d');

        if(streakEl) animateValue(streakEl, 0, stats.currentStreak, 1500);
        if(totalWorkoutsEl) animateValue(totalWorkoutsEl, 0, stats.totalWorkouts, 1500);
        if(totalXpEl && user) animateValue(totalXpEl, 0, user.xp, 1500);
        if (goalLevelNameEl && user.levelInfo) {
            goalLevelNameEl.textContent = user.levelInfo.currentLevel.name;
        }

        if(weeklyCtx && stats.weeklyData) renderWeeklyChart(weeklyCtx, stats.weeklyData);
        if(frequencyCtx && stats.workoutFrequency) renderFrequencyChart(frequencyCtx, stats.workoutFrequency);

    } catch (error) {
        console.error("Erro ao carregar dados de progressão:", error);
        document.querySelector('.charts-grid').innerHTML = `<p style="color: #e74c3c;">Não foi possível carregar suas estatísticas.</p>`;
    }
}