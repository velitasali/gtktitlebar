const GObject = imports.gi.GObject
const Main = imports.ui.main
const ExtensionUtils = imports.misc.extensionUtils
const Me = ExtensionUtils.getCurrentExtension()
const WindowManager = Me.imports.window.WindowManager

var windowManager = null 

function enable() {
  windowManager = new WindowManager()
  windowManager.activate()
}

function disable() {
  windowManager.destroy()
  windowManager = null
}
