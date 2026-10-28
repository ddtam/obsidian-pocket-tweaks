# Omnisearch in Navbar

An Obsidian plugin that makes the search button in the phone's bottom navbar open [Omnisearch](https://github.com/scambier/obsidian-omnisearch) instead of the core Quick Switcher. With search on that button, the navbar's right button can stay the ribbon menu. The plugin does nothing on desktop.

## How the redirect works

Obsidian builds the navbar search button as a div with the class `mobile-navbar-action-quick-switcher`, which opens the Quick Switcher from a click listener on that div. The plugin listens for clicks on the document in the capture phase, which runs before the button's own listener. When a click lands on that button, it stops the event and runs Omnisearch's `omnisearch:show-modal` command.

The tap is left alone, and the Quick Switcher opens as before, when:
- Omnisearch is disabled, or its command has been renamed;
- an Obsidian update has renamed the button's class. The class is not public API.

So if the button opens the Quick Switcher again, check those two things first. The class name was read from Obsidian 1.15.0's `app.js`.

## Install

Via [BRAT](https://github.com/TfTHacker/obsidian42-brat): add `ddtam/obsidian-navbar-omnisearch` as a beta plugin. Releases carry `main.js` and `manifest.json`.

## Release

`npm run brat:release -- <version> [--notes "..."]` bumps `manifest.json` and `versions.json`, commits, pushes, and cuts a GitHub release with the artifacts attached. There is no build step: `main.js` is plain JavaScript at the repo root.
