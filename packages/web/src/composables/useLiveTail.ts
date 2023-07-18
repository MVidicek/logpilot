import { ref, onUnmounted } from 'vue';
import type { LogEntry, LogLevel } from '../types';

export function useLiveTail(maxLogs = 500) {
  const logs = ref<LogEntry[]>([]);
  const connected = ref(false);
  const paused = ref(false);
  const error = ref<string | null>(null);

  let ws: WebSocket | null = null;
  const pauseBuffer: LogEntry[] = [];

  function connect(filters?: { level?: LogLevel; source?: string; query?: string }) {
    if (ws) {
      ws.close();
    }

    const params = new URLSearchParams();
    if (filters?.level) params.set('level', filters.level);
    if (filters?.source) params.set('source', filters.source);
    if (filters?.query) params.set('q', filters.query);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const queryStr = params.toString();
    const url = `${protocol}//${window.location.host}/api/v1/logs/tail${queryStr ? '?' + queryStr : ''}`;

    ws = new WebSocket(url);

    ws.onopen = () => {
      connected.value = true;
      error.value = null;
    };

    ws.onmessage = (event) => {
      try {
        const log: LogEntry = JSON.parse(event.data);

        if (paused.value) {
          pauseBuffer.push(log);
          // Cap pause buffer
          if (pauseBuffer.length > maxLogs) {
            pauseBuffer.shift();
          }
        } else {
          logs.value.unshift(log);
          // Keep logs list bounded
          if (logs.value.length > maxLogs) {
            logs.value.pop();
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      connected.value = false;
    };

    ws.onerror = () => {
      error.value = 'WebSocket connection failed';
      connected.value = false;
    };
  }

  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
    }
    connected.value = false;
  }

  function togglePause() {
    if (paused.value) {
      // Resume: flush pause buffer
      logs.value.unshift(...pauseBuffer);
      pauseBuffer.length = 0;
      // Trim to max
      if (logs.value.length > maxLogs) {
        logs.value.splice(maxLogs);
      }
    }
    paused.value = !paused.value;
  }

  function clear() {
    logs.value = [];
    pauseBuffer.length = 0;
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    logs,
    connected,
    paused,
    error,
    connect,
    disconnect,
    togglePause,
    clear,
  };
}
