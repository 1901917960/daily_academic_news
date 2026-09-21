// 构建国内新闻搜索链接（搜狗新闻，直接展示相关报道列表）
export function buildDomesticSearchUrl(query) {
  const q = String(query || '').trim();
  if (!q) return '';
  return 'https://news.sogou.com/news?query=' + encodeURIComponent(q);
}
