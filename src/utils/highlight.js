function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 创建知识点高亮器：长词优先匹配，单次扫描，避免嵌套替换破坏结构
export function createKnowledgeHighlighter(names) {
  const terms = (names || [])
    .filter(name => typeof name === 'string' && name.length >= 2)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const regex = terms.length ? new RegExp(terms.join('|'), 'g') : null;

  return function highlight(text) {
    if (!text) return '';
    if (!regex) return escapeHtml(text);

    let result = '';
    let lastIndex = 0;
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      result += escapeHtml(text.slice(lastIndex, match.index));
      result += `<span class="knowledge-term">${escapeHtml(match[0])}</span>`;
      lastIndex = match.index + match[0].length;
    }
    result += escapeHtml(text.slice(lastIndex));
    return result;
  };
}
