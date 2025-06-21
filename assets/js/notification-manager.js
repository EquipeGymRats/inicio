// assets/js/notification-manager.js

import { api } from './apiService.js';

// Chave pública que o servidor usará para enviar notificações
const VAPID_PUBLIC_KEY = 'BGQteJ5nQk49unrs0ud7_bHMHUCLvnBNQj_i_jAZoZxCOxBRN-IQjDkL7prYdGC3_Vyu6LxsljMGcQrtVMQIziY'; // <<< SUBSTITUA PELA SUA CHAVE PÚBLICA

// Função para converter a chave VAPID para o formato correto
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Registra o Service Worker e inscreve o usuário nas notificações Push.
 */
export async function registerAndSubscribe() {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    const isSecureContext = window.location.protocol === 'https:';

    if (!isSupported || !isSecureContext) {
        // alert('Push messaging não é suportado ou o ambiente não é seguro.');
        const banner = document.getElementById('notification-unsupported-banner');
        if (banner) {
            banner.classList.add('show');
        }
        return;
    }

    try {
        // <<< CORREÇÃO PRINCIPAL AQUI >>>
        // Adicionamos o caminho do repositório '/inicio/' ao registro do Service Worker.
        const registration = await navigator.serviceWorker.register('/inicio/sw.js');
        console.log('Service Worker registrado com sucesso:', registration);

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            alert('Permissão para notificações negada.');
            return;
        }

        let subscription = await registration.pushManager.getSubscription();
        if (subscription === null) {
            console.log('Nenhuma inscrição encontrada, criando uma nova...');
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            console.log('Nova inscrição criada:', subscription);

            await api.savePushSubscription(subscription);
            console.log('Inscrição salva no backend.');
        } else {
            console.log('Usuário já está inscrito.');
        }

    } catch (error) {
        console.error('Falha ao registrar/inscrever no Service Worker:', error);
    }
}