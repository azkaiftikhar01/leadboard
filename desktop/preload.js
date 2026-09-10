const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('leadboard', {
  desktop: true,
  closeCapture: () => ipcRenderer.send('capture:close'),
  openMain: (route) => ipcRenderer.send('window:open', route),
  closeWidget: () => ipcRenderer.send('widget:close'),
  openWidget: (kind) => ipcRenderer.send('widget:open', kind),
  pinWidget: (pinned) => ipcRenderer.send('widget:pin', pinned),
  /** Returns true so the page knows the desktop handled it and can skip its
   *  own in-window confetti. */
  celebrate: (mood) => { ipcRenderer.invoke('celebrate', mood); return true },
})
