// assets/js/dashboard/settings.js

import { authService } from '../auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // Seleciona os elementos do formulário
    const form = document.getElementById('settings-form');
    const profilePicPreview = document.getElementById('profile-picture-preview');
    const profilePicInput = document.getElementById('profile-picture-input');
    const usernameInput = document.getElementById('username-input');
    const emailInput = document.getElementById('email-input');
    const weightInput = document.getElementById('weight-input');
    const heightInput = document.getElementById('height-input');
    const objectiveSelect = document.getElementById('objective-select');
    const experienceSelect = document.getElementById('experience-select');
    const saveButton = document.getElementById('save-button');
    const feedbackDiv = document.getElementById('form-feedback');

    // Função para carregar e preencher os dados do usuário no formulário
    async function populateForm() {
        try {
            const user = await authService.getUserProfile();
            if (user) {
                profilePicPreview.src = user.profilePicture || 'https://placehold.co/150x150';
                usernameInput.value = user.username || '';
                emailInput.value = user.email || '';
                weightInput.value = user.weight || '';
                heightInput.value = user.height || '';
                objectiveSelect.value = user.mainObjective || 'hipertrofia muscular';
                experienceSelect.value = user.experienceLevel || 'iniciante';
            }
        } catch (error) {
            console.error('Erro ao carregar dados do perfil:', error);
            feedbackDiv.textContent = 'Erro ao carregar seus dados.';
            feedbackDiv.className = 'feedback-message error';
        }
    }

    // Função para mostrar preview da nova imagem selecionada
    profilePicInput.addEventListener('change', () => {
        const file = profilePicInput.files[0];
        if (file) {
            profilePicPreview.src = URL.createObjectURL(file);
        }
    });

    // Função para lidar com o envio do formulário
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        saveButton.disabled = true;
        saveButton.textContent = 'Salvando...';
        feedbackDiv.textContent = '';
        feedbackDiv.className = 'feedback-message';

        const formData = new FormData(form);

        try {
            // <<< CORREÇÃO NA LÓGICA DE TRATAMENTO DA RESPOSTA >>>
            const response = await authService.updateUserProfile(formData);
            
            if (response.success) {
                feedbackDiv.textContent = response.message;
                feedbackDiv.className = 'feedback-message success';

                // A resposta de sucesso agora contém o usuário atualizado
                const updatedUser = response.user;
                // Atualiza o cache do perfil no localStorage
                localStorage.setItem('userProfile', JSON.stringify(updatedUser));
                
                // Atualiza a imagem de preview para a imagem definitiva vinda do Cloudinary
                if (updatedUser.profilePicture) {
                    profilePicPreview.src = updatedUser.profilePicture;
                }

                setTimeout(() => { feedbackDiv.textContent = ''; }, 3000);
            } else {
                // Se a API retornar sucesso: false, joga um erro para o bloco catch
                throw new Error(response.message);
            }

        } catch (error) {
            console.error('Erro ao atualizar o perfil:', error);
            feedbackDiv.textContent = error.message || 'Não foi possível salvar as alterações.';
            feedbackDiv.className = 'feedback-message error';
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Salvar Alterações';
        }
    });

    // Carrega os dados do usuário quando a página é aberta
    populateForm();
});