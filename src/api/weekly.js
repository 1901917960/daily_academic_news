import { chatJson } from './client';

// 聚合多日报告生成周报
export async function generateWeeklyReport(records) {
  const summaryText = records
    .map(r => `【${r.date}】${r.news.title}｜核心洞见：${r.analysis.key_insight || ''}｜摘要：${(r.analysis.news_summary_cn || '').slice(0, 100)}`)
    .join('\n');

  const prompt = `以下是一周内的新闻与研究摘要（按日期）。请基于这些内容生成一份周报。

${summaryText}

严格按 JSON 输出：
{
  "title": "周报标题（不超过 20 字）",
  "overview": "本周整体回顾（100-150 字）",
  "themes": [
    { "name": "主题名（不超过 10 字）", "detail": "该主题下的现象与分析（60-100 字）" }
  ],
  "trend": "一周趋势观察（60-100 字）",
  "recommendation": "下周值得关注的方向或建议（60-100 字）"
}

要求：
1. themes 提供 2-4 个主题，归纳各日新闻的共同点
2. 所有内容使用简体中文
3. 基于给定内容归纳，不要编造`;

  return chatJson({
    system: '你是财经研究周报编辑，擅长归纳多日商业新闻的研究主题与趋势。所有输出使用简体中文。',
    prompt,
    temperature: 0.4,
    timeout: 120000
  });
}
