const Bytes = imports.byteArray
const GLib = imports.gi.GLib
const St = imports.gi.St
const GObject = imports.gi.GObject
const GTKTitleBar = imports.misc.extensionUtils.getCurrentExtension()
const Convenience = GTKTitleBar.imports.convenience

const SETTINGS = Convenience.getSettings()
const WM_PREFS = Convenience.getPreferences()

const USER_CONFIG = GLib.get_user_config_dir()

function fileExists(path) {
  return GLib.file_test(path, GLib.FileTest.EXISTS)
}

function getGioFile(path) {
  const absPath = GLib.build_filenamev([GTKTitleBar.path, path])

  if (fileExists(absPath)) {
    return Gio.file_new_for_path(absPath)
  }
}

function getFileContents(path) {
  if (fileExists(path)) {
    const contents = GLib.file_get_contents(path)
    return Bytes.toString(contents[1])
  } else {
    return ''
  }
}

function setFileContents(path, contents) {
  GLib.file_set_contents(path, contents)
}

var Signals = class Signals {
  constructor() {
    this.signals = new Map()
  }

  registerHandler(object, name, callback) {
    const key = `${object}[${name}]`

    if (!this.hasSignal(key)) {
      this.signals.set(key, {
        object:   object,
        signalId: object.connect(name, callback)
      })
    }

    return key
  }

  hasSignal(key) {
    return this.signals.has(key)
  }

  connect(object, name, callback) {
    return this.registerHandler(object, name, callback)
  }

  disconnect(key) {
    if (this.hasSignal(key)) {
      const data = this.signals.get(key)
      data.object.disconnect(data.signalId)

      this.signals.delete(key)
    }
  }

  disconnectMany(keys) {
    keys.forEach(this.disconnect.bind(this))
  }

  disconnectAll() {
    for (const key of this.signals.keys()) {
      this.disconnect(key)
    }
  }
}

var Settings = class Settings extends Signals {
  getSettingObject(key) {
    if (SETTINGS.exists(key)) {
      return SETTINGS
    } else {
      return WM_PREFS
    }
  }

  connect(name, callback) {
    const object = this.getSettingObject(name)
    return this.registerHandler(object, `changed::${name}`, callback)
  }

  get(key) {
    const object = this.getSettingObject(key)
    return object.getSetting(key)
  }
}
