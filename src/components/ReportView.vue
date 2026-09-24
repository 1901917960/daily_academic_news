<template>
  <div class="report">
    <div class="report-toolbar">
      <button class="toolbar-btn" :class="{ active: !isCompact }" @click="setView('full')">完整视图</button>
      <button class="toolbar-btn" :class="{ active: isCompact }" @click="setView('compact')">精简视图</button>
      <button class="toolbar-btn" @click="exportMarkdown">导出 Markdown</button>
    </div>

    <section class="card news-card">
      <img
        v-if="news.image && !imageFailed"
        :src="news.image"
        class="news-image"
        alt="新闻配图"
        referrerpolicy="no-referrer"
        @error="imageFailed = true"
      >
      <h2 v-html="highlightKnowledge(news.title)"></h2>
      <p class="summary" v-html="highlightKnowledge(analysis.news_summary_cn)"></p>
      <div v-if="news.tags && news.tags.length" class="news-tags">
        <span v-for="tag in news.tags" :key="tag" class="news-tag">{{ tag }}</span>
      </div>
      <p class="meta">{{ news.source }} · {{ news.date }}</p>
      <div class="news-links">
        <template v-if="news.isDomestic">
          <a
            v-if="news.url"
            :href="news.url"
            target="_blank"
            rel="noopener"
            class="link"
          >阅读原文 →</a>
        </template>
        <template v-else>
          <a
            v-if="domesticUrl"
            :href="domesticUrl"
            target="_blank"
            rel="noopener"
            class="link link-domestic"
            title="在搜狗新闻中检索该事件的国内报道"
          >国内相关报道 →</a>
          <span v-if="domesticUrl && news.url" class="link-sep">·</span>
          <a
            v-if="news.url"
            :href="news.url"
            target="_blank"
            rel="noopener"
            class="link link-external"
          >阅读原文 →</a>
          <span v-if="news.url" class="link-hint">外网链接，可能无法直接访问</span>
        </template>
      </div>
    </section>

    <section class="card highlight">
      <p v-html="highlightKnowledge(analysis.why_interesting)"></p>
    </section>

    <template v-if="!isCompact">
      <section v-if="analysis.institutional_gap" class="card gap-card">
        <div class="label">制度缝隙</div>
        <p v-html="highlightKnowledge(analysis.institutional_gap)"></p>
      </section>

      <section v-if="stakeholderGraph || analysis.stakeholder_map" class="card gap-card">
        <div class="label">参与方策略</div>
        <div v-if="stakeholderGraph" class="stakeholder-graph">
          <svg class="stakeholder-svg" :viewBox="`0 0 ${GRAPH_W} ${GRAPH_H}`" aria-hidden="true">
            <g v-for="(e, i) in stakeholderGraph.edges" :key="'e' + i">
              <line
                :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2"
                class="stakeholder-line"
              />
              <text
                :x="e.lx"
                :y="e.ly"
                class="stakeholder-edge-label"
                text-anchor="middle"
              >{{ e.label }}</text>
            </g>
          </svg>
          <div
            v-for="(n, i) in stakeholderGraph.nodes"
            :key="'n' + i"
            class="stakeholder-node"
            :style="{ left: (n.x / GRAPH_W * 100) + '%', top: (n.y / GRAPH_H * 100) + '%' }"
            :title="n.desc"
          >
            <span class="stakeholder-node-name">{{ n.name }}</span>
            <span class="stakeholder-node-desc">{{ n.desc }}</span>
          </div>
        </div>
        <p v-else v-html="highlightKnowledge(analysis.stakeholder_map)"></p>
      </section>
    </template>

    <section class="angles">
      <h3>研究切入点</h3>
      <div v-for="(angle, i) in analysis.research_angles" :key="i" class="card angle-card">
        <div class="angle-header" @click="toggleAngle(i)">
          <div class="tags">
            <span class="tag field">{{ angle.field }}</span>
            <span class="tag maturity">{{ angle.maturity }}</span>
          </div>
          <h4 v-html="highlightKnowledge(angle.research_question)"></h4>
          <span class="angle-chevron">{{ isAngleExpanded(i) ? '▾' : '▸' }}</span>
        </div>
        <div v-if="isAngleExpanded(i)" class="angle-details">
          <div class="detail-row"><b>理论视角：</b><span v-html="highlightKnowledge(angle.theoretical_lens)"></span></div>
          <div class="detail-row"><b>方法建议：</b><span v-html="highlightKnowledge(angle.methodology_hint)"></span></div>
          <div class="detail-row"><b>数据来源：</b><span v-html="highlightKnowledge(angle.data_source_hint)"></span></div>
          <div class="detail-row"><b>目标期刊：</b>{{ angle.related_journals.join('、') }}</div>
        </div>
      </div>

      <div v-if="analysis.literature_angle" class="card angle-card literature-card">
        <div class="angle-header" @click="toggleLiterature">
          <div class="tags">
            <span class="tag lit">文献启发</span>
            <span class="tag maturity">
              {{ analysis.literature_angle.paper_year }}<template v-if="analysis.literature_angle.paper_venue"> · {{ analysis.literature_angle.paper_venue }}</template>
            </span>
          </div>
          <h4 v-html="highlightKnowledge(analysis.literature_angle.research_question)"></h4>
          <span class="angle-chevron">{{ literatureExpanded ? '▾' : '▸' }}</span>
        </div>
        <div v-if="literatureExpanded" class="angle-details">
          <div class="lit-paper">
            <a
              v-if="analysis.literature_angle.paper_url"
              :href="analysis.literature_angle.paper_url"
              target="_blank"
              rel="noopener"
              class="lit-paper-title"
            >{{ analysis.literature_angle.paper_title }}</a>
            <span v-else class="lit-paper-title">{{ analysis.literature_angle.paper_title }}</span>
            <span v-if="analysis.literature_angle.paper_authors" class="lit-paper-meta">{{ analysis.literature_angle.paper_authors }}</span>
          </div>
          <div class="detail-row"><b>论文概要：</b><span v-html="highlightKnowledge(analysis.literature_angle.paper_summary)"></span></div>
          <div class="detail-row"><b>不足与展望：</b><span v-html="highlightKnowledge(analysis.literature_angle.limitations)"></span></div>
          <div class="detail-row"><b>与新闻关联：</b><span v-html="highlightKnowledge(analysis.literature_angle.connection)"></span></div>
          <div class="detail-row"><b>理论视角：</b><span v-html="highlightKnowledge(analysis.literature_angle.theoretical_lens)"></span></div>
          <div class="detail-row"><b>方法建议：</b><span v-html="highlightKnowledge(analysis.literature_angle.methodology_hint)"></span></div>
          <div class="detail-row"><b>数据来源：</b><span v-html="highlightKnowledge(analysis.literature_angle.data_source_hint)"></span></div>
          <div class="lit-note">文献来自 OpenAlex 检索；不足与展望为基于摘要的推断</div>
        </div>
      </div>

      <div v-else-if="analysis.literature_unavailable && !isCompact" class="card angle-card literature-unavailable">
        文献启发暂不可用：文献源暂时没有响应，重新生成报告可再次尝试
      </div>
    </section>

    <template v-if="!isCompact">
      <section v-if="analysis.comparative_insight" class="card gap-card">
        <div class="label">结构类比</div>
        <p v-html="highlightKnowledge(analysis.comparative_insight)"></p>
      </section>
    </template>

    <section class="insight">
      <p v-html="highlightKnowledge(analysis.key_insight)"></p>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { getAllKnowledge, getSettings, setSettings } from '../storage';
