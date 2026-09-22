// 学术文献检索结果处理（纯函数，便于测试）

// OpenAlex 的摘要以倒排索引存储，需要还原为文本
export function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';

  const positions = [];
  for (const [word, indexes] of Object.entries(invertedIndex)) {
    if (!Array.isArray(indexes)) continue;
    for (const i of indexes) {
      if (Number.isInteger(i) && i >= 0) positions[i] = word;
    }
  }

  return positions.filter(Boolean).join(' ').trim();
}

// 规范化 OpenAlex 检索结果
export function normalizeOpenAlexWorks(payload, { maxItems = 8 } = {}) {
  const results = payload && Array.isArray(payload.results) ? payload.results : [];

  return results
    .map(w => ({
      title: String((w && w.title) || '').trim(),
      abstract: reconstructAbstract(w && w.abstract_inverted_index),
      year: (w && w.publication_year) || 0,
      venue: (w && w.primary_location && w.primary_location.source && w.primary_location.source.display_name) || '',
      authors: ((w && w.authorships) || [])
        .slice(0, 3)
        .map(a => a && a.author && a.author.display_name)
        .filter(Boolean)
        .join('、'),
      url: (w && (w.doi || w.id)) || '',
      citedBy: (w && w.cited_by_count) || 0,
      isOpenAccess: !!(w && w.open_access && w.open_access.is_oa)
    }))
    .filter(p => p.title && p.abstract)
    .slice(0, maxItems);
}

// 按发表年份从新到旧排序（用于优先挑选较新的文献）
export function sortPapersByYear(papers) {
  return [...(papers || [])].sort((a, b) => (b.year || 0) - (a.year || 0));
}
