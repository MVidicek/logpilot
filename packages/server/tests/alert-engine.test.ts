import { describe, it, expect } from 'vitest';
import type { AlertRule, ThresholdCondition, PatternCondition } from '../src/types/alert';

// Test the alert rule evaluation logic independently of the engine
// (without requiring database connections)

function evaluateThresholdCondition(
  condition: ThresholdCondition,
  count: number
): boolean {
  switch (condition.operator) {
    case 'gt':
      return count > condition.threshold;
    case 'gte':
      return count >= condition.threshold;
    case 'lt':
      return count < condition.threshold;
    case 'lte':
      return count <= condition.threshold;
    case 'eq':
      return count === condition.threshold;
    default:
      return false;
  }
}

function shouldSkipCooldown(
  lastTriggeredAt: Date | null,
  cooldownMinutes: number
): boolean {
  if (!lastTriggeredAt) return false;
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const elapsed = Date.now() - lastTriggeredAt.getTime();
  return elapsed < cooldownMs;
}

function matchesPattern(
  message: string,
  pattern: string,
  isRegex: boolean
): boolean {
  if (isRegex) {
    try {
      return new RegExp(pattern).test(message);
    } catch {
      return false;
    }
  }
  return message.toLowerCase().includes(pattern.toLowerCase());
}

describe('threshold evaluation', () => {
  it('triggers when count exceeds threshold (gt)', () => {
    const condition: ThresholdCondition = {
      type: 'threshold',
      threshold: 100,
      window_minutes: 5,
      operator: 'gt',
    };
    expect(evaluateThresholdCondition(condition, 101)).toBe(true);
    expect(evaluateThresholdCondition(condition, 100)).toBe(false);
    expect(evaluateThresholdCondition(condition, 99)).toBe(false);
  });

  it('triggers when count meets threshold (gte)', () => {
    const condition: ThresholdCondition = {
      type: 'threshold',
      threshold: 50,
      window_minutes: 10,
      operator: 'gte',
    };
    expect(evaluateThresholdCondition(condition, 50)).toBe(true);
    expect(evaluateThresholdCondition(condition, 51)).toBe(true);
    expect(evaluateThresholdCondition(condition, 49)).toBe(false);
  });

  it('triggers when count is below threshold (lt)', () => {
    const condition: ThresholdCondition = {
      type: 'threshold',
      threshold: 10,
      window_minutes: 5,
      operator: 'lt',
    };
    expect(evaluateThresholdCondition(condition, 5)).toBe(true);
    expect(evaluateThresholdCondition(condition, 10)).toBe(false);
    expect(evaluateThresholdCondition(condition, 15)).toBe(false);
  });

  it('triggers when count equals threshold (eq)', () => {
    const condition: ThresholdCondition = {
      type: 'threshold',
      threshold: 42,
      window_minutes: 1,
      operator: 'eq',
    };
    expect(evaluateThresholdCondition(condition, 42)).toBe(true);
    expect(evaluateThresholdCondition(condition, 41)).toBe(false);
    expect(evaluateThresholdCondition(condition, 43)).toBe(false);
  });

  it('triggers when count is at or below threshold (lte)', () => {
    const condition: ThresholdCondition = {
      type: 'threshold',
      threshold: 20,
      window_minutes: 5,
      operator: 'lte',
    };
    expect(evaluateThresholdCondition(condition, 20)).toBe(true);
    expect(evaluateThresholdCondition(condition, 19)).toBe(true);
    expect(evaluateThresholdCondition(condition, 21)).toBe(false);
  });
});

describe('cooldown', () => {
  it('skips evaluation during cooldown period', () => {
    const recentTrigger = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
    expect(shouldSkipCooldown(recentTrigger, 5)).toBe(true);
  });

  it('allows evaluation after cooldown expires', () => {
    const oldTrigger = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    expect(shouldSkipCooldown(oldTrigger, 5)).toBe(false);
  });

  it('allows first trigger (no previous trigger)', () => {
    expect(shouldSkipCooldown(null, 5)).toBe(false);
  });

  it('handles cooldown boundary', () => {
    const exactBoundary = new Date(Date.now() - 5 * 60 * 1000); // exactly 5 minutes ago
    expect(shouldSkipCooldown(exactBoundary, 5)).toBe(false);
  });
});

describe('pattern matching', () => {
  it('matches plain text patterns (case insensitive)', () => {
    expect(matchesPattern('OutOfMemoryError in heap', 'outofmemory', false)).toBe(true);
    expect(matchesPattern('Connection timeout', 'outofmemory', false)).toBe(false);
  });

  it('matches regex patterns', () => {
    expect(matchesPattern('Error code: 404', 'Error code: \\d+', true)).toBe(true);
    expect(matchesPattern('Success', 'Error code: \\d+', true)).toBe(false);
  });

  it('handles complex regex patterns', () => {
    expect(
      matchesPattern(
        '2023-10-01 12:00:00 FATAL: process crashed',
        'FATAL|CRITICAL|EMERGENCY',
        true
      )
    ).toBe(true);
  });

  it('handles invalid regex gracefully', () => {
    expect(matchesPattern('test', '[invalid', true)).toBe(false);
  });

  it('matches substring for non-regex patterns', () => {
    expect(matchesPattern('Payment processing failed for order', 'payment', false)).toBe(true);
    expect(matchesPattern('Payment processing failed for order', 'PAYMENT', false)).toBe(true);
  });
});
