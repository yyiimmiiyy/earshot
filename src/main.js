'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, clipboard, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createClaude, MODELS } = require('./core/claude');
const { analyse, decodeFile, toCsv, STORES } = require('./core/reviews');
const { createSettings } = require('./core/settings');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
let settings;
let win;

// Errors cross the IPC boundary as plain data so the window can show them.
function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      return { ok: true, data: await fn(payload || {}) };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });
}

function registerHandlers() {
  handle('settings:get', () => {
    const v = settings.publicView();
    return { model: v.model, hasAnthropicKey: v.hasAnthropicKey, models: MODELS, stores: Object.entries(STORES).map(([id, s]) => ({ id, ...s })) };
  });
  handle('settings:save', ({ model, anthropicKey }) => { settings.save({ model, anthropicKey }); return true; });

  handle('reviews:open', async () => {
    const res = await dialog.showOpenDialog(win, { title: 'Open reviews', properties: ['openFile'], filters: [{ name: 'Reviews', extensions: ['csv', 'txt'] }] });
    if (res.canceled || !res.filePaths.length) return { cancelled: true };
    const file = res.filePaths[0];
    if (fs.statSync(file).size > MAX_FILE_BYTES) throw new Error('That file is larger than 5 MB. Export a shorter date range.');
    return { text: decodeFile(fs.readFileSync(file)), name: path.basename(file) };
  });

  handle('reviews:analyse', async ({ text, appName, store, tone, contact }) => {
    const s = settings.secrets();
    return analyse({ claude: createClaude({ apiKey: s.anthropicKey, model: s.model }), text, appName, store, tone, contact });
  });

  handle('text:copy', ({ text }) => { clipboard.writeText(String(text)); return true; });

  handle('reviews:save', async ({ reviews }) => {
    const res = await dialog.showSaveDialog(win, { title: 'Save replies', defaultPath: 'review-replies.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (res.canceled || !res.filePath) return { saved: false };
    fs.writeFileSync(res.filePath, toCsv(reviews));
    return { saved: true, path: res.filePath };
  });

  handle('open:external', ({ url }) => {
    const u = new URL(url);
    const allowed = ['console.anthropic.com', 'platform.claude.com'];
    if (u.protocol !== 'https:' || !allowed.includes(u.hostname)) throw new Error('That link is not allowed.');
    return shell.openExternal(u.toString());
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 860,
    minHeight: 560,
    title: 'Earshot',
    backgroundColor: '#f6f4ef',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // The window only ever shows our own page.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

app.whenReady().then(() => {
  settings = createSettings({ dir: app.getPath('userData'), crypto: safeStorage });
  Menu.setApplicationMenu(null);
  registerHandlers();
  createWindow();
  if (process.env.EARSHOT_SMOKE) {
    win.webContents.once('did-finish-load', () => { console.log('EARSHOT_SMOKE_OK'); app.quit(); });
  }
});

app.on('window-all-closed', () => app.quit());
