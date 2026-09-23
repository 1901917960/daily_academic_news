import { describe, it, expect } from 'vitest';
import { nextReviewSchedule, isDue, dueKnowledgePoints } from '../review';

describe('nextReviewSchedule', () => {
  it('首次复习"认识"：1 天后到期', () => {
    const s = nextReviewSchedule('known');
    expect(s.interval).toBe(1);
    expect(s.nextDue).toBeGreaterThan(Date.now());
  });

  it('"认识"间隔按倍率增长', () => {
    const first = nextReviewSchedule('known');
    const second = nextReviewSchedule('known', first);
    expect(second.interval).toBeGreaterThan(first.interval);
  });

  it('"模糊"间隔减半且至少 1 天', () => {
    const s = nextReviewSchedule('fuzzy', { interval: 6, ease: 2.5 });
    expect(s.interval).toBe(3);
    expect(nextReviewSchedule('fuzzy').interval).toBe(1);
  });

  it('"不认识"立即到期并降低倍率', () => {
    const s = nextReviewSchedule('unknown', { interval: 7, ease: 2.5 });
    expect(s.interval).toBe(0);
    expect(s.ease).toBe(2.3);
    expect(s.nextDue).toBeLessThanOrEqual(Date.now());
  });

  it('倍率有下限', () => {
    let s = { interval: 1, ease: 1.3 };
    s = nextReviewSchedule('unknown', s);
    expect(s.ease).toBe(1.3);
  });
});

describe('isDue', () => {
  it('无记录视为到期', () => {
    expect(isDue(null)).toBe(true);
    expect(isDue(undefined)).toBe(true);
  });

  it('到期时间已过才需要复习', () => {
    expect(isDue({ nextDue: Date.now() - 1000 })).toBe(true);
    expect(isDue({ nextDue: Date.now() + 86400000 })).toBe(false);
  });
});

describe('dueKnowledgePoints', () => {
  it('筛选出到期的知识点', () => {
    const state = {
      A: { nextDue: Date.now() - 1000 },
      B: { nextDue: Date.now() + 86400000 }
    };
    expect(dueKnowledgePoints(['A', 'B', 'C'], state)).toEqual(['A', 'C']);
  });
});
