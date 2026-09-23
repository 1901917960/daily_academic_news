// 国内新闻源（RSS）与解析（纯函数，便于测试）

// 国内 RSS 新闻源；key 需与 edge-functions/api/rss 中的白名单保持一致
export const RSS_SOURCES = [
  { key: 'wallstreetcn', label: '华尔街见闻', url: 'https://dedicated.wallstreetcn.com/rss.xml' },
  { key: 'chinanews', label: '中新网财经', url: 'https://www.chinanews.com.cn/rss/finance.xml' },
  { key: 'people', label: '人民网财经', url: 'http://www.people.com.cn/rss/finance.xml' },
  { key: 'tmtpost', label: '钛媒体', url: 'https://www.tmtpost.com/rss.xml' },
  { key: 'ifanr', label: '爱范儿', url: 'https://www.ifanr.com/feed' }
];

function extractTag(block, tagNames) {
  for (const tag of tagNames) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
    const m = re.exec(block);
    if (m && m[1]) return m[1];
  }
  return '';
}

function extractLink(block) {
  // Atom: <link rel="alternate" href="..."/> 或 <link href="..."/>
  const atom = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(block);
  if (atom && /rel=["']alternate["']/i.test(atom[0])) return atom[1].trim();
  // RSS: <link>...</link>
  const rss = /<link>([\s\S]*?)<\/link>/i.exec(block);
  if (rss) return rss[1].trim();
  if (atom) return atom[1].trim();
  return '';
}

// 提取条目配图：enclosure / media:content / media:thumbnail
function extractImage(block) {
  const enclosure = /<enclosure[^>]*url=["']([^"']+)["']/i.exec(block);
  if (enclosure) return enclosure[1].trim();

  const media = /<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["']/i.exec(block);
  if (media) return media[1].trim();

  const content = /<content[^>]*url=["']([^"']+)["']/i.exec(block);
  return content ? content[1].trim() : '';
}

// 清洗文本：去 CDATA、HTML 标签、解码常见实体、压缩空白
export function cleanRssText(text) {
  let t = String(text || '');
  t = t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  t = t.replace(/<[^>]+>/g, ' ');
  t = t
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&mdash;/gi, '—');
  t = t.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return t.replace(/\s+/g, ' ').trim();
}

// 统一为 Currents 风格的时间字符串，便于复用排序与过滤逻辑
function normalizeRssDate(dateStr) {
  const t = Date.parse(String(dateStr || ''));
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000`;
}

// 解析 RSS 2.0 / Atom 订阅源为候选新闻列表
export function parseRssFeed(xmlText, { maxItems = 30 } = {}) {
  const xml = String(xmlText || '');
  if (!xml) return [];

  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<item>[\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>|<entry>[\s\S]*?<\/entry>/gi) || [];
  const items = [];

  for (const block of blocks.slice(0, maxItems)) {
    const title = cleanRssText(extractTag(block, ['title']));
    if (!title) continue;

    const description = cleanRssText(
      extractTag(block, ['description', 'summary', 'content:encoded', 'content'])
    );

    items.push({
      title,
      description: description.length > 200 ? description.slice(0, 200) + '…' : description,
      url: extractLink(block),
      author: cleanRssText(extractTag(block, ['dc:creator', 'source', 'author'])),
      published: normalizeRssDate(extractTag(block, ['pubDate', 'published', 'updated', 'dc:date'])),
      image: extractImage(block)
    });
  }

  return items;
}
