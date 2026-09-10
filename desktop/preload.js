const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('leadboard', {
  desktop: true,
  closeCapture: () => ipcRenderer.send('capture:close'),
  openMain: (route) => ipcRenderer.send('window:open', route),
  closeWidget: () => ipcRenderer.send('widget:close'),
  openWidget: (kind) => ipcRenderer.send('widget:open', kind),
  pinWidget: (pinned) => ipcRenderer.send('widget:pin', pinned),
})
