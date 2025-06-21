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
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push messaging is not supported');
        alert('Seu navegador não suporta notificações push.');
        return;
    }

    try {
        // 1. Registra o Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registrado com sucesso:', registration);

        // 2. Pede permissão para notificações
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('Permissão para notificações negada.');
            alert('Você precisa permitir notificações para receber lembretes.');
            return;
        }

        // 3. Obtém a inscrição (subscription)
        let subscription = await registration.pushManager.getSubscription();
        if (subscription === null) {
            console.log('Nenhuma inscrição encontrada, criando uma nova...');
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            console.log('Nova inscrição criada:', subscription);

            // 4. Envia a nova inscrição para o backend
            await api.savePushSubscription(subscription);
            console.log('Inscrição salva no backend.');
        } else {
            console.log('Usuário já está inscrito.');
            alert('Você já está inscrito para receber notificações.');
        }

    } catch (error) {
        console.error('Falha ao registrar/inscrever no Service Worker:', error);
    }
}