// ─── CLOCK ───────────────────────────────────────
function updateClock() {
    const now = new Date();
    document.getElementById('tb-time').textContent =
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('tb-date').textContent =
        now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
updateClock(); setInterval(updateClock, 1000);

// ─── ANALYTICS ENGINE ────────────────────────────
const STORE_KEY = 'portfolio_visits_v2';
function loadData() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { visits: [], winsOpened: 0 }; }
    catch { return { visits: [], winsOpened: 0 }; }
}
function saveData(d) { localStorage.setItem(STORE_KEY, JSON.stringify(d)); }

function recordVisit() {
    const d = loadData();
    const entry = {
        time: new Date().toISOString(),
        ua: navigator.userAgent,
        lang: navigator.language,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${screen.width}x${screen.height}`,
        ref: document.referrer || 'Direct'
    };
    d.visits.push(entry);
    saveData(d);
}

function bumpWindows() {
    const d = loadData();
    d.winsOpened = (d.winsOpened || 0) + 1;
    saveData(d);
    refreshStats();
}

function refreshStats() {
    const d = loadData();
    const today = new Date().toDateString();
    const todayVisits = d.visits.filter(v => new Date(v.time).toDateString() === today);
    document.getElementById('stat-total').textContent = d.visits.length;
    document.getElementById('stat-today').textContent = todayVisits.length;
    document.getElementById('stat-unique').textContent = new Set(d.visits.map(v => v.tz + v.screen)).size;
    document.getElementById('stat-pages').textContent = d.winsOpened || 0;

    const log = document.getElementById('visit-log');
    if (!log) return;
    const recent = [...d.visits].reverse().slice(0, 10);
    log.innerHTML = recent.length ? recent.map(v => {
        const t = new Date(v.time);
        return `<div class="log-entry">
      <div>
        <div class="le-info">📱 ${v.screen} &nbsp;·&nbsp; ${v.lang}</div>
        <div class="le-loc">🌍 ${v.tz} &nbsp;·&nbsp; via ${v.ref.length > 30 ? 'Link' : v.ref || 'Direct'}</div>
      </div>
      <div class="le-time">${t.toLocaleDateString()} ${t.toLocaleTimeString()}</div>
    </div>`;
    }).join('') : '<p style="color:var(--text-dim);font-size:13px;">No visits recorded yet.</p>';
}

function exportReport() {
    const d = loadData();
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'portfolio_report.json'; a.click();
}

recordVisit();
setTimeout(refreshStats, 200);

// ─── WINDOW MANAGER ──────────────────────────────
let zTop = 200;
const openWins = {};
const positions = {};

function getWinDef(id) {
    return document.querySelector(`[data-win="${id}"]`);
}

function openWindow(id) {
    bumpWindows();
    if (openWins[id]) {
        const w = openWins[id];
        w.style.zIndex = ++zTop;
        w.style.animation = 'winOpen 0.18s cubic-bezier(.34,1.56,.64,1)';
        setTimeout(() => w.style.animation = '', 200);
        if (id === 'analytics') { setTimeout(refreshStats, 100); }
        return;
    }
    const tmpl = getWinDef(id);
    if (!tmpl) return;

    const winW = Math.min(parseInt(tmpl.dataset.w), window.innerWidth - 40);
    const winH = Math.min(parseInt(tmpl.dataset.h), window.innerHeight - 80);
    const pos = positions[id] || {
        x: Math.max(20, Math.random() * (window.innerWidth - winW - 40)),
        y: Math.max(10, Math.random() * (window.innerHeight - winH - 80))
    };

    const win = document.createElement('div');
    win.className = 'win';
    win.id = `win-${id}`;
    win.style.cssText = `width:${winW}px;height:${winH}px;left:${pos.x}px;top:${pos.y}px;z-index:${++zTop}`;

    win.innerHTML = `
    <div class="win-titlebar" onmousedown="startDrag(event,'${id}')">
      <span class="win-icon">${tmpl.dataset.icon}</span>
      <span class="win-title">${tmpl.dataset.title}</span>
      <div class="win-controls">
        <div class="wc" onclick="minimizeWin('${id}')" title="Minimise">─</div>
        <div class="wc" onclick="maxWin('${id}')" title="Maximise">□</div>
        <div class="wc close" onclick="closeWin('${id}')" title="Close">✕</div>
      </div>
    </div>
    <div class="win-body">${tmpl.innerHTML}</div>
    <div class="win-resize" onmousedown="startResize(event,'${id}')"></div>
  `;
    document.body.appendChild(win);
    openWins[id] = win;

    win.addEventListener('mousedown', () => { win.style.zIndex = ++zTop; });

    if (id === 'analytics') setTimeout(refreshStats, 150);
    showNotif(tmpl.dataset.icon, tmpl.dataset.title, 'Window opened');
    updateTaskbarDots();
}

function closeWin(id) {
    const w = openWins[id];
    if (!w) return;
    w.style.animation = 'winClose 0.18s forwards';
    setTimeout(() => { w.remove(); delete openWins[id]; updateTaskbarDots(); }, 180);
}

function minimizeWin(id) { closeWin(id); }

const maxState = {};
function maxWin(id) {
    const w = openWins[id];
    if (!w) return;
    if (maxState[id]) {
        const s = maxState[id];
        w.style.cssText = `width:${s.w}px;height:${s.h}px;left:${s.x}px;top:${s.y}px;z-index:${++zTop};border-radius:var(--win-radius)`;
        delete maxState[id];
    } else {
        maxState[id] = { w: w.offsetWidth, h: w.offsetHeight, x: w.offsetLeft, y: w.offsetTop };
        w.style.cssText = `width:${window.innerWidth}px;height:${window.innerHeight - 52}px;left:0;top:0;z-index:${++zTop};border-radius:0`;
    }
}

// ─── DRAG ────────────────────────────────────────
let drag = null;
function startDrag(e, id) {
    if (e.target.closest('.win-controls')) return;
    const w = openWins[id];
    drag = { id, ox: e.clientX - w.offsetLeft, oy: e.clientY - w.offsetTop };
    w.style.transition = 'none';
}
document.addEventListener('mousemove', e => {
    if (!drag) return;
    const w = openWins[drag.id];
    const nx = Math.max(0, Math.min(e.clientX - drag.ox, window.innerWidth - w.offsetWidth));
    const ny = Math.max(0, Math.min(e.clientY - drag.oy, window.innerHeight - 52 - w.offsetHeight));
    w.style.left = nx + 'px'; w.style.top = ny + 'px';
    positions[drag.id] = { x: nx, y: ny };
});
document.addEventListener('mouseup', () => { drag = null; });

// ─── RESIZE ──────────────────────────────────────
let resizing = null;
function startResize(e, id) {
    e.stopPropagation();
    const w = openWins[id];
    resizing = { id, sx: e.clientX, sy: e.clientY, sw: w.offsetWidth, sh: w.offsetHeight };
}
document.addEventListener('mousemove', e => {
    if (!resizing) return;
    const w = openWins[resizing.id];
    const nw = Math.max(320, resizing.sw + (e.clientX - resizing.sx));
    const nh = Math.max(240, resizing.sh + (e.clientY - resizing.sy));
    w.style.width = nw + 'px'; w.style.height = nh + 'px';
});
document.addEventListener('mouseup', () => { resizing = null; });

// ─── TASKBAR DOTS ────────────────────────────────
function updateTaskbarDots() {
    document.querySelectorAll('.tb-btn').forEach(b => b.classList.remove('active'));
}

// ─── START MENU ──────────────────────────────────
function toggleStart() {
    const sm = document.getElementById('start-menu');
    sm.classList.toggle('show');
    if (sm.classList.contains('show')) document.getElementById('start-search').focus();
}
document.addEventListener('click', e => {
    if (!e.target.closest('#start-menu') && !e.target.closest('#tb-start')) {
        document.getElementById('start-menu').classList.remove('show');
    }
});
function filterStart(v) {
    document.querySelectorAll('.start-icon').forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(v.toLowerCase()) ? '' : 'none';
    });
}

// ─── NOTIFICATION ────────────────────────────────
let notifTimer;
function showNotif(icon, title, sub) {
    document.getElementById('notif').querySelector('.ni').textContent = icon;
    document.getElementById('notif-text').textContent = title;
    document.getElementById('notif-sub').textContent = sub;
    const n = document.getElementById('notif');
    n.classList.add('show');
    clearTimeout(notifTimer);
    notifTimer = setTimeout(() => n.classList.remove('show'), 2800);
}

// ─── BOOT WELCOME ────────────────────────────────
window.addEventListener('load', () => {
    setTimeout(() => showNotif('🖥️', 'Welcome to my Portfolio!', 'Double-click any icon to explore'), 800);
    setTimeout(() => openWindow('about'), 1400);
});

// ─── TOUCH SUPPORT ───────────────────────────────
document.addEventListener('touchstart', e => {
    const icon = e.target.closest('.icon');
    if (icon) icon.style.transform = 'scale(0.92)';
}, { passive: true });
document.addEventListener('touchend', e => {
    const icon = e.target.closest('.icon');
    if (icon) icon.style.transform = '';
}, { passive: true });
