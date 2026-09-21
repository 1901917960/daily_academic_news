import { chatJson, getAccessCode } from './client';
import { formatNewsDate, mergeNewsCandidates } from '../utils/news';
import { buildPreferenceHint } from '../utils/preferences';
import { getPreferences } from '../storage';

// 多组关键词抓取，扩大当日候选范围
const QUERIES = [
  { endpoint: 'search', keywords: '公司 OR 企业 OR 员工 OR 裁员 OR 职场' },
  { endpoint: 'search', keywords: '消费 OR 品牌 OR 价格 OR 电商 OR 直播' },
  { endpoint: 'search', keywords: '行业 OR 监管 OR 政策 OR 竞争 OR 产能' },
  { endpoint: 'latest', keywords: '' }
];

// 固定的新闻类型标签（用于偏好学习，避免自由生成导致权重分散）
const NEWS_TAGS = [
  '公司治理', '劳资关系', '消费趋势', '资本市场', '监管政策', '行业竞争',
  '商业模式', '商业伦理', '宏观经济', '企业管理', '品牌营销', '科技创新'
];

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 抓取当日财经/商业新闻候选（经由同源代理，密钥保存在服务端）
async function fetchCandidates() {
  const results = await Promise.allSettled(
    QUERIES.map(q => {
      const params = new URLSearchParams({
        language: 'zh',
        category: 'business',
        page_size: '20'
      });
      if (q.keywords) params.set('keywords', q.keywords);

      const endpoint = q.endpoint === 'search' ? 'search' : 'latest-news';
      const url = `/api/news/${endpoint}?${params}`;

      return fetch(url, {
        headers: { 'x-access-code': getAccessCode() }
      }).then(async r => {
        if (!r.ok) {
          let detail = '';
          try {
            const data = await r.json();
            detail = data?.error?.message || '';
          } catch { /* 忽略解析失败 */ }
          throw new Error(`新闻接口请求失败: ${r.status}${detail ? `（${detail}）` : ''}`);
        }
        return r.json();
      });
    })
  );

  const lists = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value.news || []);

  return mergeNewsCandidates(lists, 60);
}

// 让 AI 从当日新闻中挑选最有分析价值的一条
async function pickMostInteresting(candidates) {
  const listText = candidates
    .map((c, i) => {
      const desc = c.description ? c.description.slice(0, 80) : '（无摘要）';
      return `${i + 1}. [${c.author || '未知来源'}] ${c.title} — ${desc}`;
    })
    .join('\n');

  // 用户历史偏好（来自"确认本日/重新生成"的学习）
  const preferenceHint = buildPreferenceHint(getPreferences().tags);
  const preferenceSection = preferenceHint
    ? `\n用户历史偏好（仅供参考，不要因此降低选材标准）：\n${preferenceHint}\n`
    : '';

  const prompt = `以下是刚刚抓取的今日财经/商业新闻候选（编号、来源、标题、摘要）。请选出最适合做"财经/管理深度分析"的 1 条。
${preferenceSection}
候选列表：
${listText}

选择标准（按重要性排序）：
1. 有意思：有画面感、有商业张力、能引发讨论（企业治理冲突、劳资博弈、消费现象、行业转折、监管变化、商业伦理、公司战略）
2. 有分析空间：能引出利益相关方博弈、制度缝隙或可研究的经验性问题
3. 时效性：优先选择今天发生或正在发酵的事件
4. 用户偏好：在其他条件相近时，优先选择用户偏好的类型，避开用户不喜欢的类型
避免：纯行情播报（股价涨跌、指数点位）、纯公告、纯宏观数据发布、体育娱乐类新闻

严格按 JSON 输出：
{
  "index": 选中新闻的编号（整数）,
  "reason": "选择理由（不超过 25 字）",
  "title_cn": "规范化后的简体中文标题（不超过 30 字）",
  "summary_cn": "180-260 字的导语，交代事件事实、涉及的利益相关方与商业张力",
  "search_keywords": "用于在中国大陆搜索引擎查找该事件国内报道的关键词（3-6 个词，空格分隔，不含标点，包含事件核心主体）",
  "tags": ["从以下固定分类中选择 1-3 个最贴合的标签：${NEWS_TAGS.join('、')}"]
}

要求：
- title_cn 与 summary_cn 必须使用简体中文（大陆规范用字），繁体或英文内容请转写为简体中文
- summary_cn 只能基于候选摘要中的事实改写，不得编造具体数字、人名或引语；摘要信息不足时可概括，但不可虚构
- tags 必须从给定的固定分类中选择，不得自创
- 如果所有候选都不理想，仍然选择相对最有分析价值的一条`;

  return chatJson({
    system: '你是财经媒体的资深主编，擅长从当日新闻中挑选最具分析价值的选题。所有输出使用简体中文。',
    prompt,
    temperature: 0.3
  });
}

// 获取今日新闻：实时抓取 + AI 筛选
export async function fetchDailyNews() {
  const candidates = await fetchCandidates();
  if (candidates.length === 0) {
    throw new Error('未获取到今日新闻，可能是新闻源暂时不可用，请稍后重试');
  }

  let picked = null;
  try {
    picked = await pickMostInteresting(candidates);
  } catch (e) {
    console.error('新闻筛选失败，回退到最新一条:', e);
  }

  const idx = Number.isInteger(picked?.index) ? picked.index : 1;
  const candidate = candidates[idx - 1] || candidates[0];

  return {
    title: (picked?.title_cn || candidate.title).trim(),
    summary: (picked?.summary_cn || candidate.description || candidate.title).trim(),
    source: candidate.author || '实时新闻',
    url: candidate.url,
    date: formatNewsDate(candidate.published) || todayKey(),
    originalTitle: candidate.title,
    domesticQuery: (picked?.search_keywords || '').trim(),
    tags: Array.isArray(picked?.tags)
      ? picked.tags.filter(t => NEWS_TAGS.includes(t)).slice(0, 3)
      : []
  };
}
