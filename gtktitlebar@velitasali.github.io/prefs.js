import Gio from 'gi://Gio'
import Gtk from 'gi://Gtk'
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GtkTileBarExtensionPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    this.settings = this.getSettings()
      
    this.settings.bind(
      'restrict-to-primary-screen',
      this._restrict_to_primary_screen,
      'active',
      Gio.SettingsBindFlags.DEFAULT
    )
    
    const hidingStrategy = this.settings.get_string('hide-window-titlebars')
    const hidingStrategyButtons = [
      this._hide_when_maximized,
      this._hide_when_tiled,
      this._hide_when_both,
      this._hide_always ,
    ]
    
    for (const button of hidingStrategyButtons) {
      if (hidingStrategy === button.get_name()) {
        button.active = true
        return false
      }
    }


    const builder = new Gtk.Builder();
    builder.add_from_file('./prefs.ui');

    const mainWidget = builder.get_object('main_widget');
    this.add(mainWidget);

    const restrictToPrimaryScreenSwitch = builder.get_object('restrict_to_primary_screen_switch')
    const hideWindowTitlebarsComboBox = builder.get_object('hide_window_titlebars_combo_box')

    this.settings.bind('restrict-to-primary-screen', restrictToPrimaryScreenSwitch, 'active', Gio.SettingsBindFlags.DEFAULT)
    this.settings.bind('hide-window-titlebars', hideWindowTitlebarsComboBox, 'active-id', Gio.SettingsBindFlags.DEFAULT)

    builder.connect_signals({
      _onBarVisibilityButton: this._onBarVisibilityButton.bind(this),
    });
  }

  _onBarVisibilityButton(visibilityButton)  {
    if (visibilityButton.active) {
      const name = visibilityButton.get_name()
      const newSetting = ['maximized', 'tiled', 'both', 'always'].indexOf(name)
      this.settings.set_enum("hide-window-titlebars", newSetting)
    }
  }
}
