// assets/js/auth.js

const BASE_URL = 'https://api-gym-cyan.vercel.app'; // Sua Base URL do backend

export const authService = {
    async register(username, email, password) {
        try {
            const response = await fetch(`${BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('jwtToken', data.token);
                return { success: true, message: data.message || 'Conta criada e logado com sucesso!' };
            } else {
                return { success: false, message: data.message || 'Erro ao criar conta.' };
            }
        } catch (error) {
            console.error('Erro de rede ao registrar:', error);
            return { success: false, message: 'Erro de conexão. Verifique sua rede.' };
        }
    },

     async loginWithGoogle(googleToken) {
        try {
            const response = await fetch(`${BASE_URL}/auth/google-signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: googleToken }),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('jwtToken', data.token);
                return { success: true, message: 'Login com Google bem-sucedido!' };
            } else {
                return { success: false, message: data.message || 'Falha no login com Google.' };
            }
        } catch (error) {
            console.error('Erro de rede no login com Google:', error);
            return { success: false, message: 'Erro de conexão.' };
        }
    },

    async login(email, password) {
        try {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('jwtToken', data.token);
                return { success: true, message: data.message || 'Login realizado com sucesso!' };
            } else {
                return { success: false, message: data.message || 'Credenciais inválidas.' };
            }
        } catch (error) {
            console.error('Erro de rede ao fazer login:', error);
            return { success: false, message: 'Erro de conexão. Verifique sua rede.' };
        }
    },

    logout() {
        localStorage.removeItem('jwtToken');
        window.location.href = '/login.html'; // Redireciona ao deslogar
    },

    isLoggedIn() {
        return !!localStorage.getItem('jwtToken');
    },

    async getUserProfile() {
        const token = this.getToken();
        if (!token) return null;
        try {
            const response = await fetch(`${BASE_URL}/auth/profile`, {
                method: 'GET',
                headers: { 'x-auth-token': token, 'Content-Type': 'application/json' },
            });
            if (response.ok) {
                return await response.json();
            } else {
                this.logout();
                return null;
            }
        } catch (error) {
            console.error('Erro de rede ao buscar perfil:', error);
            return null;
        }
    },
    
    getToken() {
        return localStorage.getItem('jwtToken');
    },

    // ==================================================================
    // <<< FUNÇÃO QUE FALTAVA, ADICIONADA AQUI CORRETAMENTE >>>
    // ==================================================================
    async updateUserProfile(formData) {
        const token = this.getToken();
        if (!token) {
            return { success: false, message: 'Usuário não autenticado.' };
        }

        try {
            // Ao enviar FormData, não definimos o 'Content-Type'. O navegador faz isso.
            const response = await fetch(`${BASE_URL}/auth/profile`, {
                method: 'PUT',
                headers: { 'x-auth-token': token },
                body: formData,
            });

            const data = await response.json();
            
            if (response.ok) {
                // Retorna o objeto de sucesso com a mensagem e o usuário atualizado
                return { success: true, message: data.message || 'Perfil atualizado!', user: data };
            } else {
                return { success: false, message: data.message || 'Erro ao atualizar perfil.' };
            }
        } catch (error) {
            console.error('Erro de rede ao atualizar perfil:', error);
            return { success: false, message: 'Erro de conexão.' };
        }
    }
};