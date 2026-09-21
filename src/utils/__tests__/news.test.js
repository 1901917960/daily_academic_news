import { describe, it, expect } from 'vitest';
import { formatNewsDate, mergeNewsCandidates } from '../news';

describe('formatNewsDate', () => {
  it('解析 Currents 日期格式', () => {
    expect(formatNewsDate('2026-09-20 06:45:10 +0000')).toBe('2026-09-20');
  });

  it('解析 ISO 日期格式', () => {
    expect(formatNewsDate('2026-09-20T06:45:10Z')).toBe('2026-09-20');
  });

  it('空值和无效日期返回空字符串', () => {
    expect(formatNewsDate('')).toBe('');
    expect(formatNewsDate('not-a-date')).toBe('');
    expect(formatNewsDate(undefined)).toBe('');
  });
});

describe('mergeNewsCandidates', () => {
  const listA = [
    { title: '  某公司裁员风波 ', description: ' 描述A ', url: 'http://a', author: '财经网', published: '2026-09-20 01:00:00 +0000' },
    { title: '消费降级新现象', description: '描述B', url: 'http://b', author: '新京报' }
  ];
  const listB = [
    { title: '某公司裁员风波', description: '重复项', url: 'http://a2', author: '另一家' },
    { title: '监管新规出台', description: '描述C', url: 'http://c', author: '证券时报' }
  ];

  it('按标题去重（忽略首尾空格）', () => {
    expect(mergeNewsCandidates([listA, listB]).length).toBe(3);
  });

  it('字段被裁剪空格', () => {
    const merged = mergeNewsCandidates([listA, listB]);
    expect(merged[0].title).toBe('某公司裁员风波');
    expect(merged[0].description).toBe('描述A');
  });

  it('不同来源的新闻均被保留', () => {
    const merged = mergeNewsCandidates([listA, listB]);
    expect(merged[2].title).toBe('监管新规出台');
  });

  it('过滤无标题和空标题项', () => {
    const merged = mergeNewsCandidates([[null, { description: '无标题' }, { title: '' }, { title: '有效新闻' }]]);
    expect(merged.length).toBe(1);
    expect(merged[0].title).toBe('有效新闻');
  });

  it('结果数量受 limit 限制', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ title: `新闻${i}` }));
    expect(mergeNewsCandidates([many], 60).length).toBe(60);
  });

  it('无效列表被安全忽略', () => {
    expect(mergeNewsCandidates([]).length).toBe(0);
    expect(mergeNewsCandidates([undefined, null]).length).toBe(0);
  });

  it('缺失字段兜底为空字符串', () => {
    const merged = mergeNewsCandidates([[{ title: '只有标题' }]]);
    expect(merged[0].description).toBe('');
    expect(merged[0].url).toBe('');
    expect(merged[0].author).toBe('');
  });
});
