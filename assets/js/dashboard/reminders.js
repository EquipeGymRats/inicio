// assets/js/dashboard/reminders.js

import { api } from '../apiService.js';

// <<< MUDANÇA ESTRUTURAL: GARANTE QUE TODO O CÓDIGO SÓ RODE QUANDO A PÁGINA ESTIVER PRONTA >>>
document.addEventListener('DOMContentLoaded', () => {

    // --- SELEÇÃO DOS ELEMENTOS DO DOM ---
    const form = document.getElementById('reminder-form');
    const daysSelector = document.getElementById('reminder-days');
    const listContainer = document.getElementById('reminders-list');
    const suggestionPillsContainer = document.querySelector('.suggestion-pills');
    const messageInput = document.getElementById('reminder-message');
    const timeInput = document.getElementById('reminder-time');

    // Validação para garantir que estamos na página correta
    if (!form || !daysSelector || !listContainer || !suggestionPillsContainer) {
        // Se os elementos não existirem, não faz nada. Isso evita erros em outras páginas.
        return; 
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO E DADOS ---

    function renderReminders(reminders) {
        listContainer.innerHTML = '';
        if (reminders.length === 0) {
            listContainer.innerHTML = '<p class="empty-list-message">Você ainda não tem lembretes.</p>';
            return;
        }

        reminders.forEach(reminder => {
            const item = document.createElement('div');
            item.className = 'reminder-item';
            item.dataset.id = reminder._id;

            // Badge de status
            const badgeClass = reminder.isActive ? 'reminder-badge active' : 'reminder-badge inactive';
            const badgeText = reminder.isActive ? 'Ativo' : 'Inativo';

            item.innerHTML = `
                <div class="reminder-info">
                    <i class="fas fa-bell"></i>
                    <div>
                        <strong>${reminder.message} <span class="${badgeClass}">${badgeText}</span></strong>
                        <span>${reminder.time} - ${reminder.days.join(', ')}</span>
                    </div>
                </div>
                <div class="reminder-actions">
                    <button class="btn-toggle-status" data-active="${reminder.isActive}" title="${reminder.isActive ? 'Desativar lembrete' : 'Ativar lembrete'}">
                        <i class="fa-solid fa-power-off"></i>
                    </button>
                    <button class="btn-delete" title="Excluir lembrete"><i class="fas fa-trash"></i></button>
                </div>
            `;
            listContainer.appendChild(item);
        });
    }

    async function loadReminders() {
        try {
            const reminders = await api.getReminders();
            renderReminders(reminders);
        } catch (error) {
            console.error("Erro ao carregar lembretes:", error);
            listContainer.innerHTML = '<p class="empty-list-message">Não foi possível carregar os lembretes.</p>';
        }
    }

    // --- EVENT LISTENERS (AGORA FUNCIONARÃO) ---

    // Lógica para as sugestões rápidas
    suggestionPillsContainer.addEventListener('click', e => {
        if (e.target.classList.contains('pill-btn')) {
            messageInput.value = e.target.dataset.message;
            timeInput.focus();
        }
    });

    // Lógica para selecionar os dias da semana
    daysSelector.addEventListener('click', e => {
        if (e.target.tagName === 'SPAN') {
            e.target.classList.toggle('selected');
        }
    });

    // Lógica para criar um novo lembrete
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const createButton = document.getElementById('create-reminder-btn');
        const selectedDays = [...daysSelector.querySelectorAll('.selected')].map(el => el.dataset.day);
        
        if (selectedDays.length === 0) {
            console.log('Selecione pelo menos um dia da semana para o lembrete.');
            return;
        }

        const newReminder = {
            message: messageInput.value,
            time: timeInput.value,
            days: selectedDays,
            type: 'custom',
        };

        createButton.disabled = true;
        createButton.textContent = 'Criando...';

        try {
            await api.createReminder(newReminder);
            form.reset();
            daysSelector.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            await loadReminders();
        } catch (error) {
            console.log(`Erro ao criar lembrete: ${error.message}`);
        } finally {
            createButton.disabled = false;
            createButton.textContent = 'Criar Lembrete';
        }
    });
    
    // Lógica para deletar ou ativar/desativar lembretes
    listContainer.addEventListener('click', async e => {
        const reminderItem = e.target.closest('.reminder-item');
        if (!reminderItem) return;

        const id = reminderItem.dataset.id;
        
        if (e.target.closest('.btn-delete')) {
            if (confirm('Tem certeza que deseja deletar este lembrete?')) {
                await api.deleteReminder(id);
                await loadReminders();
            }
        } else if (e.target.closest('.btn-toggle-status')) {
            const currentStatus = e.target.dataset.active === 'true';
            await api.updateReminder(id, { isActive: !currentStatus });
            await loadReminders();
        }
    });

    // --- INICIALIZAÇÃO DA PÁGINA ---
    loadReminders();
});