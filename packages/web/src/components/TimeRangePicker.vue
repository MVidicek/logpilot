<script setup lang="ts">
import type { TimeRange } from '../types';
import { TIME_RANGE_OPTIONS } from '../types';

defineProps<{
  modelValue: TimeRange;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: TimeRange];
  'change': [];
}>();

function select(value: TimeRange) {
  emit('update:modelValue', value);
  emit('change');
}
</script>

<template>
  <div class="time-range-picker">
    <button
      v-for="option in TIME_RANGE_OPTIONS"
      :key="option.value"
      class="time-btn"
      :class="{ active: modelValue === option.value }"
      @click="select(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.time-range-picker {
  display: flex;
  gap: 2px;
  background: #e2e8f0;
  border-radius: 6px;
  padding: 2px;
}

.time-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.15s;
  white-space: nowrap;
}

.time-btn:hover {
  color: var(--text-primary);
}

.time-btn.active {
  background: #fff;
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
</style>
