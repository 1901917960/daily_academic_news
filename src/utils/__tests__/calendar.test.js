import { describe, it, expect } from 'vitest';
import { buildCalendarGrid, shiftMonth } from '../calendar';

describe('buildCalendarGrid', () => {
  it('固定 42 格（6 行 × 7 列）', () => {
    expect(buildCalendarGrid(2026, 9).length).toBe(42);
  });

  it('2026-09 的正确首日偏移（9 月 1 日是周二，周一开头偏移 1）', () => {
    const cells = buildCalendarGrid(2026, 9);
    // 第一格是 8 月 31 日（周一）
    expect(cells[0].inMonth).toBe(false);
    expect(cells[0].dateKey).toBe('2026-08-31');
    // 第 2 格是 9 月 1 日
    expect(cells[1].inMonth).toBe(true);
    expect(cells[1].dateKey).toBe('2026-09-01');
    expect(cells[1].day).toBe(1);
  });

  it('本月天数正确且跨月日期正确', () => {
    const cells = buildCalendarGrid(2026, 2); // 2026-02 有 28 天
    const inMonth = cells.filter(c => c.inMonth);
    expect(inMonth.length).toBe(28);
    // 网格包含下月初的日期
    expect(cells.some(c => c.dateKey === '2026-03-01')).toBe(true);
  });

  it('日期键格式统一为 YYYY-MM-DD', () => {
    const cells = buildCalendarGrid(2026, 1);
    for (const c of cells) {
      expect(c.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('周日开头模式（startMonday=false）', () => {
    // 2026-09-01 是周二，周日开头偏移 2
    const cells = buildCalendarGrid(2026, 9, { startMonday: false });
    expect(cells[2].dateKey).toBe('2026-09-01');
  });
});

describe('shiftMonth', () => {
  it('正常前进一个月', () => {
    expect(shiftMonth({ year: 2026, month: 9 }, 1)).toEqual({ year: 2026, month: 10 });
  });

  it('正常后退一个月', () => {
    expect(shiftMonth({ year: 2026, month: 9 }, -1)).toEqual({ year: 2026, month: 8 });
  });

  it('跨年边界', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });
});
