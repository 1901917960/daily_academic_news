// 知识点间隔复习调度（简化版 SM-2 算法，纯函数）

// rating: 'known'（认识）| 'fuzzy'（模糊）| 'unknown'（不认识）
// current: 上一次的复习状态 { interval, ease }
export function nextReviewSchedule(rating, current = null) {
  const base = current || { interval: 0, ease: 2.5 };

  let interval;
  let ease = base.ease;

  if (rating === 'known') {
    // 认识：间隔按倍率增长，首次复习间隔 1 天
    interval = base.interval === 0 ? 1 : Math.max(1, Math.round(base.interval * base.ease));
  } else if (rating === 'fuzzy') {
    // 模糊：间隔减半，至少 1 天
    interval = Math.max(1, Math.round((base.interval || 1) / 2));
  } else {
    // 不认识：立即到期，降低学习倍率
    interval = 0;
    ease = Math.max(1.3, base.ease - 0.2);
  }

  return {
    interval,
    ease,
    nextDue: Date.now() + interval * 24 * 60 * 60 * 1000
  };
}

// 是否到期需要复习（无记录视为需要）
export function isDue(item, now = Date.now()) {
  if (!item) return true;
  return (item.nextDue || 0) <= now;
}

// 计算到期需要复习的知识点
export function dueKnowledgePoints(allNames, reviewState, now = Date.now()) {
  return (allNames || []).filter(name => {
    const item = reviewState[name];
    return isDue(item, now);
  });
}
