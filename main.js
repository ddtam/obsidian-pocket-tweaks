/* Navbar Omnisearch.
 *
 * The phone's bottom navbar has a search button that opens the core
 * Quick Switcher. This plugin sends that tap to Omnisearch instead,
 * so the navbar's right button can go back to the ribbon menu rather
 * than carrying a second search.
 *
 * Obsidian 1.15.0 builds the button as a div with the class
 * `mobile-navbar-action-quick-switcher` and a click listener on that
 * div. A capture-phase click listener on the document runs before
 * it, and stopping the event there keeps the Quick Switcher closed.
 *
 * The class name is not public API. If an Obsidian update renames
 * it, this listener stops matching and the button opens the Quick
 * Switcher again, which is the failure to watch for. If Omnisearch
 * is disabled or its command is renamed, the tap is left alone for
 * the same reason.
 */
const { Plugin, Platform } = require('obsidian');

const BUTTON = '.mobile-navbar-action-quick-switcher';
const COMMAND = 'omnisearch:show-modal';

module.exports = class NavbarOmnisearch extends Plugin {
    onload() {
        if (!Platform.isMobile) return;
        this.registerDomEvent(document, 'click', (evt) => {
            const el = evt.target;
            if (!(el instanceof Element) || !el.closest(BUTTON)) return;
            if (!this.app.commands.findCommand(COMMAND)) return;
            evt.preventDefault();
            evt.stopImmediatePropagation();
            this.app.commands.executeCommandById(COMMAND);
        }, { capture: true });
    }
};
