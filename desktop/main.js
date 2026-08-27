const {
  app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage,
  ipcMain, Notification, screen, shell, systemPreferences,
} = require('electron')
const path = require('node:path')

const DEV = process.env.LEADBOARD_DEV === '1'
const API = process.env.LEADBOARD_API || 'http://localhost:4000/api'
const RENDERER = DEV ? 'http://localhost:5180' : `file://${path.join(__dirname, '../fe/dist/index.html')}`

// he does standup first thing; this is the alarm clock for the streak
const STANDUP_HOUR = Number(process.env.LEADBOARD_STANDUP_HOUR || 9)
const POLL_MS = 5 * 60 * 1000

let tray = null
let popover = null
let capture = null
let mainWindow = null
let lastNudge = {}

const url = (view, route = '') =>
  DEV ? `${RENDERER}/?view=${view}${route}` : `${RENDERER}?view=${view}${route}`

const baseWebPrefs = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
}

/* ------------------------------------------------------------------ *
 * Tray — ambient status. The point is that he reads it peripherally
 * without opening anything, the way people read an unread badge.
 * ------------------------------------------------------------------ */
function createTray() {
  tray = new Tray(nativeImage.createEmpty())
  tray.setTitle(' ◆ ')
  tray.setToolTip('Leadboard')

  tray.on('click', togglePopover)
  tray.on('right-click', () => tray.popUpContextMenu(contextMenu()))
}

function contextMenu() {
  return Menu.buildFromTemplate([
    { label: 'Capture  ⌥Space', click: showCapture },
    { label: 'Start standup', click: () => openMain('#/standup') },
    { type: 'separator' },
    { label: 'Board', click: () => openMain('#/board') },
    { label: 'People', click: () => openMain('#/people') },
    { label: 'Inbox', click: () => openMain('#/inbox') },
    { type: 'separator' },
    {
      label: 'Launch at login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { label: 'Quit', click: () => app.quit() },
  ])
}

/* ------------------------------------------------------------------ *
 * Popover — the 90% surface. Closes on blur so it never sits in the way.
 * ------------------------------------------------------------------ */
function createPopover() {
  popover = new BrowserWindow({
    width: 380,
    height: 620,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: baseWebPrefs,
  })
  popover.loadURL(url('popover'))
  popover.on('blur', () => popover.hide())
}

function togglePopover() {
  if (popover.isVisible()) return popover.hide()
  const { x, y } = tray.getBounds()
  const { width } = popover.getBounds()
  const display = screen.getDisplayNearestPoint({ x, y })
  popover.setPosition(
    Math.round(Math.min(Math.max(x - width / 2, display.workArea.x + 8), display.workArea.x + display.workArea.width - width - 8)),
    Math.round(y + 6),
    false
  )
  popover.show()
  popover.focus()
}

/* ------------------------------------------------------------------ *
 * Capture overlay — ⌥Space from inside any app. This is the whole
 * "cheaper than paper" promise: no window to find, no page to turn.
 * ------------------------------------------------------------------ */
function createCapture() {
  capture = new BrowserWindow({
    width: 380,
    height: 300,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    vibrancy: 'hud',
    webPreferences: baseWebPrefs,
  })
  capture.loadURL(url('capture'))
  capture.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  capture.on('blur', () => capture.hide())
}

function showCapture() {
  capture.center()
  capture.show()
  capture.focus()
}

/* ------------------------------------------------------------------ *
 * Main window — depth on demand, which is not most of the time.
 * ------------------------------------------------------------------ */
function openMain(route = '#/') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`location.hash = ${JSON.stringify(route)}`)
    mainWindow.show()
    mainWindow.focus()
    return
  }
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 760,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#12131a',
    webPreferences: baseWebPrefs,
  })
  mainWindow.loadURL(DEV ? `${RENDERER}/${route}` : `${RENDERER}${route}`)
}

/* ------------------------------------------------------------------ *
 * Ambient state + nudges. Notifications are the reason paper loses:
 * the notebook cannot tap him on the shoulder.
 * ------------------------------------------------------------------ */
async function poll() {
  try {
    const res = await fetch(`${API}/today`)
    if (!res.ok) throw new Error(res.statusText)
    const data = await res.json()

    const bits = []
    if (data.streak) bits.push(`🔥${data.streak}`)
    if (data.badge.owed) bits.push(`●${data.badge.owed}`)
    if (data.badge.atRisk) bits.push(`⚠︎${data.badge.atRisk}`)
    tray.setTitle(bits.length ? ` ${bits.join(' ')} ` : ' ◆ ')
    tray.setToolTip(
      `Leadboard\n${data.badge.owed} waiting on you · ${data.badge.atRisk} due soon · ${data.inboxCount} in inbox`
    )

    nudge(data)
  } catch {
    tray.setTitle(' ◆ ')
    tray.setToolTip('Leadboard — API offline')
  }
}

function nudge(data) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const fire = (key, title, body, route) => {
    if (lastNudge[key] === today) return
    lastNudge[key] = today
    const n = new Notification({ title, body, silent: false })
    n.on('click', () => (route === 'capture' ? showCapture() : openMain(route)))
    n.show()
  }

  if (!data.standupDone && now.getHours() >= STANDUP_HOUR && now.getDay() > 0 && now.getDay() < 6) {
    fire(
      'standup',
      data.streak ? `Standup — keep the ${data.streak} day streak` : 'Standup time',
      `${data.dueSoon.length} deadline${data.dueSoon.length === 1 ? '' : 's'} in the window · ${data.owed.length} waiting on you`,
      '#/standup'
    )
  }

  const stuck = data.owed.filter((b) => b.ageHours > 24)
  if (stuck.length) {
    fire('owed', `${stuck.length} thing${stuck.length === 1 ? '' : 's'} still waiting on you`, stuck.map((b) => b.item).join(', '), '#/')
  }

  if (now.getHours() >= 18 && data.inboxCount) {
    fire('inbox', `${data.inboxCount} captures to place`, 'Two minutes now beats a blank morning.', '#/inbox')
  }
}

/* ------------------------------------------------------------------ */
app.whenReady().then(async () => {
  if (process.platform === 'darwin') app.dock?.hide()

  // ask once, up front — a permission prompt in the middle of a thought is
  // exactly the friction that sends him back to the notebook
  if (process.platform === 'darwin') {
    try { await systemPreferences.askForMediaAccess('microphone') } catch {}
  }

  createTray()
  createPopover()
  createCapture()

  globalShortcut.register('Alt+Space', showCapture)
  globalShortcut.register('CommandOrControl+Shift+L', () => openMain('#/'))

  poll()
  setInterval(poll, POLL_MS)
})

ipcMain.on('capture:close', () => capture?.hide())
ipcMain.on('window:open', (_e, route) => openMain(route))

app.on('window-all-closed', (e) => e.preventDefault()) // lives in the tray
app.on('will-quit', () => globalShortcut.unregisterAll())
