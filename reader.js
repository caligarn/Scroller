// Scroller: small scroll buttons for any web page.
// The Scroller bookmark runs this code on the page you are reading.
// Tap the bookmark again, or tap the close button, to remove the buttons.
(function () {
  if (window.__scroller) { window.__scroller.stop(); return; }

  // The buttons fade after this many milliseconds.
  var HIDE_AFTER = 3000;

  function load(k, d) { try { return +localStorage.getItem(k) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // Speed is in screen points per second.
  var MIN = 20, MAX = 1000, STEP = 20;
  var speed = load('scroller-pps', 120), size = load('scroller-size', 100);
  var on = false, alive = true, last = 0, lock = null, hideT = 0, tgt = null;
  // pos is the exact position. Safari rounds scroll steps, so the code keeps its own.
  var pos = 0, lastSet = 0, atEnd = 0;
  var root = document.scrollingElement || document.documentElement;

  // Find the part of the page that scrolls.
  function pick() {
    var best = null, gap = 0;
    document.querySelectorAll('body *').forEach(function (el) {
      var g = el.scrollHeight - el.clientHeight;
      if (g > gap && el.clientHeight > innerHeight * 0.5 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) { best = el; gap = g; }
    });
    return (root.scrollHeight - root.clientHeight >= gap) ? root : best;
  }

  // The button bar. A shadow root keeps it apart from the page's own styles.
  var host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;left:50%;transform:translateX(-50%);' +
    'bottom:max(14px,calc(env(safe-area-inset-bottom) + 6px))';
  var shadow = host.attachShadow({ mode: 'open' });
  var css = '.bar{display:flex;align-items:center;gap:4px;padding:5px;border-radius:999px;background:rgba(20,20,24,.85);' +
    '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#fff;font:14px -apple-system,system-ui,sans-serif;' +
    'transition:opacity .5s;-webkit-user-select:none;user-select:none;box-shadow:0 4px 16px rgba(0,0,0,.3)}' +
    '.off{opacity:0;pointer-events:none}' +
    'button{all:unset;width:36px;height:36px;border-radius:50%;text-align:center;line-height:36px;font-size:15px;font-weight:600;color:#fff;cursor:pointer;touch-action:manipulation}' +
    'button:active{background:rgba(255,255,255,.18)}.play{background:#0a5cff}' +
    'span{min-width:3.4em;text-align:center;font-variant-numeric:tabular-nums;opacity:.85}' +
    'i{width:1px;height:18px;background:rgba(255,255,255,.25);margin:0 2px}';
  // Some sites block style tags. A constructed style sheet still works there.
  try {
    var sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadow.adoptedStyleSheets = [sheet];
  } catch (e) {
    var st = document.createElement('style');
    st.textContent = css;
    shadow.appendChild(st);
  }

  var bar = document.createElement('div');
  bar.className = 'bar';
  shadow.appendChild(bar);
  function el(tag, text, label, fn) {
    var e = document.createElement(tag);
    if (text) e.textContent = text;
    if (label) e.setAttribute('aria-label', label);
    if (fn) e.addEventListener('click', fn);
    bar.appendChild(e);
    return e;
  }

  el('button', '✕', 'Close', stop);
  el('i');
  el('button', '−', 'Slower', function () { speed = Math.max(MIN, speed - STEP); update(); });
  var speedOut = el('span');
  el('button', '+', 'Faster', function () { speed = Math.min(MAX, speed + STEP); update(); });
  el('i');
  el('button', 'A−', 'Smaller', function () { size = Math.max(40, size - 10); update(); });
  var sizeOut = el('span');
  el('button', 'A+', 'Larger', function () { size = Math.min(300, size + 10); update(); });
  el('i');
  var play = el('button', '▶', 'Start scrolling', function () { setPlay(!on); });
  play.className = 'play';

  function show() {
    bar.classList.remove('off');
    clearTimeout(hideT);
    hideT = setTimeout(function () { bar.classList.add('off'); }, HIDE_AFTER);
  }

  function update() {
    speedOut.textContent = speed;
    sizeOut.textContent = size + '%';
    document.documentElement.style.zoom = size === 100 ? '' : size / 100;
    host.style.zoom = size === 100 ? '' : 100 / size;
    save('scroller-pps', speed);
    save('scroller-size', size);
  }

  // Keep the screen on while the page scrolls.
  function wake(v) {
    try {
      if (v && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { lock = l; }, function () {});
      else if (!v && lock) { lock.release(); lock = null; }
    } catch (e) {}
  }
  function onVisible() {
    if (document.visibilityState === 'visible' && on) wake(true);
  }

  function getY() { return tgt === root ? window.scrollY : tgt.scrollTop; }
  function setY(y) { if (tgt === root) window.scrollTo(0, y); else tgt.scrollTop = y; }
  function maxY() { return Math.max(0, tgt.scrollHeight - tgt.clientHeight); }

  function setPlay(v) {
    on = v; last = 0;
    if (on) {
      tgt = pick() || root;
      pos = lastSet = getY();
      atEnd = 0;
    }
    play.textContent = on ? '❚❚' : '▶';
    play.setAttribute('aria-label', on ? 'Stop scrolling' : 'Start scrolling');
    wake(on);
  }

  function onKey(e) {
    if (e.code === 'Space' && !/INPUT|TEXTAREA/.test(e.target.tagName) && !e.target.isContentEditable) {
      e.preventDefault();
      setPlay(!on);
    }
  }

  // Any touch shows the buttons. They fade again after a few seconds.
  var touches = ['pointerdown', 'touchstart', 'keydown'];
  touches.forEach(function (t) { document.addEventListener(t, show, { capture: true, passive: true }); });
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisible);
  bar.addEventListener('click', show);

  function tick(ts) {
    if (!alive) return;
    if (on && tgt) {
      var dt = last ? ts - last : 0;
      last = ts;
      // Skip long gaps (Safari was in the background), so the page does not jump.
      if (dt > 0 && dt < 250) {
        // If you scrolled by hand, continue from there.
        var y = getY();
        if (Math.abs(y - lastSet) > 40) pos = y;
        var max = maxY();
        pos = Math.min(pos + speed * dt / 1000, max);
        setY(pos);
        lastSet = pos;
        // Stop when the page stays at the end for 3 seconds.
        // The wait lets pages that load more images at the bottom continue.
        atEnd = pos >= max - 1 ? atEnd + dt : 0;
        if (atEnd > 3000) setPlay(false);
      }
    }
    requestAnimationFrame(tick);
  }

  function stop() {
    setPlay(false);
    alive = false;
    clearTimeout(hideT);
    touches.forEach(function (t) { document.removeEventListener(t, show, { capture: true }); });
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisible);
    document.documentElement.style.zoom = '';
    host.remove();
    window.__scroller = null;
  }

  window.__scroller = { stop: stop };
  (document.body || document.documentElement).appendChild(host);
  update();
  show();
  requestAnimationFrame(tick);
})();
