<script setup lang="ts">
import type { LogLevel } from '../types';

defineProps<{
  level: LogLevel;
}>();

const colorMap: Record<LogLevel, { bg: string; text: string }> = {
  debug: { bg: '#f1f5f9', text: '#64748b' },
  info: { bg: '#dbeafe', text: '#1d4ed8' },
  warn: { bg: '#fef3c7', text: '#b45309' },
  error: { bg: '#fee2e2', text: '#dc2626' },
  fatal: { bg: '#fecaca', text: '#991b1b' },
};
</script>

<template>
  <span
    class="badge"
    :style="{
      backgroundColor: colorMap[level]?.bg || '#f1f5f9',
      color: colorMap[level]?.text || '#64748b',
    }"
  >
    {{ level.toUpperCase() }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  font-family: var(--font-mono);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
}
</style>
