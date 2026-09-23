/* CTRLServers Pterodactyl Extension — client dashboard wizard (vanilla JS).
 * Reuses Pterodactyl core client API routes with the user's session
 * (window.axios with cookies, or fetch with credentials):
 *   GET  /api/client                      (server list)
 *   POST /api/client/account/api-keys     (create client key, ptlc_)
 *   DELETE /api/client/account/api-keys/{identifier}
 * The generated secret is kept only in memory and POSTed to
 * http://127.0.0.1:12747/accept-servers. Never logged or put in URLs.
 */
(function () {
  'use strict';

  var DESKTOP_ENDPOINT = 'http://127.0.0.1:12747/accept-servers';
  var KEY_DESCRIPTION = 'CTRLServers Desktop Integration';
  var CSS_ID = 'ctrlservers-ext-styles';

  function isClientDashboard() {
    var path = window.location.pathname || '/';
    return path === '/' || path === '/dashboard';
  }

  function styles() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      '.cs-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:8px;',
      'font-weight:600;font-size:13px;cursor:pointer;border:1px solid rgba(255,255,255,.12);',
      'background:#2b2f36;color:#fff;transition:background .15s}',
      '.cs-btn:hover{background:#3a4048}',
      '.cs-btn:disabled{opacity:.5;cursor:wait}',
      '.cs-btn-primary{background:#3b82f6;border-color:#3b82f6}',
      '.cs-btn-primary:hover{background:#2563eb}',
      '.cs-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;',
      'display:flex;align-items:center;justify-content:center;padding:16px}',
      '.cs-modal{background:#1e2126;border:1px solid rgba(255,255,255,.1);border-radius:12px;',
      'max-width:560px;width:100%;max-height:85vh;overflow:auto;padding:24px;color:#e5e7eb}',
      '.cs-modal h2{margin:0 0 8px;font-size:18px;color:#fff}',
      '.cs-modal p{font-size:13px;line-height:1.6;color:#9ca3af;margin:0 0 12px}',
      '.cs-keybox{font-family:monospace;background:#111417;border:1px solid rgba(255,255,255,.12);',
      'border-radius:8px;padding:12px;word-break:break-all;font-size:13px;color:#fff;margin:12px 0}',
      '.cs-row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}',
      '.cs-srv{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:8px;border:1px solid transparent}',
      '.cs-srv:hover{background:rgba(255,255,255,.04)}',
      '.cs-srv input{margin-top:3px;width:16px;height:16px;accent-color:#3b82f6}',
      '.cs-srv b{color:#fff;font-size:13px;display:block}',
      '.cs-srv span{font-size:12px;color:#9ca3af}',
      '.cs-err{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.4);color:#fca5a5;',
      'border-radius:8px;padding:10px 12px;font-size:13px;margin-top:12px}',
      '.cs-ok{background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.4);color:#86efac;',
      'border-radius:8px;padding:10px 12px;font-size:13px;margin-top:12px}',
      '.cs-spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);',
      'border-top-color:#fff;border-radius:50%;animation:cs-spin .7s linear infinite}',
      '@keyframes cs-spin{to{transform:rotate(360deg)}}',
    ].join('\n');
    var el = document.createElement('style');
    el.id = CSS_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  function api(method, path, body) {
    var url = path;
    if (window.axios) {
      var cfg = { method: method, url: url };
      if (body) cfg.data = body;
      return window.axios(cfg).then(function (r) { return r.data; });
    }
    var opts = { method: method, credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } };
    var token = document.querySelector('meta[name="csrf-token"]');
    if (token) opts.headers['X-CSRF-TOKEN'] = token.getAttribute('content');
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (r.status === 204) return null;
      return r.json();
    });
  }

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d.firstElementChild;
  }

  function openModal(innerHtml) {
    closeModal();
    var ov = el('<div class="cs-overlay"><div class="cs-modal" role="dialog" aria-modal="true"></div></div>');
    ov.firstElementChild.innerHTML = innerHtml;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    document.body.appendChild(ov);
    return ov.firstElementChild;
  }

  function closeModal() {
    document.querySelectorAll('.cs-overlay').forEach(function (n) { n.remove(); });
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    btn.disabled = !!busy;
    if (busy) {
      btn.dataset.label = btn.innerHTML;
      btn.innerHTML = '<span class="cs-spin"></span> ' + (label || 'Working…');
    } else if (btn.dataset.label) {
      btn.innerHTML = btn.dataset.label;
    }
  }
  var state = { apiKey: null, keyIdentifier: null, servers: [], selected: {} };
  function resetWizardState() {
    var abandonedId = state.keyIdentifier;
    state.apiKey = null;
    state.keyIdentifier = null;
    state.servers = [];
    state.selected = {};
    if (abandonedId) {
      api('DELETE', '/api/client/account/api-keys/' + encodeURIComponent(abandonedId)).catch(function () {});
    }
  }

  function stepWarning() {
    resetWizardState();
    var m = openModal(
      '<h2>Add to CTRLServers</h2>' +
      '<p>CTRLServers requires a Pterodactyl Client API key to manage your servers.</p>' +
      '<p>If you continue, a new API key will automatically be created for your account. ' +
      'The API key will be sent only to the CTRLServers application running locally on your computer at 127.0.0.1.</p>' +
      '<div class="cs-row"><button class="cs-btn" data-x="cancel">Cancel</button>' +
      '<button class="cs-btn cs-btn-primary" data-x="go">Continue</button></div>'
    );
    m.querySelector('[data-x="cancel"]').onclick = closeModal;
    var go = m.querySelector('[data-x="go"]');
    go.onclick = function () {
      setBusy(go, true, 'Creating API key…');
      api('POST', '/api/client/account/api-keys', { description: KEY_DESCRIPTION, allowed_ips: [] })
        .then(function (data) {
          var identifier = (data && data.attributes && data.attributes.identifier) || '';
          var secret = (data && data.meta && data.meta.secret_token) || '';
          if (!identifier || !secret) throw new Error('No secret returned');
          state.keyIdentifier = identifier;
          state.apiKey = identifier + secret;
          stepShowKey();
        })
        .catch(function () {
          setBusy(go, false);
          var e = el('<div class="cs-err">Could not create an API key. Please try again from Account &gt; API Credentials.</div>');
          m.appendChild(e);
        });
    };
  }

  function stepShowKey() {
    var m = openModal(
      '<h2>Client API Key created successfully</h2>' +
      '<p>Store this key somewhere safe. Pterodactyl may only display the complete key once.</p>' +
      '<div class="cs-keybox" id="cs-key"></div>' +
      '<div class="cs-row"><button class="cs-btn" data-x="copy">Copy</button>' +
      '<button class="cs-btn cs-btn-primary" data-x="go">Continue</button></div>'
    );
    m.querySelector('#cs-key').textContent = state.apiKey;
    m.querySelector('[data-x="copy"]').onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(state.apiKey);
    };
    m.querySelector('[data-x="go"]').onclick = stepServers;
  }

  function stepServers() {
    var m = openModal('<h2>Select servers</h2><p>Loading your servers…</p>');
    api('GET', '/api/client?page=1&per_page=100')
      .then(function (data) {
        var list = (data && data.data) || [];
        state.servers = list.map(function (s) {
          var a = s.attributes || {};
          return {
            identifier: a.identifier || '',
            uuid: a.uuid || '',
            name: a.name || 'Unnamed',
            description: a.description || '',
            node: a.node || '',
            limits: a.limits || {},
          };
        }).filter(function (s) { return s.identifier || s.uuid; });
        state.selected = {};
        state.servers.forEach(function (s, i) { state.selected[i] = true; });
        renderServerStep(m);
      })
      .catch(function () {
        m.innerHTML = '<h2>Select servers</h2><div class="cs-err">Could not load your servers. Please reload the dashboard and try again.</div>' +
          '<div class="cs-row"><button class="cs-btn" data-x="cancel">Close</button></div>';
        m.querySelector('[data-x="cancel"]').onclick = function () { cleanupKey(); closeModal(); };
      });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderServerStep(m) {
    var items = state.servers.map(function (s, i) {
      return '<label class="cs-srv"><input type="checkbox" data-i="' + i + '"' + (state.selected[i] ? ' checked' : '') + '>' +
        '<span><b>' + esc(s.name) + '</b><span>' + esc(s.node || s.identifier) + '</span></span></label>';
    }).join('') || '<p>No servers found on your account.</p>';
    m.innerHTML =
      '<h2>Select servers</h2><p>Choose which servers to add to CTRLServers.</p>' +
      '<div class="cs-row" style="justify-content:flex-start;margin:0 0 8px">' +
      '<button class="cs-btn" data-x="all">Select All</button>' +
      '<button class="cs-btn" data-x="none">Deselect All</button></div>' +
      '<div>' + items + '</div><div data-x="msg"></div>' +
      '<div class="cs-row"><button class="cs-btn" data-x="cancel">Cancel</button>' +
      '<button class="cs-btn cs-btn-primary" data-x="send">Add Selected Servers</button></div>';
    m.querySelectorAll('input[data-i]').forEach(function (cb) {
      cb.onchange = function () { state.selected[cb.getAttribute('data-i')] = cb.checked; };
    });
    m.querySelector('[data-x="all"]').onclick = function () {
      Object.keys(state.selected).forEach(function (k) { state.selected[k] = true; });
      renderServerStep(m);
    };
    m.querySelector('[data-x="none"]').onclick = function () {
      Object.keys(state.selected).forEach(function (k) { state.selected[k] = false; });
      renderServerStep(m);
    };
    m.querySelector('[data-x="cancel"]').onclick = function () { cleanupKey(); closeModal(); };
    var send = m.querySelector('[data-x="send"]');
    send.onclick = function () { sendToDesktop(m, send); };
  }

  function cleanupKey() {
    var id = state.keyIdentifier;
    state.apiKey = null;
    state.keyIdentifier = null;
    if (id) api('DELETE', '/api/client/account/api-keys/' + encodeURIComponent(id)).catch(function () {});
  }

  function sendToDesktop(m, btn) {
    var chosen = state.servers.filter(function (s, i) { return state.selected[i]; });
    var msg = m.querySelector('[data-x="msg"]');
    if (!chosen.length) {
      msg.innerHTML = '<div class="cs-err">Select at least one server.</div>';
      return;
    }
    var activeKey = state.apiKey;
    if (!activeKey || activeKey.indexOf('ptlc_') !== 0) {
      msg.innerHTML = '<div class="cs-err">Import session expired. Please close and start again to create a fresh API key.</div>';
      return;
    }
    setBusy(btn, true, 'Sending to CTRLServers…');
    var panelUrl = window.location.origin;
    var payload = {
      type: 'pterodactyl',
      panel: { url: panelUrl, apiKey: activeKey },
      servers: chosen.map(function (s) {
        return {
          identifier: s.identifier, uuid: s.uuid, name: s.name,
          description: s.description, node: s.node, limits: s.limits,
          panelUrl: panelUrl, apiKey: activeKey,
        };
      }),
    };
    if (payload.panel.apiKey !== activeKey ||
        !payload.servers.every(function (s) { return s.apiKey === activeKey; })) {
      setBusy(btn, false);
      msg.innerHTML = '<div class="cs-err">Key mismatch detected. Payload was not sent. Please restart the import.</div>';
      return;
    }
    fetch(DESKTOP_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        setBusy(btn, false);
        if (!res.ok) throw new Error('bad payload');
        var count = (res.body && res.body.count) || chosen.length;
        state.apiKey = null;
        state.keyIdentifier = null;
        state.servers = [];
        state.selected = {};
        m.innerHTML = '<h2>Done</h2><div class="cs-ok">Servers sent to CTRLServers successfully. (' + count + ' received)</div>' +
          '<div class="cs-row"><button class="cs-btn cs-btn-primary" data-x="ok">Close</button></div>';
        m.querySelector('[data-x="ok"]').onclick = closeModal;
      })
      .catch(function () {
        setBusy(btn, false);
        msg.innerHTML = '<div class="cs-err">Could not connect to CTRLServers Desktop. ' +
          'Make sure CTRLServers is installed and currently running.</div>';
      });
  }

  function removeButton() {
    var wrap = document.getElementById('ctrlservers-toolbar');
    if (wrap) wrap.remove();
  }

  function findListContainer() {
    var row = document.querySelector('a[href^="/server/"]');
    if (row && row.parentElement) return row.parentElement;
    var paras = document.querySelectorAll('p');
    for (var i = 0; i < paras.length; i++) {
      if (/no (other )?servers/i.test(paras[i].textContent || '')) return paras[i].parentElement;
    }
    return null;
  }

  function syncButton() {
    if (!isClientDashboard()) {
      removeButton();
      return;
    }
    var container = findListContainer();
    if (!container) {
      removeButton();
      return;
    }
    if (document.getElementById('ctrlservers-toolbar')) {
      var cur = document.getElementById('ctrlservers-toolbar');
      if (cur.parentElement !== container) {
        container.insertBefore(cur, container.firstChild);
      }
      return;
    }
    var wrap = el(
      '<div id="ctrlservers-toolbar" style="display:flex;justify-content:flex-end;margin-bottom:12px">' +
      '<button id="ctrlservers-add-btn" class="cs-btn" type="button">Add to CTRLServers</button></div>'
    );
    wrap.querySelector('#ctrlservers-add-btn').addEventListener('click', stepWarning);
    container.insertBefore(wrap, container.firstChild);
  }

  function boot() {
    styles();
    api('GET', '/ctrlservers-extension/config').then(function (cfg) {
      if (cfg && cfg.desktopEndpoint) DESKTOP_ENDPOINT = cfg.desktopEndpoint;
      if (cfg && cfg.keyDescription) KEY_DESCRIPTION = cfg.keyDescription;
    }).catch(function () {});
    syncButton();
    var obs = new MutationObserver(function () { syncButton(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    var push = history.pushState;
    var replace = history.replaceState;
    history.pushState = function () {
      var r = push.apply(this, arguments);
      syncButton();
      return r;
    };
    history.replaceState = function () {
      var r = replace.apply(this, arguments);
      syncButton();
      return r;
    };
    window.addEventListener('popstate', syncButton);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
