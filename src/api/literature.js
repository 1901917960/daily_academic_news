import { chatJson } from './client';
import { fetchRelatedPapers } from './papers';

// 基于最新文献的"不足与展望"，生成与今日新闻相关的研究方向
export async function generateLiteratureAngle(news, analysis) {
  const query = String(analysis?.paper_search_query || '').trim();
  if (!query) return null;

  const papers = await fetchRelatedPapers(query);
  if (papers.length === 0) return null;

  const listText = papers
    .map((p, i) => {
      const venue = p.venue ? `（${p.venue}）` : '';
      return `${i + 1}. [${p.year}] ${p.title}${venue} — ${p.abstract.slice(0, 280)}`;
    })
    .join('\n');

  const prompt = `以下是一条今日新闻和一批刚检索到的相关学术文献（编号、年份、标题、期刊、摘要）。请选出一篇与新闻主题最相关、较新的文献，并基于它生成一个与今日新闻结合的研究方向。

今日新闻：
标题：${news.title}
摘要：${news.summary}

候选文献：
${listText}

要求：
1. 选择与新闻主题关联最紧密的一篇（优先年份较新的）
2. paper_summary：用 2-3 句话概括该论文的核心内容（简体中文）。只能基于候选列表中给出的摘要概括，严禁添加摘要中不存在的结论、数据或细节
3. limitations：基于摘要与领域常识，推断该论文的"不足与展望"（1-2 句，简体中文）
4. research_question：结合今日新闻，提出一个可回答的经验性问题（完整疑问句）
5. 理论框架、研究方法、数据来源建议要具体
6. connection：说明该文献与今日新闻的关联（1-2 句）
7. 所有内容使用简体中文（论文标题保留原文）
8. 严禁编造文献：只能从候选列表中选择，不得虚构论文标题、期刊或作者

严格按 JSON 输出：
{
  "index": 选中文献的编号（整数）,
  "paper_summary": "论文核心内容概括（仅基于摘要）",
  "limitations": "该论文的不足与展望（基于摘要推断）",
  "research_question": "结合今日新闻衍生的研究问题",
  "theoretical_lens": "可用的理论框架",
  "methodology_hint": "建议的研究方法",
  "data_source_hint": "可能的数据来源",
  "connection": "该文献与今日新闻的关联"
}`;

  const data = await chatJson({
    system: '你是学术文献分析助手，擅长从文献摘要中识别研究缺口并结合现实事件提出研究问题。所有输出使用简体中文。',
    prompt,
    temperature: 0.3
  });

  // 防幻觉校验：核心字段必须完整，否则视为生成失败
  const researchQuestion = String(data?.research_question || '').trim();
  const paperSummary = String(data?.paper_summary || '').trim();
  if (researchQuestion.length < 6 || paperSummary.length < 10) {
    console.warn('文献方向输出不完整，已丢弃:', { researchQuestion, paperSummary });
    return null;
  }

  // 字段截断，防止超长异常输出
  const clip = (text, max) => String(text || '').trim().slice(0, max);

  const idx = Number.isInteger(data?.index) ? data.index : 1;
  const paper = papers[idx - 1] || papers[0];

  // 论文信息一律使用 OpenAlex 的真实数据，不使用 AI 输出，杜绝编造文献
  return {
    paper_title: paper.title,
    paper_authors: paper.authors,
    paper_venue: paper.venue,
    paper_year: paper.year,
    paper_url: paper.url,
    is_open_access: paper.isOpenAccess,
    paper_summary: clip(data?.paper_summary, 400),
    limitations: clip(data?.limitations, 300),
    research_question: researchQuestion,
    theoretical_lens: clip(data?.theoretical_lens, 200),
    methodology_hint: clip(data?.methodology_hint, 200),
    data_source_hint: clip(data?.data_source_hint, 200),
    connection: clip(data?.connection, 300)
  };
}
