import { chatJson } from './client';

export async function extractKnowledgePoints({ news, analysis }) {
  const prompt = `请从以下新闻和学术分析中提取3-5个关键学术知识点。

新闻标题：${news.title}
新闻摘要：${news.summary}

学术分析：
${analysis.news_summary_cn}
${analysis.why_interesting}

研究切入点：
${analysis.research_angles.map((a, i) => `${i + 1}. [${a.field}] ${a.research_question}
   理论：${a.theoretical_lens}
   方法：${a.methodology_hint}`).join('\n')}

核心洞见：${analysis.key_insight}

要求：
1. 提取 3-5 个精炼的知识点名称，每个不超过 12 个字
2. 每个知识点必须分类到以下之一：理论框架 / 研究方法 / 研究领域 / 数据来源 / 核心概念
3. 知识点要具备通用性，可被后续新闻复用（比如"委托代理理论"、"双重差分法"、"文本分析"）
4. 避免过于具体的短语，应抽象为通用概念
5. 所有内容使用简体中文

严格按JSON输出：
{
  "points": [
    { "name": "委托代理理论", "category": "理论框架" },
    { "name": "双重差分法", "category": "研究方法" }
  ]
}`;

  const parsed = await chatJson({
    system: '你是学术知识点提取助手，负责从新闻分析中识别可复用的学术概念。所有输出使用简体中文。',
    prompt,
    temperature: 0.3
  });
  return parsed.points || [];
}