import { describe, it, expect } from 'vitest';
import {
  buildCategoryNodes,
  buildCategoryEdges,
  selectDetailNodes,
  buildDetailEdges
} from '../graphViews';

const CATEGORIES = ['理论框架', '研究方法', '研究领域'];

const allNodes = [
  { id: 'auto_委托代理理论', name: '委托代理理论', category: '理论框架' },
  { id: 'auto_制度理论', name: '制度理论', category: '理论框架' },
  { id: 'auto_双重差分法', name: '双重差分法', category: '研究方法' },
  { id: 'auto_事件研究法', name: '事件研究法', category: '研究方法' },
  { id: 'auto_公司治理', name: '公司治理', category: '研究领域' }
];

const allEdges = [
  { id: 'e1', source: 'auto_委托代理理论', target: 'auto_双重差分法' },
  { id: 'e2', source: 'auto_制度理论', target: 'auto_双重差分法' },
  { id: 'e3', source: 'auto_双重差分法', target: 'auto_公司治理' },
  { id: 'e4', source: 'auto_事件研究法', target: 'auto_事件研究法' }
];

describe('buildCategoryNodes', () => {
  it('按分类聚合，计数正确', () => {
    const nodes = buildCategoryNodes(allNodes, CATEGORIES);
    expect(nodes.length).toBe(3);
    expect(nodes.find(n => n.category === '理论框架').count).toBe(2);
    expect(nodes.find(n => n.category === '研究方法').count).toBe(2);
    expect(nodes.find(n => n.category === '研究领域').count).toBe(1);
  });

  it('跳过空分类', () => {
    const nodes = buildCategoryNodes(allNodes, [...CATEGORIES, '数据来源']);
    expect(nodes.some(n => n.category === '数据来源')).toBe(false);
  });

  it('应用缓存的分类节点位置', () => {
    const positions = new Map([['cat_研究方法', { x: 111, y: 222 }]]);
    const nodes = buildCategoryNodes(allNodes, CATEGORIES, positions);
    const method = nodes.find(n => n.category === '研究方法');
    expect(method.x).toBe(111);
    expect(method.y).toBe(222);
  });
});

describe('buildCategoryEdges', () => {
  it('跨类连线聚合计权，同类连线被忽略', () => {
    const edges = buildCategoryEdges(allNodes, allEdges);
    const theoryMethod = edges.find(e =>
      [e.a, e.b].sort().join('||') === ['理论框架', '研究方法'].sort().join('||')
    );
    expect(theoryMethod).toBeTruthy();
    expect(theoryMethod.weight).toBe(2);
    expect(theoryMethod.isCategoryEdge).toBe(true);
    expect(theoryMethod.source).toMatch(/^cat_/);
    expect(theoryMethod.label).toContain('条关联');
  });

  it('不产生分类自身连线', () => {
    const edges = buildCategoryEdges(allNodes, allEdges);
    expect(edges.every(e => e.a !== e.b)).toBe(true);
  });
});

describe('selectDetailNodes', () => {
  it('仅返回该分类的知识点（关闭关联显示时）', () => {
    const { visible, primaryIds } = selectDetailNodes(allNodes, allEdges, '研究方法', false);
    expect(visible.length).toBe(2);
    expect(visible.every(n => primaryIds.has(n.id))).toBe(true);
  });

  it('包含有关联的其他类知识点（开启关联显示时）', () => {
    const { visible, primaryIds } = selectDetailNodes(allNodes, allEdges, '研究方法', true);
    // 2 个本类节点 + 3 个有关联的其他类节点（委托代理理论、制度理论、公司治理）
    expect(visible.length).toBe(5);
    expect(visible.some(n => n.name === '委托代理理论')).toBe(true);
    expect(visible.some(n => n.name === '制度理论')).toBe(true);
    expect(visible.some(n => n.name === '公司治理')).toBe(true);
    expect(primaryIds.has('auto_双重差分法')).toBe(true);
    expect(primaryIds.has('auto_委托代理理论')).toBe(false);
  });

  it('邻居节点同时包含本类节点与其关联节点', () => {
    const { visible, primaryIds } = selectDetailNodes(allNodes, allEdges, '研究领域', true);
    expect(visible.length).toBe(2);
    expect(visible.some(n => n.name === '公司治理')).toBe(true);
    expect(visible.some(n => n.name === '双重差分法')).toBe(true);
    expect(primaryIds.size).toBe(1);
  });
});

describe('buildDetailEdges', () => {
  it('只保留可见节点之间的连线', () => {
    const { visible } = selectDetailNodes(allNodes, allEdges, '研究方法', false);
    const edges = buildDetailEdges(allEdges, visible);
    expect(edges.length).toBe(1);
    expect(edges[0].id).toBe('e4');
  });

  it('关联节点加入后跨类连线可见', () => {
    const { visible } = selectDetailNodes(allNodes, allEdges, '研究方法', true);
    const edges = buildDetailEdges(allEdges, visible);
    expect(edges.some(e => e.id === 'e1')).toBe(true);
    expect(edges.some(e => e.id === 'e3')).toBe(true);
  });
});
