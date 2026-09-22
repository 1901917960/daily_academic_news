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
2. paper_summary：用 2-3 句话概括该论文的核心内容（简体中文）
3. limitations：基于摘要与领域常识，推断该论文的"不足与展望"（1-2 句，简体中文）
4. research_question：结合今日新闻，提出一个可回答的经验性问题（完整疑问句）
5. 理论框架、研究方法、数据来源建议要具体
6. connection：说明该文献与今日新闻的关联（1-2 句）
7. 所有内容使用简体中文（论文标题保留原文）

严格按 JSON 输出：
{
  "index": 选中文献的编号（整数）,
  "paper_summary": "论文核心内容概括",
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

  const idx = Number.isInteger(data?.index) ? data.index : 1;
  const paper = papers[idx - 1] || papers[0];

  return {
    paper_title: paper.title,
    paper_authors: paper.authors,
    paper_venue: paper.venue,
    paper_year: paper.year,
    paper_url: paper.url,
    is_open_access: paper.isOpenAccess,
    paper_summary: data?.paper_summary || '',
    limitations: data?.limitations || '',
    research_question: data?.research_question || '',
    theoretical_lens: data?.theoretical_lens || '',
    methodology_hint: data?.methodology_hint || '',
    data_source_hint: data?.data_source_hint || '',
    connection: data?.connection || ''
  };
}
