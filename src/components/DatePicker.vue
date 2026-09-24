<template>
  <div ref="root" class="date-picker">
    <button class="date-btn date-picker-btn" @click="open = !open">
      {{ selectedLabel }} <span class="date-caret">▾</span>
    </button>

    <div v-if="open" class="date-picker-pop">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { buildCalendarGrid, shiftMonth } from '../utils/calendar';

const props = defineProps({
  selectedDate: { type: String, default: '' },
  availableDates: { type: Array, default: () => [] }
});

const emit = defineEmits(['select']);

const root = ref(null);
const open = ref(false);
const view = ref(initView());
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

function hasReport(dateKey) {
  return availableSet.value.has(dateKey);
}

function pick(dateKey) {
  if (!hasReport(dateKey)) return;
  emit('select', dateKey);
  open.value = false;
}

function onDocClick(e) {
  if (open.value && root.value && !root.value.contains(e.target)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));
</script>
