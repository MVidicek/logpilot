import { describe, it, expect } from 'vitest';
import { buildSearchParams } from '../src/query/search';

describe('buildSearchParams', () => {
  it('returns default params when no query provided', () => {
    const params = buildSearchParams({});
    expect(params.limit).toBe(50);
    expect(params.offset).toBe(0);
    expect(params.from).toBeDefined();
    expect(params.query).toBeUndefined();
    expect(params.level).toBeUndefined();
    expect(params.source).toBeUndefined();
  });

  it('parses text query', () => {
    const params = buildSearchParams({ q: 'payment failed' });
    expect(params.query).toBe('payment failed');
  });

  it('parses single level filter', () => {
    const params = buildSearchParams({ level: 'error' });
    expect(params.level).toBe('error');
  });

  it('parses multiple level filters', () => {
    const params = buildSearchParams({ level: 'error,fatal' });
    expect(params.level).toEqual(['error', 'fatal']);
  });

  it('parses source filter', () => {
    const params = buildSearchParams({ source: 'api-server' });
    expect(params.source).toBe('api-server');
  });

  it('parses time range', () => {
    const from = '2023-10-01T00:00:00Z';
    const to = '2023-10-01T23:59:59Z';
    const params = buildSearchParams({ from, to });
    expect(params.from).toEqual(new Date(from));
    expect(params.to).toEqual(new Date(to));
  });

  it('caps limit at 1000', () => {
    const params = buildSearchParams({ limit: '5000' });
    expect(params.limit).toBe(1000);
  });

  it('handles invalid limit gracefully', () => {
    const params = buildSearchParams({ limit: 'abc' });
    expect(params.limit).toBe(50);
  });

  it('handles invalid offset gracefully', () => {
    const params = buildSearchParams({ offset: 'abc' });
    expect(params.offset).toBe(0);
  });

  it('defaults from to last 24 hours when not specified', () => {
    const params = buildSearchParams({});
    const now = Date.now();
    const fromTime = params.from!.getTime();
    // Should be approximately 24 hours ago (within 5 seconds tolerance)
    expect(now - fromTime).toBeGreaterThan(24 * 60 * 60 * 1000 - 5000);
    expect(now - fromTime).toBeLessThan(24 * 60 * 60 * 1000 + 5000);
  });

  it('handles pagination params', () => {
    const params = buildSearchParams({ limit: '25', offset: '50' });
    expect(params.limit).toBe(25);
    expect(params.offset).toBe(50);
  });

  it('ignores invalid date strings', () => {
    const params = buildSearchParams({ from: 'not-a-date', to: 'also-not-a-date' });
    // from should default to 24h ago
    expect(params.from).toBeDefined();
    expect(params.to).toBeUndefined();
  });
});
