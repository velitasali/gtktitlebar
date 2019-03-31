const Lang = imports.lang;
const GTKTitleBar = imports.misc.extensionUtils.getCurrentExtension();
const Signals = GTKTitleBar.imports.handlers.SignalsHandler;

var BaseModule = new Lang.Class({
    Name: 'GTKTitleBar.BaseModule',
    
    _init() {
        this._signals = new Signals(this);

        this._runCallback('_onInitialize');
        this._activate();
    },

    _hasCallback(name) {
        return typeof (this[name]) === 'function';
    },

    _runCallback(name) {
        if (this._hasCallback(name))
            this[name]();
    },

    _activate() {
        this._runCallback('_onActivate');
    },

    _deactivate() {
        this._runCallback('_onDeactivate');
        this._signals.disconnectAll();
    },

    destroy() {
        this._deactivate();
        this._runCallback('_onDestroy');
    }
});
