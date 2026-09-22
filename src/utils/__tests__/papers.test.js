import { describe, it, expect } from 'vitest';
import { reconstructAbstract, normalizeOpenAlexWorks, sortPapersByYear } from '../papers';

describe('reconstructAbstract', () => {
  it('还原倒排索引为文本', () => {
    const inverted = {
      We: [0],
      study: [1],
      'corporate': [2],
      'governance.': [3]
    };
    expect(reconstructAbstract(inverted)).toBe('We study corporate governance.');
  });

  it('按位置正确排序（乱序输入）', () => {
    const inverted = {
      world: [2],
      hello: [0],
      beautiful: [1]
    };
    expect(reconstructAbstract(inverted)).toBe('hello beautiful world');
  });

  it('空输入返回空字符串', () => {
    expect(reconstructAbstract(null)).toBe('');
    expect(reconstructAbstract(undefined)).toBe('');
    expect(reconstructAbstract({})).toBe('');
    expect(reconstructAbstract('not-an-object')).toBe('');
  });

  it('忽略无效位置', () => {
    const inverted = { a: [0], b: ['x'], c: [1] };
    expect(reconstructAbstract(inverted)).toBe('a c');
  });
});

describe('normalizeOpenAlexWorks', () => {
  const payload = {
    results: [
      {
        title: 'Paper A',
        abstract_inverted_index: { First: [0], paper: [1] },
        publication_year: 2025,
        primary_location: { source: { display_name: 'Journal of Finance' } },
        authorships: [
          { author: { display_name: '张三' } },
          { author: { display_name: '李四' } },
          { author: { display_name: '王五' } },
          { author: { display_name: '赵六' } }
        ],
        doi: 'https://doi.org/10.1/abc',
        cited_by_count: 12,
        open_access: { is_oa: true }
      },
      {
        title: 'Paper B (无摘要)',
        abstract_inverted_index: null,
        publication_year: 2024
      },
      {
        title: '',
        abstract_inverted_index: { X: [0] },
        publication_year: 2023
      },
      {
        title: 'Paper C',
        abstract_inverted_index: { Only: [0], abstract: [1] },
        publication_year: 2022,
        id: 'https://openalex.org/W123',
        open_access: { is_oa: false }
      }
    ]
  };

  it('规范化字段并过滤无摘要/无标题条目', () => {
    const papers = normalizeOpenAlexWorks(payload);
    expect(papers.length).toBe(2);
    expect(papers[0].title).toBe('Paper A');
    expect(papers[0].abstract).toBe('First paper');
    expect(papers[0].venue).toBe('Journal of Finance');
    expect(papers[0].year).toBe(2025);
    expect(papers[0].url).toBe('https://doi.org/10.1/abc');
    expect(papers[0].isOpenAccess).toBe(true);
  });

  it('作者最多取 3 位并用顿号连接', () => {
    const papers = normalizeOpenAlexWorks(payload);
    expect(papers[0].authors).toBe('张三、李四、王五');
  });

  it('缺少 doi 时回退到 OpenAlex 链接', () => {
    const papers = normalizeOpenAlexWorks(payload);
    expect(papers[1].url).toBe('https://openalex.org/W123');
  });

  it('限制返回数量', () => {
    const many = {
      results: Array.from({ length: 20 }, (_, i) => ({
        title: `Paper ${i}`,
        abstract_inverted_index: { x: [0] },
        publication_year: 2025
      }))
    };
    expect(normalizeOpenAlexWorks(many, { maxItems: 5 }).length).toBe(5);
  });

  it('无效载荷返回空数组', () => {
    expect(normalizeOpenAlexWorks(null)).toEqual([]);
    expect(normalizeOpenAlexWorks({})).toEqual([]);
    expect(normalizeOpenAlexWorks({ results: 'bad' })).toEqual([]);
  });
});

describe('sortPapersByYear', () => {
  it('按年份从新到旧排序', () => {
    const papers = [
      { title: 'A', year: 2020 },
      { title: 'B', year: 2025 },
      { title: 'C', year: 2023 }
    ];
    expect(sortPapersByYear(papers).map(p => p.title)).toEqual(['B', 'C', 'A']);
  });

  it('缺少年份视为 0 排在最后', () => {
    const papers = [
      { title: 'A' },
      { title: 'B', year: 2024 }
    ];
    expect(sortPapersByYear(papers).map(p => p.title)).toEqual(['B', 'A']);
  });

  it('不修改原数组', () => {
    const papers = [{ title: 'A', year: 2020 }, { title: 'B', year: 2025 }];
    sortPapersByYear(papers);
    expect(papers[0].title).toBe('A');
  });
});
