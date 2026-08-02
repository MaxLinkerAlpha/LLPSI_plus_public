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

  // 当日日期 YYYY-MM-DD (本地时区)
  function todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function render(container, reads, today, total) {
    var items = [
      { label: 'L\u0113cti\u014dn\u0113s', value: reads },
      { label: 'Hodi\u0113', value: today },
      { label: '\u014cmn\u0113s', value: total }
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
      fetchGC('//reader.html.json'),   // 阅读次数 (双斜杠: 存储路径含前导 /)
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
