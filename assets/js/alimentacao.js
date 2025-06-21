// assets/js/alimentacao.js

import { authService } from './auth.js';

const api = {
    getNutritionPlan: async () => {
        const token = authService.getToken();
        // A URL deve corresponder à sua URL de produção/desenvolvimento
        return fetch('https://api-gym-cyan.vercel.app/nutrition', { headers: { 'x-auth-token': token } });
    },
    saveNutritionPlan: async (planData) => {
        const token = authService.getToken();
        return fetch('https://api-gym-cyan.vercel.app/nutrition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify(planData)
        });
    }
};


document.addEventListener('DOMContentLoaded', () => {
    // --- Referências aos Elementos do DOM ---
    const alimentacaoHeaderInfo = document.querySelector('.alimentacao-header-info');
    const saveNutriBtn = document.getElementById('save-nutri-btn'); // <<< NOVO
    const nutriSummaryInfo = document.getElementById('nutri-summary-info');
    const nutriObjectiveSpan = document.getElementById('nutri-objective');
    const nutriLevelSpan = document.getElementById('nutri-level');
    const nutriFrequencySpan = document.getElementById('nutri-frequency');
    const nutriCaloriesSpan = document.getElementById('nutri-calories');
    const estimatedCaloriesContainer = document.querySelector('.estimated-calories');

    const nutriFormSection = document.getElementById('nutri-form-section');
    const nutritionDetailsForm = document.getElementById('nutrition-details-form');
    const formSteps = document.querySelectorAll('.form-step');
    const formProgressBar = document.querySelector('.form-progress-bar');
    const formProgressSteps = document.querySelectorAll('.form-progress-bar .progress-step');

    const nextStep1Btn = document.getElementById('next-step-1');
    const prevStep2Btn = document.getElementById('prev-step-2');
    const nextStep2Btn = document.getElementById('next-step-2');
    const prevStep3Btn = document.getElementById('prev-step-3');
    const submitNutritionFormBtn = document.getElementById('submit-nutrition-form');

    const nutriPlanOutput = document.getElementById('nutri-plan-output');
    const currentDayName = document.getElementById('current-day-name');
    const currentDayCard = document.getElementById('current-day-card');
    const prevDayBtn = document.getElementById('prev-day');
    const nextDayBtn = document.getElementById('next-day');

    const regenerateNutriBtn = document.getElementById('regenerate-nutri-btn');
    const exportNutriBtn = document.getElementById('export-nutri-btn');

    const notificationToast = document.getElementById('notification-toast');

    const nutriTipsSection = document.getElementById('nutri-tips-section');
    const nutriTipsList = document.getElementById('nutri-tips-list');
    
    const formLoadingOverlay = document.getElementById('form-loading-overlay');
    const loadingText = document.querySelector('.loading-text');

    // --- Referências ao Modal ---
    const mealDetailsModal = document.getElementById('meal-details-modal');
    const modalCloseButton = mealDetailsModal.querySelector('.modal-close-button');
    const modalMealIcon = document.getElementById('modal-meal-icon');
    const modalMealTitle = document.getElementById('modal-meal-title');
    const modalMealBody = document.getElementById('modal-meal-body');
    const modalMealSummary = document.getElementById('modal-meal-summary');


    let currentStep = 0;
    let nutritionPlanData = []; // Apenas o array `plan`
    let globalTipsData = []; // Apenas o array `tips`
    let fullPlanResponse = null; // Armazena a resposta completa da IA (com assinatura)
    let currentDayIndex = 0;

    const dayNames = [
        "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira",
        "Sexta-feira", "Sábado", "Domingo"
    ];

    // --- Funções Auxiliares de UI ---

    function showToast(message, type = 'info') {
        notificationToast.textContent = message;
        notificationToast.className = `notification-toast show ${type}`;
        setTimeout(() => {
            notificationToast.classList.remove('show');
            notificationToast.className = 'notification-toast';
        }, 5000);
    }

    function updateProgressBar(stepIndex) {
        formProgressBar.classList.remove('progress-step-1', 'progress-step-2', 'progress-step-3');
        if (stepIndex === 0) formProgressBar.classList.add('progress-step-1');
        else if (stepIndex === 1) formProgressBar.classList.add('progress-step-2');
        else if (stepIndex === 2) formProgressBar.classList.add('progress-step-3');

        formProgressSteps.forEach((step, index) => {
            step.classList.toggle('active', index <= stepIndex);
            step.textContent = index + 1; 
        });
    }

    function showStep(stepIndex) {
        formSteps.forEach((step, index) => {
            step.classList.toggle('active', index === stepIndex);
        });
        currentStep = stepIndex;
        updateProgressBar(stepIndex);
    }

    function animateToNextStep() {
        if (currentStep < formSteps.length - 1) {
            showStep(currentStep + 1);
        }
    }

    function animateToPrevStep() {
        if (currentStep > 0) {
            showStep(currentStep - 1);
        }
    }

    // --- Funções de Coleta e Validação ---

        function renderPlan(planObject, isNew = false) {
        nutritionPlanData = planObject.plan;
        globalTipsData = planObject.tips;

        // Preenche o cabeçalho de resumo com base nas entradas do usuário
        const inputs = planObject.userInputs;
        if (inputs && nutriObjectiveSpan && nutriLevelSpan && nutriCaloriesSpan) {
            nutriObjectiveSpan.textContent = inputs.goal || 'N/A';
            nutriLevelSpan.textContent = inputs.activityLevel || 'N/A';

            // Calcula e exibe as calorias (lógica de cálculo idêntica à do backend)
            const bmr = (10 * inputs.weight) + (6.25 * inputs.height) - (5 * inputs.age) + (inputs.gender === 'Masculino' ? 5 : -161);
            const factors = { 'sedentário': 1.2, 'levemente ativo': 1.375, 'moderadamente ativo': 1.55, 'muito ativo': 1.725, 'extremamente ativo': 1.9 };
            const tdee = bmr * (factors[inputs.activityLevel] || 1.2);
            let targetCalories = tdee;
            if (inputs.goal === 'perda de peso') targetCalories -= 500;
            if (inputs.goal.includes('hipertrofia') || inputs.goal.includes('forca')) targetCalories += 300;
            nutriCaloriesSpan.textContent = Math.round(targetCalories);
        }

        alimentacaoHeaderInfo.classList.add('plan-generated');
        nutriSummaryInfo.classList.add('active');
        
        displayDayPlan(0); // Mostra o primeiro dia do plano
        displayGlobalTips(); // Mostra as dicas gerais

        // Esconde o formulário e exibe a área do plano
        nutriFormSection.classList.add('hidden');
        nutriPlanOutput.classList.remove('hidden');
        nutriPlanOutput.classList.add('active');

        // Controla a visibilidade e estado do botão de salvar
        if (isNew) {
            saveNutriBtn.classList.remove('hidden');
            saveNutriBtn.disabled = false;
            saveNutriBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Plano';
        } else {
            // Se o plano foi carregado, não precisa salvar de novo
            saveNutriBtn.classList.add('hidden');
        }
    }

    function getUserInputs() {
        const genderInput = document.querySelector('input[name="gender"]:checked');
        const selectedGender = genderInput ? (genderInput.value === 'male' ? 'Masculino' : 'Feminino') : '';
        const activityLevelMap = { 'sedentary': 'sedentário', 'light': 'levemente ativo', 'moderate': 'moderadamente ativo', 'active': 'muito ativo', 'very-active': 'extremamente ativo' };
        const dietTypeMap = { 'omnivore': 'onívora', 'vegetarian': 'vegetariana', 'vegan': 'vegana', 'keto': 'cetogênica', 'sem gluten': 'sem glúten', 'low carb': 'low carb', 'outra': 'outra' };

        return {
            weight: parseFloat(document.getElementById('user-weight').value),
            height: parseFloat(document.getElementById('user-height').value),
            age: parseInt(document.getElementById('user-age').value),
            gender: selectedGender,
            activityLevel: activityLevelMap[document.getElementById('activity-level').value] || '',
            goal: document.getElementById('user-goal').value,
            mealsPerDay: parseInt(document.getElementById('meal-count').value),
            dietType: dietTypeMap[document.getElementById('diet-type').value] || '',
            restrictions: document.getElementById('food-restrictions').value.trim()
        };
    }

    function validateCurrentStepInputs(stepIndex) {
        const inputs = getUserInputs();
        let isValid = true;
        if (stepIndex === 0) {
            if (isNaN(inputs.weight) || inputs.weight <= 0) isValid = false, showToast('Por favor, insira um peso válido.', 'error');
            else if (isNaN(inputs.height) || inputs.height <= 0) isValid = false, showToast('Por favor, insira uma altura válida.', 'error');
            else if (isNaN(inputs.age) || inputs.age <= 0) isValid = false, showToast('Por favor, insira uma idade válida.', 'error');
            else if (!inputs.gender) isValid = false, showToast('Por favor, selecione seu gênero.', 'error');
        } else if (stepIndex === 1) {
            if (!inputs.activityLevel) isValid = false, showToast('Selecione seu nível de atividade.', 'error');
            else if (!inputs.goal) isValid = false, showToast('Selecione seu objetivo.', 'error');
            else if (isNaN(inputs.mealsPerDay) || inputs.mealsPerDay <= 0 || inputs.mealsPerDay > 10) isValid = false, showToast('Insira um nº de refeições válido (1-10).', 'error');
        }
        return isValid;
    }

    // --- Lógica Principal e de Renderização ---

    async function generateNutritionPlanWithGemini() {
        const userInputs = getUserInputs();
        loadingText.textContent = "Gerando seu plano alimentar inteligente...";
        formLoadingOverlay.classList.add('visible');
        
                try {
            const token = authService.getToken();
            const response = await fetch('https://api-gym-cyan.vercel.app/generate-nutrition-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify(userInputs),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro no servidor ao gerar plano.');
            }

            const data = await response.json();
            
            // Armazena a resposta completa para poder salvar depois
            fullPlanResponse = {
                userInputs,
                plan: data.plan,
                tips: data.tips,
                signature: data.signature // A assinatura é crucial para o salvamento
            };
            
            // Chama a função de renderização, indicando que é um plano novo
            renderPlan({ userInputs, plan: data.plan, tips: data.tips }, true); 
            showToast('Plano gerado com sucesso! Não se esqueça de salvar.', 'success');

        } catch (error) {
            console.error("Erro na requisição ou processamento:", error);
            showToast(error.message || 'Erro ao gerar plano.', 'error');
            formLoadingOverlay.classList.remove('visible');
            nutriFormSection.classList.remove('hidden');
        }
    }

    function updateSummaryInfoDisplay(inputs, calories) {
        nutriObjectiveSpan.textContent = inputs.goal;
        nutriLevelSpan.textContent = inputs.activityLevel;
        nutriCaloriesSpan.textContent = calories;
        estimatedCaloriesContainer.classList.remove('hidden');
    }

    function calculateBMR(weight, height, age, gender) {
        const base = (10 * weight) + (6.25 * height) - (5 * age);
        return gender === 'Masculino' ? base + 5 : base - 161;
    }

    function calculateTDEE(bmr, activityLevel) {
        const factors = { 'sedentário': 1.2, 'levemente ativo': 1.375, 'moderadamente ativo': 1.55, 'muito ativo': 1.725, 'extremamente ativo': 1.9 };
        return bmr * (factors[activityLevel] || 1.2);
    }

    function displayDayPlan(dayIndex) {
        if (!nutritionPlanData || !nutritionPlanData[dayIndex]) {
            currentDayCard.innerHTML = '<p>Nenhum plano para este dia.</p>';
            currentDayName.textContent = dayNames[dayIndex];
            return;
        }
        
        const dayPlan = nutritionPlanData[dayIndex];

        currentDayName.classList.add('fade-out');
        setTimeout(() => {
            currentDayName.textContent = dayPlan.dayName || dayNames[dayIndex];
            currentDayName.classList.remove('fade-out');
        }, 150);

        let mealListHTML = '<ul class="meal-list">';
        dayPlan.meals?.forEach((meal, mealIndex) => {
            const icon = meal.icon?.startsWith('fas fa-') ? `<i class="${meal.icon}"></i>` : `<span>${meal.icon || '🍴'}</span>`;
            
            const summaryHTML = meal.preparationTip 
                ? `<p class="meal-summary"><i class="fas fa-lightbulb"></i>${meal.preparationTip}</p>` 
                : '';

            mealListHTML += `
                <li class="meal-item" data-meal-index="${mealIndex}" style="cursor: pointer;">
                    <div class="meal-header">${icon}<h5>${meal.mealName}</h5></div>
                    ${summaryHTML}
                </li>`;
        });
        currentDayCard.innerHTML = mealListHTML + '</ul>';
        
        prevDayBtn.disabled = dayIndex === 0;
        nextDayBtn.disabled = dayIndex === (nutritionPlanData.length - 1);
        currentDayIndex = dayIndex;
    }

    async function saveCurrentPlan() {
            if (!fullPlanResponse) {
                showToast('Nenhum plano novo para salvar.', 'error');
                return;
            }

            saveNutriBtn.disabled = true;
            saveNutriBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

            try {
                const response = await api.saveNutritionPlan(fullPlanResponse);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Erro desconhecido ao salvar.');
                }
                
                showToast('Plano salvo com sucesso!', 'success');
                saveNutriBtn.innerHTML = '<i class="fas fa-check"></i> Salvo!';
                // Esconde o botão após o sucesso para evitar cliques repetidos
                setTimeout(() => saveNutriBtn.classList.add('hidden'), 2000);

            } catch (error) {
                showToast(`Erro ao salvar: ${error.message}`, 'error');
                saveNutriBtn.disabled = false;
                saveNutriBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Plano';
            }
        }

    function displayGlobalTips() {
        nutriTipsList.innerHTML = '';
        if (globalTipsData.length > 0) {
            globalTipsData.forEach(tip => {
                nutriTipsList.innerHTML += `<li><i class="fas fa-lightbulb"></i> ${tip}</li>`;
            });
            nutriTipsSection.classList.remove('hidden');
        } else {
            nutriTipsSection.classList.add('hidden');
        }
    }

    async function loadInitialData() {
        if (!authService.isLoggedIn()) {
            showToast('Faça login para ver ou criar um plano de alimentação.', 'info');
            return;
        }
        
        formLoadingOverlay.classList.add('visible');
        try {
            const response = await api.getNutritionPlan();

            if (response.ok) {
                // Se a resposta for OK (200), significa que um plano foi encontrado
                const savedPlan = await response.json();
                renderPlan(savedPlan, false); // false = não é um plano novo
                showToast('Seu plano salvo foi carregado!', 'success');
            } else if (response.status === 404) {
                // 404 significa que o usuário não tem plano salvo, então mostramos o formulário
                console.log('Nenhum plano salvo encontrado. Exibindo formulário de criação.');
            } else {
                // Outros erros de servidor
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro ao carregar seus dados.');
            }
        } catch (error) {
            showToast(`Erro ao carregar dados: ${error.message}`, 'error');
        } finally {
            formLoadingOverlay.classList.remove('visible');
        }
    }

    // --- Funções do Modal ---
    function openMealModal(mealData) {
        if (!mealData) return;

        modalMealIcon.className = mealData.icon || 'fas fa-utensils';
        modalMealTitle.textContent = mealData.mealName;

        let bodyHTML = '';
        let totalCalories = 0;

        // Acessando os macronutrientes do objeto da refeição
        const macros = mealData.macronutrients || {};
        const protein = macros.protein || '0g';
        const carbs = macros.carbohydrates || '0g';
        const fat = macros.fats || '0g';

        if (mealData.foods && mealData.foods.length > 0) {
            // No novo schema, foods é um array de strings.
            // O cálculo de calorias e macros é por refeição, não por alimento.
            bodyHTML += `
                <div class="food-item">
                    <div class="food-name">${mealData.foods.join(', ')}</div>
                    <div class="food-macros">
                        <span class="protein">P: ${protein}</span>
                        <span class="carbs">C: ${carbs}</span>
                        <span class="fat">G: ${fat}</span>
                    </div>
                </div>
            `;
        } else {
            bodyHTML = '<p>Nenhum detalhe nutricional para esta refeição.</p>';
        }
        modalMealBody.innerHTML = bodyHTML;

        // O total de calorias não vem mais por alimento, então não podemos somar.
        // Se a IA fornecer um campo `totalCalories` por refeição, poderíamos usá-lo aqui.
        modalMealSummary.innerHTML = ''; // Limpa o resumo por enquanto

        mealDetailsModal.classList.remove('hidden');
    }


    function closeMealModal() {
        mealDetailsModal.classList.add('hidden');
    }

    // --- Event Listeners ---
    nextStep1Btn?.addEventListener('click', () => validateCurrentStepInputs(0) && animateToNextStep());
    prevStep2Btn?.addEventListener('click', animateToPrevStep);
    nextStep2Btn?.addEventListener('click', () => validateCurrentStepInputs(1) && animateToNextStep());
    prevStep3Btn?.addEventListener('click', animateToPrevStep);
    submitNutritionFormBtn?.addEventListener('click', e => { e.preventDefault(); if (validateCurrentStepInputs(2)) generateNutritionPlanWithGemini(); });
    prevDayBtn?.addEventListener('click', () => currentDayIndex > 0 && displayDayPlan(currentDayIndex - 1));
    nextDayBtn?.addEventListener('click', () => currentDayIndex < nutritionPlanData.length - 1 && displayDayPlan(currentDayIndex + 1));

     nutritionDetailsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        generateNutritionPlanWithGemini();
    });

    saveNutriBtn.addEventListener('click', saveCurrentPlan); // <<< NOVO
    
    regenerateNutriBtn.addEventListener('click', () => {
        // Mostra o formulário novamente
        nutriPlanOutput.classList.add('hidden');
        nutriPlanOutput.classList.remove('active');
        nutriFormSection.classList.remove('hidden');
        alimentacaoHeaderInfo.classList.remove('plan-generated');
        
        // Reseta o formulário e as variáveis de estado
        showStep(0);
        nutritionDetailsForm.reset();
        fullPlanResponse = null; // <<< ADICIONADO: Limpa a resposta anterior
    });

    currentDayCard.addEventListener('click', (event) => {
        const mealItem = event.target.closest('.meal-item');
        if (mealItem) {
            const mealIndex = parseInt(mealItem.dataset.mealIndex, 10);
            const mealData = nutritionPlanData[currentDayIndex]?.meals[mealIndex];
            if (mealData) {
                openMealModal(mealData);
            }
        }
    });

    modalCloseButton.addEventListener('click', closeMealModal);
    mealDetailsModal.addEventListener('click', (event) => {
        if (event.target === mealDetailsModal) {
            closeMealModal();
        }
    });

    // --- Inicialização ---
    showStep(0);
    loadInitialData(); // <<< CHAMADA INICIAL PARA VERIFICAR PLANO SALVO
});