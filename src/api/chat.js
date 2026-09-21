import { chatJson, chatTextStream } from './client';

const SYSTEM_PROMPT = `你是一位同时精通会计学、管理学和金融学的学术研究者，熟悉Contemporary Accounting Research、Journal of Finance、Academy of Management Journal、The Accounting Review等顶级期刊的研究范式与前沿进展。

【语言要求】所有输出必须使用简体中文（中国大陆规范用字），严禁使用繁体字。

【回答原则】
1. 基于用户提供的新闻和分析报告回答，不脱离上下文凭空发挥
2. 涉及学术问题时，要给出具体的理论框架、文献脉络、研究方法建议
3. 如果用户的提问超出你的知识范围，诚实说明，不要编造文献或数据
4. 回答简洁清晰，善用分点、举例，但不要过度堆砌术语
5. 如果用户问的是"这个方向怎么写论文"，要给出可操作的步骤
6. 如果用户问的是与研究无关的闲聊，礼貌地把话题拉回学术讨论

【数学公式格式要求（重要）】
- 行内公式：必须用单美元符号包裹，如 $y_t = \\alpha + \\beta x_t$
- 独立公式：必须用双美元符号包裹，且单独成段，如：
  $$
  y_t = \\alpha_1 + \\sum_{i=1}^{p} \\beta_{1i} y_{t-i} + \\varepsilon_{1t}
  $$
- 严禁使用以下任何格式包裹公式：
  × \\[ ... \\]
  × \\( ... \\)
  × 孤立的 [ ... ] 或 ( ... )
  × 用空行把公式和方括号分开
- 每条独立公式前后各保留一个空行，公式内部不要有多余空行
`;

// 流式对话：逐段产出回答内容
export async function* streamChatWithContext({ news, analysis, history, question }) {
  // 构造上下文摘要（避免每次都把完整长文塞进去，节省 token）
  const context = `【当前讨论的新闻】
标题：${news.title}
摘要：${news.summary}
来源：${news.source}
日期：${news.date}

【已有的学术分析】
核心事实：${analysis.news_summary_cn}
为何有价值：${analysis.why_interesting}
研究切入点：
${analysis.research_angles.map((a, i) => `${i + 1}. [${a.field}] ${a.research_question}
   理论：${a.theoretical_lens}
   方法：${a.methodology_hint}
   数据：${a.data_source_hint}`).join('\n')}
核心洞见：${analysis.key_insight}`;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: context },
    // 历史对话（只保留最近 10 轮，避免上下文过长）
    ...history.slice(-20).map(m => ({
      role: m.role,
      content: m.content
    })),
    { role: 'user', content: question }
  ];

  yield* chatTextStream({ messages, temperature: 0.7, timeout: 120000 });
}

// 从对话回答中提取知识点
export async function extractKnowledgeFromChat(answer) {
  const prompt = `请从以下 AI 回答中提取 2-4 个关键学术知识点。

AI 回答内容：
${answer}

要求：
1. 提取的知识点应该是具体的学术概念、理论、方法或工具
2. 每个知识点名称不超过 12 个字
3. 每个知识点必须分类到以下之一：理论框架 / 研究方法 / 研究领域 / 数据来源 / 核心概念
4. 知识点要具备通用性，可被后续讨论复用
5. 如果回答中没有明确的学术知识点，返回空数组
6. 所有内容使用简体中文

严格按 JSON 输出：
{
  "points": [
    { "name": "事件研究法", "category": "研究方法" },
    { "name": "制度理论", "category": "理论框架" }
  ]
}`;

  try {
    const parsed = await chatJson({
      system: '你是学术知识点提取助手。所有输出使用简体中文。',
      prompt,
      temperature: 0.3
    });
    return parsed.points || [];
  } catch (error) {
    console.error('从对话中提取知识点失败:', error);
    return [];
  }
}