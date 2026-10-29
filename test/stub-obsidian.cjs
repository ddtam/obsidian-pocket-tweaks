// A stand-in for the `obsidian` module, enough for main.js to load in
// node and for the loader to run. Component keeps Obsidian's contract:
// children load with a loaded parent, and unloading runs what each
// registered.
const Module = require('node:module');

class Component {
    constructor() {
        this._loaded = false;
        this._children = [];
        this._cleanups = [];
    }
    load() {
        this._loaded = true;
        this._children.forEach((c) => c.load());
    }
    unload() {
        this._children.forEach((c) => c.unload());
        this._cleanups.splice(0).forEach((fn) => fn());
        this._loaded = false;
    }
    addChild(c) {
        this._children.push(c);
        if (this._loaded) c.load();
        return c;
    }
    removeChild(c) {
        this._children = this._children.filter((x) => x !== c);
        c.unload();
        return c;
    }
    register(fn) {
        this._cleanups.push(fn);
    }
    registerDomEvent(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        this.register(() => target.removeEventListener(type, fn, opts));
    }
}

class Plugin extends Component {
    constructor(app, manifest) {
        super();
        this.app = app;
        this.manifest = manifest;
        this.data = null;
        this.saves = 0;
    }
    addCommand(command) {
        command.id = `${this.manifest.id}:${command.id}`;
        this.app.commands.commands[command.id] = command;
        return command;
    }
    addSettingTab() {}
    async loadData() {
        return this.data;
    }
    async saveData(data) {
        this.data = JSON.parse(JSON.stringify(data));
        this.saves += 1;
    }
}

const Platform = { isMobile: false, isDesktopApp: true };

const obsidian = {
    Component, Plugin, Platform,
    MarkdownView: class {},
    Notice: class {},
    PluginSettingTab: class {},
    Setting: class {},
};

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (request === 'obsidian') return 'obsidian';
    return resolve.call(this, request, ...rest);
};
require.cache.obsidian = {
    id: 'obsidian', filename: 'obsidian', loaded: true, exports: obsidian,
};

module.exports = obsidian;
