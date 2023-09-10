<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ChartWidget from '../components/ChartWidget.vue';
import { api } from '../api/client';
import { useTimeRange } from '../composables/useTimeRange';
import type { AggregationBucket, SourceCount, ErrorRate } from '../types';

const timeRange = useTimeRange('24h');

const volumeLabels = ref<string[]>([]);
const volumeData = ref<number[]>([]);
const errorLabels = ref<string[]>([]);
const errorData = ref<number[]>([]);
const sourceNames = ref<string[]>([]);
const sourceCounts = ref<number[]>([]);
const totalLogs = ref(0);
const totalErrors = ref(0);
const avgErrorRate = ref(0);
const loading = ref(false);

function formatBucketLabel(bucket: string): string {
  const date = new Date(bucket);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function loadDashboard() {
  loading.value = true;

  const params: Record<string, string> = {
    from: timeRange.fromDate.value.toISOString(),
    to: timeRange.toDate.value.toISOString(),
    interval: '60',
  };

  try {
    const [volumeResult, errorResult, sourceResult] = await Promise.all([
      api.getLogVolume(params),
      api.getErrorRate(params),
      api.getTopSources({ from: params.from, to: params.to, limit: '10' }),
    ]);

    const volumeBuckets = volumeResult.buckets as AggregationBucket[];
    volumeLabels.value = volumeBuckets.map((b) => formatBucketLabel(b.bucket));
    volumeData.value = volumeBuckets.map((b) => b.count);
    totalLogs.value = volumeData.value.reduce((sum, v) => sum + v, 0);

    const errorBuckets = errorResult.buckets as ErrorRate[];
    errorLabels.value = errorBuckets.map((b) => formatBucketLabel(b.bucket));
    errorData.value = errorBuckets.map((b) => b.errors);
    totalErrors.value = errorData.value.reduce((sum, v) => sum + v, 0);

    const totalAll = errorBuckets.reduce((sum, b) => sum + b.total, 0);
    avgErrorRate.value = totalAll > 0 ? totalErrors.value / totalAll : 0;

    const sources = sourceResult.sources as SourceCount[];
    sourceNames.value = sources.map((s) => s.source);
    sourceCounts.value = sources.map((s) => s.count);
  } catch (err) {
    console.error('Dashboard load error:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <div class="dashboard">
    <div class="page-header">
      <h2>Dashboard</h2>
      <button class="refresh-btn" @click="loadDashboard" :disabled="loading">
        {{ loading ? 'Loading...' : 'Refresh' }}
      </button>
    </div>

    <!-- Stats cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Logs (24h)</div>
        <div class="stat-value">{{ totalLogs.toLocaleString() }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Errors (24h)</div>
        <div class="stat-value error">{{ totalErrors.toLocaleString() }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Error Rate</div>
        <div class="stat-value">{{ (avgErrorRate * 100).toFixed(2) }}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Sources</div>
        <div class="stat-value">{{ sourceNames.length }}</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="charts-grid">
      <ChartWidget
        title="Log Volume"
        :labels="volumeLabels"
        :data="volumeData"
        color="#3b82f6"
      />
      <ChartWidget
        title="Errors"
        :labels="errorLabels"
        :data="errorData"
        color="#ef4444"
      />
      <ChartWidget
        title="Top Sources"
        :labels="sourceNames"
        :data="sourceCounts"
        color="#8b5cf6"
      />
    </div>
  </div>
</template>

<style scoped>
.dashboard {
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

.refresh-btn {
  padding: 8px 18px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: #fff;
  font-size: 0.9rem;
}

.refresh-btn:disabled {
  opacity: 0.5;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 1.6rem;
  font-weight: 700;
}

.stat-value.error {
  color: #ef4444;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.charts-grid > *:last-child {
  grid-column: 1 / -1;
}

@media (max-width: 900px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .charts-grid { grid-template-columns: 1fr; }
}
</style>
