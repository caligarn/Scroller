// Opens a web page inside the app and adds the scroll buttons.
// Many sites block other pages from showing them in a frame. This function
// gets the page on the server and sends it back as a normal page instead.

var UA = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
// Do not open addresses inside a private network.
var PRIVATE = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function fail(res, code, msg, url) {
  res.statusCode = code;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end('<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Scroller</title><body style="font:17px/1.5 -apple-system,system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 24px">' +
    '<h1 style="font-size:1.6rem">This page did not open.</h1><p>' + esc(msg) + '</p>' +
    (url ? '<p><a href="' + esc(url) + '" target="_blank" rel="noopener">Open it in Safari</a></p>' : '') +
    '<p><a href="/">Back</a></p></body>');
}

module.exports = async function (req, res) {
  var q = new URL(req.url, 'http://app').searchParams;
  var target = (q.get('url') || '').trim();
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

  var url;
  try { url = new URL(target); } catch (e) { return fail(res, 400, 'This is not a valid web address.'); }
  if (!/^https?:$/.test(url.protocol) || (PRIVATE.test(url.hostname) && !process.env.ALLOW_LOCAL)) {
    return fail(res, 400, 'This address cannot be opened.');
  }

  var r;
  try {
    r = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': UA,
        'accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'accept-language': req.headers['accept-language'] || 'en'
      }
    });
  } catch (e) {
    return fail(res, 502, 'The site did not answer.', url.href);
  }

  var type = r.headers.get('content-type') || '';
  // Not a web page (for example an image or a PDF): open it directly.
  if (r.ok && !/html/i.test(type)) {
    res.statusCode = 302;
    res.setHeader('location', r.url);
    return res.end();
  }
  if (!r.ok) {
    return fail(res, 502, 'The site said no (code ' + r.status + '). Some sites only open in a normal browser.', url.href);
  }

  // Read the page in its own character set.
  var buf = Buffer.from(await r.arrayBuffer());
  var cs = (type.match(/charset=["']?([\w-]+)/i) || [])[1] ||
    (buf.subarray(0, 4096).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  var html;
  try { html = new TextDecoder(cs).decode(buf); } catch (e) { html = buf.toString('utf8'); }

  var proto = (req.headers['x-forwarded-proto'] || (req.socket && req.socket.encrypted ? 'https' : 'http')).split(',')[0];
  var host = req.headers['x-forwarded-host'] || req.headers.host;
  var app = proto + '://' + host;

  // The base tag makes images and links load from the real site.
  // No referrer, so image servers do not refuse the request.
  var top = '<base href="' + esc(r.url) + '"><meta name="referrer" content="no-referrer">';
  var tail = '<script src="' + esc(app) + '/reader.js"></script>';

  html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy[^>]*>/gi, '');
  if (/<head(\s[^>]*)?>/i.test(html)) {
    html = html.replace(/<head(\s[^>]*)?>/i, function (m) { return m + top; });
  } else {
    html = top + html;
  }
  var end = html.toLowerCase().lastIndexOf('</body>');
  html = end >= 0 ? html.slice(0, end) + tail + html.slice(end) : html + tail;

  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(html);
};
