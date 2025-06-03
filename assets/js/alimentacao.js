document.addEventListener('DOMContentLoaded', () => {
    // --- Referências aos Elementos do DOM ---
    const nutriSummaryInfo = document.getElementById('nutri-summary-info');
    const nutriObjectiveSpan = document.getElementById('nutri-objective');
    const nutriLevelSpan = document.getElementById('nutri-level');
    const nutriFrequencySpan = document.getElementById('nutri-frequency');
    const nutriCaloriesSpan = document.getElementById('nutri-calories');
    const estimatedCaloriesContainer = document.querySelector('.estimated-calories');

    const nutriFormSection = document.getElementById('nutri-form-section');
    const nutritionDetailsForm = document.getElementById('nutrition-details-form');
    const formSteps = document.querySelectorAll('.form-step');
    const formStepTitle = document.getElementById('form-step-title');
    
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
    const pdfLoadingSpinner = document.getElementById('pdf-loading-spinner');
    
    const notificationToast = document.getElementById('notification-toast');

    // NOVO: Referência para a seção de dicas
    const nutriTipsSection = document.getElementById('nutri-tips-section');
    const nutriTipsList = document.getElementById('nutri-tips-list');


    let currentStep = 0;
    let nutritionPlanData = []; // Armazenará o plano semanal completo da Gemini API
    let globalTipsData = []; // NOVO: Armazenará as dicas globais da Gemini API
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

    function showStep(stepIndex) {
        formSteps.forEach((step, index) => {
            if (index === stepIndex) {
                step.classList.add('active');
                step.classList.remove('entering-right', 'leaving-left');
                setTimeout(() => step.classList.add('animate-in'), 50); 
            } else {
                step.classList.remove('active', 'animate-in');
            }
        });
        currentStep = stepIndex;
        formStepTitle.textContent = `${stepIndex + 1} de ${formSteps.length}`;
    }

    function animateToNextStep() {
        formSteps[currentStep].classList.remove('active', 'animate-in');
        formSteps[currentStep].classList.add('leaving-left');
        currentStep++;
        setTimeout(() => {
            showStep(currentStep);
        }, 300);
    }

    function animateToPrevStep() {
        formSteps[currentStep].classList.remove('active', 'animate-in');
        formSteps[currentStep].classList.add('entering-right');
        currentStep--;
        setTimeout(() => {
            showStep(currentStep);
        }, 300);
    }

    // --- Funções de Coleta e Validação de Dados ---

    function getUserInputs() {
        const genderInput = document.querySelector('input[name="gender"]:checked');
        const selectedGender = genderInput ? (genderInput.value === 'male' ? 'Masculino' : 'Feminino') : '';

        const activityLevelMap = {
            'sedentary': 'sedentário',
            'light': 'levemente ativo',
            'moderate': 'moderadamente ativo',
            'active': 'muito ativo',
            'very-active': 'extremamente ativo'
        };

        const dietTypeMap = {
            'omnivore': 'onívora',
            'vegetarian': 'vegetariana',
            'vegan': 'vegana',
            'keto': 'cetogênica',
            'sem gluten': 'sem glúten',
            'low carb': 'low carb',
            'outra': 'outra'
        };

        return {
            weight: parseFloat(document.getElementById('user-weight').value),
            height: parseFloat(document.getElementById('user-height').value),
            age: parseInt(document.getElementById('user-age').value),
            gender: selectedGender,
            activityLevel: activityLevelMap[document.getElementById('activity-level').value] || document.getElementById('activity-level').value,
            goal: document.getElementById('user-goal').value,
            mealsPerDay: parseInt(document.getElementById('meal-count').value),
            dietType: dietTypeMap[document.getElementById('diet-type').value] || document.getElementById('diet-type').value,
            restrictions: document.getElementById('food-restrictions').value.trim()
        };
    }

    function validateCurrentStepInputs(stepIndex) {
        const inputs = getUserInputs();
        let isValid = true;

        if (stepIndex === 0) {
            if (isNaN(inputs.weight) || inputs.weight <= 0) {
                showToast('Por favor, insira um peso válido e maior que zero.', 'error');
                isValid = false;
            } else if (isNaN(inputs.height) || inputs.height <= 0) {
                showToast('Por favor, insira uma altura válida e maior que zero.', 'error');
                isValid = false;
            } else if (isNaN(inputs.age) || inputs.age <= 0) {
                showToast('Por favor, insira uma idade válida e maior que zero.', 'error');
                isValid = false;
            } else if (!inputs.gender) {
                showToast('Por favor, selecione seu gênero.', 'error');
                isValid = false;
            }
        } else if (stepIndex === 1) {
            if (!inputs.activityLevel || inputs.activityLevel === '') {
                showToast('Por favor, selecione seu nível de atividade.', 'error');
                isValid = false;
            } else if (!inputs.goal || inputs.goal === '') {
                 showToast('Por favor, selecione seu objetivo fitness.', 'error');
                 isValid = false;
            } else if (isNaN(inputs.mealsPerDay) || inputs.mealsPerDay <= 0 || inputs.mealsPerDay > 10) {
                showToast('Por favor, insira um número válido de refeições (entre 1 e 10).', 'error');
                isValid = false;
            }
        }
        return isValid;
    }

    // --- Integração com Gemini API ---

    async function generateNutritionPlanWithGemini() {
        const userInputs = getUserInputs();

        nutriFormSection.classList.add('hidden');
        nutriPlanOutput.classList.add('hidden');
        if (pdfLoadingSpinner) pdfLoadingSpinner.classList.remove('hidden');
        
        currentDayCard.innerHTML = '<div style="text-align: center; padding: 50px;"><i class="fas fa-spinner fa-spin" style="font-size: 3em; color: var(--gymrats-highlight-yellow);"></i><p style="margin-top: 20px;">Gerando seu plano alimentar inteligente...</p></div>';
        currentDayName.textContent = "Carregando...";
        nutriPlanOutput.classList.remove('hidden');

        try {
            const response = await fetch('http://localhost:3000/generate-nutrition-plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userInputs),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro desconhecido ao gerar plano alimentar no servidor.');
            }

            const data = await response.json();
            
            if (data.plan && Array.isArray(data.plan)) {
                nutritionPlanData = data.plan; 
                globalTipsData = data.tips || []; // NOVO: Armazena as dicas globais
            } else {
                console.error("Resposta da IA não contém 'plan' como um array:", data);
                throw new Error("A IA não gerou um plano em formato esperado.");
            }

            if (nutritionPlanData.length > 0) {
                localStorage.setItem('gymrats_objetivo', userInputs.goal);
                localStorage.setItem('gymrats_nivel', userInputs.activityLevel);
                localStorage.setItem('gymrats_frequencia', "Não especificada");
                
                const bmr = calculateBMR(userInputs.weight, userInputs.height, userInputs.age, userInputs.gender);
                const tdee = calculateTDEE(bmr, userInputs.activityLevel);
                let adjustedCalories = tdee;
                if (userInputs.goal === 'perda de peso') {
                    adjustedCalories = tdee - 500;
                } else if (userInputs.goal === 'hipertrofia muscular' || userInputs.goal === 'ganho de forca') {
                    adjustedCalories = tdee + 300;
                }
                localStorage.setItem('gymrats_calorias', Math.round(adjustedCalories).toString());


                displayDayPlan(0); // Exibe o plano da primeira dia por padrão
                displayGlobalTips(); // NOVO: Exibe as dicas globais
                nutriPlanOutput.classList.remove('hidden');
                nutriSummaryInfo.classList.remove('hidden');
                updateSummaryInfoDisplay(userInputs, Math.round(adjustedCalories));
                showToast('Plano alimentar gerado com sucesso!', 'success');
            } else {
                nutriPlanOutput.innerHTML = '<p style="color: red; text-align: center;">A IA gerou o plano, mas ele veio vazio ou em um formato inesperado. Tente novamente ou ajuste os parâmetros.</p>';
                showToast('Erro: Plano vazio ou inválido da IA.', 'error');
                nutriFormSection.classList.remove('hidden');
            }
            
        } catch (error) {
            console.error("Erro na requisição ao backend ou ao processar a resposta:", error);
            nutriPlanOutput.innerHTML = `<p style="color: red; text-align: center;">Erro ao gerar plano alimentar. Por favor, tente novamente. <br> Detalhes: ${error.message}</p>`;
            showToast('Erro ao gerar plano. Verifique o console para mais detalhes.', 'error');
            nutriFormSection.classList.remove('hidden');
        } finally {
            if (pdfLoadingSpinner) pdfLoadingSpinner.classList.add('hidden');
        }
    }

    function updateSummaryInfoDisplay(inputs, calories) {
        nutriObjectiveSpan.textContent = inputs.goal;
        nutriLevelSpan.textContent = inputs.activityLevel;
        nutriFrequencySpan.textContent = 'Não especificada';
        nutriCaloriesSpan.textContent = calories;
        estimatedCaloriesContainer.classList.remove('hidden');
    }

    function calculateBMR(weight, height, age, gender) {
        if (gender === 'Masculino') {
            return (10 * weight) + (6.25 * height) - (5 * age) + 5;
        } else {
            return (10 * weight) + (6.25 * height) - (5 * age) - 161;
        }
    }

    function calculateTDEE(bmr, activityLevel) {
        let activityFactor = 1.2;
        switch (activityLevel) {
            case 'levemente ativo':
                activityFactor = 1.375;
                break;
            case 'moderadamente ativo':
                activityFactor = 1.55;
                break;
            case 'muito ativo':
                activityFactor = 1.725;
                break;
            case 'extremamente ativo':
                activityFactor = 1.9;
                break;
        }
        return bmr * activityFactor;
    }

    function displayDayPlan(dayIndex) {
        if (!nutritionPlanData || nutritionPlanData.length === 0 || !nutritionPlanData[dayIndex]) {
            currentDayCard.innerHTML = '<p>Nenhum plano disponível para este dia.</p>';
            currentDayName.textContent = dayNames[dayIndex];
            return;
        }

        const dayPlan = nutritionPlanData[dayIndex];
        currentDayName.textContent = dayPlan.dayName || dayNames[dayIndex];
        currentDayCard.innerHTML = '';

        const mealList = document.createElement('ul');
        mealList.classList.add('meal-list');

        if (dayPlan.meals && Array.isArray(dayPlan.meals)) {
            dayPlan.meals.forEach(meal => {
                const mealItem = document.createElement('li');
                mealItem.classList.add('meal-item');

                const mealHeader = document.createElement('div');
                mealHeader.classList.add('meal-header');
                
                // Lógica para adicionar ícone Font Awesome ou emoji
                // A prioridade é usar Font Awesome se a IA enviar a classe correta
                const iconElement = document.createElement('i'); // Começa com <i> para Font Awesome
                if (meal.icon && meal.icon.startsWith('fas fa-')) {
                    iconElement.className = meal.icon;
                } else if (meal.icon) {
                    // Se não for uma classe Font Awesome, tenta renderizar como emoji
                    iconElement.outerHTML = `<span style="font-size: 1.5em; margin-right: 15px; color: var(--gymrats-highlight-yellow);">${meal.icon}</span>`;
                    // Substitui o iconElement <i> por um <span> diretamente no DOM
                    // Não podemos mais usar iconElement.textContent = meal.icon;
                    // pois ele já foi criado como <i>. Precisamos criar um novo elemento ou outerHTML.
                    // Para simplificar, vou recriar o elemento no mealHeader.appendChild
                } else {
                    iconElement.className = 'fas fa-utensils'; // Fallback padrão
                }
                
                // Se o ícone não foi tratado como emoji, adicione o <i> criado
                if (meal.icon && !meal.icon.startsWith('fas fa-')) {
                    // Se foi tratado como emoji via outerHTML, o elemento original <i> não é mais válido,
                    // e o span já foi "injetado".
                    // Precisamos criar um novo span aqui ou garantir que o outerHTML funcione.
                    // A melhor abordagem é ter uma variável que armazena o HTML do ícone.
                    const iconHtml = meal.icon && meal.icon.startsWith('fas fa-') 
                        ? `<i class="${meal.icon}"></i>`
                        : (meal.icon ? `<span style="font-style: normal;">${meal.icon}</span>` : `<i class="fas fa-utensils"></i>`);
                    mealHeader.innerHTML = `${iconHtml}<h5 style="margin-left: 15px;">${meal.mealName}</h5>`; // Injetar HTML para o ícone
                } else {
                    mealHeader.appendChild(iconElement);
                    const mealTitle = document.createElement('h5');
                    mealTitle.textContent = meal.mealName;
                    mealHeader.appendChild(mealTitle);
                }
                
                mealItem.appendChild(mealHeader);

                if (meal.foods && Array.isArray(meal.foods)) {
                    const foodDetails = document.createElement('p');
                    foodDetails.classList.add('meal-foods');
                    foodDetails.innerHTML = meal.foods.join('<br>');
                    mealItem.appendChild(foodDetails);
                } else {
                    const noFoods = document.createElement('p');
                    noFoods.classList.add('meal-foods');
                    noFoods.innerHTML = 'Nenhum alimento detalhado para esta refeição.';
                    noFoods.style.fontStyle = 'italic';
                    mealItem.appendChild(noFoods);
                }

                mealList.appendChild(mealItem);
            });
        } else {
            currentDayCard.innerHTML = '<p>Erro: As refeições para este dia não foram carregadas corretamente ou estão em formato inválido.</p>';
        }

        currentDayCard.appendChild(mealList);

        prevDayBtn.disabled = dayIndex === 0;
        nextDayBtn.disabled = dayIndex === (nutritionPlanData.length - 1);
    }

    // NOVO: Função para exibir as dicas globais
    function displayGlobalTips() {
        nutriTipsList.innerHTML = ''; // Limpa as dicas anteriores
        if (globalTipsData && globalTipsData.length > 0) {
            globalTipsData.forEach(tip => {
                const li = document.createElement('li');
                li.innerHTML = `<i class="fas fa-lightbulb"></i> ${tip}`; // Ícone de lâmpada para dicas
                nutriTipsList.appendChild(li);
            });
            nutriTipsSection.classList.remove('hidden'); // Mostra a seção de dicas
        } else {
            nutriTipsSection.classList.add('hidden'); // Esconde se não houver dicas
        }
    }


    // --- Event Listeners para Navegação do Formulário ---
    if (nextStep1Btn) {
        nextStep1Btn.addEventListener('click', () => {
            if (validateCurrentStepInputs(0)) {
                animateToNextStep();
            }
        });
    }
    if (prevStep2Btn) {
        prevStep2Btn.addEventListener('click', () => {
            animateToPrevStep();
        });
    }
    if (nextStep2Btn) {
        nextStep2Btn.addEventListener('click', () => {
            if (validateCurrentStepInputs(1)) {
                animateToNextStep();
            }
        });
    }
    if (prevStep3Btn) {
        prevStep3Btn.addEventListener('click', () => {
            animateToPrevStep();
        });
    }

    if (nutritionDetailsForm) {
        nutritionDetailsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            await generateNutritionPlanWithGemini();
        });
    }

    // --- Event Listeners para Navegação do Plano Semanal ---
    if (prevDayBtn) {
        prevDayBtn.addEventListener('click', () => {
            if (currentDayIndex > 0) {
                currentDayIndex--;
                displayDayPlan(currentDayIndex);
            }
        });
    }
    if (nextDayBtn) {
        nextDayBtn.addEventListener('click', () => {
            if (currentDayIndex < nutritionPlanData.length - 1) {
                currentDayIndex++;
                displayDayPlan(currentDayIndex);
            }
        });
    }

    // --- Outros Botões de Ação ---
    if (regenerateNutriBtn) {
        regenerateNutriBtn.addEventListener('click', () => {
            showStep(0);
            nutriFormSection.classList.remove('hidden');
            nutriPlanOutput.classList.add('hidden');
            nutriSummaryInfo.classList.add('hidden');
            nutriTipsSection.classList.add('hidden'); // NOVO: Esconde as dicas ao resetar
            showToast('Formulário resetado. Preencha novamente para regerar o plano.', 'info');
            nutritionDetailsForm.reset();
            localStorage.removeItem('gymRatsNutritionDetails');
            localStorage.removeItem('gymrats_objetivo');
            localStorage.removeItem('gymrats_nivel');
            localStorage.removeItem('gymrats_frequencia');
            localStorage.removeItem('gymrats_calorias');
        });
    }

    // --- Exportar para PDF (Ajustado com Ícones) ---
    if (exportNutriBtn) {
        exportNutriBtn.addEventListener('click', async () => {
            showToast('Gerando PDF...', 'info');
            if (pdfLoadingSpinner) pdfLoadingSpinner.classList.remove('hidden');
            if (exportNutriBtn) exportNutriBtn.disabled = true;

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

            const defaultFont = 'Helvetica'; // jsPDF padrão
            const fontAwesomeFont = 'FontAwesome'; // Para ícones (se carregada)

            const addPageBackgroundAndFooter = () => {
                doc.setFillColor(darkBgColor[0], darkBgColor[1], darkBgColor[2]);
                doc.rect(0, 0, pageWidth, pageHeight, 'F');

                doc.setFont(defaultFont, 'normal');
                doc.setFontSize(8);
                doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
                const footerText = 'Projeto Gym Rats | Site: https://equipegymrats.github.io/inicio/';
                doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
            };

            try {
                addPageBackgroundAndFooter();

                const objetivo = localStorage.getItem('gymrats_objetivo') || 'Não informado';
                const nivel = localStorage.getItem('gymrats_nivel') || 'Não informado';
                const frequencia = localStorage.getItem('gymrats_frequencia') || 'Não informada';
                const calorias = localStorage.getItem('gymrats_calorias') || 'Não estimado';

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

                doc.setFontSize(12);
                doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
                doc.text(`Objetivo: ${objetivo} | Nível: ${nivel} | Frequência: ${frequencia}`, pageWidth / 2, currentY, { align: 'center' });
                currentY += 7;

                if (calorias !== 'Não estimado' && calorias !== '') {
                    doc.text(`Calorias diárias estimadas: ${calorias} kcal`, pageWidth / 2, currentY, { align: 'center' });
                }
                currentY += 15;

                // Legenda de Macronutrientes
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

                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(7);
                    doc.text(item.char, legendX + 2, currentY - 2 + (7/2 * 0.35), { align: 'center', baseline: 'middle' });
                    
                    doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);
                    doc.setFontSize(10);
                    doc.text(`= ${item.label}`, legendX + 7, currentY);
                    legendX += 50;
                });
                currentY += 15;


                // Adicionando Dicas Globais ao PDF
                if (globalTipsData && globalTipsData.length > 0) {
                    doc.setFont(defaultFont, 'bold');
                    doc.setFontSize(12);
                    doc.setTextColor(highlightYellow[0], highlightYellow[1], highlightYellow[2]);
                    doc.text('Dicas Importantes:', margin, currentY);
                    currentY += 8;

                    doc.setFont(defaultFont, 'normal');
                    doc.setFontSize(10);
                    doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);
                    globalTipsData.forEach(tip => {
                        const tipText = `• ${tip}`;
                        const splitText = doc.splitTextToSize(tipText, pageWidth - (2 * margin));
                        doc.text(splitText, margin, currentY);
                        currentY += doc.getTextDimensions(splitText).h + 3;
                    });
                    currentY += 10;
                }


                const cardPromises = [];
                if (nutritionPlanData.length === 0) {
                     showToast('Nenhum plano gerado para exportar.', 'error');
                     return; 
                }

                nutritionPlanData.forEach(dayPlan => {
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

                        let cardContent = `<h4 style="font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: bold; color: rgb(${highlightYellow[0]}, ${highlightYellow[1]}, ${highlightYellow[2]}); margin-bottom: 6px; text-align: center;">${dayPlan.dayName}</h4>`;

                        if (dayPlan.meals && Array.isArray(dayPlan.meals)) {
                             dayPlan.meals.forEach(meal => {
                                 cardContent += `<div style="margin-bottom: 4px; display: flex; align-items: flex-start;">`;
                                 
                                 // NOVO: Adiciona ícone Font Awesome ou emoji no HTML temporário para renderização no canvas
                                 if (meal.icon && meal.icon.startsWith('fas fa-')) {
                                    // Para Font Awesome no HTML, usamos a tag <i>
                                     cardContent += `<i class="${meal.icon}" style="font-size: 11px; margin-right: 4px; color: rgb(${highlightYellow[0]}, ${highlightYellow[1]}, ${highlightYellow[2]});"></i>`;
                                 } else if (meal.icon) {
                                    // Para emojis, usamos o próprio emoji dentro de um span
                                     cardContent += `<span style="font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', sans-serif; font-size: 11px; margin-right: 4px; color: rgb(${highlightYellow[0]}, ${highlightYellow[1]}, ${highlightYellow[2]});">${meal.icon}</span>`;
                                 } else {
                                     // Fallback para ícone padrão
                                     cardContent += `<i class="fas fa-utensils" style="font-size: 11px; margin-right: 4px; color: rgb(${highlightYellow[0]}, ${highlightYellow[1]}, ${highlightYellow[2]});"></i>`;
                                 }

                                 cardContent += `<div style="flex-grow: 1;">`;
                                 cardContent += `<strong style="font-size: 9px;">${meal.mealName}:</strong> `;

                                 if (meal.foods && Array.isArray(meal.foods)) {
                                     const foodsText = meal.foods.join(', ');
                                     cardContent += `<span style="font-size: 8px;">${foodsText}</span>`;
                                 }
                                 cardContent += `</div></div>`;
                             });
                        } else {
                            cardContent += `<p style="font-style: italic; font-size: 8px; color: rgb(${secondaryTextColor[0]}, ${secondaryTextColor[1]}, ${secondaryTextColor[2]});">Nenhuma refeição detalhada para este dia.</p>`;
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
                showToast('Plano exportado para PDF!', 'success');

            } catch (error) {
                console.error("Erro ao exportar PDF:", error);
                showToast('Erro ao exportar o plano para PDF.', 'error');
            } finally {
                if (pdfLoadingSpinner) pdfLoadingSpinner.classList.add('hidden');
                if (exportNutriBtn) exportNutriBtn.disabled = false;
            }
        });
    }

    // --- Função para carregar dados do formulário do localStorage ---
    function loadInitialFormData() {
        const savedNutritionDetails = localStorage.getItem('gymRatsNutritionDetails');
        if (savedNutritionDetails) {
            const details = JSON.parse(savedNutritionDetails);
            document.getElementById('user-weight').value = details.weight || '';
            document.getElementById('user-height').value = details.height || '';
            document.getElementById('user-age').value = details.age || '';
            if (details.gender) {
                const genderRadio = document.querySelector(`input[name="gender"][value="${details.gender === 'Masculino' ? 'male' : 'female'}"]`);
                if(genderRadio) genderRadio.checked = true;
            }
            document.getElementById('activity-level').value = details.activityLevel || '';
            document.getElementById('user-goal').value = details.goal || '';
            document.getElementById('meal-count').value = details.mealsPerDay || '';
            document.getElementById('diet-type').value = details.dietType || 'omnivore';
            document.getElementById('food-restrictions').value = details.restrictions || '';
        }
    }

    // --- Inicialização ---
    showStep(0);
    loadInitialFormData();
});