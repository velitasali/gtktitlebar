const Lang = imports.lang;
const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const Util = imports.misc.util;
const GTKTitleBar = imports.misc.extensionUtils.getCurrentExtension();
const Base = GTKTitleBar.imports.module.BaseModule;
const versionCheck = GTKTitleBar.imports.helpers.versionCheck;
const getWindowXID = GTKTitleBar.imports.helpers.getWindowXID;
const isWindow = GTKTitleBar.imports.helpers.isWindow;
const isMaximized = GTKTitleBar.imports.helpers.isMaximized;

var WindowDecoration = new Lang.Class({
    Name: 'GTKTitleBar.WindowDecoration',
    Extends: Base,
    _setting: 'both', // 'both': tiled or maximized, 'tiled': for edges,  'maximized': when maximized, 

    _onInitialize() {
        this.monitorManager = Meta.MonitorManager.get();
        this._useMotifHints = versionCheck('> 3.30.0');
        this._isWaylandComp = Meta.is_wayland_compositor();

        //global.log("GTKTitleBar: windowDecoration - _onInitialize");
    },

    _onActivate() {
        this._signals.connect(global.display, 'notify::focus-window', 'updateTitlebar');
        this._signals.connect(global.window_manager, 'size-change', 'updateTitlebar');
        this._signals.connect(this.monitorManager, 'monitors-changed', 'undecorateWindows');

        this._undecorateWindows();

        //global.log("GTKTitleBar: windowDecoration - _onActivate");
    },

    _onDeactivate() {
        this._decorateWindows();
        //global.log("GTKTitleBar: windowDecoration - _onDeactivate");
    },

    _onReset() {
        this._undecorateWindows();
        //global.log("GTKTitleBar: windowDecoration - _onReset");
    },

    _getWindowXID(win) {
        win._windowXID = win._windowXID || getWindowXID(win);
        return win._windowXID;
    },

    _getHintValue(win, hint) {
        let winId = this._getWindowXID(win);
        if (!winId) return;

        let result = GLib.spawn_command_line_sync(`xprop -id ${winId} ${hint}`);
        let string = ByteArray.toString(result[1]);
        if (!string.match(/=/)) return;

        string = string.split('=')[1].trim().split(',').map(part => {
            part = part.trim();
            return part.match(/\dx/) ? part : `0x${part}`
        });

        return string;
    },

    _setHintValue(win, hint, value) {
        let winId = this._getWindowXID(win);
        if (!winId) return;

        Util.spawn(['xprop', '-id', winId, '-f', hint, '32c', '-set', hint, value]);
    },

    _getMotifHints(win) {
        if (!win._GTKTitleBarOriginalState) {
            let state = this._getHintValue(win, '_GTKTitleBar_ORIGINAL_STATE');

            if (!state) {
                state = this._getHintValue(win, '_MOTIF_WM_HINTS');
                state = state || ['0x2', '0x0', '0x1', '0x0', '0x0'];

                this._setHintValue(win, '_GTKTitleBar_ORIGINAL_STATE', state.join(', '));
            }

            win._GTKTitleBarOriginalState = state;
        }

        return win._GTKTitleBarOriginalState;
    },

    _getAllWindows() {
        let windows = global.get_window_actors().map(win => win.meta_window);
        return windows.filter(win => this._handleWindow(win));
    },

    _handleWindow(win) {
        //global.log("GTKTitleBar: windowDecoration - _handleWindow + win: " + win);

        let handleWin = false;
        if (!isWindow(win)) return;

        if (this._useMotifHints) {
            //global.log("GTKTitleBar: windowDecoration - _handleWindow + motifHints??: " + (isWindow(win) && !win.is_client_decorated()));
            let state = this._getMotifHints(win);
            handleWin = !win.is_client_decorated();
            handleWin = handleWin && (state[2] != '0x2' && state[2] != '0x0');
        } else {
            handleWin = win.decorated;
        }

        return handleWin;
    },

    _toggleDecorations(win, hide) {
        let winId = this._getWindowXID(win);
        if (!winId) return;

        GLib.idle_add(0, () => {
            if (this._useMotifHints)
                this._toggleDecorationsMotif(winId, hide);
            else
                this._toggleDecorationsGtk(winId, hide);
        });

        //global.log("GTKTitleBar: windowDecoration - _toggleDecorations + win: " + win + " + hide?: " + hide);
    },

    _toggleDecorationsGtk(winId, hide) {
        let prop = '_GTK_HIDE_TITLEBAR_WHEN_MAXIMIZED';
        let value = hide ? '0x1' : '0x0';

        Util.spawn(['xprop', '-id', winId, '-f', prop, '32c', '-set', prop, value]);
    },

    _toggleDecorationsMotif(winId, hide) {
        let prop = '_MOTIF_WM_HINTS';
        let flag = '0x2, 0x0, %s, 0x0, 0x0';
        let value = hide
            ? flag.format(this._isWaylandComp ? '0x2' : '0x0')
            : flag.format('0x1')

        Util.spawn(['xprop', '-id', winId, '-f', prop, '32c', '-set', prop, value]);
    },

    _resetDecorations(win) {
        if (!this._handleWindow(win))
            return;

        this._toggleDecorations(win, false);

        delete win._decorationOFF;
        delete win._windowXID;
    },

    _updateTitlebar() {
        let focusWindow = global.display.focus_window;
        let toggleDecor = focusWindow;

        //global.log("GTKTitleBar: windowDecoration - _updateTitleBar");

        if (!this._useMotifHints && this._setting == 'both')
            toggleDecor = focusWindow && focusWindow.get_maximized() !== 0;

        if (toggleDecor)
            this._toggleTitlebar(focusWindow);
    },

    _showTitlebar(win) {
        //global.log("GTKTitleBar: windowDecoration - _showTitleBar + win: " + win);

        if (!win._decorationOFF) return;

        win._decorationOFF = false;
        this._toggleDecorations(win, false);
    },

    _hideTitlebar(win) {
        //global.log("GTKTitleBar: windowDecoration - _hideTitleBar + win: " + win);

        if (win._decorationOFF) return;

        win._decorationOFF = true;
        this._toggleDecorations(win, true);
    },

    _toggleTitlebar(win) {
        //global.log("GTKTitleBar: windowDecoration - _toggleTitleBar + win: " + win);

        if (!this._handleWindow(win))
            return;

        if (isMaximized(win, this._setting))
            this._hideTitlebar(win);
        else
            this._showTitlebar(win);
    },

    _undecorateWindows() {
        let windows = this._getAllWindows();
        windows.forEach(win => { this._toggleTitlebar(win) });
    },

    _decorateWindows() {
        let windows = this._getAllWindows();
        windows.forEach(win => { this._resetDecorations(win) });
    }
});
