import { chatJson } from './client';
import { generateLiteratureAngle } from './literature';

const SYSTEM_PROMPT = `你是一位同时精通会计学、管理学和金融学的学术研究者，熟悉Contemporary Accounting Research、Journal of Finance、Academy of Management Journal等顶级期刊的选题偏好和研究范式，也擅长从财经与管理视角拆解商业现象背后的利益结构与制度逻辑。

【语言要求】所有输出必须使用简体中文（中国大陆规范用字），严禁使用繁体字、粤语词汇或英文原文（专有名词如期刊名、模型名除外）。`;

export async function analyzeNews(news) {
  const userPrompt = `以下是一条今日财经/商业新闻：

标题：${news.title}
摘要：${news.summary}
来源：${news.source}
日期：${news.date}

请从财经与管理的角度分析这个现象，并严格按照以下JSON格式输出：
{
  "news_summary_cn": "用2-3句话概括这个现象的核心事实",
  "why_interesting": "为什么这个现象值得从财经/管理角度分析，它反映了什么深层问题",
  "institutional_gap": "现象背后的制度缝隙或规则空白（若无则输出空字符串）",
  "stakeholder_map": "各方参与者的策略与博弈，如企业、员工、监管、消费者等（100字以内）",
  "research_angles": [
    {
      "field": "会计学 | 管理学 | 金融学 | 交叉领域",
      "research_question": "具体的可研究问题（完整的疑问句）",
      "theoretical_lens": "可以用的理论框架",
      "methodology_hint": "建议的研究方法",
      "data_source_hint": "可能的数据来源",
      "related_journals": ["期刊1", "期刊2"],
      "maturity": "成熟议题 | 新兴方向 | 前沿空白"
    }
  ],
  "comparative_insight": "与另一个相似现象或案例的结构类比（若无则输出空字符串）",
  "key_insight": "一句话点出最值得深挖的洞见",
  "paper_search_query": "用于在学术数据库检索相关文献的英文关键词（2-4 个学术通用词，空格分隔，不要标点，如 corporate governance）"
}

要求：
1. research_angles 提供2-3个方向
2. 研究问题必须是可回答的经验性问题
3. 理论框架和方法建议要具体
4. 如果学术价值有限，诚实指出
5. 语言要求（重要）：
- 所有字段的内容必须使用简体中文
- 严禁使用繁体字，例如：必须写"财务"不能写"財務"
- 专业术语使用中国大陆学术界的通用译法`;

  const analysis = await chatJson({
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.7,
    timeout: 120000
  });

  // 附加步骤：检索相关文献，从其"不足与展望"衍生研究方向（失败不影响主报告）
  try {
    const angle = await generateLiteratureAngle(news, analysis);
    if (angle) analysis.literature_angle = angle;
  } catch (e) {
    console.error('文献研究方向生成失败:', e);
  }

  return analysis;
}