// assets/js/auth.js

const BASE_URL = 'https://api-gym-cyan.vercel.app'; // Sua Base URL do backend

export const authService = {
    async register(username, email, password) {
        try {
            const response = await fetch(`${BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('jwtToken', data.token);
                // Não salvamos mais o username no localStorage aqui!
                return { success: true, message: data.message || 'Conta criada e logado com sucesso!' };
            } else {
                return { success: false, message: data.message || 'Erro ao criar conta.' };
            }
        } catch (error) {
            console.error('Erro de rede ao registrar:', error);
            return { success: false, message: 'Erro de conexão. Verifique sua rede.' };
        }
    },

    async login(email, password) {
        try {
            const response = await fetch(`${BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('jwtToken', data.token);
                // Não salvamos mais o username no localStorage aqui!
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
        // Removemos o userName também, embora ele não seja salvo diretamente
        localStorage.removeItem('userName'); 
    },

    isLoggedIn() {
        return !!localStorage.getItem('jwtToken');
    },

    // Nova função para buscar o perfil do usuário do backend
    async getUserProfile() {
        const token = this.getToken();
        if (!token) {
            return null; // Não há token, não pode buscar o perfil
        }

        try {
            const response = await fetch(`${BASE_URL}/api/auth/profile`, {
                method: 'GET',
                headers: {
                    'x-auth-token': token, // Envia o token no cabeçalho
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const userProfile = await response.json();
                return userProfile; // Retorna o objeto de perfil (id, username, email)
            } else if (response.status === 401 || response.status === 403) {
                // Token inválido ou expirado, faz logout
                this.logout();
                console.warn('Token expirado ou inválido. Realizando logout.');
                return null;
            } else {
                console.error('Erro ao buscar perfil do usuário:', await response.text());
                return null;
            }
        } catch (error) {
            console.error('Erro de rede ao buscar perfil:', error);
            return null;
        }
    },

    // A função getUserName agora busca do perfil, não do localStorage diretamente
    // Pode ser síncrona se apenas precisar do que está no localStorage
    // Mas para ser consistente com a nova abordagem, a chamaremos de profile.username
    // Se quiser o username diretamente, chame getUserProfile().username
    async getUserName() {
        const profile = await this.getUserProfile();
        return profile ? profile.username : null; // Retorna o username do perfil ou null se não houver perfil
    },
    
    getToken() {
        return localStorage.getItem('jwtToken');
    }
};