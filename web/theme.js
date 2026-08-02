/* ============================================================
   LLPSI+++ M2 · product 版 主题切换脚本
   - 默认: 夜间模式 (Nox, 用户决策)
   - 手动切换: 用户点击右上角按钮
   - 持久化: localStorage["llpsi-theme"]
   - 移动端: tap .ent 触发 tooltip (1.5s 后自动收起)
   - 切换动画: 柔和 fade 效果 (0.4s)
   ============================================================ */

(function () {
  var KEY = 'llpsi-theme';
  var root = document.documentElement;
  var btn = null;

  /* ---- 核心: 纯 CSS 动画 ----
     动画逻辑完全由 style.css 控制:
     * html, body { transition: background 0.4s, color 0.4s; }
     * .theme-toggle::before 有 box-shadow glow 动画
     * 所以这里只管状态切换 + 按钮文字更新
  */

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }

  function applyTheme(name, persist) {
    root.setAttribute('data-theme', name);
    if (btn) {
      btn.textContent = name === 'dark' ? '☾ Nox' : '☀ Dies';
      btn.setAttribute('aria-label', name === 'dark' ? 'Ad l\u016bcam' : 'Ad noctem');
    }
    if (persist) {
      try { localStorage.setItem(KEY, name); } catch (e) {}
    }
  }

  function getStored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  // 初始化
  var stored = getStored();
  var initial = stored || 'dark'; // 默认夜间模式 (用户决策)
  applyTheme(initial, false);

  // 监听系统变化 (仅在用户未手动选择时)
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var listener = function (e) {
      if (!getStored()) applyTheme(e.matches ? 'dark' : 'light', false);
    };
    if (mq.addEventListener) mq.addEventListener('change', listener);
    else if (mq.addListener) mq.addListener(listener);
  }

  // 切换按钮 (DOMContentLoaded)
  document.addEventListener('DOMContentLoaded', function () {
    btn = document.querySelector('.theme-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'theme-toggle';
      document.body.appendChild(btn);
    }
    applyTheme(root.getAttribute('data-theme'), false);

    /* 切换时:
       - 先加 .theme-switching 类 (CSS 保持全局 transition)
       - 200ms 后真正切换 (让视觉感知到过渡起点)
       - 400ms 后移除 .theme-switching
       style.css 已定义全局 transition 故这里只需要状态切换 + 延迟
    */
    btn.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme') || 'light';
      var next = cur === 'dark' ? 'light' : 'dark';

      /* 主动触发动画起点 (让 body 立即开始 transition) */
      document.body.style.transition = 'background 0.4s ease, color 0.4s ease';

      /* 小延迟后切换，让视觉感知到过渡 */
      setTimeout(function () {
        applyTheme(next, true);
      }, 60);

      /* 动画完成后恢复默认 (由 CSS global transition 驱动) */
      setTimeout(function () {
        document.body.style.transition = '';
      }, 460);
    });

    // 移动端 tap 触发实体 tooltip
    if ('ontouchstart' in window) {
      document.querySelectorAll('.ent').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          document.querySelectorAll('.ent.tapped').forEach(function (other) {
            if (other !== el) other.classList.remove('tapped');
          });
          el.classList.toggle('tapped');
        });
      });
      document.addEventListener('click', function () {
        document.querySelectorAll('.ent.tapped').forEach(function (el) {
          el.classList.remove('tapped');
        });
      });
    }
  });
})();
