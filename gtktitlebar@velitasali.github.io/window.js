const Bytes = imports.byteArray
import GLib from 'gi://GLib'
import Meta from 'gi://Meta'
import * as Util from 'resource:///org/gnome/shell/misc/util.js'

const VALID_TYPES = [
  Meta.WindowType.NORMAL,
  Meta.WindowType.DIALOG,
  Meta.WindowType.MODAL_DIALOG,
  Meta.WindowType.UTILITY
]

const GTKTB_HINTS = '_GTKTB_ORIGINAL_STATE'
const MOTIF_HINTS = '_MOTIF_WM_HINTS'

const _SHOW_FLAGS = ['0x2', '0x0', '0x1', '0x0', '0x0']
const _HIDE_FLAGS = ['0x2', '0x0', '0x2', '0x0', '0x0']

function isValid(win) {
  return win && VALID_TYPES.includes(win.window_type)
}

function getXid(win) {
  const desc  = win.get_description()
  const match = desc && desc.match(/0x[0-9a-f]+/)

  return match && match[0]
}

function getHint(xid, name, fallback) {
  const result = GLib.spawn_command_line_sync(`xprop -id ${xid} ${name}`)
  const string = Bytes.toString(result[1])

  if (!string.match(/=/)) {
    return fallback
  }

  return string.split('=')[1].trim().split(',').map(part => {
    part = part.trim()
    return part.match(/\dx/) ? part : `0x${part}`
  })
}

function setHint(xid, hint, value) {
  value = value.join(', ')
  Util.spawn(['xprop', '-id', xid, '-f', hint, '32c', '-set', hint, value])
}

function getHints(xid) {
  let value = getHint(xid, GTKTB_HINTS)

  if (!value) {
    value = getHint(xid, MOTIF_HINTS, _SHOW_FLAGS)
    setHint(xid, GTKTB_HINTS, value)
  }

  return value
}

function isDecorated(hints) {
  return hints[2] != '0x2' && hints[2] != '0x0'
}

class ClientDecorations {
  constructor(xid) {
    this.xid = xid
  }

  show() {
    return false
  }

  hide() {
    return false
  }

  reset() {
    return false
  }
}

class ServerDecorations {
  constructor(xid) {
    this.xid = xid
    this.initial = getHints(xid)
    this.current = this.initial
  }

  get decorated() {
    return isDecorated(this.current)
  }

  get handle() {
    return isDecorated(this.initial)
  }

  show() {
    if (this.handle && !this.decorated) {
      this.current = _SHOW_FLAGS
      setHint(this.xid, MOTIF_HINTS, _SHOW_FLAGS)
    }
  }

  hide() {
    if (this.handle && this.decorated) {
      this.current = _HIDE_FLAGS
      setHint(this.xid, MOTIF_HINTS, _HIDE_FLAGS)
    }
  }

  reset() {
    if (this.handle) {
      setHint(this.xid, MOTIF_HINTS, this.initial)
    }
  }
}

class MetaWindow {
  constructor(window, settings) {
    window._shellManaged = true

    this.settings = settings
    this.window = window
    this.xid = getXid(window)
    
    if (this.xid && !this.window.is_client_decorated()) {
      this.decorations = new ServerDecorations(this.xid)
    } else {
      this.decorations = new ClientDecorations(this.xid)
    }

    this.sizeChangedConnectionId = this.window.connect('size-changed', this.syncDecorations.bind(this))
    this.workspaceChangedConnectionId = this.window.connect('workspace-changed', this.syncDecorations.bind(this))
    this.settingsChangedConnectionId = this.settings.connect('changed', (settings, key) => {
      switch(key) {
        case 'hide-window-titlebars':
        case 'restrict-to-primary-screen':
          this.syncDecorations()
      }
    })
    
    this.syncDecorations()
  }

  destroy() {
    this.decorations.reset()
    this.window.disconnect(this.sizeChangedConnectionId)
    this.window.disconnect(this.workspaceChangedConnectionId)
    this.settings.disconnect(this.settingsChangedConnectionId)

    this.window._shellManaged = false
  }

