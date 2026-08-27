const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('leadboard', {
  closeCapture: () => ipcRenderer.send('capture:close'),
  openMain: (route) => ipcRenderer.send('window:open', route),
  onFocusMic: (cb) => ipcRenderer.on('mic:focus', cb),
})
