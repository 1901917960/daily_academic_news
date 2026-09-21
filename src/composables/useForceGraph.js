import { ref, computed } from 'vue';
import { getAllKnowledge, saveNodePositions, clearNodePositions } from '../storage';
import {
  buildCategoryNodes,
  buildCategoryEdges,
  selectDetailNodes,
  buildDetailEdges
} from '../utils/graphViews';

export const GRAPH_WIDTH = 900;
export const GRAPH_HEIGHT = 560;

const FRAME_INTERVAL = 1000 / 30; // 30fps 节流，降低 CPU 与重渲染频率
const SETTLE_SPEED = 0.08;        // 判定收敛的速度阈值
const SETTLE_FRAMES = 20;         // 连续静止帧数达到该值后停止模拟

export function useForceGraph(categories) {
  const allNodes = ref([]);           // 全量知识点
  const allEdges = ref([]);           // 全量关联
  const nodes = ref([]);              // 当前视图节点（一级=分类聚合，二级=某类明细）
  const edges = ref([]);              // 当前视图连线
  const activeCategory = ref(null);   // null = 一级分类视图；否则为二级明细视图
  const includeNeighbors = ref(true); // 二级视图是否显示关联的其他类知识点
  const selected = ref(null);
  const dragging = ref(null);
  const simulationRunning = ref(true);
  const viewBox = ref({ x: 0, y: 0, width: GRAPH_WIDTH, height: GRAPH_HEIGHT });
  const svgEl = ref(null);

  let animationId = null;
  let dragMoved = false;
  let dragStartClient = { x: 0, y: 0 };
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let settleFrames = 0;
  let lastFrameTime = 0;
  const categoryPositions = new Map(); // 分类节点位置（会话内保持）

  const stats = computed(() => ({
    nodeCount: allNodes.value.length,
    edgeCount: allEdges.value.length,
    dayCount: new Set(allNodes.value.flatMap(n => n.dates || [])).size
  }));

  const displayEdges = computed(() => {
    const nodeMap = new Map(nodes.value.map(n => [n.id, n]));
    return edges.value.map(e => {
      const source = nodeMap.get(e.source);
      const target = nodeMap.get(e.target);
      if (!source || !target) return null;
      return {
        ...e,
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
        dimmed: !!(source.dimmed || target.dimmed)
      };
    }).filter(Boolean);
  });

  function toGraphPoint(event) {
    const svg = svgEl.value;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  /* ---------- 视图构建 ---------- */

  // 根据当前视图重建显示数据
  function rebuildDisplay() {
    if (activeCategory.value) {
      // 二级视图：某分类的知识点（可选包含关联的其他类节点）
      const { visible, primaryIds } = selectDetailNodes(
        allNodes.value,
        allEdges.value,
        activeCategory.value,
        includeNeighbors.value
      );
      nodes.value = visible.map(n => {
        n.dimmed = !primaryIds.has(n.id);
        return n;
      });
      edges.value = buildDetailEdges(allEdges.value, nodes.value);
    } else {
      // 一级视图：分类聚合
      nodes.value = buildCategoryNodes(allNodes.value, categories, categoryPositions);
      edges.value = buildCategoryEdges(allNodes.value, allEdges.value);
    }

    // 刷新选中状态，避免引用已失效的节点对象
    if (selected.value) {
      selected.value = nodes.value.find(n => n.id === selected.value.id) || null;
    }

    initLayout();
    wake();
  }

  // 进入二级视图
  function drillInto(category) {
    activeCategory.value = category;
    selected.value = null;
    rebuildDisplay();
  }

  // 返回一级视图
  function backToOverview() {
    activeCategory.value = null;
    selected.value = null;
    rebuildDisplay();
  }

  function setIncludeNeighbors(value) {
    includeNeighbors.value = !!value;
    if (activeCategory.value) rebuildDisplay();
  }

  // 聚焦某个知识点：必要时切换到其所在分类
  function focusNode(name) {
    const target = allNodes.value.find(n => n.name === name);
    if (!target) return;
    if (activeCategory.value !== target.category) {
      activeCategory.value = target.category;
      rebuildDisplay();
    }
    selected.value = target;
    centerOnNode(target);
  }

  function initLayout() {
    const N = nodes.value.length;
    if (N === 0) return;

    const byCat = {};
    nodes.value.forEach(n => {
      if (!byCat[n.category]) byCat[n.category] = [];
      byCat[n.category].push(n);
    });

    let idx = 0;
    for (const cat of categories) {
      const arr = byCat[cat] || [];
      arr.forEach((n, i) => {
        idx++;
        // 已有位置的节点（保存过位置或手动添加）保持原位
        if (n.x !== undefined && n.y !== undefined) return;
        const angle = (idx / N) * Math.PI * 2;
        const r = 150 + (i % 3) * 50;
        n.x = GRAPH_WIDTH / 2 + Math.cos(angle) * r;
        n.y = GRAPH_HEIGHT / 2 + Math.sin(angle) * r;
        n.vx = 0;
        n.vy = 0;
      });
    }

    // 兜底：分类不在预设列表中的节点也要有坐标，否则模拟会因坐标缺失而失效
    nodes.value.forEach((n, i) => {
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
        const angle = (i / N) * Math.PI * 2;
        const r = 180 + (i % 4) * 40;
        n.x = GRAPH_WIDTH / 2 + Math.cos(angle) * r;
        n.y = GRAPH_HEIGHT / 2 + Math.sin(angle) * r;
        n.vx = 0;
        n.vy = 0;
      }
    });
  }

  function simulate(timestamp) {
    if (!simulationRunning.value || nodes.value.length === 0) {
      animationId = null;
      return;
    }

    // 帧率节流：低于 30fps 的间隔内不做计算与渲染
    if (timestamp !== undefined && timestamp - lastFrameTime < FRAME_INTERVAL) {
      animationId = requestAnimationFrame(simulate);
      return;
    }
    lastFrameTime = timestamp ?? lastFrameTime;

    const N = nodes.value.length;
    const nodeMap = new Map(nodes.value.map(n => [n.id, n]));
    const dragId = dragging.value ? dragging.value.id : null;
    const movable = (n) => !n.fixed && n.id !== dragId;

    // 斥力
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = nodes.value[i];
        const b = nodes.value[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist2 = dx * dx + dy * dy || 1;
        const dist = Math.sqrt(dist2);
        const force = 8000 / dist2;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (movable(a)) {
          a.vx = (a.vx || 0) - fx;
          a.vy = (a.vy || 0) - fy;
        }
        if (movable(b)) {
          b.vx = (b.vx || 0) + fx;
          b.vy = (b.vy || 0) + fy;
        }
      }
    }

    // 弹簧力
    for (const e of edges.value) {
      const a = nodeMap.get(e.source);
      const b = nodeMap.get(e.target);
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealLen = 120 - Math.min(e.weight || 1, 5) * 10;
      const force = (dist - idealLen) * 0.03;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (movable(a)) {
        a.vx = (a.vx || 0) + fx;
        a.vy = (a.vy || 0) + fy;
      }
      if (movable(b)) {
        b.vx = (b.vx || 0) - fx;
        b.vy = (b.vy || 0) - fy;
      }
    }

    // 更新位置并统计最大速度
    let maxSpeed = 0;
    for (const n of nodes.value) {
      if (!movable(n)) {
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      // 防御：坐标异常时重置到画布中心，避免 NaN 导致整个模拟失效
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
        n.x = GRAPH_WIDTH / 2;
        n.y = GRAPH_HEIGHT / 2;
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx = (n.vx || 0) * 0.8;
      n.vy = (n.vy || 0) * 0.8;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(50, Math.min(GRAPH_WIDTH - 50, n.x));
      n.y = Math.max(50, Math.min(GRAPH_HEIGHT - 50, n.y));
      maxSpeed = Math.max(maxSpeed, Math.abs(n.vx), Math.abs(n.vy));
    }

    // 收敛检测：拖动中不判定；静止足够长时间后停止循环，节省 CPU
    if (!dragging.value && maxSpeed < SETTLE_SPEED) {
      settleFrames++;
      if (settleFrames >= SETTLE_FRAMES) {
        animationId = null;
        return;
      }
    } else {
      settleFrames = 0;
    }

    animationId = requestAnimationFrame(simulate);
  }

  // 启动模拟循环（幂等）
  function start() {
    if (animationId !== null) return;
    if (!simulationRunning.value || nodes.value.length === 0) return;
    settleFrames = 0;
    lastFrameTime = 0;
    animationId = requestAnimationFrame(simulate);
  }

  // 唤醒模拟（交互或数据变化时调用）
  function wake() {
    start();
  }

  function stop() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function toggleSimulation() {
    simulationRunning.value = !simulationRunning.value;
    if (simulationRunning.value) start();
    else stop();
  }

  function loadData(preservePositions = false) {
    const prev = new Map();
    if (preservePositions) {
      for (const n of allNodes.value) prev.set(n.name, { x: n.x, y: n.y });
    }

    const data = getAllKnowledge();
    allNodes.value = data.nodes.map(n => ({
      ...n,
      vx: 0,
      vy: 0
    }));
    allEdges.value = data.edges;

    if (preservePositions) {
      for (const n of allNodes.value) {
        const p = prev.get(n.name);
        if (p && n.x === undefined) {
          n.x = p.x;
          n.y = p.y;
        }
      }
    }

    rebuildDisplay();
  }

  function resetLayout() {
    clearNodePositions();
    categoryPositions.clear();
    allNodes.value.forEach(n => {
      delete n.x;
      delete n.y;
      delete n.fixed;
      n.vx = 0;
      n.vy = 0;
    });
    rebuildDisplay();
  }

  // 拖拽节点（仅左键，且只有真正移动后才固定节点）
  function onNodeMouseDown(event, node) {
    if (event.button !== 0) return;
    dragging.value = node;
    dragMoved = false;
    dragStartClient = { x: event.clientX, y: event.clientY };
    const p = toGraphPoint(event);
    dragging.value.dragOffsetX = p.x - node.x;
    dragging.value.dragOffsetY = p.y - node.y;
    wake();
  }

  function onMouseMove(event) {
    if (dragging.value) {
      if (Math.abs(event.clientX - dragStartClient.x) > 3 ||
          Math.abs(event.clientY - dragStartClient.y) > 3) {
        dragMoved = true;
      }
      const p = toGraphPoint(event);
      dragging.value.x = p.x - (dragging.value.dragOffsetX || 0);
      dragging.value.y = p.y - (dragging.value.dragOffsetY || 0);
      wake();
    } else if (isPanning) {
      const svg = svgEl.value;
      const scale = svg && svg.clientWidth ? viewBox.value.width / svg.clientWidth : 1;
      const dx = event.clientX - panStart.x;
      const dy = event.clientY - panStart.y;
      viewBox.value.x -= dx * scale;
      viewBox.value.y -= dy * scale;
      panStart = { x: event.clientX, y: event.clientY };
    }
  }

  function onMouseUp() {
    if (dragging.value) {
      // 只有真正拖动过才固定并保存位置（单纯点击/右键不固定）
      if (dragMoved) {
        if (dragging.value.isCategory) {
          // 分类节点位置仅在会话内保持
          categoryPositions.set(dragging.value.id, {
            x: dragging.value.x,
            y: dragging.value.y
          });
        } else {
          dragging.value.fixed = true;
          saveNodePositions({
            [dragging.value.name]: { x: dragging.value.x, y: dragging.value.y }
          });
        }
        wake();
      }
      dragging.value = null;
      dragMoved = false;
    }
    isPanning = false;
  }

  // 画布平移
  function onCanvasMouseDown(event) {
    if (event.button === 0 && !event.target.closest('.kg-node')) {
      isPanning = true;
      panStart = { x: event.clientX, y: event.clientY };
    }
  }

  // 缩放
  function onWheel(event) {
    const scale = event.deltaY > 0 ? 1.1 : 0.9;
    const newWidth = Math.max(240, Math.min(2700, viewBox.value.width * scale));
    const ratio = newWidth / viewBox.value.width;
    const newHeight = viewBox.value.height * ratio;
    viewBox.value.x += (viewBox.value.width - newWidth) / 2;
    viewBox.value.y += (viewBox.value.height - newHeight) / 2;
    viewBox.value.width = newWidth;
    viewBox.value.height = newHeight;
  }

  // 将视图移动到指定节点
  function centerOnNode(node) {
    if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
      viewBox.value.x = node.x - viewBox.value.width / 2;
      viewBox.value.y = node.y - viewBox.value.height / 2;
    }
  }

  return {
    allNodes,
    allEdges,
    nodes,
    edges,
    activeCategory,
    includeNeighbors,
    selected,
    dragging,
    simulationRunning,
    viewBox,
    svgEl,
    stats,
    displayEdges,
    toGraphPoint,
    loadData,
    resetLayout,
    toggleSimulation,
    wake,
    stop,
    drillInto,
    backToOverview,
    setIncludeNeighbors,
    focusNode,
    onNodeMouseDown,
    onMouseMove,
    onMouseUp,
    onCanvasMouseDown,
    onWheel,
    centerOnNode
  };
}
