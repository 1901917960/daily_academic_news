// 新闻偏好学习：标签权重调整与提示生成（纯函数）

// 调整标签权重：喜欢 +1，不喜欢 -1
export function adjustWeights(weights, tags, delta) {
  const next = { ...(weights || {}) };
  for (const tag of tags || []) {
    if (!tag) continue;
    next[tag] = (next[tag] || 0) + delta;
  }
  return next;
}

// 根据权重生成给 AI 的偏好提示（空则返回空字符串）
export function buildPreferenceHint(weights, maxPerSide = 5) {
  const entries = Object.entries(weights || {});

  const liked = entries
    .filter(([, w]) => w >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPerSide)
    .map(([tag]) => tag);

  const disliked = entries
    .filter(([, w]) => w <= -1)
    .sort((a, b) => a[1] - b[1])
    .slice(0, maxPerSide)
    .map(([tag]) => tag);

  const parts = [];
  if (liked.length > 0) parts.push(`用户偏好的新闻类型：${liked.join('、')}`);
  if (disliked.length > 0) parts.push(`用户不喜欢的新闻类型：${disliked.join('、')}`);
  return parts.join('；');
}
