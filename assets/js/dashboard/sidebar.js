/**
 * sidebar.js
 * * Gerencia o comportamento da sidebar, como o toggle em telas móveis.
 */

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleMobileBtn = document.getElementById('sidebar-toggle-mobile');
    const toggleDesktopBtn = document.getElementById('sidebar-toggle-desktop');

    if (!sidebar || !toggleMobileBtn || !toggleDesktopBtn) {
        console.error('Elementos da sidebar não encontrados.');
        return;
    }

    // Função para abrir/fechar a sidebar
    const toggleSidebar = () => {
        sidebar.classList.toggle('open');
        // Adicionar um overlay no main content quando a sidebar estiver aberta em mobile
    };

    // Event listeners para os botões de toggle
    toggleMobileBtn.addEventListener('click', toggleSidebar);
    toggleDesktopBtn.addEventListener('click', toggleSidebar);

    // Fechar a sidebar se clicar fora dela em modo mobile
    document.addEventListener('click', (event) => {
        const isMobile = window.innerWidth <= 768;
        if (isMobile && sidebar.classList.contains('open')) {
            // Se o clique não foi na sidebar nem no botão que a abre
            if (!sidebar.contains(event.target) && !toggleDesktopBtn.contains(event.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Gerenciar link ativo
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const currentPath = window.location.pathname.split('/').pop() || 'home.html';

    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href').split('/').pop();
        if (linkPath === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});
