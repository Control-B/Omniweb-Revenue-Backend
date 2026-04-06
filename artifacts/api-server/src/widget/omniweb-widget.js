/* Omniweb AI Sales Widget — v1.1.0
 * Self-contained IIFE, no external dependencies.
 * Install: <script src="https://your-api.omniweb.app/widget.js"
 *              data-api-url="https://your-api.omniweb.app"
 *              data-shop-id="your-shop.myshopify.com"></script>
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var API_URL = (script.getAttribute('data-api-url') || '').replace(/\/$/, '');
  var SHOP_ID = script.getAttribute('data-shop-id') || window.location.hostname;

  if (!API_URL) {
    console.warn('[Omniweb Widget] data-api-url is required.');
    return;
  }

  /* ── Session ID (persisted per shop per tab) ── */
  var SESSION_KEY = 'ow_sess_' + SHOP_ID;
  var sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  /* ── Widget state ── */
  var cfg = {
    greeting:    'Hi! \uD83D\uDC4B How can I help you today?',
    accentColor: '#E63946',
    position:    'bottom-right',
    widgetTitle: 'Sales Assistant',
    enabled:     true
  };
  var isOpen       = false;
  var muted        = false;
  var isLoading    = false;
  var greetingDone = false;
  var audioQueue   = Promise.resolve();

  /* ── Shadow DOM host ── */
  var host = document.createElement('div');
  host.id  = 'ow-widget-host';
  host.setAttribute('aria-label', 'AI Sales Assistant');
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'open' });

  /* ── CSS ── */
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    ':host { all: initial; }',
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
    '#ow-root { position: fixed; z-index: 2147483647; bottom: 24px; right: 24px;',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
    '  font-size: 15px; color: #111; line-height: 1.5; }',
    '#ow-root.pos-left { right: auto; left: 24px; }',

    /* Launcher button */
    '#ow-btn { width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;',
    '  background: var(--ow-accent, #E63946); color: #fff; display: flex; align-items: center;',
    '  justify-content: center; box-shadow: 0 4px 18px rgba(0,0,0,0.22); transition: transform 0.2s, box-shadow 0.2s; }',
    '#ow-btn:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(0,0,0,0.28); }',
    '#ow-btn:focus-visible { outline: 3px solid var(--ow-accent, #E63946); outline-offset: 3px; }',
    '#ow-btn svg { width: 26px; height: 26px; transition: opacity 0.15s; }',
    '#ow-btn .ico-close { display: none; }',
    '#ow-root.open #ow-btn .ico-chat { display: none; }',
    '#ow-root.open #ow-btn .ico-close { display: block; }',

    /* Panel */
    '#ow-panel { position: absolute; bottom: 68px; right: 0; width: 360px; max-width: calc(100vw - 32px);',
    '  background: #fff; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.18);',
    '  display: flex; flex-direction: column; overflow: hidden;',
    '  opacity: 0; pointer-events: none; transform: translateY(12px) scale(0.97);',
    '  transition: opacity 0.22s, transform 0.22s; }',
    '#ow-root.pos-left #ow-panel { right: auto; left: 0; }',
    '#ow-root.open #ow-panel { opacity: 1; pointer-events: auto; transform: translateY(0) scale(1); }',

    /* Header */
    '#ow-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px;',
    '  background: var(--ow-accent, #E63946); color: #fff; flex-shrink: 0; }',
    '#ow-avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.25);',
    '  display: flex; align-items: center; justify-content: center; flex-shrink: 0; }',
    '#ow-avatar svg { width: 20px; height: 20px; }',
    '#ow-title { flex: 1; font-weight: 700; font-size: 15px; }',
    '#ow-subtitle { font-size: 12px; opacity: 0.85; }',
    '#ow-mute-btn { background: rgba(255,255,255,0.15); border: none; border-radius: 8px;',
    '  width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center;',
    '  justify-content: center; color: #fff; transition: background 0.15s; flex-shrink: 0; }',
    '#ow-mute-btn:hover { background: rgba(255,255,255,0.25); }',
    '#ow-mute-btn svg { width: 16px; height: 16px; }',

    /* Messages */
    '#ow-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex;',
    '  flex-direction: column; gap: 10px; min-height: 220px; max-height: 340px; }',
    '.ow-msg { display: flex; flex-direction: column; gap: 2px; }',
    '.ow-msg.user { align-items: flex-end; }',
    '.ow-msg.bot  { align-items: flex-start; }',
    '.ow-bubble { padding: 10px 14px; border-radius: 16px; font-size: 14px; max-width: 82%; line-height: 1.5; word-break: break-word; }',
    '.ow-msg.user .ow-bubble { background: var(--ow-accent, #E63946); color: #fff; border-bottom-right-radius: 4px; }',
    '.ow-msg.bot  .ow-bubble { background: #f3f3f3; color: #111; border-bottom-left-radius: 4px; }',

    /* Typing indicator */
    '.ow-typing { display: flex; align-items: center; gap: 5px; padding: 10px 14px; background: #f3f3f3; border-radius: 16px; border-bottom-left-radius: 4px; width: fit-content; }',
    '.ow-dot { width: 7px; height: 7px; border-radius: 50%; background: #aaa; animation: ow-bounce 1.2s infinite; }',
    '.ow-dot:nth-child(2) { animation-delay: 0.2s; }',
    '.ow-dot:nth-child(3) { animation-delay: 0.4s; }',
    '@keyframes ow-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }',

    /* Input area */
    '#ow-footer { border-top: 1px solid #eee; padding: 12px 12px 12px; display: flex;',
    '  align-items: flex-end; gap: 8px; flex-shrink: 0; }',
    '#ow-input { flex: 1; border: 1.5px solid #ddd; border-radius: 10px; padding: 10px 14px;',
    '  font-size: 14px; font-family: inherit; resize: none; line-height: 1.45;',
    '  max-height: 100px; outline: none; transition: border-color 0.15s; }',
    '#ow-input:focus { border-color: var(--ow-accent, #E63946); }',
    '#ow-send { width: 38px; height: 38px; flex-shrink: 0; border: none; border-radius: 10px;',
    '  background: var(--ow-accent, #E63946); color: #fff; cursor: pointer;',
    '  display: flex; align-items: center; justify-content: center; transition: opacity 0.15s; }',
    '#ow-send:disabled { opacity: 0.45; cursor: not-allowed; }',
    '#ow-send svg { width: 18px; height: 18px; }',
    '#ow-branding { text-align: center; font-size: 11px; color: #bbb; padding: 4px 0 2px;',
    '  flex-basis: 100%; }',
    '#ow-branding a { color: inherit; text-decoration: none; }',
  ].join('\n');
  shadow.appendChild(styleEl);

  /* ── HTML ── */
  var root = document.createElement('div');
  root.id  = 'ow-root';
  root.innerHTML = [
    '<div id="ow-panel" role="dialog" aria-label="Chat with AI Sales Assistant">',
    '  <div id="ow-header">',
    '    <div id="ow-avatar">',
    '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
    '        <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2z"/>',
    '        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>',
    '      </svg>',
    '    </div>',
    '    <div>',
    '      <div id="ow-title">Sales Assistant</div>',
    '      <div id="ow-subtitle">Typically replies instantly</div>',
    '    </div>',
    '    <button id="ow-mute-btn" aria-label="Toggle voice" title="Toggle voice">',
    '      <svg id="ow-icon-sound" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
    '        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>',
    '        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
    '        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    '      </svg>',
    '      <svg id="ow-icon-mute" style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
    '        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>',
    '        <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
    '      </svg>',
    '    </button>',
    '  </div>',
    '  <div id="ow-messages" role="log" aria-live="polite" aria-label="Chat messages"></div>',
    '  <div id="ow-footer">',
    '    <textarea id="ow-input" placeholder="Type a message…" rows="1" aria-label="Chat message input"></textarea>',
    '    <button id="ow-send" aria-label="Send message" disabled>',
    '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
    '        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    '      </svg>',
    '    </button>',
    '    <div id="ow-branding"><a href="#" tabindex="-1">Powered by Omniweb AI</a></div>',
    '  </div>',
    '</div>',
    '<button id="ow-btn" aria-label="Open chat" aria-expanded="false">',
    '  <svg class="ico-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
    '    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    '  </svg>',
    '  <svg class="ico-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
    '    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    '  </svg>',
    '</button>',
  ].join('\n');
  shadow.appendChild(root);

  /* ── DOM refs ── */
  var panelEl   = root.querySelector('#ow-panel');
  var btnEl     = root.querySelector('#ow-btn');
  var muteBtn   = root.querySelector('#ow-mute-btn');
  var iconSound = root.querySelector('#ow-icon-sound');
  var iconMute  = root.querySelector('#ow-icon-mute');
  var titleEl   = root.querySelector('#ow-title');
  var messagesEl = root.querySelector('#ow-messages');
  var inputEl   = root.querySelector('#ow-input');
  var sendBtn   = root.querySelector('#ow-send');

  /* ── Helpers ── */
  function setAccent(color) {
    root.style.setProperty('--ow-accent', color);
  }

  function setPosition(pos) {
    root.classList.toggle('pos-left', pos === 'bottom-left');
    host.style.right = pos === 'bottom-left' ? 'auto' : '24px';
    host.style.left  = pos === 'bottom-left' ? '24px' : 'auto';
  }

  function applyConfig(c) {
    if (c.accentColor) setAccent(c.accentColor);
    if (c.position)    setPosition(c.position);
    if (c.widgetTitle) titleEl.textContent = c.widgetTitle;
    cfg = Object.assign(cfg, c);
  }

  function appendMessage(role, text) {
    var msg = document.createElement('div');
    msg.className = 'ow-msg ' + role;
    var bubble = document.createElement('div');
    bubble.className = 'ow-bubble';
    bubble.textContent = text;
    msg.appendChild(bubble);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'ow-msg bot';
    el.id = 'ow-typing-indicator';
    el.innerHTML = '<div class="ow-typing"><div class="ow-dot"></div><div class="ow-dot"></div><div class="ow-dot"></div></div>';
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var el = messagesEl.querySelector('#ow-typing-indicator');
    if (el) el.remove();
  }

  function showGreeting() {
    if (greetingDone) return;
    greetingDone = true;
    appendMessage('bot', cfg.greeting);
  }

  function fetchConfig() {
    fetch(API_URL + '/api/widget/' + encodeURIComponent(SHOP_ID) + '/config')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (data) applyConfig(data); })
      .catch(function () {});
  }

  /* ── Send chat message ── */
  function sendMessage(text) {
    if (isLoading || !text.trim()) return;
    isLoading = true;
    sendBtn.disabled = true;

    appendMessage('user', text.trim());
    showTyping();

    var pageContext = null;
    try { pageContext = window.__owContext || null; } catch (_) {}

    fetch(API_URL + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        message:   text.trim(),
        shopId:    SHOP_ID,
        pageContext: pageContext
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping();
        var reply = data.reply || 'Sorry, I couldn\'t respond right now.';
        appendMessage('bot', reply);
        if (!muted) playVoice(reply);
      })
      .catch(function () {
        hideTyping();
        appendMessage('bot', 'Something went wrong. Please try again.');
      })
      .finally(function () {
        isLoading  = false;
        sendBtn.disabled = inputEl.value.trim().length === 0;
      });
  }

  /* ── Voice playback ── */
  function playVoice(text) {
    if (muted) return;
    audioQueue = audioQueue.then(function () {
      return fetch(API_URL + '/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, voiceId: cfg.voiceId, shopId: SHOP_ID })
      }).then(function (r) {
        if (!r.ok) return;
        return r.arrayBuffer().then(function (buf) {
          if (!buf.byteLength) return;
          var AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;
          var ctx = new AudioCtx();
          return ctx.decodeAudioData(buf).then(function (decoded) {
            return new Promise(function (resolve) {
              var src = ctx.createBufferSource();
              src.buffer = decoded;
              src.connect(ctx.destination);
              src.onended = resolve;
              src.start(0);
            });
          });
        });
      }).catch(function () {});
    });
  }

  /* ── Toggle panel ── */
  var configRefreshInterval = null;

  function openPanel() {
    isOpen = true;
    root.classList.add('open');
    btnEl.setAttribute('aria-expanded', 'true');
    panelEl.setAttribute('aria-hidden', 'false');
    fetchConfig();
    showGreeting();
    setTimeout(function () { inputEl.focus(); }, 250);
    if (!configRefreshInterval) {
      configRefreshInterval = setInterval(fetchConfig, 30000);
    }
  }

  function closePanel() {
    isOpen = false;
    root.classList.remove('open');
    btnEl.setAttribute('aria-expanded', 'false');
    panelEl.setAttribute('aria-hidden', 'true');
    if (configRefreshInterval) {
      clearInterval(configRefreshInterval);
      configRefreshInterval = null;
    }
  }

  /* ── Events ── */
  btnEl.addEventListener('click', function () {
    if (isOpen) closePanel(); else openPanel();
  });

  muteBtn.addEventListener('click', function () {
    muted = !muted;
    iconSound.style.display = muted ? 'none'  : '';
    iconMute.style.display  = muted ? ''      : 'none';
    muteBtn.setAttribute('aria-label', muted ? 'Unmute voice' : 'Mute voice');
  });

  inputEl.addEventListener('input', function () {
    sendBtn.disabled = inputEl.value.trim().length === 0 || isLoading;
    /* Auto-grow textarea */
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) {
        var text = inputEl.value;
        inputEl.value = '';
        inputEl.style.height = 'auto';
        sendBtn.disabled = true;
        sendMessage(text);
      }
    }
  });

  sendBtn.addEventListener('click', function () {
    var text = inputEl.value;
    if (!text.trim()) return;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;
    sendMessage(text);
  });

  /* Close on Escape key */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  /* ── Bootstrap ── */
  fetchConfig();

})();
