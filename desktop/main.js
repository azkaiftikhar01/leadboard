const {
  app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage,
  ipcMain, Notification, screen, systemPreferences,
} = require('electron')
const path = require('node:path')
const fs = require('node:fs')

/**
 * The desktop shell.
 *
 * The whole reason this exists is that a browser tab dies with the browser. A
 * lead who closes Chrome should not lose sight of what he owes, so this runs on
 * its own: a tray icon, and any number of small always-on-top widgets that sit
 * over whatever he is actually working in.
 */

// Point at the deployment by default so widgets share one signed-in session with
// the browser's own cookies for that origin, and pick up every deploy.
const APP_URL = process.env.LEADBOARD_URL || 'https://leadboard-two.vercel.app'
const DEV = process.env.LEADBOARD_DEV === '1'
const BASE = DEV ? 'http://localhost:5180' : APP_URL
const API = process.env.LEADBOARD_API || `${BASE.replace(/\/$/, '')}/api`

const STANDUP_HOUR = Number(process.env.LEADBOARD_STANDUP_HOUR || 9)
const POLL_MS = 60 * 1000

/** Each widget is one feature, small enough to leave open beside real work. */
const WIDGETS = {
  tasks: { label: 'Task list', w: 340, h: 460, corner: 'top-right' },
  focus: { label: 'Focus timer', w: 300, h: 330, corner: 'bottom-right' },
  notes: { label: 'Notes', w: 340, h: 420, corner: 'bottom-left' },
}

let tray = null
let popover = null
let capture = null
let mainWindow = null
let party = null
const widgets = new Map()
let lastNudge = {}

/* ---------------- remembered geometry ---------------- */

const storeFile = () => path.join(app.getPath('userData'), 'widgets.json')

function readStore() {
  try { return JSON.parse(fs.readFileSync(storeFile(), 'utf8')) } catch { return {} }
}
function writeStore(next) {
  try { fs.writeFileSync(storeFile(), JSON.stringify(next, null, 2)) } catch { /* not worth crashing over */ }
}

const baseWebPrefs = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  // one session for every window, so signing in once covers all of them
  partition: 'persist:leadboard',
}

const view = (name, extra = '') =>
  `${BASE.replace(/\/$/, '')}/?view=${name}${extra}`

/* ---------------- widgets ---------------- */

function cornerFor(spec) {
  // The display the cursor is on, not the primary one. With a second monitor
  // attached those are often different, and a widget that opens on the screen
  // you are not looking at is indistinguishable from one that never opened.
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const pad = 16
  const right = workArea.x + workArea.width - spec.w - pad
  const bottom = workArea.y + workArea.height - spec.h - pad
  return {
    'top-right': { x: right, y: workArea.y + pad },
    'bottom-right': { x: right, y: bottom },
    'bottom-left': { x: workArea.x + pad, y: bottom },
    'top-left': { x: workArea.x + pad, y: workArea.y + pad },
  }[spec.corner]
}

function openWidget(kind) {
  const existing = widgets.get(kind)
  if (existing && !existing.isDestroyed()) {
    existing.show()
    existing.focus()
    return existing
  }

  const spec = WIDGETS[kind]
  const saved = readStore()[kind]

  // A remembered position can name a monitor that is no longer plugged in,
  // which restores the widget where nobody can see it.
  const onScreen = (x, y) =>
    x != null && screen.getAllDisplays().some((d) => {
      const a = d.workArea
      return x >= a.x - 40 && x <= a.x + a.width - 60 && y >= a.y - 20 && y <= a.y + a.height - 60
    })
  const at = onScreen(saved?.x, saved?.y) ? { x: saved.x, y: saved.y } : cornerFor(spec)

  const win = new BrowserWindow({
    width: saved?.w ?? spec.w,
    height: saved?.h ?? spec.h,
    x: at.x,
    y: at.y,
    frame: false,
    transparent: true,
    resizable: true,
    minWidth: 260,
    minHeight: 200,
    // over other apps, but never stealing focus from what he is typing into
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: baseWebPrefs,
  })

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.loadURL(view('widget', `&kind=${kind}`))

  // Persist open/closed as it happens. Writing it only at quit meant a force
  // kill left no flag at all, and the next launch opened nothing - with the
  // dock hidden that is indistinguishable from the app failing to start.
  const remember = (open = true) => {
    const store = readStore()
    const bounds = win.isDestroyed() ? (store[kind] ?? {}) : win.getBounds()
    writeStore({ ...store, [kind]: { ...bounds, open } })
  }
  remember(true)
  win.on('moved', () => remember(true))
  win.on('resized', () => remember(true))
  win.on('closed', () => {
    remember(false)
    widgets.delete(kind)
    tray?.setContextMenu(contextMenu())
  })

  widgets.set(kind, win)
  tray?.setContextMenu(contextMenu())
  return win
}

