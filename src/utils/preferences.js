// 新闻偏好学习：标签权重调整、提示生成、排序（纯函数）

// 固定的新闻类型标签（用于偏好学习，避免自由生成导致权重分散）
export const NEWS_TAGS = [
  '公司治理', '劳资关系', '消费趋势', '资本市场', '监管政策', '行业竞争',
  '商业模式', '商业伦理', '宏观经济', '企业管理', '品牌营销', '科技创新'
];

// 调整标签权重：喜欢 +1，不喜欢 -1
export function adjustWeights(weights, tags, delta) {
  const next = { ...(weights || {}) };
  for (const tag of tags || []) {
    if (!tag) continue;
    next[tag] = (next[tag] || 0) + delta;
  }
  return next;
}

// 直接设置某标签权重
export function setWeight(weights, tag, value) {
  if (!tag) return { ...(weights || {}) };
  return { ...(weights || {}), [tag]: value };
}

// 按权重从高到低排序标签；权重相同时固定标签优先，其次按名称
export function sortPreferenceTags(weights, fixedTags = []) {
  const fixedOrder = new Map(fixedTags.map((t, i) => [t, i]));
  return Object.keys(weights || {}).sort((a, b) => {
    const wa = weights[a] || 0;
    const wb = weights[b] || 0;
    if (wb !== wa) return wb - wa;
    const oa = fixedOrder.has(a) ? fixedOrder.get(a) : Number.MAX_SAFE_INTEGER;
    const ob = fixedOrder.has(b) ? fixedOrder.get(b) : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });
}

// 从历史记录中撤回一条"喜欢"记录（撤销锁定用）
// 返回 { history, found }；found=false 表示没有对应记录，不应调整权重
export function retractLike(history, meta) {
  const list = [...(history || [])];
  if (!meta || !meta.date) return { history: list, found: false };

  const idx = list.findIndex(h =>
    h.action === 'like' &&
    h.date === meta.date &&
    (!meta.title || h.title === meta.title)
  );
  if (idx === -1) return { history: list, found: false };

  list.splice(idx, 1);
  return { history: list, found: true };
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
