<template>
  <div class="nav-tree-item">
    <div
      :class="['nav-item', { active: activePathIds.has(item.node.id) }]"
      @click="$emit('select', item.node.id)"
    >
      <span class="nav-index">{{ item.num }}</span>
      <span class="nav-text" :title="item.node.question">{{ preview(item.node.question) }}</span>
    </div>
    <div v-if="item.children.length > 0" class="nav-children">
      <NavTreeItem
        v-for="child in item.children"
        :key="child.node.id"
        :item="child"
        :active-path-ids="activePathIds"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup>
defineProps(['item', 'activePathIds']);
defineEmits(['select']);

function preview(t) {
  return (t || '').replace(/\s+/g, ' ').trim().slice(0, 30) || '（无内容）';
}
</script>