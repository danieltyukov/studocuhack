// The project site in site/ is published as it is, with no build step, so the
// only thing standing between a typo and a broken page is this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(site, 'style.css'), 'utf8');

// The declarations of one `selector { ... }` block, trimmed and sorted, so two
// blocks compare equal regardless of order or indentation.
function declarations(source, selector) {
    const open = source.indexOf(selector + ' {');
    assert.notEqual(open, -1, 'no block for ' + selector);
    const close = source.indexOf('}', open);
    return source
        .slice(open + selector.length + 2, close)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('/*'))
        .sort();
}

test('every local file the page references exists', () => {
    const refs = [];
    for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) refs.push(m[1]);
    for (const m of css.matchAll(/url\('([^']+)'\)/g)) refs.push(m[1]);
    const local = refs.filter((ref) => !/^(https?:|mailto:|#)/.test(ref));
    assert.ok(local.length >= 5, 'expected local references, found ' + local.length);
    for (const ref of local) {
        const file = path.join(site, ref.replace(/[?#].*$/, ''));
        assert.ok(fs.existsSync(file), ref + ' is referenced but missing');
    }
});

test('the system-dark and explicit-dark token blocks are identical', () => {
    const system = declarations(css, ":root:not([data-theme='light'])");
    const explicit = declarations(css, ":root[data-theme='dark']");
    assert.ok(system.length > 5, 'dark block looks empty');
    assert.deepEqual(system, explicit);
});

test('every token the dark blocks set is declared on bare :root', () => {
    // A token whose only home is a media query is undefined for everyone
    // whose system preference does not match.
    const light = declarations(css, '\n:root');
    const declared = new Set(light.map((line) => line.split(':')[0]));
    for (const line of declarations(css, ":root[data-theme='dark']")) {
        const token = line.split(':')[0];
        if (token.startsWith('--')) assert.ok(declared.has(token), token + ' is dark-only');
    }
});

test('no colour literal outside the token blocks', () => {
    const afterTokens = css.slice(css.indexOf(":root[data-theme='dark'] {"));
    const body = afterTokens.slice(afterTokens.indexOf('}')).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(body, /#[0-9a-f]{3,8}\b/i, 'hex colour outside the token blocks');
    assert.doesNotMatch(body, /\brgba?\(/, 'rgb colour outside the token blocks');
});

test('the theme key is the same in the head script and in theme.js', () => {
    const js = fs.readFileSync(path.join(site, 'theme.js'), 'utf8');
    const inHead = html.match(/localStorage\.getItem\('([^']+)'\)/);
    const inScript = js.match(/localStorage\.setItem\('([^']+)'/);
    assert.ok(inHead && inScript, 'both files must name the storage key');
    assert.equal(inHead[1], inScript[1]);
});
