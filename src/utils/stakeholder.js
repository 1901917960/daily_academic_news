// 参与方博弈关系图布局（纯函数，便于测试）

// 尺寸常量（viewBox 单位，用于碰撞检测，需与 CSS 中的卡片/标签尺寸保持一致）
export const STAKEHOLDER_METRICS = {
  nodeHalfW: 38,   // 节点卡片半宽（最大 104px，容器 440px）
  nodeHalfH: 15,   // 节点卡片半高（约 40px）
  labelHalfW: 22,  // 关系标签半宽（最多约 4 个字）
  labelHalfH: 8    // 关系标签半高
};

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

// 与所有节点的最小分离度（>0 表示不重叠任何节点卡片）
function nodeClearance(x, y, nodes) {
  const m = STAKEHOLDER_METRICS;
  let min = Infinity;
  for (const n of nodes) {
    const dW = Math.abs(x - n.x) - (m.nodeHalfW + m.labelHalfW);
    const dH = Math.abs(y - n.y) - (m.nodeHalfH + m.labelHalfH);
    min = Math.min(min, Math.max(dW, dH));
  }
  return min;
}

// 与已放置标签的最小分离度（>0 表示不重叠）
function labelClearance(x, y, labels) {
  const m = STAKEHOLDER_METRICS;
  let min = Infinity;
  for (const p of labels) {
    const dW = Math.abs(x - p.x) - m.labelHalfW * 2;
    const dH = Math.abs(y - p.y) - m.labelHalfH * 2;
    min = Math.min(min, Math.max(dW, dH));
  }
  return min;
}

// 为关系标签挑选一个不遮挡节点、尽量不与其他标签重叠的位置
function findLabelPosition(a, b, nodes, placedLabels, edgeIndex, W, H) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;

  const baseSide = edgeIndex % 2 === 0 ? 1 : -1;
  const sides = [baseSide, -baseSide];
  const ts = [0.45, 0.35, 0.55, 0.25, 0.65, 0.3, 0.6, 0.2, 0.7];
  const sideOffset = 12;

  let bestNodeOnly = null;
  let bestNodeOnlyClearance = -Infinity;
  let bestAny = null;
  let bestAnyClearance = -Infinity;

  for (const side of sides) {
    for (const t of ts) {
      const x = a.x + dx * t + px * side * sideOffset;
      const y = a.y + dy * t + py * side * sideOffset;

      const nc = nodeClearance(x, y, nodes);
      const lc = labelClearance(x, y, placedLabels);
      const total = Math.min(nc, lc);

      // 理想位置：既不遮节点也不重叠标签
      if (nc > 0 && lc > 0) return { x, y };

      // 次优：至少不遮节点
      if (nc > 0 && nc > bestNodeOnlyClearance) {
        bestNodeOnlyClearance = nc;
        bestNodeOnly = { x, y };
      }

      if (total > bestAnyClearance) {
        bestAnyClearance = total;
        bestAny = { x, y };
      }
    }
  }

  // 保证标签尽量落在画布内
  const fallback = bestNodeOnly || bestAny || { x: a.x + dx * 0.45, y: a.y + dy * 0.45 };
  fallback.x = Math.max(20, Math.min(W - 20, fallback.x));
  fallback.y = Math.max(14, Math.min(H - 14, fallback.y));
  return fallback;
}

// 计算完整布局：节点位置 + 连线端点 + 关系标签位置（自动避让）
export function computeStakeholderLayout(nodes, edges, width = 320, height = 200) {
  const list = (nodes || []).slice(0, 6);
  const positions = computeStakeholderPositions(list.length, width, height);
  const positioned = list.map((n, i) => ({ ...n, ...positions[i] }));

  const seen = new Set();
  const placedLabels = [];
  const layoutEdges = [];

  for (const e of edges || []) {
    if (!e || !e.from || !e.to || e.from === e.to) continue;

    // 去重镜像边（A→B 与 B→A 视为同一条）
    const key = [e.from, e.to].sort().join('||');
    if (seen.has(key)) continue;
    seen.add(key);

    const a = positioned.find(n => n.name === e.from);
    const b = positioned.find(n => n.name === e.to);
    if (!a || !b) continue;

    const labelPos = findLabelPosition(a, b, positioned, placedLabels, layoutEdges.length, width, height);
    placedLabels.push(labelPos);

    layoutEdges.push({
      from: e.from,
      to: e.to,
      label: e.label || '',
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      lx: labelPos.x,
      ly: labelPos.y
    });
  }

  return { nodes: positioned, edges: layoutEdges };
}
