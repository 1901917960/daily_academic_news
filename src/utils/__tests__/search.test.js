import { describe, it, expect } from 'vitest';
import { exactSearchNodes } from '../search';

const nodes = [
  { name: '双重差分法', category: '研究方法' },
  { name: '差分法改进', category: '研究方法' },
  { name: '双重差分模型', category: '核心概念' },
  { name: '事件研究法', category: '研究方法' },
  { name: 'DID方法', category: '研究方法' }
];

describe('exactSearchNodes', () => {
  it('完全匹配并标注原因', () => {
    const r = exactSearchNodes(nodes, '双重差分法');
    expect(r.length).toBe(1);
    expect(r[0].name).toBe('双重差分法');
    expect(r[0].reason).toBe('名称完全匹配');
  });

  it('前缀匹配返回所有以该词开头的节点', () => {
    const r = exactSearchNodes(nodes, '双重差分');
    expect(r.length).toBe(2);
    expect(r.some(x => x.name === '双重差分法')).toBe(true);
    expect(r.some(x => x.name === '双重差分模型')).toBe(true);
  });

  it('前缀匹配优先于包含匹配', () => {
    const r = exactSearchNodes(nodes, '差分');
    expect(r[0].name).toBe('差分法改进');
  });

  it('非完全匹配不标注原因', () => {
    const r = exactSearchNodes(nodes, '差分');
    expect(r.every(x => !x.reason)).toBe(true);
  });

  it('英文名称不区分大小写', () => {
    const r = exactSearchNodes(nodes, 'did');
    expect(r.length).toBe(1);
    expect(r[0].name).toBe('DID方法');
  });

  it('无匹配与空查询返回空数组', () => {
    expect(exactSearchNodes(nodes, '神经网络')).toEqual([]);
    expect(exactSearchNodes(nodes, '   ')).toEqual([]);
  });

  it('结果数量受 limit 限制', () => {
    expect(exactSearchNodes(nodes, '法', 2).length).toBe(2);
  });

  it('结果携带分类信息', () => {
    const r = exactSearchNodes(nodes, '事件研究');
    expect(r[0].category).toBe('研究方法');
  });
});
