const Lang = imports.lang;
const GTKTitleBar = imports.misc.extensionUtils.getCurrentExtension();

var SignalsHandler = new Lang.Class({
    Name: 'GTKTitleBar.SignalsHandler',

    _init(context) {
        this._signals = {};
        this._context = context;
    },

    _getCallbackFunction(callback) {
        if (typeof callback == 'string')
            callback = this._context[callback] || this._context[`_${callback}`];

        return callback;
    },

    _connectHandler(object, name, callbackObj) {
        let callback = this._getCallbackFunction(callbackObj);
        let signalId = object.connect(name, Lang.bind(this._context, callback));

        return { object: object, signalId: signalId };
    },

    _addHandler(object, name, callback) {
        let signalKey = `${object}[${name}#${callback}]`;

        if (!this._signals[signalKey])
            this._signals[signalKey] = this._connectHandler(object, name, callback);

        return signalKey;
    },

    connect(object, name, callback) {
        return this._addHandler(object, name, callback);
    },

    disconnect(signalKey) {
        let signalData = this._signals[signalKey];
        if (!signalData) return;

        signalData.object.disconnect(signalData.signalId);
        delete this._signals[signalKey];
    },

    disconnectMany(signalKeys) {
        signalKeys.forEach(signalKey => { this.disconnect(signalKey) });
    },

    disconnectAll() {
        this.disconnectMany(Object.keys(this._signals));
    }
});