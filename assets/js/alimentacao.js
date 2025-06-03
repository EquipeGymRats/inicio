// assets/js/alimentacao.js

document.addEventListener('DOMContentLoaded', () => {
    const nutriSummaryInfo = document.getElementById('nutri-summary-info');
    // CORRIGIDO: IDs dos spans para coincidir com o HTML
    const nutriObjectiveSpan = document.getElementById('nutri-objective');
    const nutriLevelSpan = document.getElementById('nutri-level');
    const nutriFrequencySpan = document.getElementById('nutri-frequency');
    const nutriCaloriesSpan = document.getElementById('nutri-calories');
    const estimatedCaloriesContainer = document.querySelector('.estimated-calories');

    const nutriFormSection = document.getElementById('nutri-form-section');
    const nutritionDetailsForm = document.getElementById('nutrition-details-form');
    const formSteps = document.querySelectorAll('.form-step');
    const formStepTitle = document.getElementById('form-step-title');
    let currentStep = 1;

    const nutriPlanOutput = document.getElementById('nutri-plan-output');
    const currentDayName = document.getElementById('current-day-name');
    const currentDayCard = document.getElementById('current-day-card');
    const prevDayBtn = document.getElementById('prev-day');
    const nextDayBtn = document.getElementById('next-day');

    const regenerateNutriBtn = document.getElementById('regenerate-nutri-btn');
    const exportNutriBtn = document.getElementById('export-nutri-btn');
    const notificationToast = document.getElementById('notification-toast');
    const pdfLoadingSpinner = document.getElementById('pdf-loading-spinner'); // Certifique-se que este elemento existe no HTML

    let trainingData = null; // Variável global para armazenar os dados do treino
    let nutritionPlan = [];
    let currentDayIndex = 0;

    // 1. Funções de Utilitário
    function formatText(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).replace(/-/g, ' ');
    }

    function displayMessage(message, type = 'info') {
        notificationToast.textContent = message;
        notificationToast.className = `notification-toast show ${type}`;
        setTimeout(() => {
            notificationToast.classList.remove('show');
            notificationToast.className = 'notification-toast';
        }, 3000);
    }

    // 2. Lógica do Formulário Multi-Step
    function showStep(stepNum) {
        formSteps.forEach((step) => { // Removed index as it wasn't used
            const stepElement = step;
            if (parseInt(stepElement.dataset.step) === stepNum) {
                stepElement.classList.add('active');
                stepElement.classList.remove('leaving-left', 'entering-right');
                setTimeout(() => stepElement.classList.add('animate-in'), 10);
            } else {
                stepElement.classList.remove('active', 'animate-in');
            }
        });
        formStepTitle.textContent = `${stepNum} de ${formSteps.length}`;
        currentStep = stepNum;
    }

    function goToNextStep() {
        const currentActiveStep = document.querySelector(`.form-step[data-step="${currentStep}"]`);
        const inputs = currentActiveStep.querySelectorAll('input[required], select[required]');
        let allValid = true;
        inputs.forEach(input => {
            if (!input.checkValidity()) {
                allValid = false;
                input.reportValidity();
            }
        });

        if (allValid) {
            currentActiveStep.classList.remove('active', 'animate-in');
            currentActiveStep.classList.add('leaving-left');
            currentStep++;
            showStep(currentStep);
        } else {
            displayMessage('Por favor, preencha todos os campos obrigatórios.', 'error');
        }
    }

    function goToPrevStep() {
        const currentActiveStep = document.querySelector(`.form-step[data-step="${currentStep}"]`);
        currentActiveStep.classList.remove('active', 'animate-in');
        currentActiveStep.classList.add('entering-right');
        currentStep--;
        showStep(currentStep);
    }

    document.getElementById('next-step-1').addEventListener('click', goToNextStep);
    document.getElementById('prev-step-2').addEventListener('click', goToPrevStep);
    document.getElementById('next-step-2').addEventListener('click', goToNextStep);
    document.getElementById('prev-step-3').addEventListener('click', goToPrevStep);

    // 3. Carregar dados do localStorage e iniciar
    function loadInitialData() {
        const savedTrainings = localStorage.getItem('gymRatsTrainings');
        if (savedTrainings) {
            const trainings = JSON.parse(savedTrainings);
            if (trainings.length > 0) {
                trainingData = trainings[trainings.length - 1]; // Pegar o último treino salvo
                nutriObjectiveSpan.textContent = formatText(trainingData.objective);
                nutriLevelSpan.textContent = formatText(trainingData.level);
                nutriFrequencySpan.textContent = `${trainingData.frequency} dias/semana`;
                nutriSummaryInfo.classList.remove('hidden'); // Mostra o resumo se houver treino
            } else {
                displayMessage('Nenhum treino encontrado. Gere um treino para um plano alimentar mais preciso!', 'info');
                nutriSummaryInfo.classList.add('hidden'); // Oculta o resumo se não houver treino
            }
        } else {
            displayMessage('Nenhum treino encontrado. Gere um treino para um plano alimentar mais preciso!', 'info');
            nutriSummaryInfo.classList.add('hidden'); // Oculta o resumo se não houver treinos salvos
        }

        const savedNutritionDetails = localStorage.getItem('gymRatsNutritionDetails');
        if (savedNutritionDetails) {
            const details = JSON.parse(savedNutritionDetails);
            document.getElementById('user-weight').value = details.weight || '';
            document.getElementById('user-height').value = details.height || '';
            document.getElementById('user-age').value = details.age || '';
            if (details.gender) {
                document.querySelector(`input[name="gender"][value="${details.gender}"]`).checked = true;
            }
            document.getElementById('activity-level').value = details.activityLevel || '';
            document.getElementById('meal-count').value = details.mealCount || '';
            document.getElementById('diet-type').value = details.dietType || 'omnivore';
            document.getElementById('food-restrictions').value = details.foodRestrictions || '';

            const allRequiredFilled = Array.from(nutritionDetailsForm.querySelectorAll('input[required], select[required]')).every(input => input.value !== '');
            if (allRequiredFilled) {
                generateNutritionPlan(details);
                nutriFormSection.classList.add('hidden');
                nutriPlanOutput.classList.remove('hidden');
            } else {
                nutriFormSection.classList.remove('hidden');
                nutriPlanOutput.classList.add('hidden');
                showStep(1);
            }
        } else {
            nutriFormSection.classList.remove('hidden');
            nutriPlanOutput.classList.add('hidden');
            showStep(1);
        }
    }

    // 4. Calcular TMB e GET (Mantido como está)
    function calculateTDEE(weight, height, age, gender, activityLevel) {
        let tmb;
        if (gender === 'male') {
            tmb = (10 * weight) + (6.25 * height) - (5 * age) + 5;
        } else {
            tmb = (10 * weight) + (6.25 * height) - (5 * age) - 161;
        }

        const activityFactors = {
            'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55,
            'active': 1.725, 'very-active': 1.9
        };
        return tmb * (activityFactors[activityLevel] || 1.2);
    }

    // 5. Estrutura de Refeições e Alimentos (Mantida como está)
    const foodItems = {
        protein: [
            { name: 'Peito de frango grelhado', icon: '🍗' }, { name: 'Filé de peixe branco', icon: '🐟' },
            { name: 'Ovos cozidos', icon: '🥚' }, { name: 'Carne magra (patinho)', icon: '🥩' },
            { name: 'Tofu ou tempeh', icon: '🥣' }, { name: 'Iogurte grego natural', icon: '🥛' },
            { name: 'Whey protein', icon: '🥤' }, { name: 'Queijo Cottage', icon: '🧀' }
        ],
        carb: [
            { name: 'Arroz integral', icon: '🍚' }, { name: 'Batata doce cozida', icon: '🍠' },
            { name: 'Pão integral', icon: '🍞' }, { name: 'Aveia em flocos', icon: '🥣' },
            { name: 'Macarrão integral', icon: '🍝' }, { name: 'Quinoa', icon: '🌾' },
            { name: 'Banana', icon: '🍌' }, { name: 'Maçã', icon: '🍎' }
        ],
        fat: [
            { name: 'Abacate', icon: '🥑' }, { name: 'Nozes e amêndoas', icon: '🌰' },
            { name: 'Azeite de oliva extra virgem', icon: '🍾' }, { name: 'Sementes de chia/linhaça', icon: '🌱' },
            { name: 'Pasta de amendoim', icon: '🥜' }
        ],
        vegetable: [
            { name: 'Brócolis e couve-flor', icon: '🥦' }, { name: 'Espinafre e folhas verdes', icon: '🥬' },
            { name: 'Salada mista', icon: '🥗' }, { name: 'Cenoura e beterraba', icon: '🥕' },
            { name: 'Tomate e pepino', icon: '🍅' }
        ]
    };

    const mealTemplates = (objective, mealsPerDay) => {
        const baseTemplates = {
            '3': {
                'Café da Manhã': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`, `${getRandomFood(foodItems.fat)}`],
                'Almoço': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`, `${getRandomFood(foodItems.vegetable)}`, `${getRandomFood(foodItems.fat)}`],
                'Jantar': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`, `${getRandomFood(foodItems.vegetable)}`]
            },
            '4': {
                'Café da Manhã': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`, `${getRandomFood(foodItems.fat)}`],
                'Lanche da Manhã': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`],
                'Almoço': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`, `${getRandomFood(foodItems.vegetable)}`, `${getRandomFood(foodItems.fat)}`],
                'Jantar': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`, `${getRandomFood(foodItems.vegetable)}`]
            },
            '5': {
                'Café da Manhã': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`, `${getRandomFood(foodItems.fat)}`],
                'Lanche da Manhã': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`],
                'Almoço': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`, `${getRandomFood(foodItems.vegetable)}`, `${getRandomFood(foodItems.fat)}`],
                'Lanche da Tarde': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.fat)}`],
                'Jantar': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`, `${getRandomFood(foodItems.vegetable)}`]
            },
            '6': {
                'Café da Manhã': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`, `${getRandomFood(foodItems.fat)}`],
                'Lanche da Manhã': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`],
                'Almoço': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`, `${getRandomFood(foodItems.vegetable)}`, `${getRandomFood(foodItems.fat)}`],
                'Lanche da Tarde': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.fat)}`],
                'Jantar': [`${getRandomFood(foodItems.protein)}`, `${getRandomFood(foodItems.carb)}`, `${getRandomFood(foodItems.vegetable)}`],
                'Ceia': [`${getRandomFood(foodItems.protein)}`]
            }
        };

        const currentTemplate = JSON.parse(JSON.stringify(baseTemplates[mealsPerDay.toString()])); // Deep copy

        if (objective === 'hipertrofia' || objective === 'forca') {
            if (currentTemplate['Café da Manhã']) currentTemplate['Café da Manhã'][1] += ' (porção maior)';
            if (currentTemplate['Almoço']) currentTemplate['Almoço'][1] += ' (porção maior)';
            if (currentTemplate['Jantar']) currentTemplate['Jantar'][1] += ' (porção maior)';
            if (currentTemplate['Lanche da Tarde']) currentTemplate['Lanche da Tarde'].push(`${getRandomFood(foodItems.carb)} (ex: fruta grande)`);
            if (currentTemplate['Ceia']) currentTemplate['Ceia'].push('Caseína ou queijo cottage');
        } else if (objective === 'perda-peso') {
            if (currentTemplate['Café da Manhã']) currentTemplate['Café da Manhã'][1] += ' (porção menor)';
            if (currentTemplate['Almoço']) currentTemplate['Almoço'][1] += ' (porção menor)';
            if (currentTemplate['Jantar']) {
                currentTemplate['Jantar'][1] = `${getRandomFood(foodItems.vegetable)} (porção extra)`;
                currentTemplate['Jantar'].push(`${getRandomFood(foodItems.carb)} (porção mínima)`);
            }
            if (currentTemplate['Lanche da Manhã']) currentTemplate['Lanche da Manhã'] = [`${getRandomFood(foodItems.protein)} (ex: ovo cozido)`];
            if (currentTemplate['Lanche da Tarde']) currentTemplate['Lanche da Tarde'] = [`${getRandomFood(foodItems.vegetable)} (ex: palitos de cenoura)`];
            if (currentTemplate['Ceia']) currentTemplate['Ceia'] = [`${getRandomFood(foodItems.protein)} (muito leve)`];
        }

        for (const mealTime in currentTemplate) {
            currentTemplate[mealTime] = currentTemplate[mealTime].map(food => {
                if (food.includes('Peito de frango') || food.includes('Peixe') || food.includes('Ovos') || food.includes('Carne') || food.includes('Tofu') || food.includes('Iogurte') || food.includes('Whey') || food.includes('Caseína') || food.includes('Queijo Cottage')) {
                    return food + ' (100-150g) <span class="macro-icon macro-p">P</span>';
                } else if (food.includes('Arroz') || food.includes('Batata') || food.includes('Pão') || food.includes('Aveia') || food.includes('Macarrão') || food.includes('Quinoa') || food.includes('Banana') || food.includes('Maçã')) {
                    return food + ' (100-150g cozido) <span class="macro-icon macro-c">C</span>';
                } else if (food.includes('Abacate') || food.includes('Nozes') || food.includes('Azeite') || food.includes('Sementes') || food.includes('Pasta de amendoim')) {
                    return food + ' (1 col. sopa/20g) <span class="macro-icon macro-g">G</span>';
                } else if (food.includes('Brócolis') || food.includes('Espinafre') || food.includes('Salada') || food.includes('Cenoura') || food.includes('Tomate')) {
                    return food + ' (à vontade) <span class="macro-icon macro-c">C</span>';
                }
                return food;
            });
        }
        return currentTemplate;
    };

    // 6. Gerar o Plano Alimentar Completo
    function generateNutritionPlan(details) {
        if (!trainingData) {
            displayMessage('Plano gerado sem dados de treino. Os ajustes de objetivo podem ser menos precisos.', 'info');
        }

        const objective = trainingData ? trainingData.objective : 'default';
        const { weight, height, age, gender, activityLevel, mealCount, dietType, foodRestrictions } = details;

        let estimatedCalories = calculateTDEE(weight, height, age, gender, activityLevel);

        if (objective === 'perda-peso') {
            estimatedCalories -= 500;
        } else if (objective === 'hipertrofia' || objective === 'forca') {
            estimatedCalories += 300;
        }
        nutriCaloriesSpan.textContent = Math.round(estimatedCalories);
        estimatedCaloriesContainer.classList.remove('hidden');

        // SALVANDO DADOS DO TREINO E NUTRIÇÃO NO LOCALSTORAGE AQUI TAMBÉM
        // PARA GARANTIR QUE ESTEJAM DISPONÍVEIS PARA O PDF
        localStorage.setItem('gymrats_objetivo', objective);
        localStorage.setItem('gymrats_nivel', trainingData ? trainingData.level : 'default');
        localStorage.setItem('gymrats_frequencia', trainingData ? `${trainingData.frequency} dias/semana` : 'Não informada');
        localStorage.setItem('gymrats_calorias', Math.round(estimatedCalories).toString());

        nutritionPlan = [];
        const daysOfWeekNames = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

        daysOfWeekNames.forEach(dayName => {
            const dayMeals = [];
            const dayMealTemplates = mealTemplates(objective, mealCount);

            for (const mealTime in dayMealTemplates) {
                let foods = [...dayMealTemplates[mealTime]];
                let mealIcon = getMealIcon(mealTime);

                foods = foods.map(food => {
                    let newFood = food;
                    if (dietType === 'vegetarian') {
                        if (food.includes('frango') || food.includes('peixe') || food.includes('carne') || food.includes('Whey')) {
                            newFood = getRandomElement(['Tofu', 'Ovo cozido', 'Proteína de soja', 'Grão de bico']);
                        }
                    } else if (dietType === 'vegan') {
                        if (food.includes('frango') || food.includes('peixe') || food.includes('carne') || food.includes('ovo') || food.includes('Iogurte') || food.includes('Whey') || food.includes('Queijo Cottage')) {
                            newFood = getRandomElement(['Tofu', 'Tempeh', 'Lentilha', 'Grão de bico', 'Leite vegetal', 'Iogurte vegano']);
                        }
                    }

                    if (foodRestrictions) {
                        const restrictionsArray = foodRestrictions.toLowerCase().split(',').map(r => r.trim());
                        const originalFoodName = newFood.replace(/<span.*?<\/span>|\(.*\)/g, '').trim().toLowerCase();
                        if (restrictionsArray.some(restriction => originalFoodName.includes(restriction))) {
                            let substitute = 'Alimento substituído (consulte opções)';
                            if (food.includes('macro-p')) substitute = getRandomElement(foodItems.protein).name + ' (opção alternativa)';
                            else if (food.includes('macro-c')) substitute = getRandomElement(foodItems.carb).name + ' (opção alternativa)';
                            else if (food.includes('macro-g')) substitute = getRandomElement(foodItems.fat).name + ' (opção alternativa)';
                            else if (food.includes('vegetable')) substitute = getRandomElement(foodItems.vegetable).name + ' (opção alternativa)';
                            newFood = substitute;
                        }
                    }
                 
                    if (!newFood.includes('<span class="macro-icon')) {
                        if (foodItems.protein.some(item => newFood.includes(item.name))) newFood += ' <span class="macro-icon macro-p">P</span>';
                        else if (foodItems.carb.some(item => newFood.includes(item.name))) newFood += ' <span class="macro-icon macro-c">C</span>';
                        else if (foodItems.fat.some(item => newFood.includes(item.name))) newFood += ' <span class="macro-icon macro-g">G</span>';
                        else if (foodItems.vegetable.some(item => newFood.includes(item.name))) newFood += ' <span class="macro-icon macro-c">C</span>';
                    }
                    return newFood;
                });
                
                if (foods.filter(f => f.includes('<span class="macro-icon')).length === 0 && foods.length > 0) {
                    foods.push('Verifique suas restrições. Opção genérica: Proteína, Carboidrato, Gordura.');
                }
                
                dayMeals.push({
                    time: mealTime,
                    icon: mealIcon,
                    foods: foods
                });
            }
            nutritionPlan.push({ day: dayName, meals: dayMeals, tip: getRandomTip() });
        });

        displayDay(currentDayIndex);
        displayMessage('Plano alimentar gerado com sucesso!', 'success');
        nutriFormSection.classList.add('hidden');
        nutriPlanOutput.classList.remove('hidden');
    }

    // Funções auxiliares (getRandomFood, getRandomElement, getMealIcon, getRandomTip) - Mantidas
    function getRandomFood(foodArray) {
        const randomIndex = Math.floor(Math.random() * foodArray.length);
        return foodArray[randomIndex].name;
    }

    function getRandomElement(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function getMealIcon(mealTime) {
        switch(mealTime) {
            case 'Café da Manhã': return '<i class="fas fa-coffee"></i>';
            case 'Lanche da Manhã': return '<i class="fas fa-apple-alt"></i>';
            case 'Almoço': return '<i class="fas fa-utensils"></i>';
            case 'Lanche da Tarde': return '<i class="fas fa-cookie-bite"></i>';
            case 'Jantar': return '<i class="fas fa-concierge-bell"></i>';
            case 'Ceia': return '<i class="fas fa-moon"></i>';
            default: return '<i class="fas fa-egg"></i>';
        }
    }

    const nutritionTips = [
        "Priorize proteínas em todas as refeições para saciedade e recuperação muscular.",
        "Beba bastante água ao longo do dia, é essencial para o metabolismo e hidratação.",
        "Consuma carboidratos complexos (integrais) para energia sustentada, especialmente em dias de treino.",
        "Inclua gorduras saudáveis (abacate, azeite, nozes) para saúde hormonal e absorção de vitaminas.",
        "Não se esqueça das fibras! Vegetais e frutas ajudam na digestão e saciedade.",
        "Planejamento é chave: prepare suas refeições com antecedência para evitar escolhas ruins.",
        "Ouça seu corpo! Ajuste as porções de acordo com sua fome e níveis de energia.",
        "A consistência é mais importante que a perfeição. Pequenos passos levam a grandes resultados.",
        "Para hipertrofia, consuma proteína e carboidratos no pós-treino para otimizar a recuperação.",
        "Na perda de peso, foque em vegetais e proteínas para aumentar a saciedade com menos calorias."
    ];
    function getRandomTip() {
        const randomIndex = Math.floor(Math.random() * nutritionTips.length);
        return nutritionTips[randomIndex];
    }

    // 7. Lógica do Calendário Interativo (Mantida)
    function displayDay(index) {
        if (nutritionPlan.length === 0) return;
        const dayPlan = nutritionPlan[index];

        currentDayName.textContent = dayPlan.day;
        currentDayCard.innerHTML = '';

        const mealList = document.createElement('ul');
        mealList.classList.add('meal-list');

        dayPlan.meals.forEach(meal => {
            const mealItem = document.createElement('li');
            mealItem.classList.add('meal-item');
            mealItem.innerHTML = `
                <div class="meal-header">
                    ${meal.icon}
                    <h5>${meal.time}</h5>
                </div>
                <p class="meal-foods">${meal.foods.join('<br>')}</p>
            `;
            mealList.appendChild(mealItem);
        });

        const tipCard = document.createElement('div');
        tipCard.classList.add('tip-card');
        tipCard.innerHTML = `<p><strong>Dica Gym Rats:</strong> ${dayPlan.tip}</p>`;

        currentDayCard.appendChild(mealList);
        currentDayCard.appendChild(tipCard);

        prevDayBtn.disabled = index === 0;
        nextDayBtn.disabled = index === nutritionPlan.length - 1;
    }

    prevDayBtn.addEventListener('click', () => {
        if (currentDayIndex > 0) {
            currentDayIndex--;
            displayDay(currentDayIndex);
        }
    });

    nextDayBtn.addEventListener('click', () => {
        if (currentDayIndex < nutritionPlan.length - 1) {
            currentDayIndex++;
            displayDay(currentDayIndex);
        }
    });

    // 8. Event Listeners do Formulário e Ações (Mantido, mas adicionamos salvamento no generateNutritionPlan)
    nutritionDetailsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const details = {
            weight: parseFloat(document.getElementById('user-weight').value),
            height: parseFloat(document.getElementById('user-height').value),
            age: parseInt(document.getElementById('user-age').value),
            gender: document.querySelector('input[name="gender"]:checked')?.value,
            activityLevel: document.getElementById('activity-level').value,
            mealCount: document.getElementById('meal-count').value,
            dietType: document.getElementById('diet-type').value,
            foodRestrictions: document.getElementById('food-restrictions').value.trim()
        };

        if (!details.weight || !details.height || !details.age || !details.gender || !details.activityLevel || !details.mealCount) {
             displayMessage('Por favor, preencha todos os campos obrigatórios do formulário.', 'error');
             return;
        }

        localStorage.setItem('gymRatsNutritionDetails', JSON.stringify(details));

        generateNutritionPlan(details);
        nutriFormSection.classList.add('hidden');
        nutriPlanOutput.classList.remove('hidden');
        currentDayIndex = 0;
        displayDay(currentDayIndex);
    });

    regenerateNutriBtn.addEventListener('click', () => {
        const savedNutritionDetails = localStorage.getItem('gymRatsNutritionDetails');
        if (savedNutritionDetails) {
            const details = JSON.parse(savedNutritionDetails);
            generateNutritionPlan(details);
            currentDayIndex = 0;
            displayDay(currentDayIndex);
        } else {
            displayMessage('Por favor, preencha o formulário para gerar o plano.', 'info');
            nutriFormSection.classList.remove('hidden');
            nutriPlanOutput.classList.add('hidden');
            showStep(1);
        }
    });

    // 9. Exportar para PDF (Ajustado)
    exportNutriBtn.addEventListener('click', async () => {
        displayMessage('Preparando o plano alimentar para exportação...', 'info');
        
        if (pdfLoadingSpinner) pdfLoadingSpinner.classList.remove('hidden');
        exportNutriBtn.disabled = true; // Desabilita o botão

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let currentY = 20;

        const primaryTextColor = [240, 240, 240];
        const secondaryTextColor = [176, 176, 176];
        const highlightYellow = [255, 215, 0];
        const darkBgColor = [8, 8, 8];
        const cardBgColor = [18, 18, 18];

        const colorProtein = [0, 191, 255];
        const colorCarb = [255, 165, 0];
        const colorFat = [50, 205, 50];

        const defaultFont = 'Helvetica';

        const addPageBackgroundAndFooter = () => {
            doc.setFillColor(darkBgColor[0], darkBgColor[1], darkBgColor[2]);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');

            doc.setFont(defaultFont, 'normal');
            doc.setFontSize(8);
            doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
            const footerText = 'Projeto Gym Rats | Site: https://equipegymrats.github.io/inicio/';
            doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
        };

        addPageBackgroundAndFooter();

        doc.setFont(defaultFont, 'bold');
        doc.setFontSize(28);
        doc.setTextColor(highlightYellow[0], highlightYellow[1], highlightYellow[2]);
        doc.text('SEU PLANO ALIMENTAR SEMANAL', pageWidth / 2, currentY, { align: 'center' });
        currentY += 12;

        doc.setFont(defaultFont, 'normal');
        doc.setFontSize(14);
        doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);
        doc.text('Otimize seus resultados com uma nutrição personalizada para sua jornada fitness!', pageWidth / 2, currentY, { align: 'center' });
        currentY += 15;

        // CAPTURA DE DADOS DO USUÁRIO - PRIORIZANDO LOCALSTORAGE
        doc.setFontSize(12);
        doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);

        // Tenta pegar do localStorage primeiro
        // O treinoData está global e deveria ser atualizado em generateNutritionPlan
        // mas vamos buscar do localStorage novamente para garantir consistência
        const storedObjective = localStorage.getItem('gymrats_objetivo') || 'Não informado';
        const storedNivel = localStorage.getItem('gymrats_nivel') || 'Não informado';
        const storedFrequencia = localStorage.getItem('gymrats_frequencia') || 'Não informada';
        const storedCalorias = localStorage.getItem('gymrats_calorias') || 'Não estimado';


        console.log("Valores para PDF (do localStorage): Objetivo:", storedObjective, "| Nível:", storedNivel, "| Frequência:", storedFrequencia, "| Calorias:", storedCalorias);

        doc.text(`Objetivo: ${storedObjective} | Nível: ${storedNivel} | Frequência: ${storedFrequencia}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 7;

        if (storedCalorias !== 'Não estimado' && storedCalorias !== '') {
            doc.text(`Calorias diárias estimadas: ${storedCalorias} kcal`, pageWidth / 2, currentY, { align: 'center' });
        }
        currentY += 15;

        // Adicionar Legenda dos Macronutrientes
        doc.setFont(defaultFont, 'bold');
        doc.setFontSize(12);
        doc.setTextColor(highlightYellow[0], highlightYellow[1], highlightYellow[2]);
        doc.text('Legenda de Macronutrientes:', margin, currentY);
        currentY += 8;

        doc.setFont(defaultFont, 'normal');
        doc.setFontSize(10);
        
        const legendItems = [
            { char: 'P', label: 'Proteína', color: colorProtein },
            { char: 'C', label: 'Carboidrato', color: colorCarb },
            { char: 'G', label: 'Gordura', color: colorFat }
        ];

        let legendX = margin;
        legendItems.forEach(item => {
            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.circle(legendX + 2, currentY - 2, 3, 'F');

            doc.setTextColor(0, 0, 0); // Preto
            doc.setFontSize(7);
            doc.text(item.char, legendX + 2, currentY - 2 + (7/2 * 0.35), { align: 'center', baseline: 'middle' });
            
            doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);
            doc.setFontSize(10);
            doc.text(`= ${item.label}`, legendX + 7, currentY);
            legendX += 50;
        });
        currentY += 15;

        const cardPromises = [];

        nutritionPlan.forEach((dayPlan) => {
            cardPromises.push(new Promise(async (resolve) => {
                const tempDayCard = document.createElement('div');
                const cardWidthPx = (pageWidth - (2 * margin) - 10) / 2 * (96 / 25.4);

                tempDayCard.style.width = `${cardWidthPx}px`;
                tempDayCard.style.padding = '8px';
                tempDayCard.style.backgroundColor = `rgb(${cardBgColor[0]}, ${cardBgColor[1]}, ${cardBgColor[2]})`;
                tempDayCard.style.borderRadius = '6px';
                tempDayCard.style.border = `1px solid rgb(${secondaryTextColor[0]/2}, ${secondaryTextColor[1]/2}, ${secondaryTextColor[2]/2})`;
                tempDayCard.style.color = `rgb(${primaryTextColor[0]}, ${primaryTextColor[1]}, ${primaryTextColor[2]})`;
                tempDayCard.style.fontFamily = 'Roboto, sans-serif';
                tempDayCard.style.fontSize = '8.5px';
                tempDayCard.style.lineHeight = '1.2';
                tempDayCard.style.boxSizing = 'border-box';
                tempDayCard.style.overflow = 'hidden';
                tempDayCard.style.pageBreakInside = 'avoid';
                tempDayCard.style.flexShrink = '0';

                let cardContent = `<h4 style="font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: bold; color: rgb(${highlightYellow[0]}, ${highlightYellow[1]}, ${highlightYellow[2]}); margin-bottom: 6px; text-align: center;">${dayPlan.day}</h4>`;

                dayPlan.meals.forEach(meal => {
                    cardContent += `<div style="margin-bottom: 4px; display: flex; align-items: flex-start;">`;
                    cardContent += `<span style="font-family: 'Font Awesome 6 Free'; font-weight: 900; font-size: 11px; margin-right: 4px; color: rgb(${highlightYellow[0]}, ${highlightYellow[1]}, ${highlightYellow[2]});">${getFontAwesomeChar(meal.icon)}</span>`;
                    cardContent += `<div style="flex-grow: 1;">`;
                    cardContent += `<strong style="font-size: 9px;">${meal.time}:</strong> `;

                    const foodsWithIcons = meal.foods.map(f => {
                        let cleanedFood = f.replace(/<span.*?<\/span>|\(.*\)/g, '').trim();
                        let macroIconHTML = '';
                        if (f.includes('macro-p')) {
                            macroIconHTML = `<span style="background-color: rgb(${colorProtein.join(',')}); color: black; border-radius: 50%; width: 11px; height: 11px; display: inline-flex; align-items: center; justify-content: center; font-size: 6px; font-weight: bold; margin-left: 2px; vertical-align: middle; line-height: 1;">P</span>`;
                        } else if (f.includes('macro-c')) {
                            macroIconHTML = `<span style="background-color: rgb(${colorCarb.join(',')}); color: black; border-radius: 50%; width: 11px; height: 11px; display: inline-flex; align-items: center; justify-content: center; font-size: 6px; font-weight: bold; margin-left: 2px; vertical-align: middle; line-height: 1;">C</span>`;
                        } else if (f.includes('macro-g')) {
                            macroIconHTML = `<span style="background-color: rgb(${colorFat.join(',')}); color: black; border-radius: 50%; width: 11px; height: 11px; display: inline-flex; align-items: center; justify-content: center; font-size: 6px; font-weight: bold; margin-left: 2px; vertical-align: middle; line-height: 1;">G</span>`;
                        }
                        return `${cleanedFood}${macroIconHTML}`;
                    }).join(', ');

                    cardContent += `<span style="font-size: 8px;">${foodsWithIcons}</span>`;
                    cardContent += `</div></div>`;
                });

                if (dayPlan.tip) {
                    cardContent += `<p style="font-style: italic; color: rgb(${secondaryTextColor[0]}, ${secondaryTextColor[1]}, ${secondaryTextColor[2]}); margin-top: 6px; border-top: 1px solid rgb(${secondaryTextColor[0]/2}, ${secondaryTextColor[1]/2}, ${secondaryTextColor[2]/2}); padding-top: 5px; font-size: 7.5px;">`;
                    cardContent += `<strong>Dica:</strong> ${dayPlan.tip}`;
                    cardContent += `</p>`;
                }

                tempDayCard.innerHTML = cardContent;
                document.body.appendChild(tempDayCard);

                const canvas = await html2canvas(tempDayCard, {
                    scale: 4,
                    backgroundColor: null,
                    logging: false,
                    useCORS: true
                });
                const imgData = canvas.toDataURL('image/png');
                document.body.removeChild(tempDayCard);

                resolve({ imgData, width: canvas.width, height: canvas.height });
            }));
        });

        const renderedCards = await Promise.all(cardPromises);

        const cardMarginX = 8;
        const cardMarginY = 10;
        const cardsPerRow = 2;
        const effectiveCardWidth = (pageWidth - (2 * margin) - ((cardsPerRow - 1) * cardMarginX)) / cardsPerRow;

        let currentRowCards = 0;
        let startX = margin;
        let highestCardInRow = 0;

        renderedCards.forEach((card, index) => {
            const aspectRatio = card.width / card.height;
            const imgHeight = effectiveCardWidth / aspectRatio;

            if (currentRowCards === cardsPerRow) {
                currentY += highestCardInRow + cardMarginY;
                startX = margin;
                currentRowCards = 0;
                highestCardInRow = 0;
            }

            if (currentY + imgHeight > pageHeight - margin - 25) { 
                doc.addPage();
                addPageBackgroundAndFooter();
                currentY = margin;
                startX = margin;
                currentRowCards = 0;
                highestCardInRow = 0;
            }

            doc.addImage(card.imgData, 'PNG', startX, currentY, effectiveCardWidth, imgHeight);
            
            startX += effectiveCardWidth + cardMarginX;
            currentRowCards++;
            highestCardInRow = Math.max(highestCardInRow, imgHeight);

            if (currentRowCards === cardsPerRow || index === renderedCards.length - 1) {
                 currentY += highestCardInRow + cardMarginY;
                 startX = margin;
                 currentRowCards = 0;
                 highestCardInRow = 0;
            }
        });

        doc.save('Plano-Alimentar-GYMRats.pdf');
        displayMessage('PDF gerado com sucesso!', 'success');
        
        if (pdfLoadingSpinner) pdfLoadingSpinner.classList.add('hidden');
        exportNutriBtn.disabled = false;
    });

    // Helper para obter o caractere Unicode de ícones Font Awesome
    function getFontAwesomeChar(iconClass) {
        const iconMap = {
            'fa-coffee': '\uf0f4',
            'fa-apple-alt': '\uf5d1',
            'fa-utensils': '\uf2e7',
            'fa-cookie-bite': '\uf564',
            'fa-concierge-bell': '\uf562',
            'fa-moon': '\uf186',
            'fa-dumbbell': '\uf630',
            'fa-tint': '\uf043',
            'fa-sun': '\uf185',
            'fa-carrot': '\uf787',
            'fa-pizza-slice': '\uf818',
            'fa-fish': '\uf578',
            'fa-drumstick-bite': '\uf6d7'
        };
        const match = iconClass.match(/fa-(.*?)(?:\s|$)/);
        const iconName = match ? match[1] : '';

        return iconMap['fa-' + iconName] || '\uf005';
    }

    // Inicializa carregando os dados e configura a UI
    loadInitialData();
});