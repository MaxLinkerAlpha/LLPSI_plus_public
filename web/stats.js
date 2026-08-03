'use strict';
// stats.js — GoatCounter 访问统计展示 (v1)
// 目录页右上角显示三项: Lēctiōnēs (阅读次数) / Hodiē (今日) / Ōmnēs (总访问)
// 罗马数字 1-3999; 0 显示 '0'; 超出 3999 fallback 阿拉伯数字 (title 显示原值)
// 异常时静默隐藏, 不阻塞页面

(function () {
  // 罗马数字转换 (1-3999, 含减法规则 XL/XC/CD/CM), 与 app.js 同款
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

  // 格式化: 0 -> '0'; 1-3999 -> 罗马数字; >3999 -> 阿拉伯 (带千分位, title 提示原值)
  function formatStat(num) {
    if (num === 0) return { text: '0', title: '' };
    if (num >= 1 && num <= 3999) return { text: toRoman(num), title: '' };
    var arabic = num.toLocaleString('en-US');
    return { text: arabic, title: 'Numerus v\u0113rus: ' + arabic };
  }

  // 抓取 GoatCounter 计数端点, 返回 int (移除千分位逗号)
  // 注意: 无数据路径 GoatCounter 返回 404 + JSON body {count:"0"}, fetch 不抛错可正常解析
  function fetchGC(path, startDate) {
    var url = 'https://maxlinkeralpha.goatcounter.com/counter/' + path;
    if (startDate) url += '?start=' + startDate;
    return fetch(url, { credentials: 'omit', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var c = String(data.count || '0').replace(/,/g, '');
        var n = parseInt(c, 10);
        return isNaN(n) ? 0 : n;
      });
  }

  // 当日日期 YYYY-MM-DD (UTC)
  // GoatCounter counter API 的 start 参数按 UTC 解释且无时区参数,
  // 必须用 UTC 日期才能与服务器统计口径一致 (否则本地凌晨会算错天)。
  function todayStr() {
    var d = new Date();
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1).padStart(2, '0');
    var day = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // GoatCounter 记录的路径 = location.pathname (含 GitHub Pages 子路径前缀,
  // 如 /LLPSI_plus_public/reader.html)。从当前地址推导同目录的阅读页路径,
  // 适配任意部署位置 (本地 /reader.html, 子路径 /<repo>/reader.html)。
  function readerPath() {
    var idx = location.pathname.lastIndexOf('/');
    var dir = idx > 0 ? location.pathname.slice(0, idx) : '';
    return dir + '/reader.html';
  }

  function render(container, reads, today, total) {
    // 窄屏 (≤720px) 用缩写标签: 报头右栏空间有限, 完整标签会溢出
    // (旧版 v2 用 CSS display:none 直接隐藏标签, 手机用户看不到统计栏含义)
    var narrow = typeof window !== 'undefined' && window.innerWidth <= 720;
    var items = [
      { label: narrow ? 'L\u0113ct.' : 'L\u0113cti\u014dn\u0113s', value: reads },
      { label: narrow ? 'Hod.' : 'Hodi\u0113', value: today },
      { label: narrow ? '\u014cmn.' : '\u014cmn\u0113s', value: total }
    ];
    var html = items.map(function (it) {
      var f = formatStat(it.value);
      var titleAttr = f.title ? ' title="' + f.title + '"' : '';
      return '<span class="stat-item"><span class="stat-label">' + it.label
           + '</span> <span class="stat-value"' + titleAttr + '>' + f.text + '</span></span>';
    }).join(' <span class="stat-sep">\u00b7</span> ');
    container.innerHTML = html;
    container.style.display = '';
  }

  function main() {
    var container = document.getElementById('visitor-stats');
    if (!container) return;
    var today = todayStr();
    Promise.all([
      fetchGC(readerPath() + '.json'),  // 阅读次数 (路径含子路径前缀, 适配部署位置)
      fetchGC('TOTAL.json', today),     // 今日访问近似 DAU
      fetchGC('TOTAL.json')             // 总访问量
    ]).then(function (results) {
      render(container, results[0], results[1], results[2]);
    }).catch(function (err) {
      console.warn('[stats] GoatCounter fetch failed:', err);
      container.style.display = 'none';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
