import { getAccessCode } from './client';
import { normalizeOpenAlexWorks, sortPapersByYear } from '../utils/papers';

// 检索与主题相关的文献：取相关度最高的若干条后，优先保留较新的
// 数据源偶发返回空结果，失败时重试一次
export async function fetchRelatedPapers(query) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const papers = await requestPapers(query);
    if (papers.length > 0) {
      return sortPapersByYear(papers).slice(0, 8);
    }
    if (attempt === 0) {
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
  }
  return [];
}

async function requestPapers(query) {
  const params = new URLSearchParams({ query });

  const response = await fetch(`/api/papers?${params}`, {
    headers: { 'x-access-code': getAccessCode() }
  });

  if (!response.ok) {
    let detail = '';
    try {
      const data = await response.json();
      detail = data?.error?.message || '';
    } catch { /* 忽略解析失败 */ }
    throw new Error(`文献检索失败: ${response.status}${detail ? `（${detail}）` : ''}`);
  }

  const payload = await response.json();
  return normalizeOpenAlexWorks(payload, { maxItems: 25 });
}
