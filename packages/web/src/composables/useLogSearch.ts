import { ref, reactive } from 'vue';
import { api } from '../api/client';
import type { LogEntry, LogLevel } from '../types';

export function useLogSearch() {
  const logs = ref<LogEntry[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const filters = reactive({
    query: '',
    level: null as LogLevel | null,
    source: '',
    from: '',
    to: '',
    limit: 50,
    offset: 0,
  });

  async function search() {
    loading.value = true;
    error.value = null;

    try {
      const params: Record<string, string> = {};

      if (filters.query) params.q = filters.query;
      if (filters.level) params.level = filters.level;
      if (filters.source) params.source = filters.source;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      params.limit = filters.limit.toString();
      params.offset = filters.offset.toString();

      const result = await api.searchLogs(params);
      logs.value = result.logs as LogEntry[];
      total.value = result.total;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Search failed';
    } finally {
      loading.value = false;
    }
  }

  function nextPage() {
    if (filters.offset + filters.limit < total.value) {
      filters.offset += filters.limit;
      search();
    }
  }

  function prevPage() {
    if (filters.offset > 0) {
      filters.offset = Math.max(0, filters.offset - filters.limit);
      search();
    }
  }

  function resetFilters() {
    filters.query = '';
    filters.level = null;
    filters.source = '';
    filters.from = '';
    filters.to = '';
    filters.offset = 0;
  }

  return {
    logs,
    total,
    loading,
    error,
    filters,
    search,
    nextPage,
    prevPage,
    resetFilters,
  };
}
