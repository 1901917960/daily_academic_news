import { describe, it, expect } from 'vitest';
import { buildReportMarkdown } from '../reportMarkdown';

const news = {
  title: '某公司宣布重大重组',
  source: '测试财经',
  date: '2026-09-22',
  url: 'https://example.com/news/1'
};

const analysis = {
  news_summary_cn: '公司宣布业务重组。',
  why_interesting: '值得关注。',
  institutional_gap: '制度存在空白。',
  stakeholder_map: '企业与员工博弈。',
  research_angles: [
    {
      field: '管理学',
      research_question: '重组如何影响员工效率？',
      theoretical_lens: '组织理论',
      methodology_hint: '实证分析',
      data_source_hint: '上市公司数据',
      related_journals: ['AMJ', 'CAR']
    }
  ],
  literature_angle: {
    paper_title: 'Corporate Governance',
    paper_url: 'https://doi.org/10.1/x',
    paper_year: 2023,
    paper_venue: 'RFS',
    paper_summary: '论文摘要。',
    limitations: '样本期较早。',
    research_question: '结合新闻的研究问题？',
    theoretical_lens: '治理理论',
    methodology_hint: 'DID',
    data_source_hint: '数据库',
    connection: '相关。'
  },
  comparative_insight: '类似现象。',
  key_insight: '核心洞见一句话。'
};

describe('buildReportMarkdown', () => {
  it('包含标题与来源', () => {
    const md = buildReportMarkdown(news, analysis);
    expect(md).toContain('# 某公司宣布重大重组');
    expect(md).toContain('来源：测试财经 · 2026-09-22');
    expect(md).toContain('原文：https://example.com/news/1');
  });

  it('包含所有章节', () => {
    const md = buildReportMarkdown(news, analysis);
    expect(md).toContain('## 新闻摘要');
    expect(md).toContain('## 为什么值得关注');
    expect(md).toContain('## 制度缝隙');
    expect(md).toContain('## 参与方策略');
    expect(md).toContain('## 研究切入点');
    expect(md).toContain('## 文献启发');
    expect(md).toContain('## 结构类比');
    expect(md).toContain('## 核心洞见');
  });

  it('研究角度条目完整', () => {
    const md = buildReportMarkdown(news, analysis);
    expect(md).toContain('### 1. 重组如何影响员工效率？');
    expect(md).toContain('- 目标期刊：AMJ、CAR');
  });

  it('文献启发包含链接格式', () => {
    const md = buildReportMarkdown(news, analysis);
    expect(md).toContain('[Corporate Governance](https://doi.org/10.1/x)（2023，RFS）');
  });

  it('可选章节缺失时安全跳过', () => {
    const md = buildReportMarkdown(news, {
      news_summary_cn: '摘要',
      why_interesting: '',
      research_angles: [],
      key_insight: '洞见'
    });
    expect(md).not.toContain('## 制度缝隙');
    expect(md).not.toContain('## 文献启发');
    expect(md).toContain('## 研究切入点');
    expect(md).toContain('## 核心洞见');
  });
});
