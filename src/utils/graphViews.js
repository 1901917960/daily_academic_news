// 知识图谱分级视图的数据构建（纯函数，便于测试）

// 一级视图：分类聚合节点
export function buildCategoryNodes(allNodes, categories, positions = new Map()) {
  const counts = new Map();
  for (const n of allNodes) {
    counts.set(n.category, (counts.get(n.category) || 0) + 1);
  }

  const list = [];
  for (const cat of categories) {
    const count = counts.get(cat) || 0;
    if (count === 0) continue;
    const id = 'cat_' + cat;
    const node = {
      id,
      name: cat,
      category: cat,
      source: 'category',
      isCategory: true,
      count,
      dates: []
    };
    const pos = positions.get(id);
    if (pos) {
      node.x = pos.x;
      node.y = pos.y;
    }
    list.push(node);
  }
  return list;
}

// 一级视图：分类之间的聚合连线（按底层关联数量计权）
export function buildCategoryEdges(allNodes, allEdges) {
  const byId = new Map(allNodes.map(n => [n.id, n]));
  const agg = new Map();

  for (const e of allEdges) {
    const a = byId.get(e.source);
    const b = byId.get(e.target);
    if (!a || !b || a.category === b.category) continue;
    const [x, y] = [a.category, b.category].sort();
    const key = x + '||' + y;
    if (!agg.has(key)) agg.set(key, { a: x, b: y, weight: 0 });
    agg.get(key).weight++;
  }

  return Array.from(agg.values()).map(e => ({
    id: 'cat_edge_' + e.a + '||' + e.b,
    a: e.a,
    b: e.b,
    source: 'cat_' + e.a,
    target: 'cat_' + e.b,
    weight: e.weight,
    label: e.weight + ' 条关联',
    isCategoryEdge: true
  }));
}

// 二级视图：某分类下的节点集合（可选包含有关联的其他类节点）
// 返回 { visible, primaryIds }
export function selectDetailNodes(allNodes, allEdges, category, includeNeighbors = true) {
  const primaryIds = new Set(
    allNodes.filter(n => n.category === category).map(n => n.id)
  );

  if (!includeNeighbors) {
    return {
      visible: allNodes.filter(n => primaryIds.has(n.id)),
      primaryIds
    };
  }

  const visibleIds = new Set(primaryIds);
  for (const e of allEdges) {
    if (primaryIds.has(e.source) && !primaryIds.has(e.target)) visibleIds.add(e.target);
    if (primaryIds.has(e.target) && !primaryIds.has(e.source)) visibleIds.add(e.source);
  }

  return {
    visible: allNodes.filter(n => visibleIds.has(n.id)),
    primaryIds
  };
}

// 二级视图：可见节点之间的连线
export function buildDetailEdges(allEdges, visibleNodes) {
  const idSet = new Set(visibleNodes.map(n => n.id));
  return allEdges.filter(e => idSet.has(e.source) && idSet.has(e.target));
}
