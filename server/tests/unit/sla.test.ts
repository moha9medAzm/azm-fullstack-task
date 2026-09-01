import { describe, it, expect } from 'vitest';
import {
  computeSlaDueDates,
  recomputeSlaOnPriorityChange,
  isResponseBreached,
  isResolutionBreached,
  bumpPriority,
  deriveSlaFields,
} from '../../src/lib/sla';

const T0 = new Date('2026-01-01T00:00:00.000Z');

describe('computeSlaDueDates', () => {
  it.each([
    ['URGENT', 1, 4],
    ['HIGH', 4, 24],
    ['MEDIUM', 8, 72],
    ['LOW', 24, 168],
  ] as const)('%s -> response +%dh, resolution +%dh', (priority, respH, resH) => {
    const { slaResponseDueAt, slaResolutionDueAt } = computeSlaDueDates(priority, T0);
    expect(slaResponseDueAt.getTime()).toBe(T0.getTime() + respH * 3_600_000);
    expect(slaResolutionDueAt.getTime()).toBe(T0.getTime() + resH * 3_600_000);
  });
});

describe('breach boundaries', () => {
  it('is not breached exactly at the due instant', () => {
    expect(isResponseBreached(T0, T0, null)).toBe(false);
    expect(isResolutionBreached(T0, T0, null)).toBe(false);
  });

  it('is breached 1ms after the due instant', () => {
    const oneMsLater = new Date(T0.getTime() + 1);
    expect(isResponseBreached(oneMsLater, T0, null)).toBe(true);
    expect(isResolutionBreached(oneMsLater, T0, null)).toBe(true);
  });

  it('never breaches once responded / resolved', () => {
    const later = new Date(T0.getTime() + 10_000);
    expect(isResponseBreached(later, T0, T0)).toBe(false);
    expect(isResolutionBreached(later, T0, T0)).toBe(false);
  });
});

describe('recomputeSlaOnPriorityChange', () => {
  it('recomputes response due date when not yet responded', () => {
    const result = recomputeSlaOnPriorityChange('URGENT', T0, null, new Date(T0.getTime() + 999));
    expect(result.slaResponseDueAt.getTime()).toBe(T0.getTime() + 1 * 3_600_000);
    expect(result.slaResolutionDueAt.getTime()).toBe(T0.getTime() + 4 * 3_600_000);
  });

  it('leaves response due date untouched once already responded', () => {
    const respondedAt = new Date(T0.getTime() + 1000);
    const originalResponseDue = new Date(T0.getTime() + 24 * 3_600_000);
    const result = recomputeSlaOnPriorityChange('URGENT', T0, respondedAt, originalResponseDue);
    expect(result.slaResponseDueAt).toBe(originalResponseDue);
    expect(result.slaResolutionDueAt.getTime()).toBe(T0.getTime() + 4 * 3_600_000);
  });
});

describe('bumpPriority', () => {
  it('escalates one step at a time and caps at URGENT', () => {
    expect(bumpPriority('LOW')).toBe('MEDIUM');
    expect(bumpPriority('MEDIUM')).toBe('HIGH');
    expect(bumpPriority('HIGH')).toBe('URGENT');
    expect(bumpPriority('URGENT')).toBe('URGENT');
  });
});

describe('deriveSlaFields', () => {
  it('reports remaining time and breach flags together', () => {
    const now = new Date(T0.getTime() + 5 * 3_600_000);
    const derived = deriveSlaFields(now, {
      slaResponseDueAt: new Date(T0.getTime() + 1 * 3_600_000),
      slaResolutionDueAt: new Date(T0.getTime() + 24 * 3_600_000),
      firstRespondedAt: null,
      resolvedAt: null,
    });
    expect(derived.slaResponseBreached).toBe(true);
    expect(derived.slaResolutionBreached).toBe(false);
    expect(derived.slaResolutionRemainingMs).toBe(19 * 3_600_000);
  });
});
