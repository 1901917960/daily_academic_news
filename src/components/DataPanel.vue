<template>
  <Teleport to="body">
    <div class="kg-overlay" @click.self="$emit('close')">
      <div class="kg-modal pref-modal">
        <div class="kg-header">
          <h2>数据管理</h2>
          <button class="kg-close" @click="$emit('close')">×</button>
        </div>

        <div class="pref-body">
          <p class="pref-tip">
            所有数据都保存在当前浏览器中。清理浏览器缓存会丢失数据，建议定期导出备份；
            应用会自动清理超过保留期的旧数据（报告 30 天、对话 90 天）。
          </p>

          <div class="pref-section-title">存储占用（共 {{ formatSize(stats.total) }}）</div>
          <div class="data-stats">
            <div v-for="g in stats.groups" :key="g.label" class="data-stat-row">
              <span class="data-stat-label">{{ g.label }}</span>
              <span class="data-stat-size">{{ formatSize(g.bytes) }}</span>
            </div>
          </div>
          <div class="data-cleanup">
            <button class="kg-btn" @click="runCleanup">立即清理旧数据</button>
            <span v-if="cleanupMessage" class="data-msg">{{ cleanupMessage }}</span>
          </div>

          <div class="pref-section-title">备份与恢复</div>
          <div class="data-actions">
            <button class="kg-btn" @click="exportData">导出全部数据</button>
            <label class="kg-btn data-import-label">
              导入备份
              <input type="file" accept=".json,application/json" @change="onImportFile">
            </label>
          </div>
          <p v-if="importMessage" class="data-msg" :class="{ error: importError }">{{ importMessage }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';
import { getStorageStats, cleanupStorage, exportAllData, importAllData } from '../storage';

defineEmits(['close']);

const stats = ref(getStorageStats());
const cleanupMessage = ref('');
const importMessage = ref('');
const importError = ref(false);

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function runCleanup() {
  const removed = cleanupStorage();
  const total = Object.values(removed).reduce((sum, n) => sum + n, 0);
  cleanupMessage.value = total > 0 ? `已清理 ${total} 项旧数据` : '没有需要清理的数据';
  stats.value = getStorageStats();
}

function exportData() {
  const payload = exportAllData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daily-academic-news-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function onImportFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    importError.value = false;
    try {
      const payload = JSON.parse(String(reader.result));
      if (!payload || payload.app !== 'daily-academic-news' || !payload.data) {
        throw new Error('文件格式不正确，请选择本应用导出的备份文件');
      }
      if (!confirm('导入将覆盖当前浏览器中的全部数据，确定继续吗？')) return;
      importAllData(payload);
      importMessage.value = '导入成功，正在刷新页面…';
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      importError.value = true;
      importMessage.value = '导入失败：' + e.message;
    }
  };
  reader.onerror = () => {
    importError.value = true;
    importMessage.value = '文件读取失败，请重试';
  };
  reader.readAsText(file);
}
</script>
