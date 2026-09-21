import { describe, it, expect } from 'vitest';
import { buildDomesticSearchUrl } from '../links';

describe('buildDomesticSearchUrl', () => {
  it('构建搜狗新闻检索链接', () => {
    const url = buildDomesticSearchUrl('恒大 清盘');
    expect(url).toContain('news.sogou.com');
    expect(url).toContain('query=');
  });

  it('中文关键词被正确编码', () => {
    const url = buildDomesticSearchUrl('恒大清盘');
    expect(url).toContain(encodeURIComponent('恒大清盘'));
    expect(url).not.toContain('恒大清盘');
  });

  it('去除首尾空格', () => {
    expect(buildDomesticSearchUrl('  恒大  ')).toBe(buildDomesticSearchUrl('恒大'));
  });

  it('空查询返回空字符串', () => {
    expect(buildDomesticSearchUrl('')).toBe('');
    expect(buildDomesticSearchUrl('   ')).toBe('');
    expect(buildDomesticSearchUrl(null)).toBe('');
    expect(buildDomesticSearchUrl(undefined)).toBe('');
  });
});
