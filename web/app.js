/**
 * app.js — 目录页主逻辑 (v4 · 用户反馈精简版)
 *
 * v4 变更 (REBUILD_SPEC_v3 用户反馈):
 *   - 卡片精简: 移除 prose/modern/fides 元信息 (移到阅读页)
 *   - 卡片精简: 移除 Praevisum 展开按钮 + 预览 (直接显示关键信息)
 *   - 卡片显示: 书名 + 词数 + length_tier + v2_level (无百分数)
 *
 * 保留 v3 功能: 4 维筛选 (Liber/Genus/Aetas/Fides) + v2_level 分组 + AND/OR 逻辑
 */
(function () {
  'use strict';

  var INDEX_PATH = 'data/combined_index.json?v=19';
  var READER_HREF = 'reader.html';

  var FILTER_DIMENSIONS = [
    { key: 'book',        field: 'book_slug',   label: 'book_title' },
    { key: 'genre',       field: 'genre',       label: 'genre' },
    { key: 'era',         field: 'era',         label: 'era' },
    { key: 'credibility', field: 'credibility', label: 'credibility' },
  ];
  var FIDES_ORDER = ['S', 'A', 'B', 'C', 'D'];

  var $matrixBlock = document.getElementById('matrix-block');
  var $selectAll = document.getElementById('select-all');
  var $clearAll = document.getElementById('clear-all');
  var $filterGroups = document.querySelectorAll('.filter-group');
  var allSegments = [];
  var FILTER_STORAGE_KEY = 'llpsi-filters-v1'; // 筛选状态持久化
  var FILTER_TRUNCATE = 10;        // v17: 筛选项默认截断数 (超出显示 Omnia ostendere 按钮)

  // ===== 工具 =====
  // v9: 罗马数字转换 (1-3999, 支持 XL/XC/CD/CM 减法规则)
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
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  async function fetchJson(path) {
    var res = await fetch(path);
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText + ' (' + path + ')');
    return res.json();
  }

  // ===== 筛选选项提取 =====
  function extractFilterOptions(segments) {
    var opts = { book: {}, genre: {}, era: {}, credibility: {} };
    var counts = { book: {}, genre: {}, era: {}, credibility: {} }; // v16: 切片计数
    segments.forEach(function (seg) {
      if (seg.book_slug) {
        opts.book[seg.book_slug] = seg.book_title || seg.book_slug;
        counts.book[seg.book_slug] = (counts.book[seg.book_slug] || 0) + 1;
      }
      if (seg.genre) {
        opts.genre[seg.genre] = capitalize(seg.genre);
        counts.genre[seg.genre] = (counts.genre[seg.genre] || 0) + 1;
      }
      if (seg.era) {
        opts.era[seg.era] = capitalize(seg.era);
        counts.era[seg.era] = (counts.era[seg.era] || 0) + 1;
      }
      if (seg.credibility) counts.credibility[seg.credibility] = (counts.credibility[seg.credibility] || 0) + 1;
    });
    var result = {};
    result.book = Object.keys(opts.book).map(function(k){return {value:k,label:opts.book[k],count:counts.book[k]||0};}).sort(function(a,b){return a.label.localeCompare(b.label);});
    result.genre = Object.keys(opts.genre).map(function(k){return {value:k,label:opts.genre[k],count:counts.genre[k]||0};}).sort(function(a,b){return a.label.localeCompare(b.label);});
    result.era = Object.keys(opts.era).map(function(k){return {value:k,label:opts.era[k],count:counts.era[k]||0};}).sort(function(a,b){return a.label.localeCompare(b.label);});
    // v21: 固定五档 S/A/B/C/D (按可信度从高到低) (用户决策: 保留 S), 不依赖数据中是否存在; D = AI 读物
    result.credibility = FIDES_ORDER.map(function (k) {
      return { value: k, label: k === 'D' ? 'D \u00b7 AI' : k, count: counts.credibility[k] || 0 };
    });
    return result;
  }

  // v17: 默认截断 FILTER_TRUNCATE 项, 超出的选项带 .filter-extra 留在 DOM 供 CSS 隐藏,
  //      展开只是切换 class, 不重建 DOM (保留用户勾选状态, 也兼容 localStorage 恢复)
  function renderFilterCheckboxes(options) {
    FILTER_DIMENSIONS.forEach(function (dim) {
      var $c = document.getElementById('filter-' + dim.key);
      if (!$c) return;
      var opts = options[dim.key] || [];
      var truncated = opts.length > FILTER_TRUNCATE;
      var html = '';
      opts.forEach(function (opt, i) {
        if (truncated && i === FILTER_TRUNCATE) {
          html += '<button type="button" class="filter-more">Omnia ostendere (' + opts.length + ') \u25be</button>';
        }
        html += '<label' + (truncated && i >= FILTER_TRUNCATE ? ' class="filter-extra"' : '') +
          '><input type="checkbox" value="' + escapeHtml(opt.value) + '" checked> ' + escapeHtml(opt.label) +
          ' <span class="filter-count">(' + (opt.count || 0) + ')</span></label>';
      });
      if (truncated) $c.classList.add('filter-truncated');
      $c.innerHTML = html;
    });
  }

  // ===== v2_level 分组 =====
  function groupByV2Level(segments) {
    var groups = {};
    var noLevel = [];
    segments.forEach(function (seg) {
      var level = seg.v2_level;
      if (level == null || level === '') { noLevel.push(seg); return; }
      var num = Number(level);
      if (isNaN(num)) { noLevel.push(seg); return; }
      if (!groups[num]) groups[num] = [];
      groups[num].push(seg);
    });
    // v14: 补全缺失章节 1-56 (LLPSI 全章节: FR 35 + RA 21 = 56 章), 索引条可达每一章
    for (var capNum = 1; capNum <= ALL_CAPS; capNum++) {
      if (!groups[capNum]) groups[capNum] = [];
    }
    var sortedCaps = Object.keys(groups).map(Number).sort(function(a,b){return a-b;});
    var result = sortedCaps.map(function (cap) {
      return { cap: cap, label: 'Gradus Cap. ' + toRoman(cap), segments: groups[cap] };
    });
    if (noLevel.length > 0) result.push({ cap: null, label: 'sine Notā', segments: noLevel });
    return result;
  }

  // v8: 按 tier 生成 N 个长度条 span (brevis=1, medius=2, longus=3)
  function tierBars(tier) {
    var n = tier === 'longus' ? 3 : tier === 'medius' ? 2 : 1;
    var html = '';
    for (var i = 0; i < n; i++) html += '<span class="ll-ext-bar"></span>';
    return html;
  }

  // ===== 卡片渲染 (v5 精简版, length_tier 独立行左对齐) =====
  function renderCard(seg) {
    if (!seg || !seg.segment_id) return '';
    // 难度: 仅章号, 无百分数
    var levelText = (seg.v2_level != null && seg.v2_level !== '')
      ? 'Gradus Cap. ' + toRoman(Number(seg.v2_level))
      : 'sine Notā';
    var tier = seg.length_tier || 'brevis';
    var bookTitle = seg.book_title || seg.book_slug || '';

    // v5: length_tier 放独立行, 与其他文本左对齐 (不再与 book 同行)
    return '<article class="ll-ext-card" data-segment-id="' + escapeHtml(seg.segment_id) + '" tabindex="0" role="button">' +
      '<div class="ll-ext-head">' +
        '<span class="ll-ext-score">' + escapeHtml(levelText) + '</span>' +
        '<span class="ll-ext-words">' + (seg.word_count || 0) + ' verba</span>' +
      '</div>' +
      '<div class="ll-ext-section">' + escapeHtml(seg.section_title || '—') + '</div>' +
      '<div class="ll-ext-book">' + escapeHtml(bookTitle) + '</div>' +
      '<div class="ll-ext-tier ll-ext-tier-' + escapeHtml(tier) + '">' + tierBars(tier) + '</div>' +
    '</article>';
  }

  // ===== v15: 惰性分批渲染 (1 万+ 卡片性能优化) =====
  // 原理: 初始只渲染前 RENDER_CHUNK 个章节分组, 滚动接近底部时由哨兵
  //       IntersectionObserver 触发追加下一批; 索引条跳转时先渲染到位再滚动
  var currentGroups = [];      // 全部分组 (模块级, 供惰性追加)
  var renderedChunkCount = 0;  // 已渲染的分组批次数
  var RENDER_CHUNK = 5;        // 每批渲染的分组数
  var $lazySentinel = null;    // 底部哨兵元素
  var chapterObserver = null;  // 章节高亮观察者 (供后续批次复用)

  function renderMatrix(segments) {
    if (!$matrixBlock) return;
    if (!Array.isArray(segments) || segments.length === 0) {
      $matrixBlock.innerHTML = '<p class="empty">Nihil inventum</p>';
      return;
    }
    var all = groupByV2Level(segments);
    renderedChunkCount = 0;
    $matrixBlock.innerHTML = '';
    if (!$lazySentinel) {
      $lazySentinel = document.createElement('div');
      $lazySentinel.className = 'lazy-sentinel';
    }
    // 空分组 (无卡片章节) 一次性渲染 — DOM 极轻, 保证索引条每章可达, 不参与惰性分批
    var contentGroups = [];
    all.forEach(function (g) {
      if (g.segments.length === 0) {
        $matrixBlock.appendChild(buildBlock(g));
      } else {
        contentGroups.push(g);
      }
    });
    currentGroups = contentGroups; // 惰性分批仅针对有内容的分组
    $matrixBlock.appendChild($lazySentinel);
    renderNextChunk();
    bindCardEvents();
  }

  // 渲染下一批分组, 返回是否还有剩余
  function renderNextChunk() {
    var start = renderedChunkCount * RENDER_CHUNK;
    var end = Math.min(start + RENDER_CHUNK, currentGroups.length);
    if (start >= currentGroups.length) return false;
    var frag = document.createDocumentFragment();
    var newBlocks = [];
    for (var i = start; i < end; i++) {
      var blk = buildBlock(currentGroups[i]);
      frag.appendChild(blk);
      newBlocks.push(blk);
    }
    $matrixBlock.insertBefore(frag, $lazySentinel);
    renderedChunkCount++;
    // 新分组纳入章节高亮观察
    if (chapterObserver) {
      newBlocks.forEach(function (b) { chapterObserver.observe(b); });
    }
    // v21: 新渲染的卡片也需受筛选器控制, 否则 Nihil 后惰性加载的新卡片仍显示
    applyFilters();
    return end < currentGroups.length;
  }

  // 构建单个章节分组 (标题 + 卡片网格)
  function buildBlock(group) {
    var n = group.segments.length;
    var block = document.createElement('div');
    block.className = 'll-ext-block';
    block.setAttribute('data-cap', group.cap != null ? group.cap : '');
    var heading = document.createElement('div');
    heading.className = 'll-ext-heading';
    heading.innerHTML = escapeHtml(group.label) +
      '<span class="ll-ext-heading-count">' + (n > 0 ? n + ' segment' + (n > 1 ? 'a' : 'um') : 'vacuum') + '</span>';
    block.appendChild(heading);
    var grid = document.createElement('div');
    grid.className = 'll-ext-grid';
    if (n > 0) {
      var cards = '';
      group.segments.forEach(function (seg) { cards += renderCard(seg); });
      grid.innerHTML = cards;
    } else {
      var emptyP = document.createElement('p');
      emptyP.className = 'empty';
      emptyP.textContent = 'Nihil h\u012bc';
      grid.appendChild(emptyP);
    }
    block.appendChild(grid);
    return block;
  }

  // 惰性加载: 观察底部哨兵, 接近时追加下一批
  function initLazyLoader() {
    if (!$matrixBlock || !$lazySentinel) return;
    if (!('IntersectionObserver' in window)) {
      // 无 IntersectionObserver 时全量渲染兜底
      while (renderNextChunk()) {}
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !renderNextChunk()) obs.disconnect();
      });
    }, { rootMargin: '900px 0px' });
    obs.observe($lazySentinel);
  }

  // 索引跳转前确保目标章节已渲染
  function ensureRenderedTo(cap) {
    var targetIdx = -1;
    for (var i = 0; i < currentGroups.length; i++) {
      var gcap = currentGroups[i].cap != null ? String(currentGroups[i].cap) : '';
      if (gcap === String(cap)) { targetIdx = i; break; }
    }
    if (targetIdx < 0) return;
    var neededChunks = Math.floor(targetIdx / RENDER_CHUNK) + 1;
    while (renderedChunkCount < neededChunks) {
      if (!renderNextChunk()) break;
    }
  }

  // ===== v14: 章节索引条 (顶部 sticky, 全 LLPSI 章节 Cap. I-LVI + sine Not\u0101) =====
  var $chapterIndex = document.getElementById('chapter-index');
  var ALL_CAPS = 56; // LLPSI 全章节: FR 35 章 + RA 21 章 = 56 章

  function renderChapterIndex() {
    if (!$chapterIndex) return;
    var html = '';
    for (var c = 1; c <= ALL_CAPS; c++) {
      html += '<button type="button" class="ci-item" data-cap="' + c + '">' + toRoman(c) + '</button>';
    }
    html += '<button type="button" class="ci-item ci-sine" data-cap="">sine N.</button>';
    $chapterIndex.innerHTML = html;
    $chapterIndex.addEventListener('click', function (e) {
      var btn = e.target.closest('.ci-item');
      if (!btn || !$matrixBlock) return;
      var cap = btn.getAttribute('data-cap');
      ensureRenderedTo(cap); // 惰性渲染: 目标分组可能尚未渲染, 先渲染到位
      setActiveChapter(cap);
      requestAnimationFrame(function () {
        var $block = cap === ''
          ? $matrixBlock.querySelector('.ll-ext-block[data-cap=""]')
          : $matrixBlock.querySelector('.ll-ext-block[data-cap="' + cap + '"]');
        if ($block) $block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function setActiveChapter(cap) {
    if (!$chapterIndex) return;
    $chapterIndex.querySelectorAll('.ci-item').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-cap') === cap);
    });
  }

  // 滚动时高亮当前章节 (IntersectionObserver)
  function initChapterObserver() {
    if (!$chapterIndex || !$matrixBlock) return;
    if (!('IntersectionObserver' in window)) return;
    chapterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) setActiveChapter(en.target.getAttribute('data-cap'));
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    $matrixBlock.querySelectorAll('.ll-ext-block').forEach(function (b) { chapterObserver.observe(b); });
  }

  // ===== 卡片交互 (仅点击跳转, 移除 Praevisum) =====
  function bindCardEvents() {
    if (!$matrixBlock) return;
    // 事件委托: 点击卡片跳转阅读页
    $matrixBlock.addEventListener('click', function (e) {
      var $card = e.target.closest('.ll-ext-card');
      if ($card) {
        var sid = $card.getAttribute('data-segment-id');
        if (sid) window.location.href = READER_HREF + '?segment_id=' + encodeURIComponent(sid);
      }
    });
    // 键盘: Enter/Space 触发跳转 (无障碍)
    $matrixBlock.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      var $card = e.target.closest('.ll-ext-card');
      if ($card && e.target === $card) {
        e.preventDefault();
        var sid = $card.getAttribute('data-segment-id');
        if (sid) window.location.href = READER_HREF + '?segment_id=' + encodeURIComponent(sid);
      }
    });
  }

  // ===== 筛选 (AND 跨组, OR 组内, 空集=不限制) =====
  // 保存当前勾选状态到 localStorage (刷新后记忆)
  function persistFilterState(selected) {
    try {
      // v22: 全空状态(用户点 Nihil)不持久化 — 否则刷新后恢复空状态, 打开网页看不到任何卡片
      var allEmpty = Object.keys(selected).every(function (k) {
        return selected[k].size === 0;
      });
      if (allEmpty) {
        localStorage.removeItem(FILTER_STORAGE_KEY);
        return;
      }
      var obj = {};
      Object.keys(selected).forEach(function (k) {
        obj[k] = Array.from(selected[k]);
      });
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) { /* 隐私模式等场景静默降级 */ }
  }

  // 从 localStorage 恢复勾选状态 (无记录时保持默认全选)
  function restoreFilterState() {
    var raw = null;
    try { raw = localStorage.getItem(FILTER_STORAGE_KEY); } catch (e) {}
    if (!raw) return;
    var obj = null;
    try { obj = JSON.parse(raw); } catch (e) { return; }
    if (!obj || typeof obj !== 'object') return;
    $filterGroups.forEach(function (group) {
      var dimKey = group.getAttribute('data-filter');
      var saved = Array.isArray(obj[dimKey]) ? obj[dimKey] : null;
      if (!saved) return;
      group.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.checked = saved.indexOf(cb.value) !== -1;
      });
    });
  }

  function collectSelectedFilters() {
    var selected = {};
    $filterGroups.forEach(function (group) {
      var dimKey = group.getAttribute('data-filter');
      var set = new Set();
      group.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        if (cb.checked) set.add(cb.value);
      });
      selected[dimKey] = set;
    });
    return selected;
  }

  function segmentPassesFilters(seg, selected) {
    for (var i = 0; i < FILTER_DIMENSIONS.length; i++) {
      var dim = FILTER_DIMENSIONS[i];
      var selectedSet = selected[dim.key];
      // 空集 = 该维度无选中项 = 无匹配 (不跳过, has() 自然返回 false)
      var segVal = seg[dim.field] || '';
      if (!selectedSet.has(segVal)) return false;
    }
    return true;
  }

  function applyFilters() {
    if (!$matrixBlock) return;
    var selected = collectSelectedFilters();
    persistFilterState(selected);
    var cards = $matrixBlock.querySelectorAll('.ll-ext-card');
    var visibleCount = 0;
    cards.forEach(function (card) {
      var sid = card.getAttribute('data-segment-id');
      var seg = allSegments.find(function (s) { return s.segment_id === sid; });
      if (!seg) { card.style.display = 'none'; return; }
      var passes = segmentPassesFilters(seg, selected);
      card.style.display = passes ? '' : 'none';
      if (passes) visibleCount++;
    });
    // 隐藏空分组
    var blocks = $matrixBlock.querySelectorAll('.ll-ext-block');
    blocks.forEach(function (block) {
      var visibleCards = block.querySelectorAll('.ll-ext-card:not([style*="display: none"])');
      block.style.display = visibleCards.length > 0 ? '' : 'none';
    });
    // 无匹配提示
    var emptyEl = $matrixBlock.querySelector('.empty');
    if (visibleCount === 0) {
      if (!emptyEl) {
        var p = document.createElement('p');
        p.className = 'empty';
        p.textContent = 'Nihil inventum';
        $matrixBlock.appendChild(p);
      }
    } else {
      if (emptyEl) emptyEl.remove();
    }
    updateFilterStats(visibleCount);
  }

  function updateFilterStats(visibleCount) {
    var $stats = document.getElementById('filter-stats');
    if (!$stats) return;
    $stats.textContent = visibleCount + ' / ' + allSegments.length + ' segmenta';
  }

  function selectAll() {
    $filterGroups.forEach(function (g) {
      g.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = true; });
    });
    applyFilters();
  }
  function clearAll() {
    $filterGroups.forEach(function (g) {
      g.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
    });
    applyFilters();
  }

  // v16: 维度标题点击折叠/展开 (Liber/Genus/Aetas/Fides)
  function initFilterCollapse() {
    var $bar = document.querySelector('.filter-bar');
    if (!$bar) return;
    $bar.addEventListener('click', function (e) {
      var label = e.target.closest('.filter-label');
      if (!label) return;
      var group = label.parentElement;
      if (!group) return;
      group.classList.toggle('collapsed');
    });
  }

  // v17: "Omnia ostendere / Pauca ostendere" 切换 — 仅切换容器 class, 不重建 DOM
  function initFilterMore() {
    var $bar = document.querySelector('.filter-bar');
    if (!$bar) return;
    $bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-more');
      if (!btn) return;
      var $c = btn.closest('.filter-options');
      if (!$c) return;
      var expanded = $c.classList.toggle('expanded');
      $c.classList.toggle('filter-truncated', !expanded);
      var total = FILTER_TRUNCATE + $c.querySelectorAll('.filter-extra').length;
      btn.textContent = expanded ? 'Pauca ostendere \u25b4' : 'Omnia ostendere (' + total + ') \u25be';
    });
  }

  function bindFilterEvents() {
    $filterGroups.forEach(function (g) {
      g.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.addEventListener('change', applyFilters);
      });
    });
    if ($selectAll) $selectAll.addEventListener('click', selectAll);
    if ($clearAll) $clearAll.addEventListener('click', clearAll);
  }

  // ===== 主流程 =====
  async function main() {
    if (!$matrixBlock) { console.error('[app.js] #matrix-block 未找到'); return; }
    $matrixBlock.innerHTML = '<p class="loading">Legēns…</p>';
    try {
      var index = await fetchJson(INDEX_PATH);
      if (Array.isArray(index)) allSegments = index;
      else if (index && Array.isArray(index.segments)) allSegments = index.segments;
      else allSegments = [];
    } catch (e) {
      console.error('[app.js] 加载失败', e);
      $matrixBlock.innerHTML = '<p class="error">Errōr: nōn potest corpora legere</p>';
      return;
    }
    if (!allSegments || allSegments.length === 0) {
      $matrixBlock.innerHTML = '<p class="error">Errōr: corpora vacua</p>';
      return;
    }
    var options = extractFilterOptions(allSegments);
    renderFilterCheckboxes(options);
    initFilterCollapse();
    initFilterMore();
    restoreFilterState();
    renderMatrix(allSegments);
    renderChapterIndex();
    initChapterObserver();
    initLazyLoader();
    bindFilterEvents();
    applyFilters();
    console.log('[app.js] v4 初始化完成, ' + allSegments.length + ' 段');
  }

  main().catch(function (err) {
    console.error('[app.js] 主流程异常', err);
    if ($matrixBlock) $matrixBlock.innerHTML = '<p class="error">Errōr</p>';
  });
})();
