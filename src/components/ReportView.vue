<template>
  <div class="report">
    <section class="card news-card">
      <h2 v-html="highlightKnowledge(news.title)"></h2>
      <p class="summary" v-html="highlightKnowledge(analysis.news_summary_cn)"></p>
      <div v-if="news.tags && news.tags.length" class="news-tags">
        <span v-for="tag in news.tags" :key="tag" class="news-tag">{{ tag }}</span>
      </div>
      <p class="meta">{{ news.source }} · {{ news.date }}</p>
      <div class="news-links">
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
      </div>
    </section>

    <section class="card highlight">
      <p v-html="highlightKnowledge(analysis.why_interesting)"></p>
    </section>

    <section v-if="analysis.institutional_gap" class="card gap-card">
      <div class="label">制度缝隙</div>
      <p v-html="highlightKnowledge(analysis.institutional_gap)"></p>
    </section>

    <section v-if="analysis.stakeholder_map" class="card gap-card">
      <div class="label">参与方策略</div>
      <p v-html="highlightKnowledge(analysis.stakeholder_map)"></p>
    </section>

    <section class="angles">
      <h3>研究切入点</h3>
      <div v-for="(angle, i) in analysis.research_angles" :key="i" class="card angle-card">
        <div class="tags">
          <span class="tag field">{{ angle.field }}</span>
          <span class="tag maturity">{{ angle.maturity }}</span>
        </div>
        <h4 v-html="highlightKnowledge(angle.research_question)"></h4>
        <div class="detail-row"><b>理论视角：</b><span v-html="highlightKnowledge(angle.theoretical_lens)"></span></div>
        <div class="detail-row"><b>方法建议：</b><span v-html="highlightKnowledge(angle.methodology_hint)"></span></div>
        <div class="detail-row"><b>数据来源：</b><span v-html="highlightKnowledge(angle.data_source_hint)"></span></div>
        <div class="detail-row"><b>目标期刊：</b>{{ angle.related_journals.join('、') }}</div>
      </div>
    </section>

    <section v-if="analysis.comparative_insight" class="card gap-card">
      <div class="label">结构类比</div>
      <p v-html="highlightKnowledge(analysis.comparative_insight)"></p>
    </section>

    <section class="insight">
      <p v-html="highlightKnowledge(analysis.key_insight)"></p>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getAllKnowledge } from '../storage';
import { createKnowledgeHighlighter } from '../utils/highlight';
import { buildDomesticSearchUrl } from '../utils/links';

const props = defineProps(['news', 'analysis']);

const highlightKnowledge = computed(() =>
  createKnowledgeHighlighter(getAllKnowledge().nodes.map(n => n.name))
);

// 国内相关报道：优先使用 AI 生成的检索关键词，老数据回退到标题
const domesticUrl = computed(() =>
  buildDomesticSearchUrl(props.news.domesticQuery || props.news.title)
);
</script>