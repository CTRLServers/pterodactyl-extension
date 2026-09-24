(function () {
  'use strict';

  const DEFAULT_ENDPOINT = 'http://127.0.0.1:12747/accept-servers';
  let keyDescription = 'CTRLServers Desktop Integration';
  const STYLE_ID = 'ctrlservers-extension-style';
  let desktopEndpoint = DEFAULT_ENDPOINT;
  let wizard = null;

  function dashboardPath() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    return path === '/' || path === '/dashboard';
  }

  function api(method, url, body) {
    if (window.axios) {
      return window.axios({ method, url, data: body }).then(response => response.data);
    }

    const options = {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    };
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
    if (csrf) options.headers['X-CSRF-TOKEN'] = csrf;
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    return fetch(url, options).then(async response => {
      if (!response.ok) throw new Error(`Pterodactyl returned ${response.status}`);
      return response.status === 204 ? null : response.json();
    });
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .ctrlservers-control-row { display:flex!important; flex-wrap:wrap!important; align-items:center!important; justify-content:flex-end!important; row-gap:8px; }
      .ctrlservers-add { display:flex; align-items:center; flex:0 0 auto; margin-right:12px; }
      .ctrlservers-add--standalone { justify-content:flex-end; margin:0 0 12px; }
      .ctrlservers-add button { display:inline-flex; align-items:center; gap:8px; min-height:34px; padding:7px 14px; border:0; border-radius:999px; background:#3b82f6; color:#fff; font:inherit; font-size:13px; font-weight:600; white-space:nowrap; cursor:pointer; transition:background-color .15s ease; }
      .ctrlservers-add button:hover { background:#2563eb; }
      .ctrlservers-add button:active { background:#1d4ed8; }
      .ctrlservers-add button:focus-visible { outline:2px solid #93c5fd; outline-offset:2px; }
      .ctrlservers-add-icon { width:16px; height:16px; flex:none; }
      .ctrlservers-modal button { border:1px solid rgba(255,255,255,.14); border-radius:4px; padding:8px 12px; background:#252a32; color:#f3f4f6; font:inherit; font-size:13px; font-weight:600; cursor:pointer; }
      .ctrlservers-modal button:hover { background:#343b46; }
      .ctrlservers-modal button.primary { background:#2563eb; border-color:#2563eb; }
      .ctrlservers-modal button:disabled { opacity:.55; cursor:wait; }
      .ctrlservers-overlay { position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(0,0,0,.68); }
      .ctrlservers-modal { box-sizing:border-box; width:min(560px,100%); max-height:85vh; overflow:auto; padding:22px; border:1px solid rgba(255,255,255,.12); border-radius:6px; background:#1f2329; color:#e5e7eb; }
      .ctrlservers-modal h2 { margin:0 0 10px; color:#fff; font-size:18px; }
      .ctrlservers-modal p { margin:0 0 12px; color:#aeb5bf; font-size:13px; line-height:1.55; }
      .ctrlservers-key { margin:14px 0; padding:12px; overflow-wrap:anywhere; border:1px solid rgba(255,255,255,.12); border-radius:4px; background:#15181d; color:#fff; font:13px monospace; }
      .ctrlservers-list { max-height:42vh; overflow:auto; }
      .ctrlservers-server { display:flex; gap:10px; align-items:flex-start; padding:9px 4px; color:#cbd1d9; font-size:13px; }
      .ctrlservers-server input { margin:2px 0 0; accent-color:#3b82f6; }
      .ctrlservers-server strong { display:block; color:#fff; }
      .ctrlservers-actions { display:flex; justify-content:flex-end; gap:8px; flex-wrap:wrap; margin-top:16px; }
      .ctrlservers-error, .ctrlservers-done { margin-top:12px; padding:10px 12px; border-radius:4px; font-size:13px; }
      .ctrlservers-error { border:1px solid rgba(239,68,68,.45); background:rgba(239,68,68,.1); color:#fecaca; }
      .ctrlservers-done { border:1px solid rgba(34,197,94,.4); background:rgba(34,197,94,.1); color:#bbf7d0; }
      @media (max-width:640px) {
        .ctrlservers-control-row { justify-content:flex-start!important; }
      }
    `;
    document.head.appendChild(style);
  }

  function serverControls() {
    const label = Array.from(document.querySelectorAll('p')).find(node =>
      /^showing (?:your|others?'?) servers$/i.test((node.textContent || '').trim().replace(/\s+/g, ' '))
    );
    const row = label?.parentElement;
    return row?.querySelector('input[type="checkbox"]') ? { row, label } : null;
  }

  function serverList() {
    const firstServer = document.querySelector('a[href^="/server/"]');
    if (firstServer) {
      return firstServer.closest('[class*="grid"]') || firstServer.parentElement?.parentElement || null;
    }

    const emptyMessage = Array.from(document.querySelectorAll('p')).find(node => /no (other )?servers/i.test(node.textContent || ''));
    return emptyMessage?.parentElement || null;
  }

  function removeButton() {
    const toolbar = document.getElementById('ctrlservers-add');
    toolbar?.parentElement?.classList.remove('ctrlservers-control-row');
    toolbar?.remove();
  }

  function syncButton() {
    if (!dashboardPath()) {
      removeButton();
      return;
    }

    const controls = serverControls();
    const list = controls ? null : serverList();
    if (!controls && !list) {
      removeButton();
      return;
    }

    let toolbar = document.getElementById('ctrlservers-add');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'ctrlservers-add';
      toolbar.className = 'ctrlservers-add';
      const button = document.createElement('button');
      button.type = 'button';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 16 16');
      icon.setAttribute('aria-hidden', 'true');
      icon.classList.add('ctrlservers-add-icon');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '8');
      circle.setAttribute('cy', '8');
      circle.setAttribute('r', '6.25');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', 'currentColor');
      circle.setAttribute('stroke-width', '1.5');
      const plus = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      plus.setAttribute('d', 'M8 4.5v7M4.5 8h7');
      plus.setAttribute('stroke', 'currentColor');
      plus.setAttribute('stroke-width', '1.5');
      plus.setAttribute('stroke-linecap', 'round');
      icon.append(circle, plus);
      const label = document.createElement('span');
      label.textContent = 'Add to CTRLServers';
      button.append(icon, label);
      button.addEventListener('click', startWizard);
      toolbar.appendChild(button);
    }

    if (controls) {
      controls.row.classList.add('ctrlservers-control-row');
      toolbar.classList.remove('ctrlservers-add--standalone');
      if (toolbar.parentElement !== controls.row || toolbar.nextElementSibling !== controls.label) {
        controls.row.insertBefore(toolbar, controls.label);
      }
      return;
    }

    toolbar.parentElement?.classList.remove('ctrlservers-control-row');
    toolbar.classList.add('ctrlservers-add--standalone');
    if (toolbar.parentElement !== list.parentElement || toolbar.nextElementSibling !== list) {
      list.parentElement?.insertBefore(toolbar, list);
    }
  }

  function closeModal(cancel = false) {
    if (cancel && wizard?.sending) return;
    document.querySelector('.ctrlservers-overlay')?.remove();
    if (cancel) discardWizard();
  }

  function showModal(title, body, actions) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'ctrlservers-overlay';
    const modal = document.createElement('section');
    modal.className = 'ctrlservers-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const heading = document.createElement('h2');
    heading.textContent = title;
    modal.append(heading);
    if (body) modal.append(...(Array.isArray(body) ? body : [body]));
    if (actions) modal.append(actions);
    overlay.append(modal);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeModal(true);
    });
    document.body.append(overlay);
    return modal;
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function actions(...buttons) {
    const row = element('div', undefined, 'ctrlservers-actions');
    buttons.forEach(button => row.append(button));
    return row;
  }

  function button(label, primary, onClick) {
    const result = element('button', label, primary ? 'primary' : '');
    result.type = 'button';
    result.addEventListener('click', onClick);
    return result;
  }

  function errorMessage(text) {
    return element('div', text, 'ctrlservers-error');
  }

  function discardWizard() {
    const keyId = wizard?.keyId;
    wizard = null;
    if (keyId) api('DELETE', `/api/client/account/api-keys/${encodeURIComponent(keyId)}`).catch(() => {});
  }

  function startWizard() {
    discardWizard();
    wizard = { key: null, keyId: null, servers: [], selected: new Set() };
    const copy = element('p', 'CTRLServers needs a Pterodactyl Client API key to manage your servers. A new key will be created and sent only to the CTRLServers app on this computer.');
    const modal = showModal('Add to CTRLServers', copy, actions(
      button('Cancel', false, () => closeModal(true)),
      button('Continue', true, event => createKey(event.currentTarget))
    ));
    modal.querySelector('button.primary').focus();
  }

  function createKey(buttonNode) {
    const session = wizard;
    buttonNode.disabled = true;
    buttonNode.textContent = 'Creating key...';
    api('POST', '/api/client/account/api-keys', { description: keyDescription, allowed_ips: [] })
      .then(data => {
        const keyId = data?.attributes?.identifier;
        const secret = data?.meta?.secret_token;
        const key = keyId && secret ? keyId + secret : '';
        if (!key.startsWith('ptlc_')) throw new Error('Pterodactyl did not return a complete client key');
        if (wizard !== session) {
          api('DELETE', `/api/client/account/api-keys/${encodeURIComponent(keyId)}`).catch(() => {});
          return;
        }
        session.keyId = keyId;
        session.key = key;
        showKey();
      })
      .catch(() => {
        if (wizard !== session) return;
        buttonNode.disabled = false;
        buttonNode.textContent = 'Continue';
        document.querySelector('.ctrlservers-modal')?.append(errorMessage('Could not create an API key. Try again from Account > API Credentials.'));
      });
  }

  function showKey() {
    const key = element('div', wizard.key, 'ctrlservers-key');
    const note = element('p', 'Pterodactyl shows the complete key only once. Copy it now if you also need it elsewhere.');
    const copy = button('Copy', false, () => navigator.clipboard?.writeText(wizard.key));
    const next = button('Select servers', true, loadServers);
    showModal('Client API key created', [note, key], actions(copy, next));
  }

  function loadServers() {
    const session = wizard;
    const modal = showModal('Select servers', element('p', 'Loading servers...'));
    api('GET', '/api/client?page=1&per_page=100')
      .then(data => {
        if (wizard !== session) return;
        session.servers = (data?.data || []).map(({ attributes = {} }) => ({
          identifier: attributes.identifier || '',
          uuid: attributes.uuid || '',
          name: attributes.name || 'Unnamed',
          description: attributes.description || '',
          node: attributes.node || '',
          limits: attributes.limits || {},
        })).filter(server => server.identifier || server.uuid);
        session.selected = new Set(session.servers.map((_, index) => index));
        showServerChoices();
      })
      .catch(() => {
        if (wizard !== session) return;
        modal.append(errorMessage('Could not load your servers. Reload the dashboard and try again.'));
        modal.append(actions(button('Close', false, () => closeModal(true))));
      });
  }

  function showServerChoices() {
    const list = element('div', undefined, 'ctrlservers-list');
    wizard.servers.forEach((server, index) => {
      const label = element('label', undefined, 'ctrlservers-server');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = wizard.selected.has(index);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) wizard.selected.add(index);
        else wizard.selected.delete(index);
      });
      const detail = document.createElement('span');
      detail.append(element('strong', server.name), element('span', server.node || server.identifier || server.uuid));
      label.append(checkbox, detail);
      list.append(label);
    });
    if (!wizard.servers.length) list.append(element('p', 'No servers found on this account.'));

    const modal = showModal('Select servers', [element('p', 'Choose which servers to add to CTRLServers.'), list]);
    const message = element('div');
    const send = button('Add selected servers', true, () => sendServers(modal, message, send));
    modal.append(message, actions(
      button('Cancel', false, () => closeModal(true)),
      send
    ));
  }

  function sendServers(modal, message, sendButton) {
    const session = wizard;
    const selected = wizard.servers.filter((_, index) => wizard.selected.has(index));
    if (!selected.length) {
      message.replaceChildren(errorMessage('Select at least one server.'));
      return;
    }

    sendButton.disabled = true;
    sendButton.textContent = 'Sending...';
    session.sending = true;
    const panelUrl = window.location.origin;
    const payload = {
      panel: { url: panelUrl, apiKey: session.key },
      servers: selected.map(server => ({ ...server, panelUrl, apiKey: session.key })),
    };

    fetch(desktopEndpoint, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Import failed');
        if (wizard !== session) return;
        wizard = null;
        modal.replaceChildren(
          element('h2', 'Done'),
          element('div', `Servers sent to CTRLServers successfully. (${result.count || selected.length} received)`, 'ctrlservers-done'),
          actions(button('Close', true, () => closeModal()))
        );
      })
      .catch(() => {
        if (wizard !== session) return;
        session.sending = false;
        sendButton.disabled = false;
        sendButton.textContent = 'Add selected servers';
        message.replaceChildren(errorMessage('Could not connect to CTRLServers Desktop. Make sure the app is running.'));
      });
  }

  function boot() {
    addStyles();
    api('GET', '/ctrlservers-extension/config').then(config => {
      if (config?.desktopEndpoint) desktopEndpoint = config.desktopEndpoint;
      if (config?.keyDescription) keyDescription = config.keyDescription;
    }).catch(() => {});

    syncButton();
    new MutationObserver(syncButton).observe(document.documentElement, { childList: true, subtree: true });
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function () {
        const result = original.apply(this, arguments);
        syncButton();
        return result;
      };
    }
    window.addEventListener('popstate', syncButton);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
