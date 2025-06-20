// assets/js/dashboard.js
import { initHomePage } from './dashboard/home.js'; // <-- ADICIONADO: Importa a lógica da Home

document.addEventListener('DOMContentLoaded', () => {
    // Seletores de elementos
    const pageContent = document.getElementById('page-content');
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');

    // Função para carregar o conteúdo da página
    function loadPage(pageId) {
        navItems.forEach(item => item.classList.remove('active'));
        const activeNavItem = document.querySelector(`.nav-item[href="#${pageId}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        const template = document.getElementById(`${pageId}-template`);
        if (template) {
            const contentWrapper = document.createElement('div');
            // Adiciona a classe que tem a animação de fade-in
            contentWrapper.classList.add('page-content-wrapper'); 
            
            const clonedTemplate = template.content.cloneNode(true);
            contentWrapper.appendChild(clonedTemplate);
            
            pageContent.innerHTML = '';
            pageContent.appendChild(menuToggle);
            pageContent.appendChild(contentWrapper);

            // <-- ADICIONADO: Executa o script específico da página carregada -->
            switch(pageId) {
                case 'home':
                    initHomePage();
                    break;
                // Futuramente, adicionaremos os outros casos:
                // case 'treino':
                //     initTreinoPage();
                //     break;
            }

        } else {
            pageContent.innerHTML = '<h2>Página não encontrada</h2>';
            console.error(`Template com ID "${pageId}-template" não foi encontrado.`);
        }
    }
    
    // Função unificada para abrir/fechar a sidebar
    function toggleSidebar() {
        const isVisible = sidebar.classList.toggle('visible');
        overlay.classList.toggle('visible');
        menuToggle.classList.toggle('is-active');

        if (isVisible) {
            menuToggle.innerHTML = '<i class="fas fa-times"></i>';
            menuToggle.setAttribute('aria-label', 'Fechar menu');
        } else {
            menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
            menuToggle.setAttribute('aria-label', 'Abrir menu');
        }
    }

    // Função explícita para fechar, para ser usada pelo overlay e links
    function closeSidebar() {
        if (sidebar.classList.contains('visible')) {
            sidebar.classList.remove('visible');
            overlay.classList.remove('visible');
            menuToggle.classList.remove('is-active');
            menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
            menuToggle.setAttribute('aria-label', 'Abrir menu');
        }
    }

    // Função para lidar com o clique na navegação
    function handleNavigation(event) {
        event.preventDefault();
        const pageId = event.currentTarget.getAttribute('href').substring(1);
        
        if (window.location.hash !== `#${pageId}`) {
            window.history.pushState(null, '', `#${pageId}`);
        }
        
        loadPage(pageId);
        closeSidebar(); // Fecha a sidebar ao navegar
    }

    // Adiciona listeners de evento
    navItems.forEach(item => item.addEventListener('click', handleNavigation));
    menuToggle.addEventListener('click', toggleSidebar); // Botão agora usa a função toggle
    overlay.addEventListener('click', closeSidebar); // Overlay sempre fecha

    // Carregamento inicial da página
    function initialLoad() {
        const initialPage = window.location.hash.substring(1) || 'home';
        loadPage(initialPage);
    }
    
    window.addEventListener('popstate', initialLoad);
    initialLoad();
});