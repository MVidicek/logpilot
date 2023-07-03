<script setup lang="ts">
import { onMounted, watch } from 'vue';
import SearchBar from '../components/SearchBar.vue';
import TimeRangePicker from '../components/TimeRangePicker.vue';
import LogTable from '../components/LogTable.vue';
import { useLogSearch } from '../composables/useLogSearch';
import { useTimeRange } from '../composables/useTimeRange';
import type { TimeRange } from '../types';

const { logs, total, loading, error, filters, search, nextPage, prevPage } = useLogSearch();
const timeRange = useTimeRange('1h');

function doSearch() {
  filters.from = timeRange.fromDate.value.toISOString();
  filters.to = timeRange.toDate.value.toISOString();
  filters.offset = 0;
  search();
}

function onTimeRangeChange() {
  doSearch();
}

watch(() => timeRange.selected.value, () => {
  onTimeRangeChange();
});

onMounted(() => {
  doSearch();
});

const currentPage = $computed(() => Math.floor(filters.offset / filters.limit) + 1);
const totalPages = $computed(() => Math.ceil(total.value / filters.limit));
</script>

<template>
  <div class="log-explorer">
    <div class="page-header">
      <h2>Log Explorer</h2>
      <TimeRangePicker
        :model-value="timeRange.selected.value"
        @update:model-value="(v: TimeRange) => timeRange.setRange(v)"
        @change="onTimeRangeChange"
      />
    </div>

    <SearchBar
      :model-value="filters.query"
      :active-level="filters.level"
      :active-source="filters.source"
      @update:model-value="(v: string) => (filters.query = v)"
      @update:active-level="(v) => (filters.level = v)"
      @update:active-source="(v: string) => (filters.source = v)"
      @search="doSearch"
      @clear="doSearch"
    />

    <div v-if="error" class="error-banner">{{ error }}</div>

    <LogTable :logs="logs" :loading="loading" />

    <div class="pagination" v-if="total > filters.limit">
      <button class="page-btn" :disabled="filters.offset === 0" @click="prevPage">
        Previous
      </button>
      <span class="page-info">
        Showing {{ filters.offset + 1 }}-{{ Math.min(filters.offset + filters.limit, total) }}
        of {{ total.toLocaleString() }}
      </span>
      <button
        class="page-btn"
        :disabled="filters.offset + filters.limit >= total"
        @click="nextPage"
      >
        Next
      </button>
    </div>
  </div>
</template>

<style scoped>
.log-explorer {
  max-width: 1400px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  font-size: 1.4rem;
  font-weight: 600;
}

.error-banner {
  background: #fee2e2;
  color: #dc2626;
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 0.9rem;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  padding: 12px;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: #fff;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.page-btn:hover:not(:disabled) {
  background: #f8fafc;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
</style>
