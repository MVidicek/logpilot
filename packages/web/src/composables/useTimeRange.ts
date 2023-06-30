import { ref, computed } from 'vue';
import type { TimeRange } from '../types';
import { TIME_RANGE_OPTIONS } from '../types';

export function useTimeRange(initial: TimeRange = '1h') {
  const selected = ref<TimeRange>(initial);
  const customFrom = ref<string>('');
  const customTo = ref<string>('');

  const fromDate = computed((): Date => {
    if (selected.value === 'custom' && customFrom.value) {
      return new Date(customFrom.value);
    }
    const option = TIME_RANGE_OPTIONS.find((o) => o.value === selected.value);
    const minutes = option?.minutes ?? 60;
    return new Date(Date.now() - minutes * 60 * 1000);
  });

  const toDate = computed((): Date => {
    if (selected.value === 'custom' && customTo.value) {
      return new Date(customTo.value);
    }
    return new Date();
  });

  const label = computed((): string => {
    if (selected.value === 'custom') {
      return 'Custom range';
    }
    const option = TIME_RANGE_OPTIONS.find((o) => o.value === selected.value);
    return option?.label ?? selected.value;
  });

  function setRange(range: TimeRange) {
    selected.value = range;
  }

  function setCustomRange(from: string, to: string) {
    selected.value = 'custom';
    customFrom.value = from;
    customTo.value = to;
  }

  return {
    selected,
    customFrom,
    customTo,
    fromDate,
    toDate,
    label,
    setRange,
    setCustomRange,
  };
}