  get handleScreen() {
    return this.windowInPrimaryScreen || !this.settings.get_boolean('restrict-to-primary-screen')
  }

  get hidingStrategyPreference() {
    if (!this.handleScreen) return false
  
    let setting = this.settings.get_string('hide-window-titlebars')
    switch (setting) {
      case 'always': return true
      case 'tiled': return this.windowTiled
      case 'maximized': return this.windowMaximized
      case 'both': return this.windowMaximized || this.windowTiled
    }
    log("gtktitlebar: Unexpected enum. Will not hide title bars: " + setting)
    return false
  }
  
  maximize() {
    if (this.windowMaximized) {
      this.window.unmaximize(Meta.MaximizeFlags.BOTH)
    } else {
      this.window.maximize(Meta.MaximizeFlags.BOTH)
    }
  }

  minimize() {
    if (this.windowMinimized) {
      this.window.unminimize()
    } else {
      this.window.minimize()
    }
  }
  
  syncDecorations() {
    if (this.hidingStrategyPreference) {
      this.decorations.hide()
    } else {
      this.decorations.show()
    }
  }
  
  get windowMaximized() {
    return this.window.maximized_horizontally && this.window.maximized_vertically
  }

  get windowMinimized() {
    return this.window.minimized
  }
  
  get windowInPrimaryScreen() {
    return this.window.is_on_primary_monitor()
  }

  get windowTiled() {
    if (this.windowMaximized) {
      return false
    } else {
      return this.window.maximized_horizontally || this.window.maximized_vertically
    }
  }
}

export class WindowManager {
  constructor(settings) {
    this.settings = settings
    this.windows  = new Map()
    this.mappingConnectionId = global.window_manager.connect('map', this._onMapWindow.bind(this))
    this.destroyingConnectionId = global.window_manager.connect('destroy', this._onDestroyWindow.bind(this))
    this.focusingConnectionId = global.display.connect('notify::focus-window', this._onFocusWindow.bind(this))
    this.windowLeftMonitorConnectionId = global.display.connect('window-left-monitor', this._onWindowLeftMonitor.bind(this))
  }
  activate() {
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      const actors = global.get_window_actors()
      actors.forEach(actor => this._onMapWindow(null, actor))
    })
  }

  destroy() {
    this.clearWindows()
    global.window_manager.disconnect(this.mappingConnectionId)
    global.window_manager.disconnect(this.destroyingConnectionId)
    global.display.disconnect(this.focusingConnectionId)
    global.display.disconnect(this.windowLeftMonitorConnectionId)
  }
  
  clearWindows() {
    for (const key of this.windows.keys()) {
      this.deleteWindow(key)
    }
  }
  
  deleteWindow(window) {
    if (this.hasWindow(window)) {
      const meta = this.getWindow(window)
      meta.destroy()

      this.windows.delete(`${window}`)
    }
  }

  get focusWindow() {
    const window = global.display.get_focus_window()
    return this.getWindow(window)
  }

  hasWindow(window) {
    return window && this.windows.has(`${window}`)
  }

  getWindow(window) {
    return window && this.windows.get(`${window}`)
  }

  setWindow(window) {
    if (!this.hasWindow(window)) {
      const meta = new MetaWindow(window, this.settings)
      this.windows.set(`${window}`, meta)
    }
  }

  _onDestroyWindow(shellwm, { meta_window }) {
    if (isValid(meta_window)) {
      this.deleteWindow(meta_window)
    }
  }

  _onFocusWindow(display) {
    if (this.focusWindow) {
      this.focusWindow.syncDecorations()
    }
  }
  
  _onMapWindow(shellwm, { meta_window }) {
    if (isValid(meta_window)) {
      this.setWindow(meta_window)
    }
  }

  _onWindowLeftMonitor(display, id, window) {
    if (this.hasWindow(window)) {
      this.getWindow(window).syncDecorations()
    }
  }
}
