<script setup lang="ts">
import type { LogEntry } from '../types';
import LevelBadge from './LevelBadge.vue';

defineProps<{
  log: LogEntry;
}>();
</script>

<template>
  <div class="log-detail">
    <div class="detail-header">
      <LevelBadge :level="log.level" />
      <span class="detail-timestamp">{{ new Date(log.timestamp).toLocaleString() }}</span>
      <span class="detail-source">{{ log.source }}</span>
    </div>

    <div class="detail-message">
      <pre>{{ log.message }}</pre>
    </div>

    <div class="detail-metadata" v-if="Object.keys(log.metadata).length > 0">
      <h4>Metadata</h4>
      <table class="metadata-table">
        <tbody>
          <tr v-for="(value, key) in log.metadata" :key="key">
            <td class="meta-key">{{ key }}</td>
            <td class="meta-value">{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="detail-id">
      <span class="id-label">ID:</span>
      <code>{{ log.id }}</code>
    </div>
  </div>
</template>

<style scoped>
.log-detail {
  padding: 16px;
  background: #f8fafc;
  border-top: 1px solid var(--border-color);
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-timestamp {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.detail-source {
  font-size: 0.85rem;
  color: var(--sidebar-active);
  font-family: var(--font-mono);
}

.detail-message {
  margin-bottom: 12px;
}

.detail-message pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.detail-metadata h4 {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.metadata-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
}

.metadata-table td {
  padding: 4px 8px;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--border-color);
}

.meta-key {
  font-weight: 600;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  width: 200px;
}

.meta-value {
  font-family: var(--font-mono);
  word-break: break-all;
}

.detail-id {
  margin-top: 8px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.detail-id code {
  font-family: var(--font-mono);
  background: #e2e8f0;
  padding: 2px 6px;
  border-radius: 3px;
}
</style>
