<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';
import type { AlertRule } from '../types';

const rules = ref<AlertRule[]>([]);
const loading = ref(false);
const showModal = ref(false);
const editingRule = ref<AlertRule | null>(null);

// Form state
const form = ref({
  name: '',
  type: 'threshold' as 'threshold' | 'pattern',
  threshold: 100,
  window_minutes: 5,
  operator: 'gt' as 'gt' | 'gte' | 'lt' | 'lte' | 'eq',
  pattern: '',
  is_regex: false,
  level: '',
  source: '',
  query: '',
  webhook_url: '',
  notifier_type: 'webhook' as 'slack' | 'discord' | 'webhook',
  cooldown_minutes: 5,
});

async function loadRules() {
  loading.value = true;
  try {
    const result = await api.listAlerts();
    rules.value = result.rules as AlertRule[];
  } catch (err) {
    console.error('Failed to load alert rules:', err);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingRule.value = null;
  form.value = {
    name: '',
    type: 'threshold',
    threshold: 100,
    window_minutes: 5,
    operator: 'gt',
    pattern: '',
    is_regex: false,
    level: '',
    source: '',
    query: '',
    webhook_url: '',
    notifier_type: 'webhook',
    cooldown_minutes: 5,
  };
  showModal.value = true;
}

function openEdit(rule: AlertRule) {
  editingRule.value = rule;
  form.value.name = rule.name;
  form.value.type = rule.type;
  form.value.cooldown_minutes = rule.cooldown_minutes;

  if (rule.condition.type === 'threshold') {
    form.value.threshold = rule.condition.threshold;
    form.value.window_minutes = rule.condition.window_minutes;
    form.value.operator = rule.condition.operator;
    form.value.level = rule.condition.level || '';
    form.value.source = rule.condition.source || '';
    form.value.query = rule.condition.query || '';
  } else {
    form.value.pattern = rule.condition.pattern;
    form.value.is_regex = rule.condition.is_regex;
    form.value.level = rule.condition.level || '';
    form.value.source = rule.condition.source || '';
  }

  if (rule.notifiers.length > 0) {
    form.value.notifier_type = rule.notifiers[0].type;
    form.value.webhook_url = rule.notifiers[0].webhook_url;
  }

  showModal.value = true;
}

async function saveRule() {
  const condition =
    form.value.type === 'threshold'
      ? {
          type: 'threshold' as const,
          threshold: form.value.threshold,
          window_minutes: form.value.window_minutes,
          operator: form.value.operator,
          level: form.value.level || undefined,
          source: form.value.source || undefined,
          query: form.value.query || undefined,
        }
      : {
          type: 'pattern' as const,
          pattern: form.value.pattern,
          is_regex: form.value.is_regex,
          level: form.value.level || undefined,
          source: form.value.source || undefined,
        };

  const notifiers = form.value.webhook_url
    ? [{ type: form.value.notifier_type, webhook_url: form.value.webhook_url }]
    : [];

  const data = {
    name: form.value.name,
    type: form.value.type,
    condition,
    notifiers,
    cooldown_minutes: form.value.cooldown_minutes,
  };

  if (editingRule.value) {
    await api.updateAlert(editingRule.value.id, data);
  } else {
    await api.createAlert(data);
  }

  showModal.value = false;
  await loadRules();
}

async function toggleStatus(rule: AlertRule) {
  const newStatus = rule.status === 'active' ? 'paused' : 'active';
  await api.updateAlert(rule.id, { status: newStatus });
  await loadRules();
}

async function deleteRule(rule: AlertRule) {
  if (!confirm(`Delete alert rule "${rule.name}"?`)) return;
  await api.deleteAlert(rule.id);
  await loadRules();
}

function formatDate(date: string | null): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleString();
}

onMounted(loadRules);
</script>

