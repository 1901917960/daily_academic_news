// 把报告渲染为 Markdown 文本（用于导出，纯函数）

export function buildReportMarkdown(news, analysis) {
  const lines = [];

  lines.push(`# ${news.title}`);
  lines.push('');
  lines.push(`> 来源：${news.source || '未知来源'} · ${news.date || ''}`);
  if (news.url) lines.push(`> 原文：${news.url}`);
  lines.push('');

  lines.push('## 新闻摘要');
  lines.push(analysis.news_summary_cn || '');
  lines.push('');

  lines.push('## 为什么值得关注');
  lines.push(analysis.why_interesting || '');
  lines.push('');

  if (analysis.institutional_gap) {
    lines.push('## 制度缝隙');
    lines.push(analysis.institutional_gap);
    lines.push('');
  }

  if (analysis.stakeholder_map) {
    lines.push('## 参与方策略');
    lines.push(analysis.stakeholder_map);
    lines.push('');
  }

  lines.push('## 研究切入点');
  (analysis.research_angles || []).forEach((a, i) => {
    lines.push('');
    lines.push(`### ${i + 1}. ${a.research_question}`);
    lines.push(`- 领域：${a.field || ''}`);
    lines.push(`- 理论视角：${a.theoretical_lens || ''}`);
    lines.push(`- 方法建议：${a.methodology_hint || ''}`);
    lines.push(`- 数据来源：${a.data_source_hint || ''}`);
    lines.push(`- 目标期刊：${(a.related_journals || []).join('、')}`);
  });
  lines.push('');

  const la = analysis.literature_angle;
  if (la) {
    lines.push('## 文献启发');
    const paperRef = la.paper_url
      ? `[${la.paper_title}](${la.paper_url})`
      : la.paper_title;
    lines.push(`- 文献：${paperRef}（${la.paper_year || '年份未知'}${la.paper_venue ? `，${la.paper_venue}` : ''}）`);
    lines.push(`- 论文概要：${la.paper_summary || ''}`);
    lines.push(`- 不足与展望：${la.limitations || ''}`);
    lines.push(`- 研究方向：${la.research_question || ''}`);
    lines.push(`- 理论视角：${la.theoretical_lens || ''}`);
    lines.push(`- 方法建议：${la.methodology_hint || ''}`);
    lines.push(`- 数据来源：${la.data_source_hint || ''}`);
    lines.push(`- 与新闻关联：${la.connection || ''}`);
    lines.push('');
  }

  if (analysis.comparative_insight) {
    lines.push('## 结构类比');
    lines.push(analysis.comparative_insight);
    lines.push('');
  }

  lines.push('## 核心洞见');
  lines.push(analysis.key_insight || '');
  lines.push('');
  lines.push('---');
  lines.push('由「每日学术洞察」生成');

  return lines.join('\n');
}
