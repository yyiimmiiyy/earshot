'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel) => (payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('earshot', {
  getSettings: call('settings:get'),
  saveSettings: call('settings:save'),
  openFile: call('reviews:open'),
  analyse: call('reviews:analyse'),
  copyText: call('text:copy'),
  saveCsv: call('reviews:save'),
  openExternal: call('open:external')
});
