import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../api/client';
import type { User } from '../types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const loading = ref(false);

  const isAuthenticated = computed(() => user.value !== null);

  async function checkAuth() {
    try {
      const response = await api.getMe();
      user.value = response.user;
    } catch {
      user.value = null;
    }
  }

  async function login(email: string, password: string) {
    loading.value = true;
    try {
      const response = await api.login(email, password);
      user.value = response.user;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    await api.logout();
    user.value = null;
  }

  async function register(email: string, password: string, name?: string) {
    loading.value = true;
    try {
      await api.register(email, password, name);
    } finally {
      loading.value = false;
    }
  }

  return { user, loading, isAuthenticated, checkAuth, login, logout, register };
});
