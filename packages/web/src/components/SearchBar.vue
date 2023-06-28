<script setup lang="ts">
import { ref } from 'vue';
import type { LogLevel } from '../types';

const props = defineProps<{
  modelValue: string;
  activeLevel: LogLevel | null;
  activeSource: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'search': [];
  'update:activeLevel': [value: LogLevel | null];
  'update:activeSource': [value: string];
  'clear': [];
}>();

const inputValue = ref(props.modelValue);

const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];

function onSubmit() {
  emit('update:modelValue', inputValue.value);
  emit('search');
}

function toggleLevel(level: LogLevel) {
  if (props.activeLevel === level) {
    emit('update:activeLevel', null);
  } else {
    emit('update:activeLevel', level);
  }
  emit('search');
}

function clearAll() {
  inputValue.value = '';
  emit('update:modelValue', '');
  emit('update:activeLevel', null);
  emit('update:activeSource', '');
  emit('clear');
}
</script>

<template>
  <div class="search-bar">
    <form class="search-form" @submit.prevent="onSubmit">
      <input
        v-model="inputValue"
        type="text"
        class="search-input"
        placeholder="Search logs... (e.g. 'payment failed' or 'user_id:123')"
        @input="emit('update:modelValue', inputValue)"
      />
      <button type="submit" class="search-btn">Search</button>
    </form>

    <div class="filters">
      <div class="level-filters">
        <button
          v-for="level in levels"
          :key="level"
          class="level-btn"
          :class="[level, { active: activeLevel === level }]"
          @click="toggleLevel(level)"
        >
          {{ level }}
        </button>
      </div>

      <div class="active-filters" v-if="activeLevel || activeSource || modelValue">
        <span class="chip" v-if="modelValue">
          q: {{ modelValue }}
          <button class="chip-remove" @click="inputValue = ''; emit('update:modelValue', ''); emit('search')">x</button>
        </span>
        <span class="chip" v-if="activeLevel">
          level: {{ activeLevel }}
          <button class="chip-remove" @click="emit('update:activeLevel', null); emit('search')">x</button>
        </span>
        <span class="chip" v-if="activeSource">
          source: {{ activeSource }}
          <button class="chip-remove" @click="emit('update:activeSource', ''); emit('search')">x</button>
        </span>
        <button class="clear-btn" @click="clearAll">Clear all</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-bar {
  margin-bottom: 16px;
}

.search-form {
  display: flex;
  gap: 8px;
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: var(--sidebar-active);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-btn {
  padding: 10px 20px;
  background: var(--sidebar-active);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.9rem;
}

.search-btn:hover {
  background: #2563eb;
}

.filters {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.level-filters {
  display: flex;
  gap: 4px;
}

.level-btn {
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: #fff;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  transition: all 0.15s;
}

.level-btn.active.debug { background: #f1f5f9; border-color: #94a3b8; }
.level-btn.active.info { background: #dbeafe; border-color: #3b82f6; }
.level-btn.active.warn { background: #fef3c7; border-color: #f59e0b; }
.level-btn.active.error { background: #fee2e2; border-color: #ef4444; }
.level-btn.active.fatal { background: #fecaca; border-color: #dc2626; }

.active-filters {
  display: flex;
  gap: 6px;
  align-items: center;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: #e2e8f0;
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: var(--font-mono);
}

.chip-remove {
  background: none;
  border: none;
  font-size: 0.8rem;
  color: var(--text-secondary);
  padding: 0 2px;
}

.clear-btn {
  background: none;
  border: none;
  color: var(--sidebar-active);
  font-size: 0.8rem;
  text-decoration: underline;
}
</style>
