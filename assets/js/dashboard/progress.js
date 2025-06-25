// assets/js/dashboard/progress.js

import { api } from '../apiService.js';
import { authService } from '../auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos do DOM
    const weightChartCanvas = document.getElementById('weight-chart');
    const measurementsChartCanvas = document.getElementById('measurements-chart');
    const achievementsGrid = document.getElementById('achievements-grid');

    // Variáveis para guardar as instâncias dos gráficos
    let weightChartInstance = null;
    let measurementsChartInstance = null;

    // --- CONFIGURAÇÕES GLOBAIS DOS GRÁFICOS ---
    const chartDefaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                titleFont: { size: 14 },
                bodyFont: { size: 12 },
                padding: 10,
                cornerRadius: 6,
            },
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                },
                ticks: {
                    color: '#aaa',
                },
            },
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                },
                ticks: {
                    color: '#aaa',
                },
                beginAtZero: false,
            },
        },
    };

    // --- FUNÇÕES DE RENDERIZAÇÃO ---

    /**
     * Renderiza ou atualiza o gráfico de peso.
     * @param {Array<Object>} weightData - Dados de peso { date, weight }.
     */
    function renderWeightChart(weightData) {
        if (!weightChartCanvas) return;

        const labels = weightData.map(d => new Date(d.date).toLocaleDateString());
        const dataPoints = weightData.map(d => d.weight);

        if (weightChartInstance) {
            weightChartInstance.destroy();
        }

        weightChartInstance = new Chart(weightChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Peso (kg)',
                    data: dataPoints,
                    borderColor: '#ffd75d',
                    backgroundColor: 'rgba(255, 215, 93, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ffd75d',
                    pointHoverRadius: 7,
                }]
            },
            options: chartDefaultOptions
        });
    }

    /**
     * Renderiza ou atualiza o gráfico de medidas.
     * @param {Array<Object>} measurementData - Dados de medida { date, value }.
     * @param {string} measurementType - O tipo de medida (ex: "Bíceps").
     */
    function renderMeasurementsChart(measurementData, measurementType) {
        if (!measurementsChartCanvas) return;

        const labels = measurementData.map(d => new Date(d.date).toLocaleDateString());
        const dataPoints = measurementData.map(d => d.value);

        if (measurementsChartInstance) {
            measurementsChartInstance.destroy();
        }

        measurementsChartInstance = new Chart(measurementsChartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: `${measurementType} (cm)`,
                    data: dataPoints,
                    backgroundColor: '#4CAF50',
                    borderColor: '#388E3C',
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: chartDefaultOptions
        });
    }

    /**
     * Renderiza a grade de conquistas.
     * @param {Array<Object>} achievements - Array com todas as conquistas possíveis.
     * @param {Array<string>} unlockedIds - IDs das conquistas desbloqueadas pelo usuário.
     */
    function renderAchievements(achievements, userProfile) {
        if (!achievementsGrid) return;
        achievementsGrid.innerHTML = ''; // Limpa a grade

        const unlockedAchievements = userProfile.unlockedAchievements || [];

        achievements.forEach(ach => {
            const unlockedData = unlockedAchievements.find(ua => ua.achievementId === ach._id);
            const isUnlocked = !!unlockedData;

            const card = document.createElement('div');
            card.className = `achievement-card ${isUnlocked ? 'unlocked' : ''}`;
            
            card.innerHTML = `
                <img src="${ach.mascotImageUrl}" alt="${ach.name}" class="achievement-icon">
                <h3 class="achievement-title">${ach.name}</h3>
                <p class="achievement-description">${isUnlocked ? ach.description : '???'}</p>
                ${isUnlocked ? `<p class="achievement-date">Conquistado em: ${new Date(unlockedData.date).toLocaleDateString()}</p>` : ''}
            `;
            achievementsGrid.appendChild(card);
        });
    }


    // --- LÓGICA PRINCIPAL ---

    /**
     * Carrega todos os dados de progresso da API.
     */
    async function loadAllProgressData() {
        try {
            // Em um cenário real, você teria endpoints específicos para cada dado.
            // Ex: api.getWeightHistory(), api.getMeasurementsHistory(), etc.
            // Por enquanto, vamos simular com os dados do perfil do usuário.
            const userProfile = await authService.getUserProfile();
            const allAchievements = await api.getAllAchievements(); // Supondo que exista um endpoint para isso

            if (userProfile && userProfile.progress) {
                // Filtra e renderiza o gráfico de peso com dados dos últimos 30 dias por padrão
                const last30DaysWeight = userProfile.progress.weight.slice(-30);
                renderWeightChart(last30DaysWeight);

                // Renderiza o gráfico de medidas de bíceps por padrão
                const bicepsData = userProfile.progress.measurements.biceps || [];
                renderMeasurementsChart(bicepsData, 'Bíceps');
            } else {
                 weightChartCanvas.parentElement.innerHTML = '<p class="info-msg">Nenhum dado de peso registrado. Atualize em Configurações.</p>';
                 measurementsChartCanvas.parentElement.innerHTML = '<p class="info-msg">Nenhum dado de medidas registrado.</p>';
            }
            
            if(allAchievements && userProfile) {
                renderAchievements(allAchievements, userProfile);
            }

        } catch (error) {
            console.error("Erro ao carregar dados de progressão:", error);
            document.querySelector('.charts-section').innerHTML = `<p class="error-msg">Não foi possível carregar seus dados de progresso.</p>`;
            achievementsGrid.innerHTML = `<p class="error-msg">Não foi possível carregar as conquistas.</p>`;
        }
    }

    // --- EVENT LISTENERS PARA OS FILTROS ---
    document.getElementById('weight-period-filter')?.addEventListener('change', async (e) => {
        const period = e.target.value;
        const userProfile = await authService.getUserProfile();
        let dataToShow = userProfile.progress.weight || [];

        if (period !== 'all') {
            dataToShow = dataToShow.slice(-parseInt(period));
        }
        renderWeightChart(dataToShow);
    });

    document.getElementById('measurement-type-filter')?.addEventListener('change', async (e) => {
        const type = e.target.value; // ex: "biceps"
        const typeLabel = e.target.options[e.target.selectedIndex].text; // ex: "Bíceps"
        const userProfile = await authService.getUserProfile();
        const dataToShow = userProfile.progress.measurements[type] || [];
        renderMeasurementsChart(dataToShow, typeLabel);
    });


    // --- INICIALIZAÇÃO ---
    loadAllProgressData();
});