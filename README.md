# Pocket Tweaks

An Obsidian plugin that bundles small conveniences as modules. Each module has its own switch in the plugin's settings and declares the platform it applies to. Until 0.1.1 this repo was Omnisearch in Navbar (`navbar-omnisearch`), which is now the first module.

## Modules

| Module | Platform | What it does |
|---|---|---|
| Navbar search opens Omnisearch | mobile | The search button in the phone's bottom navbar opens [Omnisearch](https://github.com/scambier/obsidian-omnisearch) instead of the core Quick Switcher |
| Check or uncheck all tasks in a note | both | Commands "Check all tasks in note" and "Uncheck all tasks in note" |

How the modules are loaded:
- A module for the other platform is never loaded, and its switch is hidden from the settings tab. Its stored value is kept, since settings may sync to a device that runs it.
- Each module loads inside its own error guard, so one that fails leaves the others running. Its settings entry then says it failed to load.
- Turning a switch off unloads the module, its commands and its event listeners, without a restart.

## Navbar search opens Omnisearch

Obsidian builds the navbar search button as a div with the class `mobile-navbar-action-quick-switcher`, which opens the Quick Switcher from a click listener on that div. The module listens for clicks on the document in the capture phase, which runs before the button's own listener. When a click lands on that button, it stops the event and runs Omnisearch's `omnisearch:show-modal` command.

The tap is left alone, and the Quick Switcher opens as before, when:
- Omnisearch is disabled, or its command has been renamed;
- an Obsidian update has renamed the button's class. The class is not public API.

So if the button opens the Quick Switcher again, check those two things first. The class name was read from Obsidian 1.15.0's `app.js`.

## Check or uncheck all tasks in a note

"Check all tasks in note" turns every `[ ]` in the active note into `[x]`; "Uncheck all tasks in note" turns every `[x]` or `[X]` into `[ ]`. Any other status character, such as `[-]` or `[/]`, is left alone, as are checkboxes inside fenced code blocks. A task is a list item (`-`, `*`, `+`, `1.` or `1)`, at any depth, optionally in a blockquote) whose checkbox follows the marker.

In the editor the change is one transaction, so a single undo reverts it. In reading view the file is rewritten through `app.vault.process`.

## Install

Via [BRAT](https://github.com/TfTHacker/obsidian42-brat): add `ddtam/obsidian-pocket-tweaks` as a beta plugin. Releases carry `main.js` and `manifest.json`. A device that had Omnisearch in Navbar should uninstall it first: both would intercept the same tap.

## Development

`npm test` runs the unit tests with node's own test runner, against a stub of the `obsidian` module. There is no build step: `main.js` is plain JavaScript at the repo root.

`npm run brat:release -- <version> [--notes "..."]` bumps `manifest.json` and `versions.json`, commits, pushes, and cuts a GitHub release with the artifacts attached.
