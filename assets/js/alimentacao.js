// assets/js/alimentacao.js

import { authService } from './auth.js';

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
    const formProgressBar = document.querySelector('.form-progress-bar'); // Referência ao container da barra de progresso
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
    const loadingText = document.querySelector('.loading-text'); // Novo elemento para o texto de carregamento


    let currentStep = 0;
    let nutritionPlanData = []; // Armazenará o plano semanal completo da Gemini API
    let globalTipsData = []; // Armazenará as dicas globais da Gemini API
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
        // Remove todas as classes de largura e adiciona a correta
        formProgressBar.classList.remove('progress-step-1', 'progress-step-2', 'progress-step-3');
        if (stepIndex === 0) {
            formProgressBar.classList.add('progress-step-1');
        } else if (stepIndex === 1) {
            formProgressBar.classList.add('progress-step-2');
        } else if (stepIndex === 2) {
            formProgressBar.classList.add('progress-step-3');
        }


        formProgressSteps.forEach((step, index) => {
            if (index <= stepIndex) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
            // Adiciona o número da etapa
            step.textContent = index + 1; 
        });
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
        formStepTitle.textContent = `Dados para o Plano: ${stepIndex + 1} de ${formSteps.length}`; // Atualiza o título
        updateProgressBar(stepIndex);
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
        // Para o step 2 (último), não há validações específicas, mas podemos adicionar se necessário
        return isValid;
    }

    // --- Integração com Gemini API ---

    async function generateNutritionPlanWithGemini() {
        const userInputs = getUserInputs();

        // 1. Mostrar overlay de carregamento no formulário
        loadingText.textContent = "Gerando seu plano alimentar inteligente..."; // Atualiza o texto
        formLoadingOverlay.classList.add('visible');
        
        try {
            const token = authService.getToken();
            const response = await fetch('https://api-gym-cyan.vercel.app/generate-nutrition-plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
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
                globalTipsData = data.tips || [];
            } else {
                console.error("Resposta da IA não contém 'plan' como um array:", data);
                throw new Error("A IA não gerou um plano em formato esperado.");
            }

            if (nutritionPlanData.length > 0) {
                // Salvar dados no localStorage
                localStorage.setItem('gymrats_objetivo', userInputs.goal);
                localStorage.setItem('gymrats_nivel', userInputs.activityLevel);
                localStorage.setItem('gymrats_frequencia', "Não especificada"); // Ajustar se a IA fornecer
                
                const bmr = calculateBMR(userInputs.weight, userInputs.height, userInputs.age, userInputs.gender);
                const tdee = calculateTDEE(bmr, userInputs.activityLevel);
                let adjustedCalories = tdee;
                if (userInputs.goal === 'perda de peso') {
                    adjustedCalories = tdee - 500;
                } else if (userInputs.goal === 'hipertrofia muscular' || userInputs.goal === 'ganho de forca') {
                    adjustedCalories = tdee + 300;
                }
                localStorage.setItem('gymrats_calorias', Math.round(adjustedCalories).toString());

                updateSummaryInfoDisplay(userInputs, Math.round(adjustedCalories));
                nutriSummaryInfo.classList.add('active'); // Mostrar summary info com transição

                // 2. Esconder overlay e formulário, mostrar plano
                formLoadingOverlay.classList.remove('visible'); // Esconde o overlay
                nutriFormSection.classList.add('hidden'); // Esconde o formulário completamente
                
                displayDayPlan(0); // Exibe o plano da primeira dia por padrão
                displayGlobalTips(); // Exibe as dicas globais
                nutriPlanOutput.classList.remove('hidden'); // Remove hidden para iniciar transição
                nutriPlanOutput.classList.add('active'); // Ativa a visibilidade com transição

                showToast('Plano alimentar gerado com sucesso!', 'success');
            } else {
                nutriPlanOutput.innerHTML = '<p style="color: red; text-align: center;">A IA gerou o plano, mas ele veio vazio ou em um formato inesperado. Tente novamente ou ajuste os parâmetros.</p>';
                showToast('Erro: Plano vazio ou inválido da IA.', 'error');
                formLoadingOverlay.classList.remove('visible'); // Esconde overlay
                nutriFormSection.classList.remove('hidden'); // Manter o formulário visível em caso de erro
            }
            
        } catch (error) {
            console.error("Erro na requisição ao backend ou ao processar a resposta:", error);
            nutriPlanOutput.innerHTML = `<p style="color: red; text-align: center;">Erro ao gerar plano alimentar. Por favor, tente novamente. <br> Detalhes: ${error.message}</p>`;
            showToast('Erro ao gerar plano. Verifique o console para mais detalhes.', 'error');
            formLoadingOverlay.classList.remove('visible'); // Esconde overlay
            nutriFormSection.classList.remove('hidden'); // Manter o formulário visível em caso de erro
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
            currentDayCard.innerHTML = '<p style="text-align: center; color: var(--gymrats-text-secondary);">Nenhum plano disponível para este dia.</p>';
            currentDayName.textContent = dayNames[dayIndex];
            // currentDayCard.style.height = 'auto'; // Não definir altura fixa aqui
            return;
        }

        const dayPlan = nutritionPlanData[dayIndex];
        currentDayName.textContent = dayPlan.dayName || dayNames[dayIndex];
        
        // Remove a transição de altura temporariamente para evitar o "salto" ou "gigante"
        // e então recalcula a altura com o novo conteúdo.
        // currentDayCard.style.transition = 'none'; 
        currentDayCard.style.height = 'auto'; // Permite que a altura se ajuste livremente

        let mealListHTML = '<ul class="meal-list">';
        if (dayPlan.meals && Array.isArray(dayPlan.meals)) {
            dayPlan.meals.forEach(meal => {
                const iconHtml = meal.icon && meal.icon.startsWith('fas fa-') 
                    ? `<i class="${meal.icon}"></i>`
                    : (meal.icon ? `<span style="font-style: normal;">${meal.icon}</span>` : `<i class="fas fa-utensils"></i>`);
                
                const foodsText = meal.foods && Array.isArray(meal.foods) ? meal.foods.join('<br>') : 'Nenhum alimento detalhado para esta refeição.';
                
                mealListHTML += `
                    <li class="meal-item">
                        <div class="meal-header">
                            ${iconHtml}
                            <h5>${meal.mealName}</h5>
                        </div>
                        <p class="meal-foods">${foodsText}</p>
                    </li>
                `;
            });
        } else {
            mealListHTML += `
                <li class="meal-item">
                    <p class="meal-foods" style="font-style: italic;">Erro: As refeições para este dia não foram carregadas corretamente ou estão em formato inválido.</p>
                </li>
            `;
        }
        mealListHTML += '</ul>';
        
        currentDayCard.innerHTML = mealListHTML; 
        
        // Se quisermos uma transição de altura, teríamos que fazer algo mais complexo
        // como capturar a altura atual, aplicar o novo conteúdo, e depois transicionar para a nova altura.
        // Mas para evitar o "tamanho gigante", deixar 'height: auto;' é a solução mais simples.
        
        prevDayBtn.disabled = dayIndex === 0;
        nextDayBtn.disabled = dayIndex === (nutritionPlanData.length - 1);

        currentDayIndex = dayIndex; // Atualiza o índice global
    }

    function displayGlobalTips() {
        nutriTipsList.innerHTML = '';
        if (globalTipsData && globalTipsData.length > 0) {
            globalTipsData.forEach(tip => {
                const li = document.createElement('li');
                li.innerHTML = `<i class="fas fa-lightbulb"></i> ${tip}`;
                nutriTipsList.appendChild(li);
            });
            nutriTipsSection.classList.remove('hidden');
        } else {
            nutriTipsSection.classList.add('hidden');
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

    if (submitNutritionFormBtn) { // Usar o submit button diretamente
        submitNutritionFormBtn.addEventListener('click', async (event) => {
            event.preventDefault(); // Impede o comportamento padrão do formulário
            // Valida a última etapa antes de gerar
            if (validateCurrentStepInputs(2)) { // Assumindo que a última etapa é a 2 (0-indexed)
                await generateNutritionPlanWithGemini();
            }
        });
    }


    // --- Event Listeners para Navegação do Plano Semanal ---
    if (prevDayBtn) {
        prevDayBtn.addEventListener('click', () => {
            if (currentDayIndex > 0) {
                displayDayPlan(currentDayIndex - 1); // Passa o novo índice para displayDayPlan
            }
        });
    }
    if (nextDayBtn) {
        nextDayBtn.addEventListener('click', () => {
            if (currentDayIndex < nutritionPlanData.length - 1) {
                displayDayPlan(currentDayIndex + 1); // Passa o novo índice para displayDayPlan
            }
        });
    }

    // --- Outros Botões de Ação ---
    if (regenerateNutriBtn) {
        regenerateNutriBtn.addEventListener('click', () => {
            showStep(0); // Volta para a primeira etapa do formulário
            nutriFormSection.classList.remove('hidden'); // Mostra o formulário
            nutriPlanOutput.classList.add('hidden'); // Esconde o plano com transição (usa .hidden diretamente)
            nutriPlanOutput.classList.remove('active'); // Remove a classe 'active' para transição de saída
            nutriSummaryInfo.classList.remove('active'); // Esconde o summary info com transição
            nutriTipsSection.classList.add('hidden'); // Esconde as dicas
            showToast('Formulário resetado. Preencha novamente para regerar o plano.', 'info');
            nutritionDetailsForm.reset(); // Limpa os campos do formulário
            // Limpa dados do localStorage
            localStorage.removeItem('gymRatsNutritionDetails');
            localStorage.removeItem('gymrats_objetivo');
            localStorage.removeItem('gymrats_nivel');
            localStorage.removeItem('gymrats_frequencia');
            localStorage.removeItem('gymrats_calorias');
            // Limpa o plano de dados
            nutritionPlanData = [];
            globalTipsData = [];
            currentDayIndex = 0;
            currentDayCard.innerHTML = ''; // Limpa o conteúdo do card do dia
        });
    }

    // --- Exportar para PDF (Ajustado com Ícones) ---
    if (exportNutriBtn) {
        exportNutriBtn.addEventListener('click', async () => {
            if (nutritionPlanData.length === 0) {
                showToast('Nenhum plano gerado para exportar.', 'error');
                return;
            }

            showToast('Gerando PDF...', 'info');
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
            // const fontAwesomeFont = 'FontAwesome'; // Para ícones (se carregada)

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
                        // Ajuste o width para algo menor para caber 2 cards na página e não precisar de um cálculo complexo
                        const cardWidthPx = (pageWidth / 2 - margin - 5) * (96 / 25.4); // Aproximadamente metade da página, menos margens.
                        
                        // Estilos para o tempDayCard para html2canvas:
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
                        // IMPORTANTE: Adicione o elemento temporário ao DOM para que html2canvas possa vê-lo e calcular as dimensões.
                        document.body.appendChild(tempDayCard);


                        let cardContent = `<h4 style="font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: bold; color: rgb(${highlightYellow[0]}, ${highlightYellow[1]}, ${highlightYellow[2]}); margin-bottom: 6px; text-align: center;">${dayPlan.dayName}</h4>`;

                        if (dayPlan.meals && Array.isArray(dayPlan.meals)) {
                             dayPlan.meals.forEach(meal => {
                                 cardContent += `<div style="margin-bottom: 4px; display: flex; align-items: flex-start;">`;
                                 
                                 // Para ícones, html2canvas geralmente não renderiza Font Awesome diretamente
                                 // Pode precisar de uma alternativa, como emojis ou imagens.
                                 // Por enquanto, vamos manter o que estava, mas ciente que pode não aparecer.
                                 if (meal.icon && meal.icon.startsWith('fas fa-')) {
                                     // Isso não funcionará bem no PDF. Considerar trocar por texto ou emoji
                                     // Ex: Substituir por um emoji ou um placeholder se não tiver suporte FontAwesome no jsPDF
                                     cardContent += `<span style="font-family: 'Font Awesome 5 Free', 'Font Awesome 5 Solid', sans-serif; font-weight: 900; font-size: 11px; margin-right: 4px; color: rgb(${highlightYellow[0]}, ${highlightYellow[1]}, ${highlightYellow[2]});">&#xf0f5;</span>`; // Exemplo de ícone de utensílio
                                 } else if (meal.icon) {
                                     cardContent += `<span style="font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', sans-serif; font-size: 11px; margin-right: 4px; color: rgb(${highlightYellow[0]}, ${highlightYellow[1]}, ${highlightYellow[2]});">${meal.icon}</span>`;
                                 } else {
                                     cardContent += `<span style="font-family: 'Font Awesome 5 Free', 'Font Awesome 5 Solid', sans-serif; font-weight: 900; font-size: 11px; margin-right: 4px; color: rgb(${highlightYellow[0]}, ${highlightYellow[1]}, ${highlightYellow[2]});">&#xf0f5;</span>`; // Ícone de utensílio
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
                        // O tempDayCard já está no body, então html2canvas pode renderizá-lo.
                        const canvas = await html2canvas(tempDayCard, {
                            scale: 4, // Aumenta a escala para melhor qualidade
                            backgroundColor: null, // Captura o fundo transparente
                            logging: false,
                            useCORS: true
                        });
                        const imgData = canvas.toDataURL('image/png');
                        document.body.removeChild(tempDayCard); // Remove o elemento temporário

                        resolve({ imgData, width: canvas.width, height: canvas.height });
                    }));
                });

                const renderedCards = await Promise.all(cardPromises);

                const cardMarginX = 8;
                const cardMarginY = 10;
                const cardsPerRow = 2;
                // Ajustando effectiveCardWidth para o cálculo correto da imagem
                const effectiveCardWidthForPdf = (pageWidth - (2 * margin) - ((cardsPerRow - 1) * cardMarginX)) / cardsPerRow;


                let currentRowCards = 0;
                let startX = margin;
                let highestCardInRow = 0;
                
                // Mudar para o inicio da área de cards, abaixo das dicas (se existirem)
                if (currentY + 10 > pageHeight - margin - 25) { // Se as dicas quase encheram a página
                    doc.addPage();
                    addPageBackgroundAndFooter();
                    currentY = margin;
                } else {
                    currentY += 10; // Pequeno espaço após as dicas ou info
                }
                
                doc.setFont(defaultFont, 'bold');
                doc.setFontSize(14);
                doc.setTextColor(highlightYellow[0], highlightYellow[1], highlightYellow[2]);
                doc.text('Plano Semanal Detalhado:', margin, currentY);
                currentY += 10; // Espaço após o título

                renderedCards.forEach((card, index) => {
                    const aspectRatio = card.width / card.height;
                    const imgHeight = effectiveCardWidthForPdf / aspectRatio;

                    if (currentRowCards === cardsPerRow) { // Se a linha atual já tem 2 cards
                        currentY += highestCardInRow + cardMarginY; // Pula para a próxima linha
                        startX = margin; // Reseta X para a margem esquerda
                        currentRowCards = 0;
                        highestCardInRow = 0;
                    }

                    if (currentY + imgHeight > pageHeight - margin - 25) { // Se o card não couber na página
                        doc.addPage();
                        addPageBackgroundAndFooter();
                        currentY = margin; // Reseta Y para o topo da nova página
                        startX = margin;
                        currentRowCards = 0;
                        highestCardInRow = 0;
                    }

                    doc.addImage(card.imgData, 'PNG', startX, currentY, effectiveCardWidthForPdf, imgHeight);
                    
                    startX += effectiveCardWidthForPdf + cardMarginX;
                    currentRowCards++;
                    highestCardInRow = Math.max(highestCardInRow, imgHeight);

                    // Se for o último card da linha ou o último card de todos, ajusta o Y para a próxima seção
                    if (currentRowCards === cardsPerRow || index === renderedCards.length - 1) {
                         currentY += highestCardInRow + cardMarginY;
                         // Não precisamos resetar startX, currentRowCards, highestCardInRow aqui
                         // pois isso será tratado no próximo loop ou ao final da função.
                    }
                });

                doc.save('Plano-Alimentar-GYMRats.pdf');
                showToast('Plano exportado para PDF!', 'success');

            } catch (error) {
                console.error("Erro ao exportar PDF:", error);
                showToast('Erro ao exportar o plano para PDF.', 'error');
            } finally {
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