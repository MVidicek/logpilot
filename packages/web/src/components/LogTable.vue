<script setup lang="ts">
import { ref } from 'vue';
import type { LogEntry } from '../types';
import LevelBadge from './LevelBadge.vue';
import LogDetail from './LogDetail.vue';

defineProps<{
  logs: LogEntry[];
  loading: boolean;
}>();

const expandedId = ref<string | null>(null);

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}
</script>

<template>
  <div class="log-table-container">
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      Loading...
    </div>

    <table class="log-table" v-if="logs.length > 0">
      <thead>
        <tr>
          <th class="col-time">Timestamp</th>
          <th class="col-level">Level</th>
          <th class="col-source">Source</th>
          <th class="col-message">Message</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="log in logs" :key="log.id">
          <tr
            class="log-row"
            :class="{ expanded: expandedId === log.id }"
            @click="toggleExpand(log.id)"
          >
            <td class="col-time">
              <span class="time-date">{{ formatDate(log.timestamp) }}</span>
              <span class="time-clock">{{ formatTimestamp(log.timestamp) }}</span>
            </td>
            <td class="col-level">
              <LevelBadge :level="log.level" />
            </td>
            <td class="col-source">{{ log.source }}</td>
            <td class="col-message">
              <code>{{ truncate(log.message, 120) }}</code>
            </td>
          </tr>
          <tr v-if="expandedId === log.id" class="detail-row">
            <td colspan="4">
              <LogDetail :log="log" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <div v-else-if="!loading" class="empty-state">
      <p>No logs found. Try adjusting your search filters or time range.</p>
    </div>
  </div>
</template>

<style scoped>
.log-table-container {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  z-index: 10;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-color);
  border-top-color: var(--sidebar-active);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.log-table thead {
  background: #f8fafc;
  border-bottom: 1px solid var(--border-color);
}

.log-table th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.log-row {
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.1s;
}

.log-row:hover {
  background: #f8fafc;
}

.log-row.expanded {
  background: #f1f5f9;
}

.log-row td {
  padding: 8px 12px;
  vertical-align: middle;
}

.col-time {
  width: 140px;
  white-space: nowrap;
}

.time-date {
  color: var(--text-secondary);
  font-size: 0.75rem;
  margin-right: 4px;
}

.time-clock {
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.col-level {
  width: 80px;
}

.col-source {
  width: 150px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--sidebar-active);
}

.col-message code {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  word-break: break-word;
}

.detail-row td {
  padding: 0;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
}
</style>
