import { WindowManager } from './window.js'
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js'

export default class GtkTileBarExtension extends Extension {
  windowManager = null 

  enable() {
    const settings = this.getSettings()
    this.windowManager = new WindowManager(settings)
    this.windowManager.activate()
  }

  disable() {
    this.windowManager.destroy()
    this.windowManager = null
  }
}