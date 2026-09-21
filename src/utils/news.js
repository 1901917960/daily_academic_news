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
        published: item.published || ''
      });
      if (candidates.length >= limit) return candidates;
    }
  }

  return candidates;
}
