// Module loader: platform filtering, switching without a restart,
// failure isolation, and that stored switches are not rewritten.
const test = require('node:test');
const assert = require('node:assert/strict');
const obsidian = require('./stub-obsidian.cjs');
const PocketTweaks = require('../main.js');
const { MODULES } = PocketTweaks;

function setPlatform(mobile) {
    obsidian.Platform.isMobile = mobile;
    obsidian.Platform.isDesktopApp = !mobile;
}

function fakeDocument() {
    const listeners = new Set();
    return {
        listeners,
        addEventListener: (type, fn) => listeners.add(fn),
        removeEventListener: (type, fn) => listeners.delete(fn),
    };
}

async function start(data) {
    const app = {
        commands: {
            commands: {},
            findCommand() { return null; },
            removeCommand(id) { delete this.commands[id]; },
        },
    };
    const plugin = new PocketTweaks(app, { id: 'pocket-tweaks' });
    plugin.data = data;
    await plugin.onload();
    plugin.load();
    return plugin;
}

const commandIds = (p) => Object.keys(p.app.commands.commands).sort();

test('desktop skips the mobile module and loads check-all', async () => {
    setPlatform(false);
    global.document = fakeDocument();
    const p = await start(null);
    assert.deepEqual([...p.loaded.keys()], ['check-all-tasks']);
    assert.equal(document.listeners.size, 0);
    assert.deepEqual(commandIds(p), [
        'pocket-tweaks:check-all-tasks',
        'pocket-tweaks:uncheck-all-tasks',
    ]);
});

test('mobile loads both modules', async () => {
    setPlatform(true);
    global.document = fakeDocument();
    const p = await start(null);
    assert.deepEqual([...p.loaded.keys()].sort(),
        ['check-all-tasks', 'navbar-omnisearch']);
    assert.equal(document.listeners.size, 1);
});

test('a switch turned off unloads its events and commands', async () => {
    setPlatform(true);
    global.document = fakeDocument();
    const p = await start(null);
    const byId = (id) => MODULES.find((m) => m.id === id);
    await p.setEnabled(byId('navbar-omnisearch'), false);
    assert.equal(document.listeners.size, 0);
    await p.setEnabled(byId('check-all-tasks'), false);
    assert.deepEqual(commandIds(p), []);
    await p.setEnabled(byId('check-all-tasks'), true);
    assert.equal(commandIds(p).length, 2);
});

test('loading and syncing never write settings', async () => {
    setPlatform(false);
    global.document = fakeDocument();
    const stored = { modules: { 'navbar-omnisearch': false } };
    const p = await start(stored);
    p.data = { modules: { 'navbar-omnisearch': true } };
    await p.onExternalSettingsChange();
    assert.equal(p.saves, 0);
});

test('a desktop toggle keeps the mobile-only switch value', async () => {
    setPlatform(false);
    global.document = fakeDocument();
    const p = await start({ modules: { 'navbar-omnisearch': false } });
    const check = MODULES.find((m) => m.id === 'check-all-tasks');
    await p.setEnabled(check, false);
    assert.deepEqual(p.data.modules, {
        'navbar-omnisearch': false, 'check-all-tasks': false,
    });
});

test('a module that throws leaves the others loaded', async () => {
    setPlatform(true);
    global.document = fakeDocument();
    const nav = MODULES.find((m) => m.id === 'navbar-omnisearch');
    const original = nav.load;
    nav.load = () => { throw new Error('boom'); };
    const error = console.error;
    console.error = () => {};
    try {
        const p = await start(null);
        assert.deepEqual([...p.loaded.keys()], ['check-all-tasks']);
        assert.equal(p.failed.get('navbar-omnisearch'), 'boom');
        assert.equal(p._children.length, 1);
    } finally {
        nav.load = original;
        console.error = error;
    }
});
