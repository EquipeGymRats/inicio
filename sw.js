// sw.js

console.log('Service Worker carregado.');

// Evento 'push' é disparado quando o servidor envia uma notificação
self.addEventListener('push', event => {
    console.log('[Service Worker] Push Recebido.');
    
    // O backend envia os dados da notificação como texto JSON
    const data = event.data.json();
    console.log('[Service Worker] Dados do Push:', data);

    const title = data.title || 'Gym Rats';
    const options = {
        body: data.body,
        icon: 'assets/logo.ico', // Caminho para o seu ícone
        badge: 'assets/logo.ico', // Ícone para Android
        vibrate: [200, 100, 200] // Padrão de vibração
    };

    // Exibe a notificação
    event.waitUntil(self.registration.showNotification(title, options));
});

// Opcional: clique na notificação abre o site
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('https://equipegymrats.github.io/inicio/reminders.html') // Substitua pelo link do seu site
    );
});