import { createKnowledgeHighlighter } from '../utils/highlight';
import { buildDomesticSearchUrl } from '../utils/links';
import { buildReportMarkdown } from '../utils/reportMarkdown';
import { computeStakeholderPositions } from '../utils/stakeholder';

const props = defineProps(['news', 'analysis']);

const GRAPH_W = 320;
const GRAPH_H = 200;

const imageFailed = ref(false);
// 用普通对象做展开状态（比 Set 更直观可靠）
const expandedAngles = reactive({});
const literatureExpanded = ref(true);

const highlightKnowledge = computed(() =>
  createKnowledgeHighlighter(getAllKnowledge().nodes.map(n => n.name))
);

const isCompact = ref(getSettings().reportView === 'compact');

function setView(view) {
  isCompact.value = view === 'compact';
  setSettings({ reportView: view });
}

function toggleAngle(i) {
  expandedAngles[i] = !expandedAngles[i];
}

function isAngleExpanded(i) {
  return !!expandedAngles[i];
}

function toggleLiterature() {
  literatureExpanded.value = !literatureExpanded.value;
}

// 国内相关报道检索：仅国外新闻需要（国内新闻的原文本身就是国内报道）
const domesticUrl = computed(() =>
  props.news.isDomestic
    ? ''
    : buildDomesticSearchUrl(props.news.domesticQuery || props.news.title)
);

// 参与方博弈关系图布局：网格/三角布局避免节点重叠，连线上标签沿垂直方向偏移避免遮挡
const stakeholderGraph = computed(() => {
  const graph = props.analysis.stakeholder_graph;
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length < 2) return null;

  const nodes = graph.nodes.slice(0, 6);
  const positions = computeStakeholderPositions(nodes.length, GRAPH_W, GRAPH_H);
  const byName = new Map();
  nodes.forEach((n, i) => byName.set(n.name, positions[i]));

  const edges = (graph.edges || [])
    .filter(e => e && e.from && e.to && e.from !== e.to)
    .map((e, i) => {
      const a = byName.get(e.from);
      const b = byName.get(e.to);
      if (!a || !b) return null;

      // 标签放在连线 45% 处，沿垂直方向交替偏移，避免与节点、其他标签重叠
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const side = (i % 2 === 0 ? 1 : -1) * 12;
      return {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        label: e.label || '',
        lx: a.x + dx * 0.45 + (-dy / len) * side,
        ly: a.y + dy * 0.45 + (dx / len) * side
      };
    })
    .filter(Boolean);

  return {
    nodes: nodes.map((n, i) => ({ ...n, ...positions[i] })),
    edges
  };
});

function exportMarkdown() {
  const md = buildReportMarkdown(props.news, props.analysis);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daily-report-${props.news.date || new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>
