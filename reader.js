// Scroller: small scroll buttons for any web page.
// The Scroller bookmark runs this code on the page you are reading.
// Tap the bookmark again, or tap the close button, to remove the buttons.
(function () {
  if (window.__scroller) { window.__scroller.stop(); return; }

  // The buttons fade after this many milliseconds.
  var HIDE_AFTER = 3000;

  // Speeds in screen points per second. The steps get larger as the speed goes up.
  var SPEEDS = [20, 40, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800,
    1000, 1500, 2000, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 30000, 50000, 75000, 100000];

  // Page mode: wait times in seconds between jumps.
  var WAITS = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 45, 60];
  // Each jump moves this part of the screen. The last line stays in view.
  var JUMP = 0.9;

  function load(k, d) { try { return +localStorage.getItem(k) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // Start at the saved value, or the nearest value in the list.
  function nearest(list, v) {
    var n = 0;
    list.forEach(function (x, i) { if (Math.abs(x - v) < Math.abs(list[n] - v)) n = i; });
    return n;
  }
  var si = nearest(SPEEDS, load('scroller-pps', 120));
  var wi = nearest(WAITS, load('scroller-wait', 1));
  // mode is 'scroll' (smooth) or 'page' (jump, then pause).
  var mode = load('scroller-page', 0) ? 'page' : 'scroll', waited = 0;
  var size = load('scroller-size', 100);
  var on = false, alive = true, last = 0, lock = null, hideT = 0, tgt = null;
  // pos is the exact position. Safari rounds scroll steps, so the code keeps its own.
  var pos = 0, atEnd = 0, byHand = false;
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

  // The button bar, on the left side. A shadow root keeps it apart from the page's own styles.
  var host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:50%;transform:translateY(-50%);' +
    'left:max(10px,env(safe-area-inset-left))';
  var shadow = host.attachShadow({ mode: 'open' });
  var css = '.bar{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px;border-radius:999px;background:rgba(20,20,24,.85);' +
    '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#fff;font:13px -apple-system,system-ui,sans-serif;' +
    'transition:opacity .5s;-webkit-user-select:none;user-select:none;box-shadow:0 4px 16px rgba(0,0,0,.3)}' +
    '.off{opacity:0;pointer-events:none}' +
    'button{all:unset;width:36px;height:36px;border-radius:50%;text-align:center;line-height:36px;font-size:15px;font-weight:600;color:#fff;cursor:pointer;touch-action:manipulation}' +
    'button:active{background:rgba(255,255,255,.18)}.play{background:#0a5cff}' +
    '.mode{width:40px;height:26px;line-height:26px;border-radius:13px;font-size:11px;background:rgba(255,255,255,.14)}' +
    'span{width:40px;padding:2px 0;text-align:center;font-variant-numeric:tabular-nums;opacity:.85}' +
    'i{width:18px;height:1px;background:rgba(255,255,255,.25);margin:4px 0}';
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
  var modeBtn = el('button', '', '', function () {
    mode = mode === 'scroll' ? 'page' : 'scroll';
    waited = 0; pos = tgt ? getY() : 0;
    update();
  });
  modeBtn.className = 'mode';
  // + makes the number larger. In Scroll mode it is the speed. In Page mode it is the wait in seconds.
  el('button', '+', 'Increase', function () {
    if (mode === 'page') wi = Math.min(WAITS.length - 1, wi + 1); else si = Math.min(SPEEDS.length - 1, si + 1);
    update();
  });
  var speedOut = el('span');
  el('button', '−', 'Decrease', function () {
    if (mode === 'page') wi = Math.max(0, wi - 1); else si = Math.max(0, si - 1);
    update();
  });
  el('i');
  el('button', 'A+', 'Larger', function () { size = Math.min(300, size + 10); update(); });
  var sizeOut = el('span');
  el('button', 'A−', 'Smaller', function () { size = Math.max(40, size - 10); update(); });
  el('i');
  var play = el('button', '▶', 'Start scrolling', function () { setPlay(!on); });
  play.className = 'play';

  function show() {
    bar.classList.remove('off');
    clearTimeout(hideT);
    hideT = setTimeout(function () { bar.classList.add('off'); }, HIDE_AFTER);
  }

  function short(n) { return n >= 10000 ? n / 1000 + 'k' : String(n); }

  function update() {
    var page = mode === 'page';
    modeBtn.textContent = page ? 'Page' : 'Scroll';
    modeBtn.setAttribute('aria-label', page ? 'Page mode. Tap for Scroll mode' : 'Scroll mode. Tap for Page mode');
    speedOut.textContent = page ? WAITS[wi] + 's' : short(SPEEDS[si]);
    sizeOut.textContent = size + '%';
    document.documentElement.style.zoom = size === 100 ? '' : size / 100;
    host.style.zoom = size === 100 ? '' : 100 / size;
    save('scroller-pps', SPEEDS[si]);
    save('scroller-wait', WAITS[wi]);
    save('scroller-page', page ? 1 : 0);
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

  // Many sites turn on smooth scrolling. That makes each small step a slow
  // animation, so the code turns it off while the page scrolls.
  var smooth = [];
  function instant(v) {
    if (v) {
      [document.documentElement, document.body, tgt].forEach(function (e) {
        if (e && smooth.indexOf(e) < 0) {
          smooth.push(e);
          e.style.setProperty('scroll-behavior', 'auto', 'important');
        }
      });
    } else {
      smooth.forEach(function (e) { e.style.removeProperty('scroll-behavior'); });
      smooth = [];
    }
  }

  function getY() { return tgt === root ? window.scrollY : tgt.scrollTop; }
  function setY(y) { if (tgt === root) window.scrollTo(0, y); else tgt.scrollTop = y; }
  // The visible height of the part that scrolls.
  function screenH() { return tgt === root ? innerHeight : tgt.clientHeight; }
  function maxY() { return Math.max(0, tgt.scrollHeight - tgt.clientHeight); }

  function setPlay(v) {
    on = v; last = 0;
    if (on) {
      tgt = pick() || root;
      instant(true);
      pos = getY();
      atEnd = 0;
      waited = 0;
    } else {
      instant(false);
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
  // When you scroll by hand, scrolling continues from your new place.
  function onHand() { byHand = true; }

  // Any touch shows the buttons. They fade again after a few seconds.
  var touches = ['pointerdown', 'touchstart', 'keydown'];
  var hands = ['touchmove', 'wheel'];
  touches.forEach(function (t) { document.addEventListener(t, show, { capture: true, passive: true }); });
  hands.forEach(function (t) { document.addEventListener(t, onHand, { capture: true, passive: true }); });
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
        if (byHand) { pos = getY(); byHand = false; }
        var max = maxY();
        if (mode === 'page') {
          // Wait, then jump down one screen.
          waited += dt;
          if (waited >= WAITS[wi] * 1000) {
            waited = 0;
            pos = Math.min(getY() + screenH() * JUMP, max);
            setY(pos);
          }
        } else {
          pos = Math.min(pos + SPEEDS[si] * dt / 1000, max);
          setY(pos);
        }
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
    hands.forEach(function (t) { document.removeEventListener(t, onHand, { capture: true }); });
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
