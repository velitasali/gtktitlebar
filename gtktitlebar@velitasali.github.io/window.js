const Bytes = imports.byteArray
const {GLib, GObject, Meta} = imports.gi
const Main = imports.ui.main
const Util = imports.misc.util
const ExtensionUtils = imports.misc.extensionUtils

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

var ClientDecorations = class ClientDecorations {
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

var ServerDecorations = class ServerDecorations {
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

var MetaWindow = GObject.registerClass(
  class GTKTitleBarMetaWindow extends GObject.Object {
    _init(win) {
      win._shellManaged = true

      this.settings = ExtensionUtils.getSettings("org.gnome.shell.extensions.gtktitlebar")
      this.win = win
      this.xid = getXid(win)
      
      if (this.xid && !this.win.is_client_decorated()) {
        this.decorations = new ServerDecorations(this.xid)
      } else {
        this.decorations = new ClientDecorations(this.xid)
      }

      this.sizeChangedConnectionId = this.win.connect('size-changed', this.syncDecorations.bind(this))
      this.workspaceChangedConnectionId = this.win.connect('workspace-changed', this.syncDecorations.bind(this))
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
      this.win.disconnect(this.sizeChangedConnectionId)
      this.win.disconnect(this.workspaceChangedConnectionId)
      this.settings.disconnect(this.settingsChangedConnectionId)

      this.win._shellManaged = false
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
        this.win.unmaximize(Meta.MaximizeFlags.BOTH)
      } else {
        this.win.maximize(Meta.MaximizeFlags.BOTH)
      }
    }

    minimize() {
      if (this.windowMinimized) {
        this.win.unminimize()
      } else {
        this.win.minimize()
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
      return this.win.maximized_horizontally && this.win.maximized_vertically
    }

    get windowMinimized() {
      return this.win.minimized
    }
    
    get windowInPrimaryScreen() {
      return this.win.is_on_primary_monitor()
    }

    get windowTiled() {
      if (this.windowMaximized) {
        return false
      } else {
        return this.win.maximized_horizontally || this.win.maximized_vertically
      }
    }
  }
)

var WindowManager = GObject.registerClass(
  class GTKTitleBarWindowManager extends GObject.Object {
    _init() {
      this.settings = ExtensionUtils.getSettings("org.gnome.shell.extensions.gtktitlebar")
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
    
    deleteWindow(win) {
      if (this.hasWindow(win)) {
        const meta = this.getWindow(win)
        meta.destroy()

        this.windows.delete(`${win}`)
      }
    }

    get focusWindow() {
      const win = global.display.get_focus_window()
      return this.getWindow(win)
    }

    hasWindow(win) {
      return win && this.windows.has(`${win}`)
    }

    getWindow(win) {
      return win && this.windows.get(`${win}`)
    }

    setWindow(win) {
      if (!this.hasWindow(win)) {
        const meta = new MetaWindow(win)
        this.windows.set(`${win}`, meta)
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
)
