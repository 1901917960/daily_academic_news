import { ref, computed } from 'vue';
import { semanticSearch } from '../api/search';
import { exactSearchNodes } from '../utils/search';

// 知识点检索：精确（按名称）+ 模糊（AI 语义匹配）
export function useKnowledgeSearch({ getNodes, onFocus }) {
  const searchMode = ref('exact');    // 'exact' | 'fuzzy'
  const searchQuery = ref('');
  const searchResults = ref([]);      // [{ name, category, reason }]
  const searching = ref(false);
  const searchError = ref('');
  const searchPerformed = ref(false);
  let searchReqId = 0;

  const matchedNames = computed(() => new Set(searchResults.value.map(r => r.name)));

  function resetSearch() {
    searchReqId++;
    searchQuery.value = '';
    searchResults.value = [];
    searchError.value = '';
    searchPerformed.value = false;
    searching.value = false;
  }

  function onSearchInput() {
    // 输入变化时清空上一次的结果
    searchReqId++;
    searchResults.value = [];
    searchError.value = '';
    searchPerformed.value = false;
    searching.value = false;
  }

  function setSearchMode(mode) {
    if (searchMode.value === mode) return;
    searchMode.value = mode;
    onSearchInput();
  }

  async function doSearch() {
    const q = searchQuery.value.trim();
    if (!q) return;

    searchError.value = '';
    searchPerformed.value = true;

    // 精确搜索：按名称匹配
    if (searchMode.value === 'exact') {
      searchResults.value = exactSearchNodes(getNodes(), q);
      return;
    }

    // 模糊搜索：按内容语义匹配
    const allNodes = getNodes();
    if (allNodes.length === 0) return;
    const reqId = ++searchReqId;
    searching.value = true;
    try {
      const matches = await semanticSearch(q, allNodes.map(n => ({ name: n.name, category: n.category })));
      if (reqId !== searchReqId) return;
      const nameMap = new Map(allNodes.map(n => [n.name, n]));
      searchResults.value = matches
        .filter(m => nameMap.has(m.name))
        .map(m => ({
          name: m.name,
          category: nameMap.get(m.name).category,
          reason: m.reason || ''
        }));
    } catch (e) {
      if (reqId !== searchReqId) return;
      console.error('模糊搜索失败:', e);
      searchError.value = '搜索失败，请稍后重试';
      searchResults.value = [];
    } finally {
      if (reqId === searchReqId) searching.value = false;
    }
  }

  // 点击检索结果：聚焦对应节点
  function focusResult(name) {
    const node = getNodes().find(n => n.name === name);
    if (node) onFocus(node);
  }

  return {
    searchMode,
    searchQuery,
    searchResults,
    searching,
    searchError,
    searchPerformed,
    matchedNames,
    resetSearch,
    onSearchInput,
    setSearchMode,
    doSearch,
    focusResult
  };
}