<template>
  <div class="alert-rules">
    <div class="page-header">
      <h2>Alert Rules</h2>
      <button class="primary-btn" @click="openCreate">New Alert Rule</button>
    </div>

    <div class="rules-table" v-if="rules.length > 0">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Last Triggered</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rule in rules" :key="rule.id">
            <td class="rule-name">{{ rule.name }}</td>
            <td><span class="type-badge">{{ rule.type }}</span></td>
            <td>
              <span class="status-badge" :class="rule.status">{{ rule.status }}</span>
            </td>
            <td class="date-cell">{{ formatDate(rule.last_triggered_at) }}</td>
            <td class="actions">
              <button class="action-btn" @click="openEdit(rule)">Edit</button>
              <button class="action-btn" @click="toggleStatus(rule)">
                {{ rule.status === 'active' ? 'Pause' : 'Activate' }}
              </button>
              <button class="action-btn danger" @click="deleteRule(rule)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!loading" class="empty-state">
      <p>No alert rules configured yet.</p>
      <button class="primary-btn" @click="openCreate">Create your first alert</button>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <h3>{{ editingRule ? 'Edit Alert Rule' : 'New Alert Rule' }}</h3>

        <div class="form-group">
          <label>Name</label>
          <input v-model="form.name" type="text" placeholder="e.g. High Error Rate" />
        </div>

        <div class="form-group">
          <label>Type</label>
          <select v-model="form.type">
            <option value="threshold">Threshold</option>
            <option value="pattern">Pattern Match</option>
          </select>
        </div>

        <template v-if="form.type === 'threshold'">
          <div class="form-row">
            <div class="form-group">
              <label>Threshold</label>
              <input v-model.number="form.threshold" type="number" min="1" />
            </div>
            <div class="form-group">
              <label>Window (minutes)</label>
              <input v-model.number="form.window_minutes" type="number" min="1" />
            </div>
            <div class="form-group">
              <label>Operator</label>
              <select v-model="form.operator">
                <option value="gt">Greater than</option>
                <option value="gte">Greater or equal</option>
                <option value="lt">Less than</option>
                <option value="lte">Less or equal</option>
                <option value="eq">Equal to</option>
              </select>
            </div>
          </div>
        </template>

        <template v-if="form.type === 'pattern'">
          <div class="form-group">
            <label>Pattern</label>
            <input v-model="form.pattern" type="text" placeholder="e.g. OutOfMemory" />
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="form.is_regex" /> Use regex
            </label>
          </div>
        </template>

        <div class="form-row">
          <div class="form-group">
            <label>Level filter (optional)</label>
            <select v-model="form.level">
              <option value="">Any</option>
              <option value="error">Error</option>
              <option value="fatal">Fatal</option>
              <option value="warn">Warn</option>
            </select>
          </div>
          <div class="form-group">
            <label>Source filter (optional)</label>
            <input v-model="form.source" type="text" placeholder="e.g. api-server" />
          </div>
        </div>

        <div class="form-group">
          <label>Cooldown (minutes)</label>
          <input v-model.number="form.cooldown_minutes" type="number" min="1" />
        </div>

        <h4>Notification</h4>

        <div class="form-row">
          <div class="form-group">
            <label>Type</label>
            <select v-model="form.notifier_type">
              <option value="webhook">Webhook</option>
              <option value="slack">Slack</option>
              <option value="discord">Discord</option>
            </select>
          </div>
          <div class="form-group" style="flex: 2">
            <label>Webhook URL</label>
            <input v-model="form.webhook_url" type="url" placeholder="https://..." />
          </div>
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" @click="showModal = false">Cancel</button>
          <button class="primary-btn" @click="saveRule" :disabled="!form.name">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alert-rules {
  max-width: 1200px;
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

.primary-btn {
  padding: 8px 18px;
  background: var(--sidebar-active);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.9rem;
}

.primary-btn:hover { background: #2563eb; }
.primary-btn:disabled { opacity: 0.5; }

.rules-table {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: 12px;
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: #f8fafc;
  border-bottom: 1px solid var(--border-color);
}

td {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.9rem;
}

.rule-name { font-weight: 500; }

.type-badge {
  padding: 2px 8px;
  background: #f1f5f9;
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: var(--font-mono);
}

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-badge.active { background: #dcfce7; color: #16a34a; }
.status-badge.paused { background: #fef3c7; color: #b45309; }

.date-cell { font-size: 0.85rem; color: var(--text-secondary); }

.actions { display: flex; gap: 6px; }

.action-btn {
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: #fff;
  font-size: 0.8rem;
}

.action-btn.danger { color: #dc2626; border-color: #fecaca; }

.empty-state {
  text-align: center;
  padding: 60px;
  color: var(--text-secondary);
}

.empty-state .primary-btn { margin-top: 16px; }

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 560px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal h3 { margin-bottom: 20px; font-size: 1.2rem; }
.modal h4 { margin: 16px 0 8px; font-size: 0.95rem; color: var(--text-secondary); }

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--text-secondary);
}

.form-group input[type="text"],
.form-group input[type="url"],
.form-group input[type="number"],
.form-group select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.9rem;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group { flex: 1; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.cancel-btn {
  padding: 8px 18px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: #fff;
  font-size: 0.9rem;
}
</style>
