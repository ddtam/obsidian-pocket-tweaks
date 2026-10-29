/* Pocket Tweaks.
 *
 * Small conveniences bundled as modules, each with its own switch in
 * the plugin's settings. A module declares the platform it applies
 * to: 'mobile', 'desktop' or 'both'. A module for the other platform
 * is never loaded, and its switch is hidden from the settings tab.
 * Its stored value is left as it is, because settings sync between
 * devices and the other device may run it.
 *
 * Each enabled module loads into its own Component, a child of the
 * plugin, inside its own try/catch. Turning a switch off unloads that
 * Component, which removes the module's DOM events and commands
 * without a restart, and a module that throws while loading leaves
 * the others running.
 */
const {
    Component, MarkdownView, Notice, Platform, Plugin, PluginSettingTab,
    Setting,
} = require('obsidian');

/* Tasks. */

// A list item whose checkbox is the first thing after the marker:
// `- [ ]`, `* [x]`, `+ [X]`, `1. [ ]`, `1) [ ]`, optionally inside a
// blockquote. The checkbox must be followed by whitespace or the end
// of the line, as Obsidian requires for a task.
const TASK = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)(.)\](?=\s|$)/;
// A fence opens with three or more backticks or tildes. It closes on
// a line of the same character, at least as long, with nothing after.
const FENCE = /^\s*(?:>\s*)*(`{3,}|~{3,})(.*)$/;

// Returns the edits that check (or uncheck) every task in `text`
// outside fenced code: one { line, ch, to } per checkbox to change,
// where `ch` is the column of the status character. Only ' ' becomes
// 'x' and only 'x' or 'X' becomes ' '; other statuses are left alone.
function taskEdits(text, check) {
    const edits = [];
    let fence = null;
    text.split('\n').forEach((line, i) => {
        const f = FENCE.exec(line);
        if (fence) {
            if (f && f[1][0] === fence[0] && f[1].length >= fence.length
                && f[2].trim() === '') fence = null;
            return;
        }
        if (f && !(f[1][0] === '`' && f[2].includes('`'))) {
            fence = f[1];
            return;
        }
        const m = TASK.exec(line);
        if (!m) return;
        const from = m[2];
        if (check && from === ' ') {
            edits.push({ line: i, ch: m[1].length, to: 'x' });
        } else if (!check && (from === 'x' || from === 'X')) {
            edits.push({ line: i, ch: m[1].length, to: ' ' });
        }
    });
    return edits;
}

function applyEdits(text, edits) {
    const lines = text.split('\n');
    for (const e of edits) {
        const l = lines[e.line];
        lines[e.line] = l.slice(0, e.ch) + e.to + l.slice(e.ch + 1);
    }
    return lines.join('\n');
}

async function setAllTasks(app, check) {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    const file = view ? view.file : app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') return;
    let count = 0;
    if (view && view.getMode() === 'source') {
        // One transaction, so a single undo reverts every checkbox.
        const editor = view.editor;
        const edits = taskEdits(editor.getValue(), check);
        count = edits.length;
        if (count) {
            editor.transaction({
                changes: edits.map((e) => ({
                    from: { line: e.line, ch: e.ch },
                    to: { line: e.line, ch: e.ch + 1 },
                    text: e.to,
                })),
            });
        }
    } else {
        await app.vault.process(file, (text) => {
            const edits = taskEdits(text, check);
            count = edits.length;
            return applyEdits(text, edits);
        });
    }
    const verb = check ? 'Checked' : 'Unchecked';
    new Notice(`${verb} ${count} task${count === 1 ? '' : 's'}`);
}

/* Modules. */

const NAVBAR_BUTTON = '.mobile-navbar-action-quick-switcher';
const OMNISEARCH = 'omnisearch:show-modal';

const MODULES = [
    {
        // Ported from Navbar Omnisearch 0.1.1. Obsidian 1.15.0 builds
        // the navbar's search button as a div with this class and a
        // click listener that opens the Quick Switcher. A capture-phase
        // listener on the document runs first and stops the event. The
        // class is not public API: if it is renamed, or Omnisearch's
        // command is missing, the tap is left alone and the Quick
        // Switcher opens as before.
        id: 'navbar-omnisearch',
        name: 'Navbar search opens Omnisearch',
        desc: 'The search button in the bottom navbar opens Omnisearch '
            + 'instead of the Quick Switcher.',
        platform: 'mobile',
        load(plugin, c) {
            c.registerDomEvent(document, 'click', (evt) => {
                const el = evt.target;
                if (!(el instanceof Element) || !el.closest(NAVBAR_BUTTON)) {
                    return;
                }
                if (!plugin.app.commands.findCommand(OMNISEARCH)) return;
                evt.preventDefault();
                evt.stopImmediatePropagation();
                plugin.app.commands.executeCommandById(OMNISEARCH);
            }, { capture: true });
        },
    },
    {
        id: 'check-all-tasks',
        name: 'Check or uncheck all tasks in a note',
        desc: 'Two commands that set every [ ] to [x], or every [x] to '
            + '[ ], in the active note. Other statuses and checkboxes '
            + 'in code blocks are left alone.',
        platform: 'both',
        load(plugin, c) {
            const command = (id, name, check) => plugin.addModuleCommand(c, {
                id, name,
                checkCallback: (checking) => {
                    const file = plugin.app.workspace.getActiveFile();
                    if (!file || file.extension !== 'md') return false;
                    if (!checking) setAllTasks(plugin.app, check);
                    return true;
                },
            });
            command('check-all-tasks', 'Check all tasks in note', true);
            command('uncheck-all-tasks', 'Uncheck all tasks in note', false);
        },
    },
];

function runsHere(mod) {
    if (mod.platform === 'mobile') return Platform.isMobile;
    if (mod.platform === 'desktop') return Platform.isDesktopApp;
    return true;
}

/* Plugin. */

class PocketTweaks extends Plugin {
    async onload() {
        this.loaded = new Map();
        this.failed = new Map();
        await this.loadSettings();
        this.syncModules();
        this.addSettingTab(new PocketTweaksSettings(this.app, this));
    }

    async loadSettings() {
        const data = (await this.loadData()) || {};
        this.settings = { modules: {}, ...data };
        this.settings.modules = { ...this.settings.modules };
    }

    // Unset means on, so a module added in a later release starts
    // enabled without anything being written.
    isEnabled(mod) {
        return this.settings.modules[mod.id] !== false;
    }

    // Brings the loaded modules in line with the settings. Only the
    // in-memory state follows the device; nothing here is saved.
    syncModules() {
        for (const mod of MODULES) {
            const want = runsHere(mod) && this.isEnabled(mod);
            if (want && !this.loaded.has(mod.id)) this.enable(mod);
            if (!want && this.loaded.has(mod.id)) this.disable(mod);
        }
    }

    enable(mod) {
        const c = new Component();
        this.addChild(c);
        try {
            mod.load(this, c);
            this.loaded.set(mod.id, c);
            this.failed.delete(mod.id);
        } catch (err) {
            console.error(`Pocket Tweaks: module ${mod.id} failed`, err);
            this.removeChild(c);
            this.failed.set(mod.id, String((err && err.message) || err));
        }
    }

    disable(mod) {
        const c = this.loaded.get(mod.id);
        this.loaded.delete(mod.id);
        if (c) this.removeChild(c);
    }

    // Plugin.addCommand lasts until the plugin unloads, so the command
    // is also removed when the module's Component unloads. The full id
    // is built here rather than read back, because addCommand rewrites
    // the id of the object it is given.
    addModuleCommand(c, command) {
        const full = `${this.manifest.id}:${command.id}`;
        const added = this.addCommand(command);
        c.register(() => this.app.commands.removeCommand(full));
        return added;
    }

    async setEnabled(mod, on) {
        this.settings.modules[mod.id] = on;
        await this.saveData(this.settings);
        this.syncModules();
    }

    // Called by Obsidian when data.json changes on disk, as when
    // LiveSync brings another device's switches across.
    async onExternalSettingsChange() {
        await this.loadSettings();
        this.syncModules();
    }
}

class PocketTweaksSettings extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        let hidden = 0;
        for (const mod of MODULES) {
            if (!runsHere(mod)) {
                hidden += 1;
                continue;
            }
            const failed = this.plugin.failed.get(mod.id);
            const desc = failed
                ? `${mod.desc} Failed to load: ${failed}`
                : mod.desc;
            new Setting(containerEl)
                .setName(mod.name)
                .setDesc(desc)
                .addToggle((t) => t
                    .setValue(this.plugin.isEnabled(mod))
                    .onChange(async (on) => {
                        await this.plugin.setEnabled(mod, on);
                        this.display();
                    }));
        }
        if (hidden) {
            const other = Platform.isMobile ? 'desktop' : 'mobile';
            containerEl.createEl('p', {
                cls: 'setting-item-description',
                text: `${hidden} ${other}-only module`
                    + `${hidden === 1 ? ' is' : 's are'} hidden here. `
                    + 'Their switches are kept for that platform.',
            });
        }
    }
}

module.exports = PocketTweaks;
module.exports.taskEdits = taskEdits;
module.exports.applyEdits = applyEdits;
module.exports.MODULES = MODULES;
