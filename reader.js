// Scroller: small scroll buttons for any web page.
// The Scroller bookmark runs this code on the page you are reading.
// Tap the bookmark again, or tap the close button, to remove the buttons.
(function () {
  if (window.__scroller) { window.__scroller.stop(); return; }

  // Tapping the bookmark starts playing at once, with the saved settings.
  // Tap the pause button to read without scrolling.

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
  var pos = 0, atEnd = 0, stuck = 0, byHand = false, lastMax = 0, peak = 0, pendWait = 0;
  // prevY: the real place at the last frame. tried: the code moved the page at the last frame.
  var prevY = null, tried = false;
  // Time at the bottom before going to the next chapter, in milliseconds.
  var END_WAIT = 1500;
  // At the bottom, wait up to this long for images that are still loading.
  var IMAGE_WAIT = 8000;
  // Stop waiting for the next chapter to load after this long, in milliseconds.
  var LOAD_LIMIT = 15000;
  // Buttons that were tapped but did not open a new chapter. They are not tapped again.
  var clicked = [];
  var root = document.scrollingElement || document.documentElement;

  // Find the part of the page that scrolls.
  function pick() {
    var best = null, gap = 0;
    document.querySelectorAll('body *').forEach(function (el) {
      var g = el.scrollHeight - el.clientHeight;
      // Use an inner box only when it fills most of the screen. A small box
      // (for example a chapter list) is not the page you read.
      if (g > gap && el.clientHeight > innerHeight * 0.7 && el.clientWidth > innerWidth * 0.5 &&
          /(auto|scroll)/.test(getComputedStyle(el).overflowY)) { best = el; gap = g; }
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
    'i{width:18px;height:1px;background:rgba(255,255,255,.25);margin:4px 0}' +
    '.note{display:none;position:absolute;left:60px;top:50%;transform:translateY(-50%);white-space:nowrap;padding:8px 12px;' +
    'border-radius:10px;background:rgba(20,20,24,.85);color:#fff;font:13px -apple-system,system-ui,sans-serif}';
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
    // A new size changes the page height. Measure the page again.
    peak = 0; lastMax = 0;
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

  // Many sites turn on smooth scrolling or "snap" scrolling. Smooth scrolling makes
  // each small step a slow animation. Snap scrolling pulls the page back. So the
  // code turns both off while the page scrolls.
  var smooth = [];
  function instant(v) {
    if (v) {
      [document.documentElement, document.body, tgt].forEach(function (e) {
        if (e && smooth.indexOf(e) < 0) {
          smooth.push(e);
          e.style.setProperty('scroll-behavior', 'auto', 'important');
          e.style.setProperty('scroll-snap-type', 'none', 'important');
        }
      });
    } else {
      smooth.forEach(function (e) {
        e.style.removeProperty('scroll-behavior');
        e.style.removeProperty('scroll-snap-type');
      });
      smooth = [];
    }
  }

  // True while images near the screen are still loading. Hidden images and
  // images far away do not count, because they may never load.
  function imagesPending() {
    var imgs = document.images, vh = innerHeight;
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (!im.getAttribute('src') || im.complete || im.offsetParent === null) continue;
      var r = im.getBoundingClientRect();
      if (r.bottom > -vh && r.top < vh * 3) return true;
    }
    return false;
  }

  // Start fresh after a new chapter, or after the page changes.
  function resetEnd() {
    atEnd = 0; stuck = 0; pendWait = 0; waited = 0; last = 0; lastMax = 0; peak = 0; prevY = null; tried = false;
  }

  function getY() { return tgt === root ? window.scrollY : tgt.scrollTop; }
  function setY(y) { if (tgt === root) window.scrollTo(0, y); else tgt.scrollTop = y; }
  // The visible height of the part that scrolls.
  function screenH() { return tgt === root ? innerHeight : tgt.clientHeight; }
  // The end of the page (the largest scroll place).
  // When the size is not 100%, Safari gives the height of the whole page in
  // different units from the scroll place. So for the whole page, the code
  // finds the real end: it moves to the bottom and back at once (you do not
  // see this). It keeps the answer for half a second.
  var endY = 0, endAt = 0;
  function maxY(fresh) {
    if (tgt !== root) return Math.max(0, tgt.scrollHeight - tgt.clientHeight);
    var now = Date.now();
    if (fresh || now - endAt > 500) {
      var y = window.scrollY;
      if (!on) instant(true);
      window.scrollTo(0, 1e9);
      endY = window.scrollY;
      window.scrollTo(0, y);
      if (!on) instant(false);
      endAt = now;
    }
    return endY;
  }

  // True when the page cannot move down any more.
  function atBottom() {
    var y = getY();
    if (y >= maxY(true) - 2) return true;
    // Safari's toolbars change the screen height. Test with a small move.
    instant(true);
    setY(y + 2);
    var moved = getY() > y;
    setY(y);
    if (!on) instant(false);
    return !moved;
  }

  function clamp(y, max) { return Math.max(0, Math.min(y, max)); }

  // Jump one screen now. d is 1 for down, -1 for up.
  function step(d) {
    if (!tgt) tgt = pick() || root;
    // ▼ at the bottom of the page goes to the next chapter.
    if (d > 0 && atBottom()) { goNext(); return; }
    instant(true);
    pos = clamp(getY() + d * screenH() * JUMP, maxY());
    setY(pos);
    if (!on) instant(false);
    // In Page mode, wait the full time before the next jump.
    waited = 0;
    atEnd = 0;
  }

  // Find the next chapter link or button. Returns { url, el }, or null.
  // Each link or button gets points. The one with the most points wins.
  var NEXT_WORDS = /^(next|next chapter|next chap|next ch\.?|next episode|next ep\.?|next page|chapter ›|다음|다음화|次|次へ|次の話|下一|下一章|下一话|下一話|siguiente|suivant|próximo|proximo|weiter)/;
  var CHAPTER = /\b(chapter|chap|ch|episode|ep)\b|화|話|章/;
  function visible(e) { return !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length); }
  function findNext() {
    var best = null, top = 0;
    var cands = document.querySelectorAll('a[href], link[rel~="next"][href], button, [role="button"], [role="link"], [onclick]');
    Array.prototype.forEach.call(cands, function (a) {
      if (host.contains(a) || clicked.indexOf(a) >= 0) return;
      var url = null, href = a.getAttribute('href');
      if (href && !/^(#|javascript:)/i.test(href.trim())) {
        try { url = new URL(href, location.href); } catch (e) { return; }
        if (url.origin !== location.origin || !/^https?:/.test(url.protocol)) return;
        url = url.href.split('#')[0];
        if (visited.indexOf(url) >= 0) return;
      }
      var alt = a.querySelector && a.querySelector('img[alt]');
      var text = ((a.textContent || '') + ' ' + (a.getAttribute('aria-label') || '') + ' ' +
        (a.getAttribute('title') || '') + ' ' + (alt ? alt.alt : '')).replace(/\s+/g, ' ').trim().toLowerCase();
      var own = ((typeof a.className === 'string' ? a.className : '') + ' ' + (a.id || '')).toLowerCase();
      var par = a.parentElement;
      var near = par ? ((typeof par.className === 'string' ? par.className : '') + ' ' + (par.id || '')).toLowerCase() : '';
      if (/prev|이전|前|上一|anterior|précédent/.test(text + ' ' + own) || /\bback\b|^[‹«←<]+$/.test(text)) return;
      if (a.disabled || a.getAttribute('aria-disabled') === 'true' || /disabled/.test(own)) return;
      // Image sliders also have "next" buttons. Skip them.
      if (/swiper|slick|carousel|slider|owl-|glide|splide|gallery|lightbox|bullet/.test(own + ' ' + near)) return;
      var score = 0;
      if (/(^|\s)next(\s|$)/i.test(a.getAttribute('rel') || '')) score += 100;
      if (NEXT_WORDS.test(text)) score += 50;
      else if (/^[›»→>]+$|^next\b|\bnext\b/.test(text)) score += 40;
      if (CHAPTER.test(text)) score += 20;
      if (/next/.test(own)) score += 40;
      else if (/next/.test(near) && !/prev/.test(text + own)) score += 30;
      if (a.nodeName !== 'LINK') score += visible(a) ? 10 : -30;
      if (score > top) { top = score; best = { url: url, el: a }; }
    });
    return top >= 40 ? best : null;
  }

  // A short message next to the bar.
  var note = document.createElement('div');
  note.className = 'note';
  shadow.appendChild(note);
  var noteT = 0;
  function say(text) {
    note.textContent = text;
    note.style.display = 'block';
    clearTimeout(noteT);
    noteT = setTimeout(function () { note.style.display = 'none'; }, 4000);
  }

  // Go to the next chapter. Returns false when there is none.
  // Add 1 to a number and keep its leading zeros: 02 -> 03, 09 -> 10, 113 -> 114.
  function bump(str) {
    var n = String(parseInt(str, 10) + 1);
    while (n.length < str.length) n = '0' + n;
    return n;
  }
  // Guess the next chapter address: add 1 to the chapter number in the address.
  // Use the number after a word like "chapter" or "ep". Else use the last number.
  function guessNext() {
    var u = new URL(location.href), path = u.pathname, re = /\d+/g, m, all = [], use = null;
    while ((m = re.exec(path))) all.push(m);
    all.forEach(function (x) {
      if (/(chapter|chap|ch|episode|ep|화|話)[-_\/ .]*$/i.test(path.slice(Math.max(0, x.index - 12), x.index))) use = x;
    });
    use = use || all[all.length - 1];
    if (!use) return null;
    u.pathname = path.slice(0, use.index) + bump(use[0]) + path.slice(use.index + use[0].length);
    u.hash = '';
    return { url: u.href, num: bump(use[0]) };
  }

  function goNext() {
    var next = findNext();
    if (!next) {
      // No link found. Try the next number in the address.
      var guess = guessNext();
      if (guess && visited.indexOf(guess.url) < 0) {
        say('Next chapter (address + 1)…');
        loadNext(guess.url, guess.num);
        return true;
      }
      say('No next chapter link found');
      return false;
    }
    say('Next chapter…');
    if (next.url && next.el.nodeName !== 'BUTTON') {
      loadNext(next.url);
    } else {
      // A button that runs the site's own code. Tap it, as you would.
      var before = location.href;
      loading = true;
      clicked.push(next.el);
      next.el.click();
      setTimeout(function () {
        loading = false;
        if (!alive) return;
        // The site changed the page without a new load. Start at the top.
        if (location.href !== before) {
          visited.push(location.href.split('#')[0]);
          tgt = pick() || root;
          if (on) instant(true);
          pos = 0; setY(0);
        }
        resetEnd();
      }, 2000);
    }
    return true;
  }

  // Many sites load images only when you get near them. Copy the real
  // image address into place, because the site's own code does not run here.
  function fixImages(rootEl) {
    rootEl.querySelectorAll('img, source').forEach(function (img) {
      ['data-src', 'data-lazy-src', 'data-original', 'data-url', 'data-lazy'].forEach(function (k) {
        // The real image address. The site's own code would copy it into place.
        var v = img.getAttribute(k);
        if (v && /^(https?:|\/|\.)|^[\w-]+[\/.]/.test(v) && v !== img.getAttribute('src')) img.setAttribute('src', v);
      });
      var ss = img.getAttribute('data-srcset') || img.getAttribute('data-lazy-srcset');
      if (ss) img.setAttribute('srcset', ss);
      img.removeAttribute('loading');
    });
  }

  // Open the next chapter as a new page. Tap the bookmark there, and it starts playing.
  function openNext(url) {
    location.href = url;
  }

  // Load the next chapter into this page, so Scroller keeps running.
  // If that does not work on this site, open it as a new page.
  // guessNum is set when the address is a guess (address + 1).
  function loadNext(url, guessNum) {
    loading = true;
    visited.push(url);
    // Stop waiting if the site does not answer in time. Then open it as a new page.
    var ctrl = window.AbortController ? new AbortController() : null;
    var limit = setTimeout(function () { if (ctrl) ctrl.abort(); }, LOAD_LIMIT);
    fetch(url, { credentials: 'include', signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
      clearTimeout(limit);
      // A guessed address that does not exist, or that sends you back to
      // another page (for example the title page): there is no next chapter.
      if (guessNum && (r.status === 404 || r.status === 410 || (r.redirected && r.url.indexOf(guessNum) < 0))) {
        throw new Error('none');
      }
      if (!r.ok || new URL(r.url).origin !== location.origin) throw new Error('not ok');
      return r.text().then(function (html) { return { html: html, url: r.url }; });
    }).then(function (got) {
      var doc = new DOMParser().parseFromString(got.html, 'text/html');
      if (!doc.body || !doc.body.children.length) throw new Error('empty');
      // A site that adds its images with its own code sends a page with few
      // images. The site's code does not run here, so open it as a new page.
      var oldImgs = document.body.querySelectorAll('img').length;
      var newImgs = doc.body.querySelectorAll('img').length;
      if (oldImgs >= 3 && newImgs < oldImgs * 0.3) throw new Error('scripts');
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
      if (on) instant(true);
      pos = 0;
      setY(0);
      resetEnd();
      // Start again after a moment.
      setTimeout(function () { loading = false; resetEnd(); }, 1000);
      // When the images have loaded, check the page. If it is still almost
      // empty, the site builds its pages with scripts, so open it as a new page.
      var here = location.href, waitedFor = 0;
      (function check() {
        if (!alive || location.href !== here) return;
        if (imagesPending() && waitedFor < IMAGE_WAIT) {
          waitedFor += 500;
          setTimeout(check, 500);
          return;
        }
        if (maxY() < innerHeight * 0.2) openNext(here);
      })();
    }).catch(function (e) {
      clearTimeout(limit);
      loading = false;
      if (!alive) return;
      if (e && e.message === 'none') {
        say('No next chapter');
        setPlay(false);
      } else {
        openNext(url);
      }
    });
  }

  function setPlay(v) {
    on = v; last = 0;
    if (on) {
      tgt = pick() || root;
      instant(true);
      pos = getY();
      resetEnd();
    } else {
      instant(false);
    }
    play.textContent = on ? '❚❚' : '▶';
    play.setAttribute('aria-label', on ? 'Stop scrolling' : 'Start scrolling');
    wake(on);
  }

  // Start or stop.
  function toggle() {
    setPlay(!on);
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

  function tick(ts) {
    if (!alive) return;
    if (on && tgt && !loading) {
      var dt = last ? ts - last : 0;
      last = ts;
      // The part that scrolls was removed by the site. Find it again.
      if (tgt !== root && !tgt.isConnected) { tgt = pick() || root; instant(true); pos = getY(); }
      // Skip a long gap (Safari was in the background), so the page does not jump.
      // Slow frames on a busy page still move, so the page does not freeze.
      if (dt > 0 && dt < 1000) {
        dt = Math.min(dt, 250);
        if (byHand) { pos = getY(); byHand = false; prevY = null; }
        var max = maxY(), y = getY(), h = screenH();
        // Did the page really move since the last frame? If the code moved it
        // and it did not move, it is stuck. In Page mode one failed jump is enough.
        if (tried && prevY !== null) {
          if (Math.abs(y - prevY) < 0.5) stuck = mode === 'page' ? 1000 : stuck + dt;
          else stuck = 0;
        }
        // The page does not follow (a popup holds it, or Safari's toolbars hide
        // the last part). Continue from the real place, so the code does not run ahead.
        if (stuck >= 200) pos = y;
        // The page grew (more images loaded). It is not the end yet.
        if (max > lastMax + 1) { stuck = 0; atEnd = 0; }
        lastMax = max;
        peak = Math.max(peak, max);
        // The page suddenly got much shorter: a popup froze it. It is not the end.
        var frozen = peak > h && max < peak * 0.5;
        tried = false;
        if (mode === 'page') {
          // Wait, then jump one screen.
          waited += dt;
          if (waited >= WAITS[wi] * 1000) {
            waited = 0;
            pos = clamp(y + dir * h * JUMP, max);
            setY(pos);
            tried = true;
          }
        } else {
          pos = clamp(pos + dir * SPEEDS[si] * dt / 1000, max);
          setY(pos);
          tried = true;
        }
        prevY = y;
        // At the end (or the top, when moving up)? Also count it when the page
        // is stuck near the end, because Safari's toolbars change the screen
        // height. Far from the end, a stuck page is held, not at the end.
        var edge = !frozen && (dir > 0
          ? pos >= max - 1 || (stuck >= 400 && y >= max - h)
          : pos <= 0 || (stuck >= 400 && y <= 1));
        // At the start of an end, check again which part of the page scrolls.
        // A wrong part (for example a small list) would end too early.
        if (edge && atEnd === 0 && pendWait === 0) {
          var again = pick() || root;
          if (again !== tgt) {
            tgt = again;
            instant(true);
            pos = getY();
            resetEnd();
            edge = false;
          }
        }
        if (edge && dir > 0 && pendWait < IMAGE_WAIT && imagesPending()) {
          // Images near the bottom are still loading. Wait for them (up to 8 s).
          if (pendWait === 0) say('Waiting for images…');
          pendWait += dt;
          atEnd = 0;
        } else {
          atEnd = edge ? atEnd + dt : 0;
          if (!edge) pendWait = 0;
        }
        // Wait a short time at the end. Then go to the next chapter.
        // If there is none, stop.
        if (atEnd > END_WAIT) {
          resetEnd();
          if (!(dir > 0 && autoNext && goNext())) {
            setPlay(false);
          }
        }
      }
    }
    requestAnimationFrame(tick);
  }

  // Close (the close button, or a second tap on the bookmark).
  function stop() {
    setPlay(false);
    alive = false;
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
  // Start playing. Wait a moment first, so the page can finish its layout.
  setTimeout(function () { if (alive && !on) setPlay(true); }, 500);
})();
