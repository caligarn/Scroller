// Scroll buttons. The app adds this file to every page it opens.
(function () {
  if (window.__scroller) return;
  window.__scroller = true;

  var app = new URL(document.currentScript.src).origin;
  var HIDE_AFTER = 3000;   // buttons fade after this many milliseconds

  function load(k, d) { try { var v = +localStorage.getItem(k); return v || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var speed = load('sr-speed', 60), size = load('sr-size', 100);
  var on = false, last = 0, acc = 0, lock = null, hideT = 0, tgt = null;

  /* Keep links inside the app */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !/^https?:/i.test(a.href)) return;
    var u = new URL(a.href);
    if (u.origin === app) return;
    var here = new URL(document.baseURI);
    if (u.hash && u.href.split('#')[0] === here.href.split('#')[0]) return;
    e.preventDefault();
    e.stopPropagation();
    location.href = app + '/api/read?url=' + encodeURIComponent(a.href);
  }, true);

  /* Find the part of the page that scrolls */
  function pick() {
    var best = null, gap = 0;
    document.querySelectorAll('body *').forEach(function (el) {
      var g = el.scrollHeight - el.clientHeight;
      if (g > gap && el.clientHeight > innerHeight * 0.5 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) { best = el; gap = g; }
    });
    var root = document.scrollingElement || document.documentElement;
    return (root.scrollHeight - root.clientHeight >= gap) ? root : best;
  }

  /* The button bar, kept apart from the page's own styles */
  var host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;left:50%;transform:translateX(-50%);' +
    'bottom:max(14px,calc(env(safe-area-inset-bottom) + 6px))';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>' +
    '.bar{display:flex;align-items:center;gap:4px;padding:5px;border-radius:999px;background:rgba(20,20,24,.82);' +
    '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#fff;font:14px -apple-system,system-ui,sans-serif;' +
    'transition:opacity .5s;-webkit-user-select:none;user-select:none;box-shadow:0 4px 16px rgba(0,0,0,.3)}' +
    '.off{opacity:0;pointer-events:none}' +
    'button{all:unset;width:36px;height:36px;border-radius:50%;text-align:center;line-height:36px;font-size:15px;font-weight:600;cursor:pointer;touch-action:manipulation}' +
    'button:active{background:rgba(255,255,255,.18)}#play{background:#0a5cff}' +
    'span{min-width:3.4em;text-align:center;font-variant-numeric:tabular-nums;opacity:.85}' +
    'i{width:1px;height:18px;background:rgba(255,255,255,.25);margin:0 2px}</style>' +
    '<div class="bar">' +
    '<button id="close" aria-label="Close page">✕</button><i></i>' +
    '<button id="slower" aria-label="Slower">−</button><span id="speed"></span><button id="faster" aria-label="Faster">+</button><i></i>' +
    '<button id="smaller" aria-label="Smaller">A−</button><span id="size"></span><button id="larger" aria-label="Larger">A+</button><i></i>' +
    '<button id="play" aria-label="Start scrolling">▶</button></div>';
  var $ = function (id) { return root.getElementById(id); };
  var bar = root.querySelector('.bar');

  function show() {
    bar.classList.remove('off');
    clearTimeout(hideT);
    hideT = setTimeout(function () { bar.classList.add('off'); }, HIDE_AFTER);
  }
  function update() {
    $('speed').textContent = speed;
    $('size').textContent = size + '%';
    document.documentElement.style.zoom = size === 100 ? '' : size / 100;
    host.style.zoom = size === 100 ? '' : 100 / size;
    save('sr-speed', speed); save('sr-size', size);
  }

  function wake(v) {
    try {
      if (v && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { lock = l; }, function () {});
      else if (!v && lock) { lock.release(); lock = null; }
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && on) wake(true);
  });

  function setPlay(v) {
    on = v; last = 0;
    if (on) tgt = pick();
    $('play').textContent = on ? '❚❚' : '▶';
    $('play').setAttribute('aria-label', on ? 'Stop scrolling' : 'Start scrolling');
    wake(on);
  }

  $('play').onclick = function () { setPlay(!on); };
  $('slower').onclick = function () { speed = Math.max(10, speed - 10); update(); };
  $('faster').onclick = function () { speed = Math.min(400, speed + 10); update(); };
  $('smaller').onclick = function () { size = Math.max(40, size - 10); update(); };
  $('larger').onclick = function () { size = Math.min(300, size + 10); update(); };
  $('close').onclick = function () { setPlay(false); location.href = app + '/'; };

  /* Any touch shows the buttons. They fade again after a few seconds. */
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (t) {
    document.addEventListener(t, show, { capture: true, passive: true });
  });
  root.addEventListener('click', show);
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); setPlay(!on); }
  });

  function tick(ts) {
    if (on && tgt) {
      if (last && ts - last < 250) {   // skip long gaps so the page does not jump
        acc += speed * (ts - last) / 1000;
        var d = Math.floor(acc);
        if (d > 0) {
          var before = tgt.scrollTop;
          tgt.scrollTop += d; acc -= d;
          if (tgt.scrollTop === before && before > 0) setPlay(false);
        }
      }
      last = ts;
    }
    requestAnimationFrame(tick);
  }

  function start() {
    (document.body || document.documentElement).appendChild(host);
    update(); show();
    requestAnimationFrame(tick);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