/** Round them all up onto whichever screen the cursor is on. */
function gatherWidgets() {
  for (const [kind, win] of widgets) {
    if (win.isDestroyed()) continue
    const at = cornerFor(WIDGETS[kind])
    win.setPosition(at.x, at.y, false)
    win.show()
  }
}

function toggleWidget(kind) {
  const win = widgets.get(kind)
  if (win && !win.isDestroyed()) {
    win.close()
    widgets.delete(kind)
    tray?.setContextMenu(contextMenu())
    return
  }
  openWidget(kind)
}

/**
 * The celebration layer.
 *
 * Transparent, click-through and over everything, so a focus block finishing in
 * a 300px widget still fills the screen. It never takes focus - he may well be
 * typing in something else when the timer runs out, and a window that steals
 * the keyboard to congratulate him is a punishment.
 */
function celebrate(mood = 'win') {
  // a second call while one is on screen replaces it rather than stacking
  if (party && !party.isDestroyed()) party.close()

  const { bounds } = screen.getPrimaryDisplay()
  party = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    frame: false, transparent: true, resizable: false, movable: false,
    skipTaskbar: true, focusable: false, hasShadow: false,
    alwaysOnTop: true, enableLargerThanScreen: true,
    webPreferences: baseWebPrefs,
  })
  party.setIgnoreMouseEvents(true, { forward: true })
  party.setAlwaysOnTop(true, 'screen-saver')
  party.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  party.loadURL(view('celebrate', `&mood=${mood === 'lose' ? 'lose' : 'win'}`))
  party.on('closed', () => { party = null })
  // a safety net, so a failed render never leaves a dead layer over the screen
  setTimeout(() => { if (party && !party.isDestroyed()) party.close() }, 8000)
  return true
}

/* ---------------- tray ---------------- */

function createTray() {
  const iconPath = path.join(__dirname, '../fe/public/mark-32.png')
  let icon = nativeImage.createEmpty()
  try {
    const img = nativeImage.createFromPath(iconPath)
    if (!img.isEmpty()) icon = img.resize({ width: 18, height: 18 })
  } catch { /* text-only tray is a fine fallback */ }

  tray = new Tray(icon)
  tray.setTitle(' LeadBoard ')
  tray.setToolTip('LeadBoard')
  tray.on('click', togglePopover)
  tray.on('right-click', () => tray.popUpContextMenu(contextMenu()))
  tray.setContextMenu(contextMenu())
}

function contextMenu() {
  return Menu.buildFromTemplate([
    { label: 'Capture  ⌥Space', click: showCapture },
    { label: 'Start standup', click: () => openMain('#/standup') },
    { type: 'separator' },
    {
      label: 'Widgets',
      submenu: Object.entries(WIDGETS).map(([kind, spec]) => ({
        label: spec.label,
        type: 'checkbox',
        checked: widgets.has(kind) && !widgets.get(kind).isDestroyed(),
        click: () => toggleWidget(kind),
      })),
    },
    { label: 'Bring widgets to this screen', click: gatherWidgets },
    { type: 'separator' },
    { label: 'Open the board', click: () => openMain('#/') },
    {
      label: 'Launch at login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { label: 'Quit', click: () => app.quit() },
  ])
}

/* ---------------- popover, capture, main ---------------- */

function createPopover() {
  popover = new BrowserWindow({
    width: 380, height: 620, show: false, frame: false, resizable: false,
    fullscreenable: false, skipTaskbar: true,
    vibrancy: 'under-window', visualEffectState: 'active',
    webPreferences: baseWebPrefs,
  })
  popover.loadURL(view('popover'))
  popover.on('blur', () => popover.hide())
}

function togglePopover() {
  if (popover.isVisible()) return popover.hide()
  const { x, y } = tray.getBounds()
  const { width } = popover.getBounds()
  const display = screen.getDisplayNearestPoint({ x, y })
  popover.setPosition(
    Math.round(Math.min(Math.max(x - width / 2, display.workArea.x + 8),
      display.workArea.x + display.workArea.width - width - 8)),
    Math.round(y + 6),
    false
  )
  popover.show()
  popover.focus()
}

function createCapture() {
  capture = new BrowserWindow({
    width: 380, height: 300, show: false, frame: false, transparent: true,
    alwaysOnTop: true, resizable: false, skipTaskbar: true, vibrancy: 'hud',
    webPreferences: baseWebPrefs,
  })
  capture.loadURL(view('capture'))
  capture.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  capture.on('blur', () => capture.hide())
}

function showCapture() {
  capture.center()
  capture.show()
  capture.focus()
}

function openMain(route = '#/') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`location.hash = ${JSON.stringify(route)}`)
    mainWindow.show()
    mainWindow.focus()
    return
  }
  mainWindow = new BrowserWindow({
    width: 1100, height: 800, titleBarStyle: 'hiddenInset',
    backgroundColor: '#100c19', webPreferences: baseWebPrefs,
  })
  mainWindow.loadURL(`${BASE.replace(/\/$/, '')}/${route}`)
}

