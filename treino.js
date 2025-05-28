document.addEventListener('DOMContentLoaded', () => {
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

    // Funções de Treino (dados simulados para a "IA")
    // Adicionado mais exercícios para permitir maior variação
    const exercises = {
        iniciante: {
            hipertrofia: [
                { name: "Agachamento Livre (Peso Corporal)", setsReps: "3 séries de 10-12 repetições", tips: "Mantenha o peito aberto e desça como se fosse sentar em uma cadeira invisível. Controle o movimento." },
                { name: "Flexão de Braço (joelhos no chão)", setsReps: "3 séries de 8-10 repetições", tips: "Mantenha o corpo reto da cabeça aos joelhos. Contraia o abdômen e desça o peito em direção ao chão." },
                { name: "Remada Curvada (com halteres leves ou elástico)", setsReps: "3 séries de 10-12 repetições", tips: "Puxe os cotovelos para trás, espremendo as omoplatas. Mantenha as costas retas e o core ativo." },
                { name: "Elevação Lateral (com garrafas d'água ou elástico)", setsReps: "3 séries de 12-15 repetições", tips: "Levante os braços para os lados até a altura dos ombros, cotovelos levemente flexionados. Não use impulso." },
                { name: "Prancha Abdominal", setsReps: "3 séries de 30-45 segundos", tips: "Mantenha o corpo reto, como uma tábua. Não deixe o quadril cair ou levantar demais. Respire fundo." },
                { name: "Panturrilha em pé", setsReps: "3 séries de 15-20 repetições", tips: "Levante os calcanhares o máximo que puder, controlando a descida. Sinta a queima na panturrilha." },
                { name: "Afundo (Peso Corporal)", setsReps: "3 séries de 8-10 repetições por perna", tips: "Dê um passo à frente e abaixe o quadril até o joelho de trás quase tocar o chão. Mantenha o equilíbrio." },
                { name: "Crucifixo Invertido (com elástico)", setsReps: "3 séries de 12-15 repetições", tips: "Simule um abraço inverso. Foque na parte superior das costas e ombros posteriores." }
            ],
            forca: [
                { name: "Agachamento Livre (Peso Corporal)", setsReps: "3 séries de 8-10 repetições", tips: "Foco na forma e profundidade. Movimento controlado e lento na descida, explosivo na subida." },
                { name: "Flexão de Braço (joelhos no chão ou parede)", setsReps: "3 séries de 6-8 repetições", tips: "Mantenha a tensão em todo o movimento, especialmente na fase de descida. Foco na força." },
                { name: "Ponte de Glúteos", setsReps: "3 séries de 12-15 repetições", tips: "Eleve o quadril até formar uma linha reta com ombros e joelhos. Contraia bem os glúteos no topo." },
                { name: "Remada com Elástico", setsReps: "3 séries de 8-10 repetições", tips: "Foco na contração das costas, não apenas nos braços. Puxe em direção ao abdômen." },
                { name: "Prancha Lateral", setsReps: "3 séries de 20-30 segundos por lado", tips: "Mantenha o corpo reto e o core contraído. Não deixe o quadril cair." },
                { name: "Rosca Bíceps (com halteres leves)", setsReps: "3 séries de 10-12 repetições", tips: "Suba o peso controladamente, sem balançar o corpo. Sinta o bíceps." }
            ],
            "perda-peso": [
                { name: "Caminhada Rápida / Corrida Leve", setsReps: "30-45 minutos", tips: "Mantenha um ritmo constante que te deixe ofegante, mas capaz de conversar. Mantenha a frequência cardíaca elevada." },
                { name: "Agachamento Livre (Peso Corporal)", setsReps: "3 séries de 15-20 repetições", tips: "Mantenha o ritmo. Bom para aquecer os músculos e queimar calorias. Sem descanso longo." },
                { name: "Mountain Climbers", setsReps: "3 séries de 30-45 segundos", tips: "Leve os joelhos ao peito alternadamente. Mantenha o core firme e o ritmo acelerado." },
                { name: "Polichinelos", setsReps: "3 séries de 30-45 segundos", tips: "Movimento contínuo e rápido para elevar a frequência cardíaca. Coordene respiração e movimento." },
                { name: "Burpees (sem flexão, adaptação)", setsReps: "3 séries de 8-10 repetições", tips: "Movimento completo e intenso. Adapte para seu nível, focando na fluidez." },
                { name: "Afundo alternado", setsReps: "3 séries de 10-12 repetições por perna", tips: "Movimento fluido e controlado. Mantenha o equilíbrio e o ritmo para manter a queima calórica." }
            ],
            resistencia: [
                { name: "Caminhada Rápida / Corrida Leve", setsReps: "30-45 minutos", tips: "Mantenha um ritmo constante e controlável. Foque na resistência aeróbica e na respiração." },
                { name: "Agachamento Livre (Peso Corporal)", setsReps: "3 séries de 15-20 repetições", tips: "Mantenha o ritmo. Bom para aquecer os músculos e queimar calorias. Sem descanso longo." },
                { name: "Prancha Abdominal", setsReps: "3 séries de 45-60 segundos", tips: "Mantenha o corpo reto, como uma tábua. Aumente o tempo gradualmente para melhorar a resistência do core." },
                { name: "Afundo (Peso Corporal)", setsReps: "3 séries de 10-12 repetições por perna", tips: "Dê um passo à frente e abaixe o quadril até o joelho de trás quase tocar o chão. Mantenha a forma." },
                { name: "Abdominal Remador", setsReps: "3 séries de 15-20 repetições", tips: "Sente-se e estenda braços e pernas, depois encolha-se, levando as mãos aos pés. Foco na contração abdominal." },
                { name: "Flexão de Braço (joelhos no chão)", setsReps: "3 séries de 12-15 repetições", tips: "Concentre-se na execução perfeita, mesmo com maior número de repetições. Mantenha o ritmo." }
            ]
        },
        intermediario: {
            hipertrofia: [
                { name: "Agachamento com Halteres / Barra", setsReps: "4 séries de 8-12 repetições", tips: "Concentre-se na profundidade e na contração do glúteo ao subir. Mantenha a coluna neutra." },
                { name: "Supino Reto (com halteres / barra)", setsReps: "4 séries de 8-12 repetições", tips: "Desça a barra até tocar levemente o peito. Mantenha os cotovelos em 45 graus. Controle o movimento." },
                { name: "Remada Curvada com Halteres / Barra", setsReps: "4 séries de 8-12 repetições", tips: "Puxe em direção ao abdômen. Mantenha as costas travadas e o core firme. Sinta as costas trabalhando." },
                { name: "Desenvolvimento de Ombro (com halteres / barra)", setsReps: "3 séries de 10-12 repetições", tips: "Empurre o peso para cima, controlando a descida. Evite usar o impulso do corpo." },
                { name: "Rosca Direta (com halteres / barra)", setsReps: "3 séries de 10-12 repetições", tips: "Mantenha os cotovelos fixos ao lado do corpo. Sinta a contração no bíceps." },
                { name: "Tríceps Testa (com halteres)", setsReps: "3 séries de 10-12 repetições", tips: "Mantenha os cotovelos apontando para cima. Sinta o alongamento e contração no tríceps." },
                { name: "Leg Press (máquina)", setsReps: "4 séries de 10-15 repetições", tips: "Mantenha as costas bem apoiadas. Pés na largura dos ombros. Desça até 90 graus." },
                { name: "Cadeira Extensora", setsReps: "3 séries de 12-15 repetições", tips: "Foque na contração máxima do quadríceps no topo do movimento. Controle a descida." },
                { name: "Cadeira Flexora", setsReps: "3 séries de 12-15 repetições", tips: "Sinta o posterior da coxa. Mantenha o quadril firme no banco." },
                { name: "Elevação Lateral (com halteres)", setsReps: "3 séries de 12-15 repetições", tips: "Movimento controlado, sem balançar. Levante até a altura dos ombros." }
            ],
            forca: [
                { name: "Agachamento com Halteres / Barra", setsReps: "5 séries de 5 repetições", tips: "Foco na técnica e explosão. Descanse mais entre as séries para recuperação total da força." },
                { name: "Supino Reto (com halteres / barra)", setsReps: "5 séries de 5 repetições", tips: "Movimento controlado e explosivo. Recupere bem. Concentre-se na força do empurrão." },
                { name: "Levantamento Terra (com halteres / kettlebell)", setsReps: "3 séries de 6-8 repetições", tips: "Mantenha a coluna neutra. Puxe o peso com as pernas e glúteos, não com as costas." },
                { name: "Remada Curvada (com halteres / barra)", setsReps: "4 séries de 6-8 repetições", tips: "Concentre-se na força da puxada e na contração das costas. Use uma pegada firme." },
                { name: "Desenvolvimento de Ombro (com halteres)", setsReps: "4 séries de 6-8 repetições", tips: "Movimento forte e controlado. Empurre o peso acima da cabeça. Core contraído." },
                { name: "Barra Fixa (com assistência ou máquina)", setsReps: "3 séries x Máx. Reps", tips: "Foco na amplitude completa de movimento. Sinta as costas e bíceps." },
                { name: "Paralelas (com assistência ou máquina)", setsReps: "3 séries x Máx. Reps", tips: "Desça até sentir um alongamento no peito. Use a força do tríceps e peito." }
            ],
            "perda-peso": [
                { name: "Circuito de Treinamento (30-40s por exercício, 15s descanso)", setsReps: "3-4 voltas", tips: "Mantenha o ritmo alto. Pouco descanso entre os exercícios para manter a frequência cardíaca elevada." },
                { name: "Burpees", setsReps: "Max repetições em 40s", tips: "Movimento completo e intenso. Foco na transição rápida entre as posições." },
                { name: "Swing com Kettlebell (ou halter)", setsReps: "3 séries de 15-20 repetições", tips: "Movimento do quadril, não dos braços. Explosão para cima. Sinta os glúteos." },
                { name: "Corrida/Pulo de Corda (intenso)", setsReps: "20-30 minutos (com variações de intensidade)", tips: "Alterne períodos de alta intensidade com descanso ativo. Queime mais calorias." },
                { name: "Afundo com Salto", setsReps: "3 séries de 10-12 repetições por perna", tips: "Movimento explosivo. Alterne as pernas no ar. Amortecimento suave na aterrissagem." },
                { name: "Remada Alta com Halteres", setsReps: "3 séries de 12-15 repetições", tips: "Puxe os halteres até a altura do queixo, cotovelos para cima. Foque nos ombros e trapézios." },
                { name: "Prancha com Elevação de Braço e Perna Alternada", setsReps: "3 séries de 10-12 repetições por lado", tips: "Mantenha o core estável. Não deixe o corpo balançar." }
            ],
            resistencia: [
                { name: "Circuito de Treinamento (45s por exercício, 15s descanso)", setsReps: "4-5 voltas", tips: "Mantenha a execução correta mesmo com a fadiga. Foque na resistência muscular e cardiovascular." },
                { name: "Polichinelos (alto volume)", setsReps: "3 séries de 60 segundos", tips: "Alta intensidade, foque na respiração constante e profunda. Mantenha o movimento fluido." },
                { name: "Agachamento Salto", setsReps: "3 séries de 12-15 repetições", tips: "Explosão na subida, amortecimento na descida. Priorize a continuidade e o ritmo." },
                { name: "Remada Invertida (barra baixa ou TRX)", setsReps: "3 séries de 15-20 repetições", tips: "Use o peso do corpo para puxar. Sinta as costas. Mantenha a prancha corporal." },
                { name: "Abdominal Bicicleta", setsReps: "3 séries de 20-30 repetições por lado", tips: "Toque o cotovelo no joelho oposto. Mantenha o ritmo e contraia o abdômen." },
                { name: "Flexão de Braço (regular)", setsReps: "3 séries de Máx. Repetições", tips: "Faça o máximo que conseguir com boa forma. Se precisar, use os joelhos no final." },
                { name: "Corrida (ritmo moderado)", setsReps: "30-45 minutos", tips: "Mantenha um ritmo que você possa sustentar por toda a duração. Foque na respiração." }
            ]
        },
        avancado: {
            hipertrofia: [
                { name: "Agachamento Completo (com barra)", setsReps: "4-5 séries de 6-10 repetições", tips: "Desça abaixo de 90 graus. Foco na tensão constante e no controle da descida." },
                { name: "Supino Reto (com barra)", setsReps: "4-5 séries de 6-10 repetições", tips: "Variações de pegada para diferentes ênfases no peito. Amplitude total de movimento." },
                { name: "Remada Cavalinho / Barra T", setsReps: "4 séries de 8-12 repetições", tips: "Foco na amplitude de movimento e contração máxima das costas. Puxe com força." },
                { name: "Desenvolvimento de Ombro (em pé com barra)", setsReps: "4 séries de 8-12 repetições", tips: "Empurre o peso para cima, controlando a descida. Sem impulso do corpo. Rigidez do core." },
                { name: "Rosca Scott (barra ou halteres)", setsReps: "3-4 séries de 8-12 repetições", tips: "Isolamento do bíceps. Mantenha a forma rigorosa e sinta a contração." },
                { name: "Tríceps Corda (na polia)", setsReps: "3-4 séries de 10-15 repetições", tips: "Force a extensão total e sinta o pico de contração no tríceps. Mantenha os cotovelos fixos." },
                { name: "Leg Press", setsReps: "4 séries de 10-15 repetições", tips: "Pés na plataforma: mais alto para glúteo, mais baixo para quadríceps. Profundidade controlada." },
                { name: "Cadeira Extensora / Flexora", setsReps: "3 séries de 12-15 repetições (bi-set opcional)", tips: "Foco na contração e alongamento máximo. Experimente um bi-set para intensidade." },
                { name: "Levantamento Terra Romeno (Halteres/Barra)", setsReps: "3-4 séries de 8-12 repetições", tips: "Foco na flexão de quadril, sentindo o alongamento do posterior da coxa. Coluna neutra." },
                { name: "Elevação Lateral Inclinado (Halteres)", setsReps: "3 séries de 12-15 repetições", tips: "Deite-se de lado em um banco inclinado para isolar o ombro. Movimento lento e controlado." }
            ],
            forca: [
                { name: "Agachamento Baixo (com barra)", setsReps: "5 séries de 3-5 repetições", tips: "Técnica impecável. Use um spotter se necessário. Foco na explosão e rigidez do core." },
                { name: "Supino Reto (com barra)", setsReps: "5 séries de 3-5 repetições", tips: "Foco na explosão e estabilidade. Mantenha os ombros travados para trás." },
                { name: "Levantamento Terra Clássico", setsReps: "3-4 séries de 3-5 repetições", tips: "Comece com peso leve para aquecimento. Priorize a forma e a progressão de carga controlada." },
                { name: "Remada Pendlay / Remada com Barra", setsReps: "4 séries de 5-8 repetições", tips: "Puxe até tocar o abdômen. Movimento explosivo e controlado. Mantenha a postura." },
                { name: "Desenvolvimento Militar (em pé)", setsReps: "4 séries de 5-8 repetições", tips: "Rigidez do core. Empurre a barra para cima e levemente para trás. Controle a descida." },
                { name: "Terra Sumô", setsReps: "3 séries de 3-5 repetições", tips: "Foco na força dos glúteos e adutores. Pés mais abertos, pontas para fora." },
                { name: "Press de Ombro com Halteres (sentado)", setsReps: "4 séries de 6-10 repetições", tips: "Estabilidade do tronco. Empurre os halteres acima da cabeça sem balançar." },
                { name: "Remada Unilateral com Haltere", setsReps: "4 séries de 6-8 repetições por braço", tips: "Puxe o haltere em direção ao quadril. Sinta a escápula. Foco na contração da dorsal." }
            ],
            "perda-peso": [
                { name: "Treino HIIT (High-Intensity Interval Training)", setsReps: "20-30 minutos (intervalos de 1:1 ou 1:2 trabalho:descanso)", tips: "Alterne entre exercícios intensos (sprint, burpees) e descanso ativo/passivo. Máximo esforço." },
                { name: "Circuitos Metabólicos Complexos", setsReps: "4-5 exercícios, 3-4 voltas, pouco descanso", tips: "Combine exercícios multiarticulares (ex: Agachamento Salto, Flexão, Burpee) para maximizar a queima calórica." },
                { name: "Sprints na esteira / ao ar livre", setsReps: "8-12 x 30s sprint / 60s descanso", tips: "Máxima velocidade nos sprints. Foco na recuperação rápida entre os tiros." },
                { name: "Box Jumps / Pular Corda (variado)", setsReps: "3 séries de 15-20 repetições / 10-15 min contínuos", tips: "Movimentos explosivos para elevar o metabolismo e a frequência cardíaca rapidamente." },
                { name: "Clean & Press (com halteres)", setsReps: "3 séries de 8-10 repetições", tips: "Movimento explosivo que trabalha o corpo todo. Comece leve e aprenda a técnica." },
                { name: "Thrusters (com halteres)", setsReps: "3 séries de 10-12 repetições", tips: "Combinação de agachamento frontal com desenvolvimento de ombro. Ótimo para cardio." },
                { name: "Remada Remador com Halteres (explosivo)", setsReps: "3 séries de 12-15 repetições", tips: "Puxe com força e controle a volta. Mantenha o abdômen contraído." }
            ],
            resistencia: [
                { name: "Treino em Circuito de Alta Repetição", setsReps: "5-6 exercícios, 4-5 voltas, 15-20 reps, 30s descanso", tips: "Foco na capacidade de manter a intensidade e a forma ao longo de muitas repetições e séries." },
                { name: "Corrida de Longa Duração", setsReps: "45-60 minutos", tips: "Mantenha um ritmo confortável, mas desafiador. Monitore a frequência cardíaca para otimizar a resistência." },
                { name: "Natação / Ciclismo (alto volume)", setsReps: "45-60 minutos", tips: "Atividades de baixo impacto para aumentar a resistência cardiovascular e muscular. Foco na duração." },
                { name: "Burpees / Kettlebell Swings (alto volume)", setsReps: "3-4 séries de 20-30 repetições", tips: "Exercícios que desafiam a resistência muscular e o sistema cardiovascular. Mantenha a forma." },
                { name: "Wall Ball Shots", setsReps: "3 séries de 15-20 repetições", tips: "Agachamento e arremesso de bola na parede. Movimento contínuo e intenso. Ótimo para resistência." },
                { name: "Remada na Máquina (alto volume)", setsReps: "4 séries de 20-25 repetições", tips: "Foco na cadência e na contração muscular. Mantenha o ritmo por um longo período." },
                { name: "Pulo de Corda (diferentes variações)", setsReps: "15-20 minutos contínuos", tips: "Varie os tipos de pulo para desafiar diferentes músculos e manter o interesse." }
            ]
        }
    };

    // Define a quantidade de exercícios por dia com base no nível
    const exercisesPerDay = {
        iniciante: { min: 3, max: 4 },
        intermediario: { min: 4, max: 5 },
        avancado: { min: 5, max: 6 }
    };

    const getDailyExercises = (level, objective, frequency) => {
        let availableExercises = [...(exercises[level][objective] || [])]; // Copia para não modificar o original
        
        // Garante que temos exercícios suficientes
        if (availableExercises.length < exercisesPerDay[level].max) {
            console.warn(`Aviso: Poucos exercícios disponíveis para o nível ${level} e objetivo ${objective}. Considere adicionar mais.`);
            // Repete exercícios se não houver o suficiente (solução temporária para o protótipo)
            while (availableExercises.length < exercisesPerDay[level].max * 2) {
                availableExercises = availableExercises.concat(exercises[level][objective] || []);
            }
        }

        const days = {};
        const numDays = parseInt(frequency); // Converte a frequência para número

        for (let i = 1; i <= numDays; i++) {
            const dayName = `Dia ${i}${numDays > 1 && numDays <= 4 ? String.fromCharCode(64 + i) : ''}`; // A, B, C, D
            const numExercisesForThisDay = Math.floor(Math.random() * (exercisesPerDay[level].max - exercisesPerDay[level].min + 1)) + exercisesPerDay[level].min;
            
            const selectedForDay = [];
            const tempAvailable = [...availableExercises]; // Copia para cada dia

            for (let j = 0; j < numExercisesForThisDay; j++) {
                if (tempAvailable.length === 0) {
                    console.warn("Todos os exercícios foram usados, reiniciando o pool para continuar.");
                    tempAvailable.push(...(exercises[level][objective] || [])); // Reabastece se acabar
                }
                const randomIndex = Math.floor(Math.random() * tempAvailable.length);
                selectedForDay.push(tempAvailable.splice(randomIndex, 1)[0]); // Remove do pool
            }
            days[dayName] = selectedForDay;
        }
        return days;
    };

    const showToast = (message, duration = 3000) => {
        notificationToast.textContent = message;
        notificationToast.classList.add('show');
        setTimeout(() => {
            notificationToast.classList.remove('show');
        }, duration);
    };

    const renderTrainingPlan = (level, objective, frequency, plan) => {
        summaryLevel.textContent = level.charAt(0).toUpperCase() + level.slice(1);
        summaryObjective.textContent = objective.charAt(0).toUpperCase() + objective.slice(1).replace('-', ' ');
        summaryFrequency.textContent = frequency;

        trainingPlanDiv.innerHTML = ''; // Limpa o conteúdo anterior

        for (const day in plan) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('training-day');
            dayDiv.innerHTML = `<h4>${day}</h4>`;
            
            const exerciseList = document.createElement('ol'); // Usar lista ordenada
            exerciseList.classList.add('exercise-list');

            plan[day].forEach(exercise => {
                const listItem = document.createElement('li');
                listItem.classList.add('exercise-item');
                listItem.innerHTML = `
                    <div class="exercise-content">
                        <h5>${exercise.name}</h5>
                        <p class="sets-reps">${exercise.setsReps}</p>
                        <p class="tips">Dica: ${exercise.tips}</p>
                    </div>
                    <button class="replace-exercise-btn" data-exercise-name="${exercise.name}" data-day="${day}" data-level="${level}" data-objective="${objective}">
                        <i class="fas fa-rotate"></i>
                    </button>
                `;
                exerciseList.appendChild(listItem);
            });
            dayDiv.appendChild(exerciseList);
            trainingPlanDiv.appendChild(dayDiv);
        }

        // Adiciona listeners para os botões de substituir
        document.querySelectorAll('.replace-exercise-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const currentExerciseName = event.currentTarget.dataset.exerciseName;
                const currentDay = event.currentTarget.dataset.day;
                const currentLevel = event.currentTarget.dataset.level;
                const currentObjective = event.currentTarget.dataset.objective;

                // Lógica para substituir o exercício (simplificada para o protótipo)
                const savedTrainings = JSON.parse(localStorage.getItem('gymRatsTrainings')) || [];
                const currentTrainingIndex = savedTrainings.findIndex(t => t.current === true);

                if (currentTrainingIndex !== -1) {
                    let currentTraining = savedTrainings[currentTrainingIndex];
                    let updatedPlan = currentTraining.plan;

                    const dayExercises = updatedPlan[currentDay];
                    const exerciseIndex = dayExercises.findIndex(ex => ex.name === currentExerciseName);

                    if (exerciseIndex !== -1) {
                        const allPossibleExercises = exercises[currentLevel][currentObjective];
                        // Filtra exercícios que não estão no dia atual
                        const availableAlternatives = allPossibleExercises.filter(
                            ex => !dayExercises.some(dEx => dEx.name === ex.name)
                        );
                        
                        let newExercise = null;
                        if (availableAlternatives.length > 0) {
                            newExercise = availableAlternatives[Math.floor(Math.random() * availableAlternatives.length)];
                        } else {
                            // Se não houver alternativas diferentes, pega qualquer um aleatório
                            newExercise = allPossibleExercises[Math.floor(Math.random() * allPossibleExercises.length)];
                        }

                        if (newExercise) {
                            updatedPlan[currentDay][exerciseIndex] = newExercise;
                            currentTraining.plan = updatedPlan;
                            
                            savedTrainings[currentTrainingIndex] = currentTraining;
                            localStorage.setItem('gymRatsTrainings', JSON.stringify(savedTrainings));
                            
                            renderTrainingPlan(currentLevel, currentObjective, currentTraining.frequency, updatedPlan);
                            showToast("Exercício substituído!");
                        } else {
                            showToast("Não foi possível encontrar uma alternativa.", 2000);
                        }
                    }
                }
            });
        });

        formSection.classList.add('hidden');
        outputSection.classList.remove('hidden');
    };

    // Evento de submissão do formulário
    trainingForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const level = document.getElementById('experience-level').value;
        const objective = document.querySelector('input[name="objective"]:checked').value;
        const frequency = document.getElementById('frequency').value;
        const equipment = document.querySelector('input[name="equipment"]:checked').value;
        const timePerSession = document.getElementById('time-per-session').value;

        const generatedPlan = getDailyExercises(level, objective, frequency);

        let savedTrainings = JSON.parse(localStorage.getItem('gymRatsTrainings')) || [];
        savedTrainings = savedTrainings.map(t => ({ ...t, current: false }));

        const currentTrainingData = {
            level,
            objective,
            frequency,
            equipment,
            timePerSession,
            plan: generatedPlan,
            dateGenerated: new Date().toISOString(),
            current: true
        };
        savedTrainings.push(currentTrainingData);
        localStorage.setItem('gymRatsTrainings', JSON.stringify(savedTrainings));
        
        renderTrainingPlan(level, objective, frequency, generatedPlan);
    });

    // Botão Salvar Treino
    saveTrainingBtn.addEventListener('click', () => {
        showToast("Treino salvo com sucesso no histórico!", 3000);
    });

    // Botão Gerar Novo Treino
    newTrainingBtn.addEventListener('click', () => {
        trainingForm.reset();
        outputSection.classList.add('hidden');
        formSection.classList.remove('hidden');
        showToast("Formulário limpo! Comece um novo treino.", 2000);
    });

    // Carregar o último treino salvo ao carregar a página
    const loadLastTraining = () => {
        const savedTrainings = JSON.parse(localStorage.getItem('gymRatsTrainings')) || [];
        const lastTraining = savedTrainings.find(t => t.current === true);
        if (lastTraining) {
            renderTrainingPlan(lastTraining.level, lastTraining.objective, lastTraining.frequency, lastTraining.plan);
        }
    };
    loadLastTraining();
});