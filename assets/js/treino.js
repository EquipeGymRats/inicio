// Arquivo JavaScript final com funcionalidades de frontend e backend

import { authService } from './auth.js'; // Importar o serviço de autenticação (manter se necessário para o backend)

document.addEventListener('DOMContentLoaded', () => {
    // Elementos do DOM
    const trainingForm = document.getElementById('training-form');
    const formSection = document.getElementById('form-section');
    const outputSection = document.getElementById('output-section');
    const trainingPlanDiv = document.getElementById('training-plan');
    const summaryLevel = document.getElementById('summary-level');
    const summaryObjective = document.getElementById('summary-objective');
    const summaryFrequency = document.getElementById('summary-frequency');
    const saveTrainingBtn = document.getElementById('save-training-btn');
    const newTrainingBtn = document.getElementById('new-training-btn');
    const notificationToast = document.getElementById('notification-toast');
    const loadingSpinner = document.getElementById('loading-spinner');

    // Elementos de navegação de dias
    const prevDayBtn = document.getElementById('prev-day');
    const nextDayBtn = document.getElementById('next-day');
    const currentDayNameSpan = document.getElementById('current-day-name');

    // Variáveis globais
    let currentTrainingPlan = null; // Armazena o plano de treino completo
    let currentDayIndex = 0; // Índice do dia atual sendo exibido (0 para Segunda, 1 para Terça, etc.)

    // URL do seu backend (ajuste conforme necessário)
    const BASE_URL = 'https://api-gym-cyan.vercel.app'; // **VERIFIQUE E ATUALIZE ESTA URL**

    // Inicializar modal de exercício
    initExerciseModal();

    // Função para mostrar notificação toast
    function showToast(message, duration = 3000) {
        notificationToast.textContent = message;
        notificationToast.classList.add('show');
        setTimeout(() => {
            notificationToast.classList.remove('show');
        }, duration);
    }

    // Função para extrair o ID do vídeo do YouTube a partir da URL
    function getYoutubeVideoId(url) {
        if (!url) return null;
        
        // Padrões de URL do YouTube
        const regExp = /^.*(https:\/\/www\.youtube\.com\/watch\?v=|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        
        return (match && match[2].length === 11) ? match[2] : null;
    }

    // Função para inicializar o modal de exercício
    function initExerciseModal() {
        // Criar elementos do modal (mantido do treino-atualizado-com-videos.js)
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'exercise-modal-overlay';
        modalOverlay.id = 'exercise-modal-overlay';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'exercise-modal';
        
        modalContent.innerHTML = `
            <button class="modal-close" id="modal-close">
                <i class="fas fa-times"></i>
            </button>
            <div class="modal-header">
                <h3 class="modal-title" id="modal-title">Nome do Exercício</h3>
                <div class="modal-subtitle" id="modal-subtitle">
                    <i class="fas fa-repeat"></i>
                    <span id="modal-sets-reps">3 séries de 10-12 repetições</span>
                </div>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <h4 class="modal-section-title">
                        <i class="fas fa-lightbulb"></i>
                        Dica de Execução
                    </h4>
                    <div class="tip-card" id="modal-tip">
                        Dica do exercício aparecerá aqui.
                    </div>
                </div>
                
                <div class="modal-section">
                    <h4 class="modal-section-title">
                        <i class="fas fa-video"></i>
                        Tutorial em Vídeo
                    </h4>
                    <div class="video-container" id="modal-video">
                        <div class="video-placeholder">
                            <i class="fas fa-film"></i>
                            <p>Vídeo tutorial não disponível</p>
                        </div>
                    </div>
                </div>
                
                <div class="modal-section">
                    <h4 class="modal-section-title">
                        <i class="fas fa-list-ol"></i>
                        Passo a Passo
                    </h4>
                    <ul class="tutorial-steps" id="modal-steps">
                        </ul>
                </div>
                
                <div class="modal-section">
                    <h4 class="modal-section-title">
                        <i class="fas fa-dumbbell"></i>
                        Músculos Trabalhados
                    </h4>
                    <div class="muscle-groups" id="modal-muscles">
                        </div>
                </div>
                
                <div class="modal-section">
                    <h4 class="modal-section-title">
                        <i class="fas fa-chart-line"></i>
                        Nível de Dificuldade
                    </h4>
                    <div class="difficulty-meter" id="modal-difficulty">
                        </div>
                </div>
            </div>
        `;
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        // Adicionar evento para fechar o modal
        document.getElementById('modal-close').addEventListener('click', closeExerciseModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeExerciseModal();
            }
        });
    }

    // Função para abrir o modal de exercício
    function openExerciseModal(exercise) {
        const modalOverlay = document.getElementById('exercise-modal-overlay');
        
        // Preencher dados do exercício no modal (mantido do treino-atualizado-com-videos.js)
        document.getElementById('modal-title').textContent = exercise.name;
        document.getElementById('modal-sets-reps').textContent = exercise.setsReps;
        document.getElementById('modal-tip').textContent = exercise.tips;
        
        // Preencher o vídeo do YouTube se disponível
        const videoContainer = document.getElementById('modal-video');
        if (exercise.youtubeUrl) {
            const videoId = getYoutubeVideoId(exercise.youtubeUrl);
            if (videoId) {
                videoContainer.innerHTML = `
                    <iframe 
                        width="100%" 
                        height="100%" 
                        src="https://www.youtube.com/embed/${videoId}" 
                        title="Tutorial de ${exercise.name}" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                `;
            } else {
                videoContainer.innerHTML = `
                    <div class="video-placeholder">
                        <i class="fas fa-film"></i>
                        <p>Link de vídeo inválido</p>
                    </div>
                `;
            }
        } else {
            videoContainer.innerHTML = `
                <div class="video-placeholder">
                    <i class="fas fa-film"></i>
                    <p>Vídeo tutorial não disponível</p>
                </div>
            `;
        }
        
        // Preencher passos do tutorial
        const stepsContainer = document.getElementById('modal-steps');
        stepsContainer.innerHTML = '';
        if (exercise.tutorialSteps && exercise.tutorialSteps.length > 0) {
            exercise.tutorialSteps.forEach(step => {
                const li = document.createElement('li');
                li.textContent = step;
                stepsContainer.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'Passos detalhados não disponíveis para este exercício.';
            stepsContainer.appendChild(li);
        }
        
        // Preencher músculos trabalhados
        const musclesContainer = document.getElementById('modal-muscles');
        musclesContainer.innerHTML = '';
        if (exercise.muscleGroups && exercise.muscleGroups.length > 0) {
            exercise.muscleGroups.forEach(muscle => {
                const tag = document.createElement('span');
                tag.className = 'muscle-tag';
                tag.textContent = muscle.charAt(0).toUpperCase() + muscle.slice(1);
                musclesContainer.appendChild(tag);
            });
        } else {
            const tag = document.createElement('span');
            tag.className = 'muscle-tag';
            tag.textContent = 'Informação não disponível';
            musclesContainer.appendChild(tag);
        }
        
        // Preencher nível de dificuldade
        const difficultyContainer = document.getElementById('modal-difficulty');
        difficultyContainer.innerHTML = '';
        const difficulty = exercise.difficulty || 1;
        for (let i = 1; i <= 5; i++) {
            const dot = document.createElement('div');
            dot.className = `difficulty-dot ${i <= difficulty ? 'active' : ''}`;
            difficultyContainer.appendChild(dot);
        }
        
        // Mostrar o modal
        modalOverlay.classList.add('active');
    }

    // Função para fechar o modal de exercício
    function closeExerciseModal() {
        const modalOverlay = document.getElementById('exercise-modal-overlay');
        modalOverlay.classList.remove('active');
        
        // Parar o vídeo do YouTube se estiver sendo reproduzido
        const videoContainer = document.getElementById('modal-video');
        const iframe = videoContainer.querySelector('iframe');
        if (iframe) {
            const iframeSrc = iframe.src;
            iframe.src = iframeSrc; // Recarrega o iframe para parar o vídeo
        }
    }

    // Função para exibir o treino do dia atual com dicas modernizadas
    function displayCurrentDayTraining() {
        if (!currentTrainingPlan || !currentTrainingPlan.plan || currentTrainingPlan.plan.length === 0) {
            trainingPlanDiv.innerHTML = '<p class="day-off-message"><i class="fas fa-exclamation-triangle"></i> Nenhum treino disponível.</p>';
            currentDayNameSpan.textContent = 'Nenhum dia';
            prevDayBtn.disabled = true;
            nextDayBtn.disabled = true;
            return;
        }

        const day = currentTrainingPlan.plan[currentDayIndex];
        currentDayNameSpan.textContent = day.dayName; // Atualiza o nome do dia na navegação

        let dayContent = '';
        if (day.exercises && day.exercises.length > 0) {
            dayContent += `<div class="training-day">
                <h4 class="training-day-header"><i class="fas fa-calendar-day"></i> ${day.dayName}</h4>
                <ul class="exercise-list">`;
            day.exercises.forEach((exercise, index) => {
                // Gera um ID único para cada exercício
                const exerciseId = `exercise-${currentDayIndex}-${index}`;
                
                // Adiciona ícones específicos para cada tipo de dica
                let tipIcon = 'lightbulb';
                
                // Determina o ícone com base no conteúdo da dica
                if (exercise.tips.toLowerCase().includes('técnica') || 
                    exercise.tips.toLowerCase().includes('forma') || 
                    exercise.tips.toLowerCase().includes('postura')) {
                    tipIcon = 'check-circle';
                } else if (exercise.tips.toLowerCase().includes('contraia') || 
                               exercise.tips.toLowerCase().includes('força') || 
                               exercise.tips.toLowerCase().includes('explosivo')) {
                    tipIcon = 'bolt';
                } else if (exercise.tips.toLowerCase().includes('respire') || 
                               exercise.tips.toLowerCase().includes('ritmo') || 
                               exercise.tips.toLowerCase().includes('constante')) {
                    tipIcon = 'wind';
                } else if (exercise.tips.toLowerCase().includes('equilíbrio') || 
                               exercise.tips.toLowerCase().includes('estabilidade')) {
                    tipIcon = 'balance-scale';
                }
                
                dayContent += `
                    <li id="${exerciseId}">
                        <div class="exercise-content">
                            <span class="exercise-name" data-number="${index + 1}">${exercise.name}</span>
                            <div class="exercise-details">
                                <span class="exercise-sets-reps"><i class="fas fa-repeat"></i> ${exercise.setsReps}</span>
                                <div class="exercise-tips">
                                    <i class="fas fa-${tipIcon}"></i>
                                    <span>${exercise.tips}</span>
                                    </div>
                            </div>
                        </div>
                    </li>`;
            });
            dayContent += `</ul></div>`;
        } else {
            dayContent = `<div class="training-day">
                <h4 class="training-day-header"><i class="fas fa-calendar-day"></i> ${day.dayName}</h4>
                <p class="day-off-message"><i class="fas fa-couch"></i> Dia de Descanso</p>
            </div>`;
        }
        trainingPlanDiv.innerHTML = dayContent;

        // Adicionar eventos para os exercícios (agora apenas para abrir o modal)
        if (day.exercises && day.exercises.length > 0) {
            day.exercises.forEach((exercise, index) => {
                const exerciseId = `exercise-${currentDayIndex}-${index}`;
                const exerciseElement = document.getElementById(exerciseId);
                
                if (exerciseElement) {
                    // Adicionar evento de clique para o nome do exercício
                    const exerciseName = exerciseElement.querySelector('.exercise-name');
                    exerciseName.addEventListener('click', () => {
                        openExerciseModal(exercise);
                    });
                }
            });
        }

        // Gerencia estado dos botões de navegação
        prevDayBtn.disabled = currentDayIndex === 0;
        nextDayBtn.disabled = currentDayIndex === currentTrainingPlan.plan.length - 1;
    }

    // Função para renderizar o plano de treino recebido da API
    function renderTrainingPlan(planData) {
        currentTrainingPlan = planData; // Salva o plano completo recebido da API
        
        // Preencher informações de resumo
        // Estes dados vêm do backend ao buscar o treino salvo
        summaryLevel.textContent = planData.level?.charAt(0).toUpperCase() + planData.level?.slice(1) || "Nível não especificado";
        summaryObjective.textContent = planData.objective?.charAt(0).toUpperCase() + planData.objective?.slice(1) || "Objetivo não especificado";
        summaryFrequency.textContent = `${planData.frequency || 0} vezes por semana`;

        // Preencher os campos do formulário com os dados do treino anterior
        // Isso é importante para que o usuário veja os inputs preenchidos
        document.querySelector(`input[name="level"][value="${planData.level}"]`).checked = true;
        document.querySelector(`input[name="objective"][value="${planData.objective}"]`).checked = true;
        document.querySelector(`input[name="frequency"][value="${planData.frequency}"]`).checked = true;
        document.querySelector(`input[name="equipment"][value="${planData.equipment}"]`).checked = true;
        const timeInput = document.getElementById('time-per-session');
        timeInput.value = planData.timePerSession;
        document.getElementById('time-value').textContent = `${planData.timePerSession} minutos`;


        // Exibe o primeiro dia do treino ao carregar/gerar
        currentDayIndex = 0;
        displayCurrentDayTraining();

        // **MODIFICAÇÃO AQUI:** Esconde o formulário se um treino for carregado ou gerado
        formSection.classList.add('hidden'); // Esconde o formulário
        formSection.style.filter = 'none'; // Remove o blur (caso tenha sido aplicado)
        loadingSpinner.classList.add('hidden'); // Esconde o spinner
        outputSection.classList.remove('hidden'); // Mostra a seção de output
        saveTrainingBtn.disabled = true; // Desabilita se já estiver salvo
        saveTrainingBtn.textContent = 'Treino Salvo!'; // Indica que já está salvo ou que foi carregado
    }

    // NOVO: Função para carregar o treino anterior do usuário
    async function loadPreviousTraining() {
        loadingSpinner.innerHTML = `
            <div class="loading-squares-container">
                <div class="loading-square"></div>
                <div class="loading-square"></div>
                <div class="loading-square"></div>
                <div class="loading-square"></div>
            </div>
            <p>Carregando seu treino anterior...</p>
        `;
        formSection.style.filter = 'blur(5px)';
        loadingSpinner.classList.remove('hidden');

        try {
            const token = authService.getToken(); // Obtenha o token de autenticação
            if (!token) {
                showToast("Usuário não autenticado. Faça login para carregar seu treino.", 5000);
                loadingSpinner.classList.add('hidden');
                formSection.style.filter = 'none';
                return;
            }

            const response = await fetch(`${BASE_URL}/training/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token, // Envia o token no cabeçalho
                },
            });

            if (response.ok) {
                const planData = await response.json();
                renderTrainingPlan(planData); // Renderiza o plano encontrado e esconde o formulário
                showToast("Treino anterior carregado com sucesso!", 3000);
            } else if (response.status === 404) {
                showToast("Nenhum treino encontrado para este usuário. Gere um novo treino!", 4000);
                trainingForm.reset(); // Limpa o formulário caso não haja treino
                outputSection.classList.add('hidden'); // Esconde a seção de output
                formSection.classList.remove('hidden'); // Garante que o formulário esteja visível para gerar um novo treino
                saveTrainingBtn.disabled = false; // Habilita o botão de salvar para um novo treino
                saveTrainingBtn.textContent = 'Salvar Treino';
            } else {
                const errorData = await response.json();
                showToast(`Erro ao carregar treino: ${errorData.message || response.statusText}`, 5000);
            }
        } catch (error) {
            console.error('Erro ao buscar treino anterior:', error);
            showToast("Erro ao carregar treino. Verifique a conexão com o backend.", 5000);
        } finally {
            loadingSpinner.classList.add('hidden');
            formSection.style.filter = 'none';
        }
    }

    // Event Listeners para navegação de dias
    prevDayBtn.addEventListener('click', () => {
        if (currentTrainingPlan && currentDayIndex > 0) {
            currentDayIndex--;
            displayCurrentDayTraining();
        }
    });

    nextDayBtn.addEventListener('click', () => {
        if (currentTrainingPlan && currentDayIndex < currentTrainingPlan.plan.length - 1) {
            currentDayIndex++;
            displayCurrentDayTraining();
        }
    });

    // Botão Salvar Treino (Lógica de backend original)
    saveTrainingBtn.addEventListener('click', async () => {
        if (!currentTrainingPlan) {
            showToast("Nenhum treino para salvar!", 3000);
            return;
        }

        // Exemplo de como enviar o treino para o backend salvar
        // Você precisará ajustar a URL e o método conforme sua API de backend
        try {
            const token = authService.getToken(); // Obtenha o token de autenticação se necessário
            if (!token) {
                showToast("Faça login para salvar seu treino.", 5000);
                return;
            }

            // Coletar dados do formulário para salvar junto com o plano
            const level = document.querySelector('input[name="level"]:checked').value;
            const objective = document.querySelector('input[name="objective"]:checked').value;
            const frequency = document.querySelector('input[name="frequency"]:checked').value;
            const equipment = document.querySelector('input[name="equipment"]:checked').value;
            const timePerSession = document.getElementById('time-per-session').value;

            const trainingToSave = {
                level,
                objective,
                frequency,
                equipment,
                timePerSession: parseInt(timePerSession),
                plan: currentTrainingPlan.plan // Envia apenas o array 'plan'
            };
            
            const response = await fetch(`${BASE_URL}/training/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token, // Envia o token no cabeçalho
                },
                body: JSON.stringify(trainingToSave)
            });

            if (response.ok) {
                showToast("Treino salvo com sucesso!", 3000);
                saveTrainingBtn.disabled = true;
                saveTrainingBtn.textContent = 'Treino Salvo!';
            } else {
                const errorData = await response.json();
                showToast(`Erro ao salvar treino: ${errorData.message || response.statusText}`, 5000);
            }
        } catch (error) {
            console.error('Erro ao salvar treino:', error);
            showToast("Erro ao salvar treino. Tente novamente mais tarde.", 5000);
        }
    });

    // Botão Gerar Novo Treino
    newTrainingBtn.addEventListener('click', () => {
        trainingForm.reset();
        outputSection.classList.add('hidden');
        formSection.classList.remove('hidden'); // Mostra o formulário novamente
        formSection.style.filter = 'none'; // Remove o blur
        saveTrainingBtn.disabled = false; // Reabilita o botão de salvar
        saveTrainingBtn.textContent = 'Salvar Treino';
        currentTrainingPlan = null; // Limpa o plano atual
        currentDayIndex = 0; // Reseta o índice do dia
        trainingPlanDiv.innerHTML = ''; // Limpa a exibição do treino
        showToast("Formulário limpo! Comece um novo treino.", 2000);
        
        // Resetar o valor do span de tempo
        const timeInput = document.getElementById('time-per-session');
        const timeValueSpan = document.getElementById('time-value');
        timeValueSpan.textContent = `${timeInput.value} minutos`;
    });

    // Submissão do formulário (Lógica de backend original integrada com frontend melhorado)
    trainingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const level = document.querySelector('input[name="level"]:checked').value;
        const objective = document.querySelector('input[name="objective"]:checked').value;
        const frequency = document.querySelector('input[name="frequency"]:checked').value;
        const equipment = document.querySelector('input[name="equipment"]:checked').value;
        const timePerSession = document.getElementById('time-per-session').value;

        // Aplica blur ao formulário e mostra o spinner de carregamento
        formSection.style.filter = 'blur(5px)';
        loadingSpinner.innerHTML = `
            <div class="loading-squares-container">
                <div class="loading-square"></div>
                <div class="loading-square"></div>
                <div class="loading-square"></div>
                <div class="loading-square"></div>
            </div>
            <p>Criando Exercício...</p>
        `;
        loadingSpinner.classList.remove('hidden');

        // Coleta os dados do formulário
        const formData = {
            level: level,
            objective: objective,
            frequency: frequency,
            equipment: equipment,
            timePerSession: parseInt(timePerSession) // Converte para número se necessário
        };

        // Chama a API de backend para gerar o treino
        try {
            const token = authService.getToken(); // Obtenha o token de autenticação se necessário
            if (!token) {
                showToast("Usuário não autenticado. Faça login para gerar seu treino.", 5000);
                loadingSpinner.classList.add('hidden');
                formSection.style.filter = 'none';
                return;
            }

            const response = await fetch(`${BASE_URL}/training/generate-treino`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token, // Envia o token no cabeçalho
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const planData = await response.json();
                renderTrainingPlan(planData); // Renderiza o plano recebido da API e esconde o formulário
                showToast("Treino gerado com sucesso!", 3000);
                saveTrainingBtn.disabled = false; // Habilita o botão de salvar para o novo treino
                saveTrainingBtn.textContent = 'Salvar Treino';
            } else {
               const errorData = await response.json();
                showToast(`Erro ao gerar treino: ${errorData.message || response.statusText}`, 5000);
                // Esconde o spinner e remove o blur em caso de erro
                loadingSpinner.classList.add('hidden');
                formSection.style.filter = 'none';
            }
        } catch (error) {
            console.error('Erro ao chamar API de geração de treino:', error);
            showToast("Erro ao gerar treino. Verifique a conexão com o backend.", 5000);
            // Esconde o spinner e remove o blur em caso de erro
            loadingSpinner.classList.add('hidden');
            formSection.style.filter = 'none';
        }
    });

    // Script para atualizar o valor do tempo por sessão (mantido do HTML)
    const timeInput = document.getElementById('time-per-session');
    const timeValueSpan = document.getElementById('time-value');
    timeInput.addEventListener('input', () => {
        timeValueSpan.textContent = `${timeInput.value} minutos`;
    });
    // Definir valor inicial ao carregar a página
    // Isso é chamado apenas uma vez, então também precisamos chamar a função de carregamento
    // para garantir que o span seja atualizado se um treino salvo for carregado.
    
    // NOVO: Chamar loadPreviousTraining ao carregar a página
    loadPreviousTraining();
});