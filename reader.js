// Scroller: small scroll buttons for any web page.
// The Scroller bookmark runs this code on the page you are reading.
// Tap the bookmark again, or tap the close button, to remove the buttons.
(function () {
  if (window.__scroller) { window.__scroller.stop(); return; }

  // Auto-resume: when you tap the bookmark on the next page, Scroller starts
  // at once if it was playing on this site in the last 30 minutes.
  var RESUME_FOR = 30 * 60 * 1000;

  // Speeds in screen points per second. The steps get larger as the speed goes up.
  var SPEEDS = [20, 40, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800,
    1000, 1500, 2000, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 30000, 50000, 75000, 100000];

  // Page mode: wait times in seconds between jumps.
  // Steps of 0.25 s up to 3 s, 0.5 s up to 6 s, 1 s up to 12 s, then larger.
  var WAITS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 4.5, 5, 5.5, 6,
    7, 8, 9, 10, 11, 12, 15, 20, 25, 30, 45, 60];
  // Each jump moves this part of the screen. The last line stays in view.
  var JUMP = 0.9;

  // Page sizes in percent. Small sizes show more of the page at once.
  var SIZES = [10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400];

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
  var zi = nearest(SIZES, load('scroller-size', 100)), size = SIZES[zi];
  // dir is 1 to move down, -1 to move up.
  var dir = load('scroller-up', 0) ? -1 : 1;
  // autoNext: at the end of a page, go to the next chapter. On at first.
  var autoNext = load('scroller-next', 1) === 1, loading = false, visited = [location.href.split('#')[0]];
  var on = false, alive = true, last = 0, lock = null, tgt = null;
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
    '-webkit-user-select:none;user-select:none;box-shadow:0 4px 16px rgba(0,0,0,.3)}' +
    'button{all:unset;width:36px;height:36px;border-radius:50%;text-align:center;line-height:36px;font-size:15px;font-weight:600;color:#fff;cursor:pointer;touch-action:manipulation}' +
    'button:active{background:rgba(255,255,255,.18)}.play{background:#0a5cff}' +
    '.mode{width:40px;height:26px;line-height:26px;border-radius:13px;font-size:11px;background:rgba(255,255,255,.14)}' +
    '.mode{white-space:nowrap}.dir{font-size:17px}.nextoff{opacity:.45;text-decoration:line-through}' +
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
  var dirBtn = el('button', '', '', function () {
    dir = -dir;
    atEnd = 0;
    update();
  });
  dirBtn.className = 'mode dir';
  var nextBtn = el('button', 'Next', '', function () {
    autoNext = !autoNext;
    update();
  });
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
  el('button', 'A+', 'Larger', function () { zi = Math.min(SIZES.length - 1, zi + 1); size = SIZES[zi]; update(); });
  var sizeOut = el('span');
  el('button', 'A−', 'Smaller', function () { zi = Math.max(0, zi - 1); size = SIZES[zi]; update(); });
  el('i');
  // ▲ and ▼ jump one screen at once, while playing or stopped.
  el('button', '▲', 'Back one screen', function () { step(-1); });
  var play = el('button', '▶', 'Start scrolling', toggle);
  play.className = 'play';
  el('button', '▼', 'Forward one screen', function () { step(1); });

  function short(n) { return n >= 10000 ? n / 1000 + 'k' : String(n); }

  function update() {
    var page = mode === 'page';
    modeBtn.textContent = page ? 'Page' : 'Scroll';
    modeBtn.setAttribute('aria-label', page ? 'Page mode. Tap for Scroll mode' : 'Scroll mode. Tap for Page mode');
    speedOut.textContent = page ? WAITS[wi] + 's' : short(SPEEDS[si]);
    dirBtn.textContent = dir > 0 ? '↓' : '↑';
    nextBtn.className = autoNext ? 'mode' : 'mode nextoff';
    nextBtn.setAttribute('aria-label', autoNext ? 'Next chapter: on. Tap to turn off' : 'Next chapter: off. Tap to turn on');
    dirBtn.setAttribute('aria-label', dir > 0 ? 'Moving down. Tap to move up' : 'Moving up. Tap to move down');
    sizeOut.textContent = size + '%';
    document.documentElement.style.zoom = size === 100 ? '' : size / 100;
    host.style.zoom = size === 100 ? '' : 100 / size;
    save('scroller-pps', SPEEDS[si]);
    save('scroller-wait', WAITS[wi]);
    save('scroller-page', page ? 1 : 0);
    save('scroller-size', size);
    save('scroller-up', dir < 0 ? 1 : 0);
    save('scroller-next', autoNext ? 1 : 2);
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
    if (document.visibilityState === 'hidden') onLeave();
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

  function clamp(y, max) { return Math.max(0, Math.min(y, max)); }

  // Jump one screen now. d is 1 for down, -1 for up.
  function step(d) {
    if (!tgt) tgt = pick() || root;
    instant(true);
    pos = clamp(getY() + d * screenH() * JUMP, maxY());
    setY(pos);
    if (!on) instant(false);
    // In Page mode, wait the full time before the next jump.
    waited = 0;
    atEnd = 0;
  }

  // Find the link to the next chapter. Returns its address, or null.
  // Each link gets points. The link with the most points wins.
  function findNext() {
    var best = null, top = 0;
    var cands = Array.prototype.slice.call(document.querySelectorAll('a[href], link[rel~="next"][href]'));
    cands.forEach(function (a) {
      var url;
      try { url = new URL(a.href, location.href); } catch (e) { return; }
      if (url.origin !== location.origin || !/^https?:/.test(url.protocol)) return;
      var u = url.href.split('#')[0];
      if (visited.indexOf(u) >= 0) return;
      var text = ((a.textContent || '') + ' ' + (a.getAttribute('aria-label') || '') + ' ' + (a.getAttribute('title') || '')).trim().toLowerCase();
      var cls = ((a.className && a.className.baseVal !== undefined ? a.className.baseVal : a.className) + ' ' + a.id).toLowerCase();
      if (/prev|이전|前/.test(text + ' ' + cls) || /\bback\b/.test(text)) return;
      var score = 0;
      if (/(^|\s)next(\s|$)/i.test(a.getAttribute('rel') || '')) score += 100;
      if (/^(next|next chapter|next ch\.?|next episode|next page|다음|次)/.test(text)) score += 50;
      else if (/^[›»→>]+$|^next\b|\bnext\b.*\b(chapter|ch|episode|ep)\b/.test(text)) score += 40;
      if (/\b(chapter|ch|episode|ep)\b/.test(text)) score += 20;
      if (/next/.test(cls)) score += 20;
      if (score > top) { top = score; best = u; }
    });
    return top >= 40 ? best : null;
  }

  // Many sites load images only when you get near them. Copy the real
  // image address into place, because the site's own code does not run here.
  function fixImages(rootEl) {
    rootEl.querySelectorAll('img, source').forEach(function (img) {
      ['data-src', 'data-lazy-src', 'data-original', 'data-url', 'data-lazy'].forEach(function (k) {
        var v = img.getAttribute(k);
        var src = img.getAttribute('src') || '';
        if (v && (!src || /^data:|blank|placeholder|loading|lazy/i.test(src))) img.setAttribute('src', v);
      });
      var ss = img.getAttribute('data-srcset') || img.getAttribute('data-lazy-srcset');
      if (ss) img.setAttribute('srcset', ss);
      img.removeAttribute('loading');
    });
  }

  // Open the next chapter as a new page. Auto-resume starts it when you tap the bookmark.
  function openNext(url) {
    save('scroller-resume', Date.now());
    location.href = url;
  }

  // Load the next chapter into this page, so Scroller keeps running.
  // If that does not work on this site, open it as a new page.
  function loadNext(url) {
    loading = true;
    visited.push(url);
    fetch(url, { credentials: 'include' }).then(function (r) {
      if (!r.ok || new URL(r.url).origin !== location.origin) throw new Error('not ok');
      return r.text().then(function (html) { return { html: html, url: r.url }; });
    }).then(function (got) {
      var doc = new DOMParser().parseFromString(got.html, 'text/html');
      if (!doc.body || !doc.body.children.length) throw new Error('empty');
      history.pushState(null, '', got.url);
      visited.push(got.url.split('#')[0]);
      if (doc.title) document.title = doc.title;
      document.body.className = doc.body.className;
      Array.prototype.slice.call(document.body.childNodes).forEach(function (n) { if (n !== host) n.remove(); });
      Array.prototype.slice.call(doc.body.childNodes).forEach(function (n) {
        if (n.nodeName !== 'SCRIPT') document.body.insertBefore(document.adoptNode(n), host);
      });
      fixImages(document.body);
      tgt = pick() || root;
      pos = 0;
      setY(0);
      atEnd = 0; waited = 0; last = 0;
      // Give the images time to load. If the new page is still short,
      // the site builds its pages with scripts, so open it as a new page.
      setTimeout(function () {
        loading = false;
        if (alive && maxY() < innerHeight * 0.5) openNext(got.url);
      }, 2500);
    }).catch(function () {
      loading = false;
      if (alive) openNext(url);
    });
  }

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

  // You start or stop. This also turns auto-resume on or off.
  function toggle() {
    setPlay(!on);
    save('scroller-resume', on ? Date.now() : 0);
  }
  // Leaving the page while playing keeps auto-resume on for the next page.
  function onLeave() {
    if (on) save('scroller-resume', Date.now());
  }

  function onKey(e) {
    if (e.code === 'Space' && !/INPUT|TEXTAREA/.test(e.target.tagName) && !e.target.isContentEditable) {
      e.preventDefault();
      toggle();
    }
  }
  // When you scroll by hand, scrolling continues from your new place.
  function onHand() { byHand = true; }

  var hands = ['touchmove', 'wheel'];
  hands.forEach(function (t) { document.addEventListener(t, onHand, { capture: true, passive: true }); });
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pagehide', onLeave);

  function tick(ts) {
    if (!alive) return;
    if (on && tgt && !loading) {
      var dt = last ? ts - last : 0;
      last = ts;
      // Skip long gaps (Safari was in the background), so the page does not jump.
      if (dt > 0 && dt < 250) {
        if (byHand) { pos = getY(); byHand = false; }
        var max = maxY();
        if (mode === 'page') {
          // Wait, then jump one screen.
          waited += dt;
          if (waited >= WAITS[wi] * 1000) {
            waited = 0;
            pos = clamp(getY() + dir * screenH() * JUMP, max);
            setY(pos);
          }
        } else {
          pos = clamp(pos + dir * SPEEDS[si] * dt / 1000, max);
          setY(pos);
        }
        // Stop when the page stays at the end (or the top, when moving up) for 3 seconds.
        // The wait lets pages that load more images at the bottom continue.
        atEnd = (dir > 0 ? pos >= max - 1 : pos <= 0) ? atEnd + dt : 0;
        // At the end, go to the next chapter. If there is none, stop.
        // Auto-resume stays on, so the next chapter starts by itself.
        if (atEnd > 3000) {
          atEnd = 0;
          var next = dir > 0 && autoNext ? findNext() : null;
          if (next) {
            loadNext(next);
          } else {
            setPlay(false);
            save('scroller-resume', Date.now());
          }
        }
      }
    }
    requestAnimationFrame(tick);
  }

  // Close (the close button, or a second tap on the bookmark). Auto-resume turns off.
  function stop() {
    setPlay(false);
    save('scroller-resume', 0);
    alive = false;
    window.removeEventListener('pagehide', onLeave);
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
  requestAnimationFrame(tick);
  var since = Date.now() - load('scroller-resume', 0);
  if (since >= 0 && since < RESUME_FOR) {
    // Wait a moment, so the new page can finish its layout.
    setTimeout(function () { if (alive && !on) setPlay(true); }, 500);
  }
})();
