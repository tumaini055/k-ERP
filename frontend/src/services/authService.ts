import api from '../lib/api';
import { User } from '../types';

interface LoginResponse {
  token: string;
  user: User;
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  async register(userData: Partial<User> & { password: string }): Promise<any> {
    const { data } = await api.post('/auth/register', userData);
    return data;
  },

  async getMe(): Promise<{ user: User }> {
    const { data } = await api.get('/auth/me');
    return data;
  },

  async updateProfile(profileData: Partial<User>): Promise<{ user: User }> {
    const { data } = await api.put('/auth/profile', profileData);
    return data;
  },

  async changePassword(current_password: string, new_password: string): Promise<any> {
    const { data } = await api.put('/auth/change-password', { current_password, new_password });
    return data;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
};
