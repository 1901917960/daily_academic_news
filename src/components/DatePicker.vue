<template>
  <div ref="root" class="date-picker">
    <button ref="btn" class="date-btn date-picker-btn" @click="toggle">
      {{ selectedLabel }} <span class="date-caret">▾</span>
    </button>
  </div>

  <Teleport to="body">
    <div v-if="open" ref="pop" class="date-picker-pop" :style="popStyle">
      <div class="date-picker-head">
        <button class="date-nav" @click="view = shiftMonth(view, -1)" title="上个月">‹</button>
        <span class="date-picker-title">{{ view.year }}年{{ view.month }}月</span>
        <button class="date-nav" @click="view = shiftMonth(view, 1)" title="下个月">›</button>
      </div>

      <div class="date-picker-grid">
        <span v-for="w in weekLabels" :key="w" class="date-picker-weekday">{{ w }}</span>
        <button
          v-for="cell in cells"
          :key="cell.dateKey + (cell.inMonth ? '-in' : '-out')"
          class="date-picker-day"
          :class="{
            'is-out': !cell.inMonth,
            'is-today': cell.dateKey === todayKey,
            'is-selected': cell.dateKey === selectedDate,
            'has-report': hasReport(cell.dateKey)
          }"
          :disabled="!hasReport(cell.dateKey)"
          @click="pick(cell.dateKey)"
        >{{ cell.day }}</button>
      </div>

      <div class="date-picker-legend">
        <span class="legend-dot"></span> 有报告的日期可点击
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { buildCalendarGrid, shiftMonth } from '../utils/calendar';

const props = defineProps({
  selectedDate: { type: String, default: '' },
  availableDates: { type: Array, default: () => [] }
});

const emit = defineEmits(['select']);

const POPUP_WIDTH = 252;
const POPUP_HEIGHT = 330;

const root = ref(null);
const btn = ref(null);
const pop = ref(null);
const open = ref(false);
const view = ref(initView());
const pos = ref({ left: 0, top: 0 });
const weekLabels = ['一', '二', '三', '四', '五', '六', '日'];

function formatKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initView() {
  const parts = String(props.selectedDate || '').split('-').map(Number);
  if (parts.length === 3 && parts[0] && parts[1]) {
    return { year: parts[0], month: parts[1] };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

const todayKey = formatKey(new Date());
const availableSet = computed(() => new Set(props.availableDates || []));
const cells = computed(() => buildCalendarGrid(view.value.year, view.value.month));
const selectedLabel = computed(() => (props.selectedDate === todayKey ? '今天' : props.selectedDate));

const popStyle = computed(() => ({
  left: pos.value.left + 'px',
  top: pos.value.top + 'px'
}));

function hasReport(dateKey) {
  return availableSet.value.has(dateKey);
}

// 计算弹层位置：按钮下方；空间不足时向上弹出；并限制在视口内
function updatePosition() {
  if (!btn.value) return;
  const rect = btn.value.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - POPUP_WIDTH - 8));

  let top = rect.bottom + 6;
  if (top + POPUP_HEIGHT > window.innerHeight) {
    top = Math.max(8, rect.top - POPUP_HEIGHT - 6);
  }

  pos.value = { left, top };
}

function toggle() {
  open.value = !open.value;
  if (open.value) {
    view.value = initView();
    updatePosition();
  }
}

function pick(dateKey) {
  if (!hasReport(dateKey)) return;
  emit('select', dateKey);
  open.value = false;
}

function onDocClick(e) {
  if (!open.value) return;
  const inRoot = root.value && root.value.contains(e.target);
  const inPop = pop.value && pop.value.contains(e.target);
  if (!inRoot && !inPop) open.value = false;
}

function onReposition() {
  if (open.value) updatePosition();
}

onMounted(() => {
  document.addEventListener('click', onDocClick);
  window.addEventListener('resize', onReposition);
  window.addEventListener('scroll', onReposition, true);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocClick);
  window.removeEventListener('resize', onReposition);
  window.removeEventListener('scroll', onReposition, true);
});
</script>
