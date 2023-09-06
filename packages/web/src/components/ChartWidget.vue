<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  title: string;
  labels: string[];
  data: number[];
  color?: string;
  type?: 'bar' | 'line';
}>();

const maxValue = computed(() => Math.max(...props.data, 1));

const barColor = computed(() => props.color || '#3b82f6');

const chartBars = computed(() => {
  return props.data.map((value, index) => ({
    value,
    label: props.labels[index] || '',
    height: (value / maxValue.value) * 100,
  }));
});

const totalCount = computed(() => props.data.reduce((sum, v) => sum + v, 0));
</script>

<template>
  <div class="chart-widget">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <span class="chart-total">{{ totalCount.toLocaleString() }} total</span>
    </div>
    <div class="chart-body">
      <div class="chart-bars">
        <div
          v-for="(bar, i) in chartBars"
          :key="i"
          class="bar-container"
          :title="`${bar.label}: ${bar.value}`"
        >
          <div
            class="bar"
            :style="{
              height: bar.height + '%',
              backgroundColor: barColor,
            }"
          ></div>
        </div>
      </div>
      <div class="chart-x-labels" v-if="labels.length <= 12">
        <span v-for="(label, i) in labels" :key="i" class="x-label">
          {{ label }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-widget {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-title {
  font-size: 0.9rem;
  font-weight: 600;
}

.chart-total {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.chart-body {
  height: 160px;
  display: flex;
  flex-direction: column;
}

.chart-bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  padding-bottom: 4px;
}

.bar-container {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.bar {
  width: 100%;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  transition: height 0.3s ease;
  opacity: 0.85;
}

.bar:hover {
  opacity: 1;
}

.chart-x-labels {
  display: flex;
  justify-content: space-between;
  padding-top: 4px;
}

.x-label {
  font-size: 0.65rem;
  color: var(--text-secondary);
  text-align: center;
  flex: 1;
}
</style>
