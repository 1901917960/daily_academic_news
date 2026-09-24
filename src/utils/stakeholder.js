// 参与方博弈关系图布局（纯函数，便于测试）
// 2 个节点：左右分布；3 个：三角形；更多：两列网格（奇数时最后一个居中）
export function computeStakeholderPositions(count, width = 320, height = 200) {
  const W = width;
  const H = height;

  if (count <= 0) return [];

  if (count === 1) {
    return [{ x: W * 0.5, y: H * 0.5 }];
  }

  if (count === 2) {
    return [
      { x: W * 0.28, y: H * 0.5 },
      { x: W * 0.72, y: H * 0.5 }
    ];
  }

  if (count === 3) {
    return [
      { x: W * 0.5, y: H * 0.18 },
      { x: W * 0.22, y: H * 0.8 },
      { x: W * 0.78, y: H * 0.8 }
    ];
  }

  const rows = Math.ceil(count / 2);
  const positions = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 2);
    const isLastOdd = count % 2 === 1 && i === count - 1;
    positions.push({
      x: isLastOdd ? W * 0.5 : (i % 2 === 0 ? W * 0.22 : W * 0.78),
      y: H * ((row + 0.5) / rows)
    });
  }
  return positions;
}
