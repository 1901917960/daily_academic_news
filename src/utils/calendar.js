// 日历工具（纯函数，便于测试）

// 生成月历网格（固定 6 行 × 7 列）
// startMonday: 是否周一开头
export function buildCalendarGrid(year, month, { startMonday = true } = {}) {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  const offset = startMonday
    ? (first.getDay() + 6) % 7 // 周一为 0
    : first.getDay();          // 周日为 0

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNumber = i - offset + 1;
    const date = new Date(year, month - 1, dayNumber);
    cells.push({
      day: date.getDate(),
      inMonth: dayNumber >= 1 && dayNumber <= daysInMonth,
      dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    });
  }
  return cells;
}

// 月份前后切换
export function shiftMonth(view, delta) {
  let { year, month } = view;
  month += delta;
  if (month < 1) {
    month = 12;
    year--;
  } else if (month > 12) {
    month = 1;
    year++;
  }
  return { year, month };
}
