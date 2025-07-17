// assets/js/dashboard/sidebar.js

import { api } from '../apiService.js'; // Importa o serviço de API

document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica da Sidebar (Toggle) ---
    const sidebar = document.getElementById('sidebar');
    const toggleDesktop = document.getElementById('sidebar-toggle-desktop');
    const toggleMobile = document.getElementById('sidebar-toggle-mobile');

    toggleDesktop?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
    toggleMobile?.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });

    document.querySelector('.main-header .sidebar-toggle-desktop')?.addEventListener('click', (e) => {
        // Para telas menores, onde o botão do header abre a sidebar
        if (window.innerWidth < 992) {
            sidebar.classList.add('open');
        }
    });

    // --- Lógica do Dropdown de Notificação ---
    const notificationBtn = document.getElementById('notification-btn');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const notificationList = document.getElementById('notification-list');
    const notificationBadge = document.querySelector('.notification-badge');
    const markAllReadLink = document.getElementById('mark-all-read-link');

    // Função para buscar e renderizar notificações
    const fetchAndRenderNotifications = async () => {
        try {
            const notifications = await api.getNotifications();
            renderNotifications(notifications);
        } catch (error) {
            console.error('Erro ao buscar notificações:', error);
            if (notificationList) {
                notificationList.innerHTML = '<p class="error-msg" style="padding: 1rem; text-align: center;">Erro ao carregar.</p>';
            }
        }
    };

    // Função para renderizar as notificações no dropdown
    const renderNotifications = (notifications) => {
        if (!notificationList) return;

        if (notifications.length === 0) {
            notificationList.innerHTML = '<p class="info-msg" style="padding: 1rem; text-align: center;">Nenhuma notificação nova.</p>';
            notificationBadge.style.display = 'none';
            return;
        }

        notificationList.innerHTML = notifications.map(createNotificationHtml).join('');
        const unreadCount = notifications.filter(n => !n.read).length;
        
        if (unreadCount > 0) {
            notificationBadge.textContent = unreadCount;
            notificationBadge.style.display = 'flex';
        } else {
            notificationBadge.style.display = 'none';
        }
    };

    // Função para criar o HTML de um item de notificação
    const createNotificationHtml = (notification) => {
        const isUnreadClass = notification.read ? '' : 'unread';
        let message = '';
        let commentSnippet = '';

        if (notification.type === 'like') {
            message = `<strong>${notification.sender.username}</strong> curtiu seu post.`;
        } else if (notification.type === 'comment') {
            message = `<strong>${notification.sender.username}</strong> comentou no seu post:`;
            commentSnippet = `<span class="comment-snippet">"${notification.commentText}..."</span>`;
        }

        return `
            <div class="notification-item ${isUnreadClass}" data-post-id="${notification.post}">
                <img src="${notification.sender.profilePicture}" alt="Avatar" class="notification-avatar">
                <div class="notification-text">
                    <p>${message}</p>
                    ${commentSnippet}
                </div>
            </div>
        `;
    };

    // Abre/Fecha o dropdown
    notificationBtn?.addEventListener('click', (e) => {
        e.stopPropagation(); // Impede que o clique feche o dropdown imediatamente
        const isVisible = notificationDropdown.classList.toggle('show');
        if (isVisible) {
            fetchAndRenderNotifications();
        }
    });

    // Marca todas como lidas
    markAllReadLink?.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await api.markAllNotificationsAsRead();
            fetchAndRenderNotifications(); // Atualiza a lista
        } catch (error) {
            console.error('Erro ao marcar notificações como lidas:', error);
        }
    });
    
    // Fecha o dropdown se clicar fora
    window.addEventListener('click', (e) => {
        if (notificationDropdown && !notificationDropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
            notificationDropdown.classList.remove('show');
        }
    });
});