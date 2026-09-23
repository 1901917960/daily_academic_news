<template>
  <Teleport to="body">
    <div class="kg-overlay" @click.self="$emit('close')">
      <div class="kg-modal weekly-modal">
        <div class="kg-header">
          <h2>周报</h2>
          <button class="kg-close" @click="$emit('close')">×</button>
        </div>

        <div class="pref-body">
          <p class="pref-tip">聚合本周所有报告（共 {{ records.length }} 天），由 AI 归纳主题与趋势。首次生成后缓存，当天内容不变。</p>

          <div v-if="!report && !loading && !loadError" class="weekly-empty">
            <button class="kg-btn" @click="generate">生成周报</button>
          </div>

          <div v-if="loading" class="weekly-loading">正在生成周报（约 20-40 秒）…</div>
          <div v-if="loadError" class="weekly-error">
            {{ loadError }}
            <button class="kg-btn" @click="generate">重试</button>
          </div>

          <div v-if="report" class="weekly-report">
            <h3 class="weekly-title">{{ report.title }}</h3>

            <div class="weekly-section">
              <div class="weekly-section-title">本周回顾</div>
              <p>{{ report.overview }}</p>
            </div>

            <div class="weekly-section">
              <div class="weekly-section-title">主题归纳</div>
              <div v-for="(t, i) in report.themes" :key="i" class="weekly-theme">
                <span class="weekly-theme-name">{{ i + 1 }}. {{ t.name }}</span>
                <p>{{ t.detail }}</p>
              </div>
            </div>

            <div class="weekly-section">
              <div class="weekly-section-title">趋势观察</div>
              <p>{{ report.trend }}</p>
            </div>

            <div class="weekly-section">
              <div class="weekly-section-title">下周关注</div>
              <p>{{ report.recommendation }}</p>
            </div>

            <div class="pref-footer">
              <button class="kg-btn" @click="regenerate">重新生成</button>
              <button class="kg-btn" @click="exportMarkdown">导出 Markdown</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { generateWeeklyReport } from '../api/weekly';
import { getWeeklyReport, saveWeeklyReport, getWeekKey } from '../storage';

const props = defineProps({
  records: { type: Array, default: () => [] }
});

defineEmits(['close']);

const weekKey = getWeekKey();
const report = ref(null);
const loading = ref(false);
const loadError = ref('');

onMounted(() => {
  report.value = getWeeklyReport(weekKey);
});

async function generate() {
  if (props.records.length < 2) {
    loadError.value = '至少需要 2 天的报告才能生成周报';
    return;
  }
  loading.value = true;
  loadError.value = '';
  try {
    const result = await generateWeeklyReport(props.records);
    report.value = result;
    saveWeeklyReport(weekKey, result);
  } catch (e) {
    console.error('生成周报失败:', e);
    loadError.value = '生成周报失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

function regenerate() {
  report.value = null;
  generate();
}

function exportMarkdown() {
  if (!report.value) return;
  const r = report.value;
  const lines = [
    `# ${r.title}`,
    '',
    `> 本周报告汇总 · 共 ${props.records.length} 天`,
    '',
    '## 本周回顾',
    r.overview,
    '',
    '## 主题归纳',
    ...(r.themes || []).flatMap((t, i) => [`### ${i + 1}. ${t.name}`, t.detail, '']),
    '## 趋势观察',
    r.trend,
    '',
    '## 下周关注',
    r.recommendation,
    '',
    '---',
    '由「每日学术洞察」生成'
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `weekly-report-${weekKey}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>
