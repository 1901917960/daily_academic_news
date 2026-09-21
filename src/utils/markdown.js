import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
});

// KaTeX 按需加载：只有内容包含数学公式时才加载解析器和样式
let katexLoading = null;

function loadKatex() {
  if (!katexLoading) {
    katexLoading = Promise.all([
      import('markdown-it-katex'),
      import('katex/dist/katex.min.css')
    ])
      .then(([mod]) => {
        md.use(mod.default || mod);
      })
      .catch(e => {
        console.error('KaTeX 加载失败，公式将以纯文本显示', e);
      });
  }
  return katexLoading;
}

function preprocess(text) {
  let t = text || '';

  // 1) \[ ... \]  →  $$ ... $$
  t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `\n$$${m}$$\n`);

  // 2) \( ... \)  →  $ ... $
  t = t.replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`);

  // 3) 孤立的 [ ... ] 包裹的 LaTeX（前后有空行/换行）
  //    只在内容含明显 LaTeX 特征时才替换，避免误伤普通方括号
  t = t.replace(
    /\[\s*\n([\s\S]*?)\n\s*\]/g,
    (match, content) => {
      const looksLikeLatex =
        /\\[a-zA-Z]+/.test(content) ||   // \alpha \sum \beta ...
        /[_^]\s*\{/.test(content) ||      // ^{...} _{...}
        /\\frac|\\sum|\\int/.test(content);
      if (looksLikeLatex) {
        return `\n$$${content.trim()}$$\n`;
      }
      return match;
    }
  );

  return t;
}

export function hasMath(text) {
  return /\$[^$\n]+\$|\\\(|\\\[|\\begin\{/.test(text || '');
}

// 异步渲染 Markdown：含公式时先确保 KaTeX 已加载
export async function renderMarkdown(text) {
  const source = preprocess(text);
  if (hasMath(source)) {
    await loadKatex();
  }
  return md.render(source);
}
