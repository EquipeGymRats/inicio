// Função para adicionar um delay antes de iniciar as animações
document.addEventListener('DOMContentLoaded', () => {
    // Smooth scroll para a seção de funcionalidades (já estava no HTML, movi para o JS)
    document.querySelector('.scroll-down').addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });

    // Animação de entrada para elementos da seção Hero
    const heroTitle = document.querySelector('.hero-content h2');
    const heroParagraph = document.querySelector('.hero-content p');
    const heroButton = document.querySelector('.hero-content .btn');

    // Adiciona classes para as animações após um pequeno delay
    setTimeout(() => {
        heroTitle.classList.add('fade-in-up');
        heroParagraph.classList.add('fade-in-up', 'delay-0-3s'); // Atraso para aparecer depois do título
        heroButton.classList.add('fade-in-up', 'delay-0-6s'); // Atraso para aparecer depois do parágrafo
    }, 500); // Inicia as animações 500ms depois que a página carrega

    // Animação dos botões de funcionalidade ao rolar a página
    const featureButtons = document.querySelectorAll('.feature-btn');

    const observerOptions = {
        root: null, // Observa a viewport
        rootMargin: '0px',
        threshold: 0.2 // A animação dispara quando 20% do item está visível
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scale-in'); // Adiciona a classe de animação
                observer.unobserve(entry.target); // Para de observar depois de animar
            }
        });
    }, observerOptions);

    featureButtons.forEach(button => {
        observer.observe(button); // Começa a observar cada botão
    });

    // Animação do logo ao carregar a página (opcional, um pequeno "pulso")
    const logo = document.querySelector('.logo');
    logo.classList.add('pulse'); // Adiciona a classe de pulso ao carregar

    // Remover a classe 'pulse' após a animação para não repetir
    logo.addEventListener('animationend', () => {
        logo.classList.remove('pulse');
    }, { once: true }); // Garante que o evento seja removido após uma execução
});