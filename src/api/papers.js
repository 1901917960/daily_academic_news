import { getAccessCode } from './client';
import { normalizeOpenAlexWorks, sortPapersByYear } from '../utils/papers';

// 检索与主题相关的文献：取相关度最高的若干条后，优先保留较新的
// 数据源偶发返回空结果，失败时退避重试
export async function fetchRelatedPapers(query) {
  const delays = [1200, 2400];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const papers = await requestPapers(query);
    if (papers.length > 0) {
      return sortPapersByYear(papers).slice(0, 8);
    }
    if (attempt < delays.length) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
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
