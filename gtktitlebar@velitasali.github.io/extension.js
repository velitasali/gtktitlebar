const GObject = imports.gi.GObject
const Main = imports.ui.main
const GTKTitleBar = imports.misc.extensionUtils.getCurrentExtension()
const WindowManager = GTKTitleBar.imports.window.WindowManager

var TitleBarExtension = GObject.registerClass(
  class TitleBarExtension extends GObject.Object {
    _init() {
      this.windowManager = new WindowManager()
    }

    get focusWindow() {
      return this.windowManager.focusWindow
    }

    activate() {
      this.windowManager.activate()
    }

    destroy() {
      this.windowManager.destroy()
    }
  }
)

function enable() {
  global.titlebar = new TitleBarExtension()
  global.titlebar.activate()
}

function disable() {
  global.titlebar.destroy()
  global.titlebar = null
}
