// 新闻日期格式化：Currents 返回格式如 "2026-09-20 06:45:10 +0000"
export function formatNewsDate(published) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(published || ''));
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  const d = new Date(published);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

// 解析发布时间为时间戳（兼容 "2026-09-20 06:45:10 +0000" 等格式）
export function parseNewsTimestamp(published) {
  const s = String(published || '');
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\s*([+-])(\d{2}):?(\d{2}))?/.exec(s);
  if (m) {
    const tz = m[3] ? `${m[3]}${m[4]}:${m[5]}` : 'Z';
    const t = Date.parse(`${m[1]}T${m[2]}${tz}`);
    if (!Number.isNaN(t)) return t;
  }
  const fallback = Date.parse(s);
  return Number.isNaN(fallback) ? 0 : fallback;
}

// 按发布时间从新到旧排序
export function sortCandidatesByDate(candidates) {
  return [...(candidates || [])].sort(
    (a, b) => parseNewsTimestamp(b.published) - parseNewsTimestamp(a.published)
  );
}

// 只保留最近 N 天内的新闻；数量不足时自动放宽窗口，仍不足则原样返回
export function filterRecentCandidates(candidates, { days = 2, minCount = 15 } = {}) {
  const list = candidates || [];
  for (const windowDays of [days, days + 1, days + 3]) {
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const recent = list.filter(c => {
      const t = parseNewsTimestamp(c.published);
      return t > 0 && t >= cutoff;
    });
    if (recent.length >= minCount) return recent;
  }
  return list;
}

// 合并多组新闻查询结果：按标题去重、过滤无效项、限制数量
export function mergeNewsCandidates(newsLists, limit = 60) {
  const seen = new Set();
  const candidates = [];

  for (const list of newsLists) {
    for (const item of list || []) {
      if (!item || !item.title) continue;
      const key = item.title.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        title: item.title.trim(),
        description: (item.description || '').trim(),
        url: item.url || '',
        author: item.author || '',
        published: item.published || '',
        image: item.image || ''
      });
      if (candidates.length >= limit) return candidates;
    }
  }

  return candidates;
}
