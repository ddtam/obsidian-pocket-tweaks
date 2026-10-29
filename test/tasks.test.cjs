// Check-all logic: which checkboxes change, and which are left alone.
const test = require('node:test');
const assert = require('node:assert/strict');
require('./stub-obsidian.cjs');
const { taskEdits, applyEdits } = require('../main.js');

const run = (text, check) => applyEdits(text, taskEdits(text, check));

test('checks every open task, nested and with each marker', () => {
    const input = [
        '- [ ] dash',
        '* [ ] star',
        '+ [ ] plus',
        '1. [ ] ordered',
        '2) [ ] ordered paren',
        '    - [ ] nested four spaces',
        '\t- [ ] nested tab',
        '> - [ ] in a blockquote',
        '- [ ]',
    ].join('\n');
    const want = input.replace(/\[ \]/g, '[x]');
    assert.equal(run(input, true), want);
});

test('unchecks x and X, and leaves custom statuses alone', () => {
    const input = [
        '- [x] done',
        '- [X] done upper',
        '- [-] cancelled',
        '- [/] in progress',
        '- [>] waiting',
        '- [ ] open',
    ].join('\n');
    const want = [
        '- [ ] done',
        '- [ ] done upper',
        '- [-] cancelled',
        '- [/] in progress',
        '- [>] waiting',
        '- [ ] open',
    ].join('\n');
    assert.equal(run(input, false), want);
});

test('checking leaves custom statuses and done tasks alone', () => {
    const input = '- [-] a\n- [/] b\n- [X] c\n- [ ] d';
    assert.equal(run(input, true), '- [-] a\n- [/] b\n- [X] c\n- [x] d');
});

test('leaves checkboxes inside fenced code alone', () => {
    const input = [
        '- [ ] before',
        '```markdown',
        '- [ ] inside backticks',
        '```',
        '~~~~',
        '- [ ] inside tildes',
        '```',
        '- [ ] still inside: a backtick line does not close tildes',
        '~~~~',
        '    ```',
        '    - [ ] inside an indented fence',
        '    ```',
        '- [ ] after',
    ].join('\n');
    const out = run(input, true).split('\n');
    assert.equal(out[0], '- [x] before');
    assert.equal(out[2], '- [ ] inside backticks');
    assert.equal(out[5], '- [ ] inside tildes');
    assert.equal(out[7], '- [ ] still inside: a backtick line does not '
        + 'close tildes');
    assert.equal(out[10], '    - [ ] inside an indented fence');
    assert.equal(out[12], '- [x] after');
});

test('a shorter fence or one with text after it does not close', () => {
    const input = '````\n```\n- [ ] in\n``` js\n````\n- [ ] out';
    const out = run(input, true).split('\n');
    assert.equal(out[2], '- [ ] in');
    assert.equal(out[5], '- [x] out');
});

test('an unclosed fence protects the rest of the note', () => {
    const input = '```\n- [ ] a\n- [ ] b';
    assert.equal(run(input, true), input);
});

test('inline code with backticks is not a fence', () => {
    const input = '```inline``` text\n- [ ] a';
    assert.equal(run(input, true), '```inline``` text\n- [x] a');
});

test('ignores things that are not tasks', () => {
    const input = [
        '[ ] no marker',
        '- [ ]no space after',
        '-[ ] no space before',
        '- text [ ] later in the line',
        '- [  ] two spaces',
    ].join('\n');
    assert.equal(run(input, true), input);
});

test('edits name the status character column', () => {
    const edits = taskEdits('text\n  1. [ ] a\n- [x] b', true);
    assert.deepEqual(edits, [{ line: 1, ch: 6, to: 'x' }]);
});
