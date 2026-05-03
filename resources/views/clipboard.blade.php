<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0b0d10" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <title>Clippy — shared clipboard</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='20' font-size='20'%3E%F0%9F%93%8B%3C/text%3E%3C/svg%3E" />
    @vite(['resources/css/app.css', 'resources/js/app.js'])
  </head>
  <body>
    <div class="app">
      <header class="header">
        <div class="brand">
          <span class="logo" aria-hidden="true">📋</span>
          <span class="brand-name">Clippy</span>
        </div>
        <div class="room" id="room">
          <button class="room-btn" id="roomBtn" type="button" aria-label="Copy room link">
            <span class="room-label">room</span>
            <span class="room-code" id="roomCode">——————</span>
            <svg class="room-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M9 9h10v10H9zM5 15V5h10"/>
            </svg>
          </button>
          <button class="icon-btn" id="newRoomBtn" type="button" title="Create a new room">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/>
            </svg>
            <span>New room</span>
          </button>
          <span class="status" id="status" data-state="connecting" aria-live="polite">
            <span class="dot"></span><span class="status-text">connecting</span>
          </span>
        </div>
      </header>

      <main class="main">
        <form class="composer" id="composer" autocomplete="off">
          <textarea
            id="input"
            class="input"
            placeholder="Paste or type something to share across your devices…"
            rows="3"
            maxlength="200000"
          ></textarea>
          <div class="composer-row">
            <span class="hint" id="hint">⌘/Ctrl + Enter to send</span>
            <button type="submit" class="btn btn-primary" id="sendBtn">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
              <span>Send</span>
            </button>
          </div>
        </form>

        <section class="list-section">
          <div class="list-header">
            <h2 class="list-title">History</h2>
            <button class="btn btn-ghost" id="clearBtn" type="button" hidden>Clear all</button>
          </div>
          <ul class="list" id="list" aria-live="polite"></ul>
          <div class="empty" id="empty">
            <div class="empty-icon">✦</div>
            <div class="empty-title">Nothing here yet</div>
            <div class="empty-sub">Send something above, or open this page on another device using the same room code.</div>
          </div>
        </section>
      </main>

      <div class="toast" id="toast" role="status" aria-live="polite"></div>
    </div>
  </body>
</html>