/* ---------------- ambient state ---------------- */

async function poll() {
  try {
    const res = await fetch(`${API}/today`)
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()

    const bits = []
    if (data.streak) bits.push(`${data.streak}d`)
    if (data.badge.owed) bits.push(`${data.badge.owed} on me`)
    if (data.badge.atRisk) bits.push(`${data.badge.atRisk} due`)
    tray.setTitle(bits.length ? ` ${bits.join(' · ')} ` : ' LeadBoard ')
    tray.setToolTip(
      `LeadBoard\n${data.badge.owed} waiting on you · ${data.badge.atRisk} due soon · ${data.inboxCount} in inbox`
    )
    nudge(data)
  } catch {
    tray.setTitle(' LeadBoard ')
    tray.setToolTip('LeadBoard — not signed in, or offline')
  }
}

function nudge(data) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const fire = (key, title, body, action) => {
    if (lastNudge[key] === today) return
    lastNudge[key] = today
    const n = new Notification({ title, body })
    n.on('click', action)
    n.show()
  }

  if (!data.standupDone && now.getHours() >= STANDUP_HOUR && now.getDay() > 0 && now.getDay() < 6) {
    fire('standup',
      data.streak ? `Standup — keep the ${data.streak} day streak` : 'Standup time',
      `${data.dueSoon.length} deadline${data.dueSoon.length === 1 ? '' : 's'} in the window · ${data.badge.owed} waiting on you`,
      () => openMain('#/standup'))
  }
  const stuck = (data.tracks?.lead ?? []).filter((t) => (t.daysOnTask ?? 0) >= 1)
  if (stuck.length) {
    fire('owed', `${stuck.length} thing${stuck.length === 1 ? '' : 's'} still waiting on you`,
      stuck.map((t) => t.title).join(', '), () => openWidget('tasks'))
  }
}

/* ---------------- lifecycle ---------------- */

app.whenReady().then(async () => {
  if (process.platform === 'darwin') app.dock?.hide()
  if (process.platform === 'darwin') {
    try { await systemPreferences.askForMediaAccess('microphone') } catch { /* declined */ }
  }

  createTray()
  createPopover()
  createCapture()

  // Whatever was open last time comes back. On a first run there is no store,
  // and a tray-only app with a hidden dock looks like nothing happened - so
  // show the task list, which is the reason to have this running at all.
  const saved = readStore()
  const remembered = Object.keys(WIDGETS).filter((k) => saved[k]?.open)
  const everRecorded = Object.keys(WIDGETS).some((k) => saved[k]?.open !== undefined)

  if (remembered.length) remembered.forEach(openWidget)
  else if (!everRecorded) openWidget('tasks')

  globalShortcut.register('Alt+Space', showCapture)
  globalShortcut.register('CommandOrControl+Shift+L', () => openMain('#/'))
  globalShortcut.register('CommandOrControl+Shift+T', () => toggleWidget('tasks'))
  globalShortcut.register('CommandOrControl+Shift+F', () => toggleWidget('focus'))

  poll()
  setInterval(poll, POLL_MS)
})

ipcMain.on('capture:close', () => capture?.hide())
ipcMain.on('window:open', (_e, route) => openMain(route))
ipcMain.on('widget:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
ipcMain.on('widget:open', (_e, kind) => WIDGETS[kind] && openWidget(kind))
ipcMain.handle('celebrate', (_e, mood) => celebrate(mood))
ipcMain.on('widget:pin', (e, pinned) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  win?.setAlwaysOnTop(Boolean(pinned), 'floating')
})

app.on('window-all-closed', (e) => e.preventDefault()) // lives in the tray
app.on('before-quit', () => {
  // remember which widgets were open, not just where they were
  const store = readStore()
  for (const kind of Object.keys(WIDGETS)) {
    if (store[kind]) store[kind] = { ...store[kind], open: widgets.has(kind) }
  }
  writeStore(store)
})
app.on('will-quit', () => globalShortcut.unregisterAll())
