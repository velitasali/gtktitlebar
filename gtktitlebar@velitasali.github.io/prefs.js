const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const GTKTitleBar = imports.misc.extensionUtils.getCurrentExtension();
const Preferences = GTKTitleBar.imports.preferences;

var PrefsWidget = new GObject.Class({
    Name: 'GTBPrefsWidget',
    Extends: Gtk.Box,

    _init(params) {
        this._settings = Preferences.getSettings();

        this.parent(params);

        this._buildable = new Gtk.Builder();
        this._buildable.add_from_file(`${GTKTitleBar.path}/preferences.glade`);

        this._container = this._getWidget('prefs_widget');
        this.add(this._container);

        this._bindStrings();
        this._bindBooleans();
        this._bindEnumerations();
    },

    _getWidget(name) {
        let widgetName = name.replace(/-/g, '_');
        return this._buildable.get_object(widgetName);
    },

    _bindInput(setting, prop) {
        let widget = this._getWidget(setting);
        this._settings.bind(setting, widget, prop, this._settings.DEFAULT_BINDING);
    },

    _bindSelect(setting) {
        let widget = this._getWidget(setting);
        widget.set_active(this._settings.get_enum(setting));

        widget.connect('changed', (combobox) => {
            this._settings.set_enum(setting, combobox.get_active());
        });
    },

    _bindStrings() {
        let settings = this._settings.getTypeSettings('string');
        settings.forEach(setting => { this._bindInput(setting, 'text') });
    },

    _bindBooleans() {
        let settings = this._settings.getTypeSettings('boolean');
        settings.forEach(setting => { this._bindInput(setting, 'active') });
    },

    _bindEnumerations() {
        let settings = this._settings.getTypeSettings('enum');
        settings.forEach(setting => { this._bindSelect(setting) });
    }
});

function init() {
    Preferences.initTranslations();
}

function buildPrefsWidget() {
    let widget = new PrefsWidget();
    widget.show_all();

    return widget;
}