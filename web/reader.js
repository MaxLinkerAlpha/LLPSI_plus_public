/**
 * reader.js — 阅读页主逻辑 (v3 · REBUILD_SPEC_v3)
 *
 * 职责:
 *   1. 从 URL 参数 ?segment_id=xxx 读取 segment_id
 *   2. 加载 segment 元数据 + 正文 (方案 A: combined_index.json; 方案 B: .md 文件回退)
 *   3. 填充 sticky 元信息栏 (8 字段: Liber/Auctor/Genus/Aetas/Fides/Origo/Pagina OCR/Gradus)
 *   4. 渲染正文到 #segment-content
 *   5. 填充章节标题 (section_title / chapter_title)
 *
 * 设计原则:
 *   - Fail Fast: 参数缺失立即报错, 不静默继续
 *   - 不吞噬异常: 所有错误 console.error 打印上下文
 *   - UTF-8 安全: 保留拉丁文长音符号 (āēīōū)
 *   - 纯 vanilla JS, 无外部依赖
 *   - HTML 转义防 XSS
 */

(function () {
  'use strict';

  // ===== 常量 =====
  const INDEX_PATH = 'data/combined_index.json?v=19';
  // .md 文件根目录 (相对 reader.html 所在的 web/ 目录的上一级)
  const SEGMENTS_DIR = '../books';

  // ===== DOM 元素引用 (集中获取, 避免重复查询) =====
  const $content = document.getElementById('segment-content');
  const $book = document.getElementById('info-book');
  const $author = document.getElementById('info-author');
  const $genre = document.getElementById('info-genre');
  const $era = document.getElementById('info-era');
  const $credibility = document.getElementById('info-credibility');
  const $source = document.getElementById('info-source');
  const $length = document.getElementById('info-length');
  const $level = document.getElementById('info-level');
  const $sectionTitle = document.getElementById('section-title');
  const $chapterTitle = document.getElementById('chapter-title');

  // ===== 工具函数 =====

  // v3.2: 罗马数字转换 (1-3999, 支持 XL/XC/CD/CM 减法规则)
  //   LLPSI Familia Romana 教材每章本就用罗马数字标号 (Capitulum I/II/.../XXXV)
  function toRoman(num) {
    if (num == null || isNaN(num) || num < 1 || num > 3999) return '';
    var map = [
      [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
      [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
      [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'],
      [1, 'I']
    ];
    var result = '';
    for (var i = 0; i < map.length; i++) {
      while (num >= map[i][0]) {
        result += map[i][1];
        num -= map[i][0];
      }
    }
    return result;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // 首字母大写 (用于 genre/era 显示: prose → Prose)
  function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // 从 URL 提取域名 (用于 Origo 字段简化显示)
  // 如 https://www.fabulaefaciles.com/... → fabulaefaciles.com
  function extractDomain(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch (e) {
      // 不是合法 URL, 返回原值
      return url;
    }
  }

  function showError(msg) {
    if ($content) {
      $content.innerHTML = '<p class="error">' + escapeHtml(msg) + '</p>';
    }
  }

  function getSegmentId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('segment_id');
  }

  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error('HTTP ' + res.status + ': ' + res.statusText + ' (' + path + ')');
    }
    return res.json();
  }

  function findSegment(index, segmentId) {
    if (Array.isArray(index)) {
      return index.find(s => s && s.segment_id === segmentId) || null;
    }
    if (index && Array.isArray(index.segments)) {
      return index.segments.find(s => s && s.segment_id === segmentId) || null;
    }
    if (index && index[segmentId]) {
      return index[segmentId];
    }
    return null;
  }

  /**
   * 合并多个对象, 跳过 null/undefined 值
   * 用于方案 A 的 body 回退: 合并 .md 元数据和 index 元数据
   */
  function cleanMerge() {
    const result = {};
    for (const src of arguments) {
      if (!src) continue;
      for (const key in src) {
        if (src[key] != null) {
          result[key] = src[key];
        }
      }
    }
    return result;
  }

  /**
   * 简易 YAML frontmatter 解析器
   * 支持: key: value, key: null, key: [], key: [a, b, c], key: "quoted string"
   */
  function parseFrontmatter(text) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!m) {
      return { meta: {}, body: text };
    }
    const yamlBlock = m[1];
    const body = m[2];
    const meta = {};

    for (const line of yamlBlock.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();

      if (value === 'null' || value === '~' || value === '') {
        meta[key] = null;
        continue;
      }
      if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1).trim();
        if (!inner) {
          meta[key] = [];
        } else {
          meta[key] = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
        }
        continue;
      }
      meta[key] = value.replace(/^["']|["']$/g, '');
    }
    return { meta, body };
  }

  /**
   * 从 segment_id 推断 .md 文件路径 (方案 B 回退用)
   * segment_id 格式: {book_slug}__section__{NN}
   * .md 路径: books/{book_slug}/segments/{NNN}.md (3 位补零)
   */
  function inferMdPath(segmentId) {
    const parts = segmentId.split('__');
    if (parts.length < 3) return null;
    const bookSlug = parts[0];
    const numPart = parts[parts.length - 1];
    const num = parseInt(numPart, 10);
    if (isNaN(num)) return null;
    const numStr = String(num).padStart(3, '0');
    return SEGMENTS_DIR + '/' + bookSlug + '/segments/' + numStr + '.md';
  }

  /**
   * 渲染正文为 HTML
   * - 按 \n\n 分段
   * - ### → <h3>, ## / # → <h2> (避免与页面 h1 冲突)
   * - 普通段落 → <p>, 段内单换行 → <br>
   */
  function renderBody(body) {
    if (!body) return '';
    const blocks = body.split(/\n\s*\n/);
    return blocks.map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('### ')) {
        return '<h3>' + escapeHtml(trimmed.slice(4)) + '</h3>';
      }
      if (trimmed.startsWith('## ')) {
        return '<h2>' + escapeHtml(trimmed.slice(3)) + '</h2>';
      }
      if (trimmed.startsWith('# ')) {
        return '<h2>' + escapeHtml(trimmed.slice(2)) + '</h2>';
      }
      // v3.1: 处理 Markdown 加粗 **text** -> <strong>text</strong>
      //   (escapeHtml 已转义 <>&, 但 * 不受影响, 可安全正则替换)
      const html = escapeHtml(trimmed)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      return '<p>' + html + '</p>';
    }).filter(Boolean).join('\n');
  }

  /**
   * 填充 sticky 元信息栏 (8 字段, REBUILD_SPEC_v3 §4)
   * 字段缺失时显示 em dash (—), 保证布局稳定不塌陷
   */
  function fillInfoBar(seg) {
    // Liber: 书名
    if ($book) {
      $book.textContent = seg.book_title || '—';
    }
    // Auctor: 作者
    if ($author) {
      $author.textContent = seg.author || '—';
    }
    // Genus: 体裁 (首字母大写)
    if ($genre) {
      $genre.textContent = seg.genre ? capitalize(seg.genre) : '—';
    }
    // Aetas: 时代 (首字母大写)
    if ($era) {
      $era.textContent = seg.era ? capitalize(seg.era) : '—';
    }
    // Longitudo: 长度分级 (brevis/medius/longus, v4 新增)
    if ($length) {
      $length.textContent = seg.length_tier || '—';
    }
    // Fides: 可信度档 (C/B/A/S/D)
    // v5: HTML 中 #info-credibility 是 .ent 容器, 内含 .tip tooltip
    //      只替换第一个文本节点 (保留 .tip 子元素), 避免 tooltip 被清空
    if ($credibility) {
      const cred = seg.credibility || '—';
      // 清空现有文本节点但保留 .tip 子元素
      const tip = $credibility.querySelector('.tip');
      $credibility.textContent = cred;
      if (tip) $credibility.appendChild(tip);
    }
    // Origo: 来源网址 (v4 改为可点击 <a> 链接, 直接跳转)
    if ($source) {
      const url = seg.source_url || '';
      if (url) {
        $source.textContent = extractDomain(url);
        $source.setAttribute('href', url);
      } else {
        $source.textContent = '—';
        $source.removeAttribute('href');
      }
    }
    // Gradus: 难度章号 (v3.2: Gradus Cap. + 罗马数字, 与卡片一致)
    if ($level) {
      const levelText = (seg.v2_level != null && seg.v2_level !== '')
        ? 'Gradus Cap. ' + toRoman(Number(seg.v2_level))
        : '';
      $level.textContent = levelText || '—';
    }
  }

  /**
   * 填充章节标题
   * #section-title: section_title (h1)
   * #chapter-title: chapter_title (小字), 缺失时回退到 chapter_id
   */
  function fillTitles(seg) {
    if ($sectionTitle) {
      $sectionTitle.textContent = seg.section_title || '—';
    }
    if ($chapterTitle) {
      $chapterTitle.textContent = seg.chapter_title || seg.chapter_id || '—';
    }
  }

  /**
   * 主流程: 加载并渲染 segment
   */
  async function main() {
    // Fail Fast: 先校验 segment_id 参数
    const segmentId = getSegmentId();
    if (!segmentId) {
      console.error('[reader.js] URL 参数 segment_id 缺失');
      showError('segment_id missing');
      return;
    }

    let segment = null;

    // ===== 方案 A: 从 combined_index.json 加载 =====
    try {
      const index = await fetchJson(INDEX_PATH);
      segment = findSegment(index, segmentId);

      if (segment && !segment.body) {
        // 元数据找到但 body 字段缺失, 从 .md 文件补充正文
        console.warn('[reader.js] combined_index.json 中 segment 无 body, 回退到 .md 文件');
        const mdPath = inferMdPath(segmentId);
        if (mdPath) {
          try {
            const res = await fetch(mdPath);
            if (res.ok) {
              const text = await res.text();
              const parsed = parseFrontmatter(text);
              segment = cleanMerge(parsed.meta, segment);
              segment.body = parsed.body.trim();
            }
          } catch (e) {
            console.error('[reader.js] 加载 .md 文件失败: ' + mdPath, e);
          }
        }
      }
    } catch (e) {
      console.warn('[reader.js] combined_index.json 不可用, 尝试直接加载 .md 文件', e);
    }

    // ===== 方案 B: 直接 fetch .md 文件 (combined_index.json 不可用时) =====
    if (!segment) {
      const mdPath = inferMdPath(segmentId);
      if (mdPath) {
        try {
          const res = await fetch(mdPath);
          if (res.ok) {
            const text = await res.text();
            const parsed = parseFrontmatter(text);
            segment = Object.assign({}, parsed.meta, { body: parsed.body.trim() });
          } else if (res.status === 404) {
            console.error('[reader.js] segment .md 未找到: ' + mdPath + ' (segment_id=' + segmentId + ')');
            showError('Segmentum nōn invenītur');
            return;
          }
        } catch (e) {
          console.error('[reader.js] 加载 .md 文件失败: ' + mdPath, e);
        }
      }
    }

    // ===== 最终校验 =====
    if (!segment) {
      console.error('[reader.js] segment 未找到: ' + segmentId);
      showError('Segmentum nōn invenītur');
      return;
    }

    // ===== 渲染 =====
    fillInfoBar(segment);
    fillTitles(segment);

    if ($content) {
      const html = renderBody(segment.body);
      $content.innerHTML = html || '<p class="empty">(vacuum)</p>';
    }

    // 更新页面标题
    document.title = (segment.section_title || 'Lector') + ' · Bibliothēca';
  }

  // 启动主流程, 捕获未预期异常
  main().catch(err => {
    console.error('[reader.js] 主流程未捕获异常', err);
    showError('Errōr: nōn potest corpora legere');
  });

  // ===== v14+1: Fides tooltip 贴近视口顶部时向下翻转 =====
  // 元信息栏不 sticky, 滚动后 reader-nav 会贴住视口顶部, 向上弹出的 tooltip 会溢出屏幕
  function updateFidesTipDirection() {
    if (!$credibility) return;
    const r = $credibility.getBoundingClientRect();
    $credibility.classList.toggle('tip-below', r.top < 180);
  }
  if (window.addEventListener) {
    window.addEventListener('scroll', updateFidesTipDirection, { passive: true });
  }
  updateFidesTipDirection();

  // ===== 移动端 tooltip tap 触发 (复用 template .tapped 模式) =====
  // 桌面端 hover 即可显示 tooltip, 移动端无 hover, 需 tap 切换
  document.addEventListener('click', function (e) {
    var $ent = e.target.closest('.reader-nav .info-val.ent');
    if (!$ent) return;
    // 切换 .tapped 类 (CSS 控制显隐)
    $ent.classList.toggle('tapped');
  });
})();
