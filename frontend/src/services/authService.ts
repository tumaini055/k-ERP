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

  async requestPasswordReset(email: string): Promise<any> {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },

  async getPasswordRequests(): Promise<{ data: any[] }> {
    const { data } = await api.get('/auth/password-requests');
    return data;
  },

  async adminResetPassword(user_id: string, new_password: string, request_id?: string, is_temporary?: boolean): Promise<any> {
    const { data } = await api.post('/auth/reset-password', { user_id, new_password, request_id, is_temporary });
    return data;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
};
