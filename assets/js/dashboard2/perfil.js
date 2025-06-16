// assets/js/perfil.js
import { authService } from '../auth.js';
import { api } from './apiService.js';

// Função principal que será exportada e chamada pelo dashboard
export async function initPerfilPage() {
    const form = document.getElementById('profile-form');
    if (!form) return;

    // Seletores dos elementos do formulário
    const preview = document.getElementById('profile-pic-preview');
    const input = document.getElementById('profile-pic-input');
    const usernameEl = document.getElementById('profile-username');
    const emailEl = document.getElementById('profile-email');
    const weightEl = document.getElementById('profile-weight');
    const heightEl = document.getElementById('profile-height');
    const experienceEl = document.getElementById('profile-experience');
    const objectiveEl = document.getElementById('profile-objective');
    const saveBtn = document.getElementById('save-profile-btn');
    const btnText = saveBtn.querySelector('.btn-text');
    const btnSpinner = saveBtn.querySelector('.spinner');

    // Função para preencher o formulário com dados do usuário
    const populateForm = (profile) => {
        if (preview) preview.src = profile.profilePicture || 'assets/images/levels/default-level.png';
        if (usernameEl) usernameEl.value = profile.username || '';
        if (emailEl) emailEl.value = profile.email || '';
        if (weightEl) weightEl.value = profile.weight || '';
        if (heightEl) heightEl.value = profile.height || '';
        if (experienceEl) experienceEl.value = profile.experienceLevel || 'Iniciante';
        if (objectiveEl) objectiveEl.value = profile.mainObjective || 'Saúde e Bem-estar';
    };

    // Função para mostrar preview da imagem selecionada
    const handleImagePreview = () => {
        const file = input.files[0];
        if (file) {
            preview.src = URL.createObjectURL(file);
        }
    };

    // Função para lidar com o envio do formulário
    const handleProfileUpdate = async (event) => {
        event.preventDefault();
        
        btnText.style.display = 'none';
        btnSpinner.style.display = 'block';
        saveBtn.disabled = true;

        // FormData é essencial para enviar arquivos e texto juntos
        const formData = new FormData();
        formData.append('username', usernameEl.value);
        formData.append('weight', weightEl.value);
        formData.append('height', heightEl.value);
        formData.append('experienceLevel', experienceEl.value);
        formData.append('mainObjective', objectiveEl.value);

        if (input.files[0]) {
            formData.append('profilePicture', input.files[0]);
        }

        try {
            const updatedProfile = await api.updateProfile(formData);
            alert('Perfil atualizado com sucesso!');
            // Opcional: atualizar dados em cache no dashboard ou recarregar
            populateForm(updatedProfile); // Atualiza o formulário com os novos dados retornados
        } catch (error) {
            alert(`Erro ao atualizar perfil: ${error.message}`);
        } finally {
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
            saveBtn.disabled = false;
        }
    };

    // Adiciona os listeners de eventos
    input.addEventListener('change', handleImagePreview);
    form.addEventListener('submit', handleProfileUpdate);

    // Busca os dados iniciais e preenche o formulário
    try {
        const profile = await authService.getUserProfile();
        populateForm(profile);
    } catch (error) {
        alert('Não foi possível carregar os dados do seu perfil.');
    }
}