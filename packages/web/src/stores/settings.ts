import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TimeRange } from '../types';

export const useSettingsStore = defineStore('settings', () => {
  const defaultTimeRange = ref<TimeRange>('1h');
  const autoRefreshEnabled = ref(false);
  const autoRefreshInterval = ref(30); // seconds
  const sidebarCollapsed = ref(false);
  const theme = ref<'light' | 'dark'>('light');

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  function setTimeRange(range: TimeRange) {
    defaultTimeRange.value = range;
  }

  function toggleAutoRefresh() {
    autoRefreshEnabled.value = !autoRefreshEnabled.value;
  }

  function setTheme(newTheme: 'light' | 'dark') {
    theme.value = newTheme;
    document.documentElement.setAttribute('data-theme', newTheme);
  }

  return {
    defaultTimeRange,
    autoRefreshEnabled,
    autoRefreshInterval,
    sidebarCollapsed,
    theme,
    toggleSidebar,
    setTimeRange,
    toggleAutoRefresh,
    setTheme,
  };
});
