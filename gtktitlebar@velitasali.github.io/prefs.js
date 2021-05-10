const {Gio, GObject, Gtk} = imports.gi
const ExtensionUtils = imports.misc.extensionUtils
const Me = ExtensionUtils.getCurrentExtension()

const PrefsWidget = GObject.registerClass({
  GTypeName: 'PrefsWidget',
  Template: Me.dir.get_child('prefs.ui').get_uri(),
  InternalChildren: [
    'restrict_to_primary_screen',
    'hide_when_maximized',
    'hide_when_tiled',
    'hide_when_both',
    'hide_always',
  ]
}, class GTKTitleBarPrefsWidget extends Gtk.Box {

  _init(params = {}) {
    super._init(params)
      
    this.settings = ExtensionUtils.getSettings("org.gnome.shell.extensions.gtktitlebar")
      
    this.settings.bind(
      'restrict-to-primary-screen',
      this._restrict_to_primary_screen,
      'active',
      Gio.SettingsBindFlags.DEFAULT
    )
    
    let hidingStrategy = this.settings.get_string('hide-window-titlebars')
    let hidingStrategyButtons = [
      this._hide_when_maximized,
      this._hide_when_tiled,
      this._hide_when_both,
      this._hide_always ,
    ]
    
    hidingStrategyButtons.forEach((button) => {
      if (hidingStrategy == button.get_name()) {
        button.active = true
        return false
      }
    })
  }
 
  _onBarVisibilityButton(visibilityButton)  {
    if (!visibilityButton.active) return 
    
    var newSetting = -1
    
    switch (visibilityButton.get_name()) {
      case 'maximized':
        newSetting = 0
        break
      case 'tiled':
        newSetting = 1
        break
      case 'both':
        newSetting = 2
        break
      case 'always':
        newSetting = 3
        break
    }
    
    this.settings.set_enum("hide-window-titlebars", newSetting)
  }
})

function init() {
  ExtensionUtils.initTranslations('gtktitlebar')
}

function buildPrefsWidget() {
  return new PrefsWidget()
}
