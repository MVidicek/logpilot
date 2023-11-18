<script setup lang="ts">
import { ref, onMounted } from 'vue';
import LevelBadge from '../components/LevelBadge.vue';
import { useLiveTail } from '../composables/useLiveTail';
import type { LogLevel } from '../types';

const { logs, connected, paused, error, connect, disconnect, togglePause, clear } = useLiveTail();

const logContainer = ref<HTMLElement | null>(null);
const filterLevel = ref<LogLevel | undefined>(undefined);
const filterSource = ref('');
const filterQuery = ref('');

function startTail() {
  connect({
    level: filterLevel.value,
    source: filterSource.value || undefined,
    query: filterQuery.value || undefined,
  });
}

function stopTail() {
  disconnect();
}

function reconnect() {
  stopTail();
  startTail();
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + d.getMilliseconds().toString().padStart(3, '0');
}

onMounted(() => {
  startTail();
});
</script>

<template>
  <div class="live-tail">
    <div class="page-header">
      <h2>Live Tail</h2>
      <div class="controls">
        <div class="status" :class="{ connected }">
          <span class="dot"></span>
          {{ connected ? 'Connected' : 'Disconnected' }}
        </div>
        <button class="ctrl-btn" @click="togglePause">
          {{ paused ? 'Resume' : 'Pause' }}
        </button>
        <button class="ctrl-btn" @click="clear">Clear</button>
        <button class="ctrl-btn" v-if="!connected" @click="startTail">Connect</button>
        <button class="ctrl-btn danger" v-if="connected" @click="stopTail">Disconnect</button>
      </div>
    </div>

    <div class="filters-bar">
      <select v-model="filterLevel" @change="reconnect" class="filter-select">
        <option :value="undefined">All levels</option>
        <option value="debug">Debug</option>
        <option value="info">Info</option>
        <option value="warn">Warn</option>
        <option value="error">Error</option>
        <option value="fatal">Fatal</option>
      </select>
      <input
        v-model="filterSource"
        placeholder="Filter by source"
        class="filter-input"
        @keyup.enter="reconnect"
      />
      <input
        v-model="filterQuery"
        placeholder="Filter by text"
        class="filter-input"
        @keyup.enter="reconnect"
      />
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="log-stream" ref="logContainer">
      <div class="log-line" v-for="log in logs" :key="log.id">
        <span class="line-time">{{ formatTime(log.timestamp) }}</span>
        <LevelBadge :level="log.level" />
        <span class="line-source">{{ log.source }}</span>
        <span class="line-message">{{ log.message }}</span>
      </div>
      <div v-if="logs.length === 0 && connected" class="waiting">
        Waiting for logs...
      </div>
    </div>

    <div class="stream-footer" v-if="paused">
      <span>Paused - {{ logs.length }} logs buffered</span>
    </div>
  </div>
</template>

<style scoped>
.live-tail {
  max-width: 1400px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 48px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-header h2 {
  font-size: 1.4rem;
  font-weight: 600;
}

.controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

.status.connected .dot {
  background: #22c55e;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.ctrl-btn {
  padding: 6px 14px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: #fff;
  font-size: 0.8rem;
}

.ctrl-btn.danger {
  color: #dc2626;
  border-color: #fecaca;
}

.filters-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.filter-select,
.filter-input {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.85rem;
}

.filter-input {
  flex: 1;
}

.error-banner {
  background: #fee2e2;
  color: #dc2626;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 0.85rem;
}

.log-stream {
  flex: 1;
  background: #0f172a;
  border-radius: 8px;
  padding: 12px;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.log-line {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 3px 0;
  color: #e2e8f0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.line-time {
  color: #64748b;
  white-space: nowrap;
  font-size: 0.75rem;
}

.line-source {
  color: #38bdf8;
  white-space: nowrap;
  min-width: 80px;
}

.line-message {
  word-break: break-word;
}

.waiting {
  color: #64748b;
  text-align: center;
  padding: 40px;
}

.stream-footer {
  padding: 8px 12px;
  background: #fef3c7;
  border-radius: 0 0 8px 8px;
  font-size: 0.8rem;
  text-align: center;
  color: #b45309;
}
</style>
