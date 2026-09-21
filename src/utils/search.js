// 精确搜索：按知识点名称匹配
// 排序优先级：名称完全匹配 > 前缀匹配 > 包含匹配
export function exactSearchNodes(nodes, query, limit = 20) {
  const lower = query.trim().toLowerCase();
  if (!lower) return [];

  const rank = (name) => {
    const n = name.toLowerCase();
    if (n === lower) return 0;
    if (n.startsWith(lower)) return 1;
    return 2;
  };

  return nodes
    .filter(n => n.name.toLowerCase().includes(lower))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(n => ({
      name: n.name,
      category: n.category,
      reason: n.name.toLowerCase() === lower ? '名称完全匹配' : ''
    }));
}
