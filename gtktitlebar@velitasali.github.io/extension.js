const Lang = imports.lang;
const Main = imports.ui.main;
const GTKTitleBar = imports.misc.extensionUtils.getCurrentExtension();
const WindowDecoration = GTKTitleBar.imports.modules.windowDecoration.WindowDecoration;

var GTKTitleBarOnlyExtension = new Lang.Class({
	Name: 'GTKTitleBar.Extension',

	_init() {
		this._windowDecoration = new WindowDecoration();
		//global.log("GTKTitleBar: extension loaded");
	},

	destroy() {
		this._windowDecoration.destroy();
		//global.log("GTKTitleBar: extension destroyed");
	}
});

let gtkTitleBarOnlyExtension;

function init() {
	//global.log("GTKTitleBar: initialized");
}

function enable() {
	gtkTitleBarOnlyExtension = new GTKTitleBarOnlyExtension();
	//global.log("GTKTitleBar: enabled");
}

function disable() {
	gtkTitleBarOnlyExtension.destroy();
	gtkTitleBarOnlyExtension = null;
	//global.log("GTKTitleBar: disabled");
}
