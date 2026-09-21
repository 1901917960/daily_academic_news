import { describe, it, expect } from 'vitest';
import { adjustWeights, buildPreferenceHint } from '../preferences';

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
