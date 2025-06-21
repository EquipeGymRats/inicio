import { api } from '../apiService.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const overviewContainer = document.getElementById('nutrition-overview');
    const tabsContainer = document.getElementById('day-tabs');
    const contentContainer = document.getElementById('day-content-container');

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function renderOverview(plan) {
        const { goal, dietType } = plan.userInputs;
        overviewContainer.innerHTML = `
            <div class="overview-header">
                <i class="fa-solid fa-utensils"></i>
                <h1>Meu Plano Alimentar</h1>
            </div>
            <div class="overview-details">
                <div class="overview-item"><i class="fa-solid fa-bullseye"></i> Objetivo: ${goal}</div>
                <div class="overview-item"><i class="fa-solid fa-seedling"></i> Dieta: ${dietType}</div>
            </div>
        `;
    }

    function renderTabsAndContent(planDays) {
        tabsContainer.innerHTML = '';
        contentContainer.innerHTML = '';

        planDays.forEach((day, index) => {
            // Cria o botão da aba
            const tabButton = document.createElement('button');
            tabButton.className = 'day-tab-btn';
            tabButton.textContent = day.dayName.substring(0, 3);
            tabButton.dataset.day = day.dayName;
            tabsContainer.appendChild(tabButton);

            // Cria o container do conteúdo do dia
            const dayContent = document.createElement('div');
            dayContent.className = 'day-content';
            dayContent.id = `content-${day.dayName}`;

            dayContent.innerHTML = day.meals.map(meal => `
                <div class="meal-card">
                    <div class="meal-header">
                        <i class="${meal.icon || 'fa-solid fa-utensils'}"></i>
                        <h3>${meal.mealName}</h3>
                    </div>
                    <div class="meal-body">
                         <div class="meal-main-content">
                            <div class="food-list-wrapper">
                                <ul class="food-list">
                                    ${meal.foods.map(food => `<li>${food}</li>`).join('')}
                                </ul>
                            </div>
                            <div class="macros-info">
                                <div class="macro-item">
                                    <div class="macro-label">
                                        <i class="fa-solid fa-drumstick-bite fa-fw"></i>
                                        <span>Proteínas</span>
                                    </div>
                                    <strong>${meal.macronutrients.protein}</strong>
                                </div>
                                <div class="macro-item">
                                    <div class="macro-label">
                                        <i class="fa-solid fa-bread-slice fa-fw"></i>
                                        <span>Carboidratos</span>
                                    </div>
                                    <strong>${meal.macronutrients.carbohydrates}</strong>
                                </div>
                                <div class="macro-item">
                                    <div class="macro-label">
                                        <i class="fa-solid fa-droplet fa-fw"></i>
                                        <span>Gorduras</span>
                                    </div>
                                    <strong>${meal.macronutrients.fats}</strong>
                                </div>
                            </div>
                        </div>
                        ${meal.preparationTip ? `
                            <div class="preparation-tip">
                                <i class="fa-solid fa-lightbulb"></i>
                                <p>${meal.preparationTip}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('');
            
            contentContainer.appendChild(dayContent);

            // Ativa a primeira aba por padrão, caso nenhum parâmetro de URL seja passado
            if (index === 0) {
                tabButton.classList.add('active');
                dayContent.classList.add('active');
            }
        });
    }

    // --- FUNÇÃO PARA ATIVAR UMA ABA ESPECÍFICA ---
    function activateTab(dayName) {
        // Desativa todas as abas e conteúdos primeiro
        tabsContainer.querySelectorAll('.day-tab-btn').forEach(btn => btn.classList.remove('active'));
        contentContainer.querySelectorAll('.day-content').forEach(content => content.classList.remove('active'));

        // Encontra e ativa a aba e o conteúdo correspondentes
        const targetButton = tabsContainer.querySelector(`.day-tab-btn[data-day="${dayName}"]`);
        const targetContent = document.getElementById(`content-${dayName}`);

        if (targetButton && targetContent) {
            targetButton.classList.add('active');
            targetContent.classList.add('active');
        }
    }

    // --- LÓGICA PRINCIPAL ---
    async function loadNutritionPlan() {
        try {
            const plan = await api.getNutritionPlan();
            renderOverview(plan);
            renderTabsAndContent(plan.plan);

            // LÊ O PARÂMETRO DA URL E ATIVA A ABA CORRETA
            const urlParams = new URLSearchParams(window.location.search);
            const targetDay = urlParams.get('day');

            if (targetDay) {
                activateTab(targetDay);
            }

        } catch (error) {
            console.error('Erro ao carregar plano alimentar:', error);
            overviewContainer.innerHTML = '';
            contentContainer.innerHTML = `<p class="error-msg">${error.message || 'Crie um plano alimentar para vê-lo aqui.'}</p>`;
            tabsContainer.style.display = 'none';
        }
    }

    // --- EVENT LISTENER PARA TROCA DE ABAS ---
    tabsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('day-tab-btn')) {
            const dayName = event.target.dataset.day;
            activateTab(dayName);
        }
    });

    // Inicia o carregamento
    loadNutritionPlan();
});