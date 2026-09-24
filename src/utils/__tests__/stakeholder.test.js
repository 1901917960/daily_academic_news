import { describe, it, expect } from 'vitest';
import {
  computeStakeholderPositions,
  computeStakeholderLayout,
  STAKEHOLDER_METRICS
} from '../stakeholder';

const W = 320;
const H = 200;
const M = STAKEHOLDER_METRICS;

function labelOverlapsNode(e, n) {
  return (
    Math.abs(e.lx - n.x) < M.nodeHalfW + M.labelHalfW &&
    Math.abs(e.ly - n.y) < M.nodeHalfH + M.labelHalfH
  );
}

function labelsOverlap(a, b) {
  return (
    Math.abs(a.lx - b.lx) < M.labelHalfW * 2 &&
    Math.abs(a.ly - b.ly) < M.labelHalfH * 2
  );
}

function makeNodes(n) {
  return Array.from({ length: n }, (_, i) => ({ name: `N${i}`, desc: '策略' }));
}

function allPairs(n) {
  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      edges.push({ from: `N${i}`, to: `N${j}`, label: '关系' });
    }
  }
  return edges;
}

function star(n) {
  const edges = [];
  for (let i = 1; i < n; i++) edges.push({ from: 'N0', to: `N${i}`, label: '关系' });
  return edges;
}

function chain(n) {
  const edges = [];
  for (let i = 0; i < n - 1; i++) edges.push({ from: `N${i}`, to: `N${i + 1}`, label: '关系' });
  return edges;
}

describe('computeStakeholderPositions', () => {
  it('返回与节点数量一致的位置', () => {
    for (let n = 1; n <= 6; n++) {
      expect(computeStakeholderPositions(n, W, H).length).toBe(n);
    }
  });

  it('所有位置在画布范围内', () => {
    for (let n = 1; n <= 6; n++) {
      for (const p of computeStakeholderPositions(n, W, H)) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(W);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(H);
      }
    }
  });

  it('任意两个节点卡片不重叠', () => {
    for (let n = 2; n <= 6; n++) {
      const positions = computeStakeholderPositions(n, W, H);
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const overlap =
            Math.abs(positions[i].x - positions[j].x) < M.nodeHalfW * 2 &&
            Math.abs(positions[i].y - positions[j].y) < M.nodeHalfH * 2;
          expect(overlap, `节点 ${i} 与 ${j} 重叠（共 ${n} 个节点）`).toBe(false);
        }
      }
    }
  });

  it('两个节点左右分布', () => {
    const [a, b] = computeStakeholderPositions(2, W, H);
    expect(a.x).toBeLessThan(b.x);
    expect(a.y).toBe(b.y);
  });

  it('奇数节点时最后一个居中', () => {
    const positions = computeStakeholderPositions(5, W, H);
    expect(positions[4].x).toBeCloseTo(W / 2);
  });

  it('空输入返回空数组', () => {
    expect(computeStakeholderPositions(0, W, H)).toEqual([]);
  });
});

describe('computeStakeholderLayout', () => {
  const cases = [
    { name: '3 节点全连通', nodes: 3, edges: allPairs(3) },
    { name: '4 节点全连通', nodes: 4, edges: allPairs(4) },
    { name: '5 节点星形', nodes: 5, edges: star(5) },
    { name: '6 节点链式', nodes: 6, edges: chain(6) },
    { name: '5 节点星形+额外边', nodes: 5, edges: [...star(5), { from: 'N2', to: 'N4', label: '关系' }] }
  ];

  for (const c of cases) {
    it(`${c.name}：标签不遮挡任何节点`, () => {
      const layout = computeStakeholderLayout(makeNodes(c.nodes), c.edges, W, H);
      for (const e of layout.edges) {
        for (const n of layout.nodes) {
          expect(
            labelOverlapsNode(e, n),
            `标签（${e.from}→${e.to}）遮挡节点 ${n.name}`
          ).toBe(false);
        }
      }
    });

    it(`${c.name}：标签之间不重叠`, () => {
      const layout = computeStakeholderLayout(makeNodes(c.nodes), c.edges, W, H);
      for (let i = 0; i < layout.edges.length; i++) {
        for (let j = i + 1; j < layout.edges.length; j++) {
          expect(labelsOverlap(layout.edges[i], layout.edges[j])).toBe(false);
        }
      }
    });
  }

  it('镜像边去重', () => {
    const layout = computeStakeholderLayout(makeNodes(2), [
      { from: 'N0', to: 'N1', label: 'A' },
      { from: 'N1', to: 'N0', label: 'B' }
    ], W, H);
    expect(layout.edges.length).toBe(1);
    expect(layout.edges[0].label).toBe('A');
  });

  it('自环与未知节点被过滤', () => {
    const layout = computeStakeholderLayout(makeNodes(2), [
      { from: 'N0', to: 'N0', label: 'x' },
      { from: 'N0', to: 'N9', label: 'y' }
    ], W, H);
    expect(layout.edges.length).toBe(0);
  });

  it('标签在画布范围内', () => {
    const layout = computeStakeholderLayout(makeNodes(5), star(5), W, H);
    for (const e of layout.edges) {
      expect(e.lx).toBeGreaterThanOrEqual(0);
      expect(e.lx).toBeLessThanOrEqual(W);
      expect(e.ly).toBeGreaterThanOrEqual(0);
      expect(e.ly).toBeLessThanOrEqual(H);
    }
  });
});
