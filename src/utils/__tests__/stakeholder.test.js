import { describe, it, expect } from 'vitest';
import { computeStakeholderPositions } from '../stakeholder';

const W = 320;
const H = 200;

// 节点卡片按最大尺寸换算到 viewBox 单位（容器宽 440px、卡片最大宽 104px）
const HALF_W = (104 / 440) * W / 2; // ≈ 38
const HALF_H = 15; // 卡片高度约 40px 换算

function overlaps(a, b) {
  return Math.abs(a.x - b.x) < HALF_W * 2 && Math.abs(a.y - b.y) < HALF_H * 2;
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
          expect(
            overlaps(positions[i], positions[j]),
            `节点 ${i} 与 ${j} 重叠（共 ${n} 个节点）`
          ).toBe(false);
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
