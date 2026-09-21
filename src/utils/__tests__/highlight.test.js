import { describe, it, expect } from 'vitest';
import { createKnowledgeHighlighter } from '../highlight';

describe('createKnowledgeHighlighter', () => {
  it('基础高亮', () => {
    const h = createKnowledgeHighlighter(['双重差分法', '事件研究法']);
    expect(h('本文采用双重差分法进行研究'))
      .toBe('本文采用<span class="knowledge-term">双重差分法</span>进行研究');
  });

  it('长词优先且不产生嵌套 span', () => {
    const h = createKnowledgeHighlighter(['双重差分法', '差分']);
    expect(h('双重差分法')).toBe('<span class="knowledge-term">双重差分法</span>');
  });

  it('HTML 被转义，防注入', () => {
    const h = createKnowledgeHighlighter(['双重差分法']);
    const out = h('<script>alert(1)</script> 双重差分法');
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>');
  });

  it('正则特殊字符正确处理', () => {
    const h = createKnowledgeHighlighter(['C++', '(DID)']);
    expect(h('使用 C++ 和 (DID) 方法'))
      .toBe('使用 <span class="knowledge-term">C++</span> 和 <span class="knowledge-term">(DID)</span> 方法');
  });

  it('单字知识点不参与高亮', () => {
    const h = createKnowledgeHighlighter(['法']);
    expect(h('方法')).toBe('方法');
  });

  it('无知识点时仅转义', () => {
    const h = createKnowledgeHighlighter([]);
    expect(h('a < b & c')).toBe('a &lt; b &amp; c');
  });

  it('输出中的 HTML 属性不会被再次匹配破坏', () => {
    const h = createKnowledgeHighlighter(['class', 'knowledge']);
    expect(h('class knowledge-term'))
      .toBe('<span class="knowledge-term">class</span> <span class="knowledge-term">knowledge</span>-term');
  });

  it('同一文本多次调用结果稳定', () => {
    const h = createKnowledgeHighlighter(['双重差分法']);
    const a = h('双重差分法双重差分法');
    const b = h('双重差分法双重差分法');
    expect(a).toBe(b);
    expect((a.match(/knowledge-term/g) || []).length).toBe(2);
  });
});
