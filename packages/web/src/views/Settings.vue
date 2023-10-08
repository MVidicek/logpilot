<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';
import type { ApiKey } from '../types';

const apiKeys = ref<ApiKey[]>([]);
const newKeyName = ref('');
const newKeyValue = ref('');
const loading = ref(false);

async function loadApiKeys() {
  loading.value = true;
  try {
    const result = await api.listApiKeys();
    apiKeys.value = result.keys as ApiKey[];
  } catch (err) {
    console.error('Failed to load API keys:', err);
  } finally {
    loading.value = false;
  }
}

async function createKey() {
  if (!newKeyName.value.trim()) return;

  try {
    const result = await api.createApiKey(newKeyName.value.trim());
    newKeyValue.value = result.key;
    newKeyName.value = '';
    await loadApiKeys();
  } catch (err) {
    console.error('Failed to create API key:', err);
  }
}

async function revokeKey(id: string) {
  if (!confirm('Revoke this API key? This cannot be undone.')) return;

  try {
    await api.revokeApiKey(id);
    await loadApiKeys();
  } catch (err) {
    console.error('Failed to revoke API key:', err);
  }
}

function formatDate(date: string | null): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleString();
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

onMounted(loadApiKeys);
</script>

<template>
  <div class="settings">
    <h2>Settings</h2>

    <section class="settings-section">
      <h3>API Keys</h3>
      <p class="section-desc">
        API keys are used to authenticate log ingestion requests.
        Include the key in the <code>X-API-Key</code> header.
      </p>

      <!-- New key result -->
      <div v-if="newKeyValue" class="new-key-banner">
        <strong>New API key created!</strong> Copy it now, it will not be shown again.
        <div class="key-display">
          <code>{{ newKeyValue }}</code>
          <button class="copy-btn" @click="copyToClipboard(newKeyValue)">Copy</button>
        </div>
        <button class="dismiss-btn" @click="newKeyValue = ''">Dismiss</button>
      </div>

      <!-- Create new key -->
      <div class="create-key">
        <input
          v-model="newKeyName"
          type="text"
          placeholder="Key name (e.g. production-api)"
          class="key-input"
          @keyup.enter="createKey"
        />
        <button class="primary-btn" @click="createKey" :disabled="!newKeyName.trim()">
          Create Key
        </button>
      </div>

      <!-- Keys table -->
      <div class="keys-table" v-if="apiKeys.length > 0">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Prefix</th>
              <th>Created</th>
              <th>Last Used</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="key in apiKeys" :key="key.id">
              <td class="key-name">{{ key.name }}</td>
              <td><code>{{ key.prefix }}...</code></td>
              <td class="date-cell">{{ formatDate(key.created_at) }}</td>
              <td class="date-cell">{{ formatDate(key.last_used_at) }}</td>
              <td>
                <span class="status-badge" :class="{ active: key.is_active, revoked: !key.is_active }">
                  {{ key.is_active ? 'Active' : 'Revoked' }}
                </span>
              </td>
              <td>
                <button
                  v-if="key.is_active"
                  class="revoke-btn"
                  @click="revokeKey(key.id)"
                >
                  Revoke
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="settings-section">
      <h3>Ingestion Examples</h3>

      <div class="code-example">
        <h4>cURL</h4>
        <pre><code>curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"level": "info", "message": "Hello from curl", "source": "test"}'</code></pre>
      </div>

      <div class="code-example">
        <h4>Node.js SDK</h4>
        <pre><code>import { LogPilot } from '@logpilot/node';

const logger = new LogPilot({
  endpoint: 'http://localhost:3100',
  apiKey: 'YOUR_API_KEY',
  source: 'my-app',
});

logger.info('User logged in', { userId: '123' });</code></pre>
      </div>

      <div class="code-example">
        <h4>Python SDK</h4>
        <pre><code>from logpilot import LogPilot

logger = LogPilot(
    endpoint="http://localhost:3100",
    api_key="YOUR_API_KEY",
    source="my-service",
)

logger.info("User logged in", user_id="123")</code></pre>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  max-width: 900px;
}

.settings h2 {
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: 24px;
}

.settings-section {
  margin-bottom: 32px;
}

.settings-section h3 {
  font-size: 1.1rem;
  margin-bottom: 8px;
}

.section-desc {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 16px;
}

.section-desc code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
}

.new-key-banner {
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.key-display {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.key-display code {
  flex: 1;
  padding: 8px;
  background: #fff;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  word-break: break-all;
}

.copy-btn {
  padding: 6px 14px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: #fff;
  font-size: 0.85rem;
}

.dismiss-btn {
  margin-top: 8px;
  background: none;
  border: none;
  color: #16a34a;
  font-size: 0.85rem;
  text-decoration: underline;
}

.create-key {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.key-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.9rem;
}

.primary-btn {
  padding: 8px 18px;
  background: var(--sidebar-active);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 500;
}

.primary-btn:disabled { opacity: 0.5; }

.keys-table {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

table { width: 100%; border-collapse: collapse; }

th {
  padding: 10px 12px;
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: #f8fafc;
  border-bottom: 1px solid var(--border-color);
}

td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.9rem;
}

.key-name { font-weight: 500; }
.date-cell { font-size: 0.8rem; color: var(--text-secondary); }

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.status-badge.active { background: #dcfce7; color: #16a34a; }
.status-badge.revoked { background: #fee2e2; color: #dc2626; }

.revoke-btn {
  padding: 4px 10px;
  border: 1px solid #fecaca;
  border-radius: 4px;
  background: #fff;
  color: #dc2626;
  font-size: 0.8rem;
}

.code-example {
  margin-bottom: 16px;
}

.code-example h4 {
  font-size: 0.9rem;
  margin-bottom: 6px;
}

.code-example pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 14px;
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  overflow-x: auto;
  line-height: 1.6;
}
</style>
