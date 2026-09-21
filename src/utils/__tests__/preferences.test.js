import { describe, it, expect } from 'vitest';
import { adjustWeights, buildPreferenceHint, setWeight, sortPreferenceTags, NEWS_TAGS } from '../preferences';

describe('adjustWeights', () => {
  it('喜欢的标签权重 +1', () => {
    expect(adjustWeights({}, ['公司治理'], 1)).toEqual({ 公司治理: 1 });
  });

  it('不喜欢的标签权重 -1', () => {
    expect(adjustWeights({ 公司治理: 1 }, ['公司治理'], -1)).toEqual({ 公司治理: 0 });
  });

  it('权重累计', () => {
    let w = adjustWeights({}, ['资本市场', '公司治理'], 1);
    w = adjustWeights(w, ['资本市场'], 1);
    expect(w).toEqual({ 资本市场: 2, 公司治理: 1 });
  });

  it('忽略空标签', () => {
    expect(adjustWeights({}, ['', null, undefined, '消费趋势'], 1)).toEqual({ 消费趋势: 1 });
  });

  it('不修改原对象', () => {
    const original = { 公司治理: 1 };
    adjustWeights(original, ['公司治理'], 1);
    expect(original).toEqual({ 公司治理: 1 });
  });
});

describe('buildPreferenceHint', () => {
  it('空权重返回空字符串', () => {
    expect(buildPreferenceHint({})).toBe('');
    expect(buildPreferenceHint(null)).toBe('');
  });

  it('生成偏好与不喜欢提示', () => {
    const hint = buildPreferenceHint({ 公司治理: 3, 资本市场: 1, 消费趋势: -2 });
    expect(hint).toContain('用户偏好的新闻类型：公司治理、资本市场');
    expect(hint).toContain('用户不喜欢的新闻类型：消费趋势');
  });

  it('按权重绝对值排序，且限制数量', () => {
    const hint = buildPreferenceHint({
      公司治理: 1, 资本市场: 5, 行业竞争: 3, 商业模式: 2, 科技创新: 4, 品牌营销: 6
    }, 3);
    expect(hint).toContain('品牌营销、资本市场、科技创新');
    expect(hint).not.toContain('公司治理');
  });

  it('权重为 0 的标签不出现', () => {
    expect(buildPreferenceHint({ 公司治理: 0 })).toBe('');
  });

  it('只有喜欢时不输出不喜欢部分', () => {
    const hint = buildPreferenceHint({ 公司治理: 1 });
    expect(hint).toContain('偏好');
    expect(hint).not.toContain('不喜欢');
  });
});

describe('setWeight', () => {
  it('设置指定标签权重', () => {
    expect(setWeight({ 公司治理: 1 }, '公司治理', 5)).toEqual({ 公司治理: 5 });
  });

  it('保留其他标签', () => {
    expect(setWeight({ 公司治理: 1, 资本市场: 2 }, '公司治理', 0))
      .toEqual({ 公司治理: 0, 资本市场: 2 });
  });

  it('不修改原对象', () => {
    const original = { 公司治理: 1 };
    setWeight(original, '公司治理', 9);
    expect(original).toEqual({ 公司治理: 1 });
  });

  it('空标签原样返回', () => {
    expect(setWeight({ 公司治理: 1 }, '', 5)).toEqual({ 公司治理: 1 });
  });
});

describe('sortPreferenceTags', () => {
  it('按权重从高到低排序', () => {
    const sorted = sortPreferenceTags({ A: 1, B: 5, C: -2 });
    expect(sorted).toEqual(['B', 'A', 'C']);
  });

  it('权重相同时固定标签优先', () => {
    const sorted = sortPreferenceTags(
      { 自定义: 2, 公司治理: 2 },
      ['公司治理', '资本市场']
    );
    expect(sorted).toEqual(['公司治理', '自定义']);
  });

  it('固定标签之间按固定顺序', () => {
    const sorted = sortPreferenceTags(
      { 资本市场: 0, 公司治理: 0 },
      ['公司治理', '资本市场']
    );
    expect(sorted).toEqual(['公司治理', '资本市场']);
  });

  it('固定标签列表非空时包含 12 个分类', () => {
    expect(NEWS_TAGS.length).toBe(12);
  });
});
