// assets/js/alimentacao.js

import { authService } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Referências aos Elementos do DOM ---
    const alimentacaoHeaderInfo = document.querySelector('.alimentacao-header-info');
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
    let nutritionPlanData = [];
    let globalTipsData = [];
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
                throw new Error(errorData.error || 'Erro ao gerar o plano no servidor.');
            }

            const data = await response.json();
            
            if (data.plan && Array.isArray(data.plan) && data.plan.length > 0) {
                nutritionPlanData = data.plan; 
                globalTipsData = data.tips || [];

                localStorage.setItem('gymrats_objetivo', userInputs.goal);
                localStorage.setItem('gymrats_nivel', userInputs.activityLevel);
                
                const bmr = calculateBMR(userInputs.weight, userInputs.height, userInputs.age, userInputs.gender);
                const tdee = calculateTDEE(bmr, userInputs.activityLevel);
                let adjustedCalories = userInputs.goal === 'perda de peso' ? tdee - 500 : (userInputs.goal.includes('hipertrofia') || userInputs.goal.includes('forca') ? tdee + 300 : tdee);
                localStorage.setItem('gymrats_calorias', Math.round(adjustedCalories).toString());

                updateSummaryInfoDisplay(userInputs, Math.round(adjustedCalories));
                
                formLoadingOverlay.classList.remove('visible');
                nutriFormSection.classList.add('hidden');
                alimentacaoHeaderInfo.classList.add('plan-generated');
                nutriSummaryInfo.classList.add('active'); 
                displayDayPlan(0);
                displayGlobalTips();
                nutriPlanOutput.classList.remove('hidden');
                nutriPlanOutput.classList.add('active');
                showToast('Plano alimentar gerado com sucesso!', 'success');
            } else {
                throw new Error("A IA não retornou um plano válido.");
            }
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
    
    regenerateNutriBtn?.addEventListener('click', () => {
        showStep(0);
        nutriFormSection.classList.remove('hidden');
        nutriPlanOutput.classList.add('hidden');
        alimentacaoHeaderInfo.classList.remove('plan-generated');
        nutriSummaryInfo.classList.remove('active');
        nutriTipsSection.classList.add('hidden');
        showToast('Formulário resetado.', 'info');
        nutritionDetailsForm.reset();
        ['gymrats_objetivo', 'gymrats_nivel', 'gymrats_calorias'].forEach(item => localStorage.removeItem(item));
        nutritionPlanData = [];
        globalTipsData = [];
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
});