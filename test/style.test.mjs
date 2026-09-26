import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createWindow, SRC } from './helpers/dom.mjs';
import { documentFixture } from './fixtures/documents.mjs';

const STYLE = fs.readFileSync(path.join(SRC, 'content', 'style.css'), 'utf8');

// The anti-bot sign-in wall as Studocu renders it (issue #63): a design-system
// Modal portaled into #main-wrapper, whose <dialog> carries the AuthWall
// module class. `hideable` is only added when the modal has a close handler.
function authWall({ dismissible = false } = {}) {
    const hideable = dismissible ? ' Modal-module-scss-module__kojW7G__hideable' : '';
    return '<div id="main-wrapper">' +
        '<div class="Modal-module-scss-module__kojW7G__overlay Modal-module-scss-module__kojW7G__centered Modal-module-scss-module__kojW7G__fullScreen">' +
        '<dialog open class="Modal-module-scss-module__kojW7G__modal Modal-module-scss-module__kojW7G__medium AuthWall-module-scss-module__q963Ya__modal' + hideable + '">' +
        '<h2>You’re one step away from the full document</h2>' +
        '</dialog></div></div>';
}

// Load style.css into a fixture page. `lock` reproduces the inline styles
// Studocu's body-scroll-lock puts on <html> (desktop) and <body> (Android).
function setup(extraBody, { lock = false } = {}) {
    const { window, document } = createWindow(documentFixture({ shape: 'all-free', pageCount: 1, extraBody }));
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    if (lock) {
        document.documentElement.setAttribute('style', 'overflow: hidden; box-sizing: border-box; padding-right: 8px;');
        document.body.setAttribute('style', 'top: -1200px; width: 100%; height: auto; position: fixed; overflow: clip;');
    }
    return { window, document };
}

// The !important value style.css declares for `prop` on `el`, or '' when no
// rule does. Only !important declarations can beat the scroll lock's inline
// styles, so those are the ones that matter here.
function importantValue(document, el, prop) {
    let value = '';
    const visit = (rules) => {
        for (const rule of rules) {
            if (rule.cssRules && !rule.selectorText) continue; // @media print etc.
            if (!rule.selectorText || !el.matches(rule.selectorText)) continue;
            if (rule.style.getPropertyPriority(prop) === 'important') value = rule.style.getPropertyValue(prop);
        }
    };
    for (const sheet of document.styleSheets) visit(sheet.cssRules);
    return value;
}

const overlayOf = (document) => document.querySelector('dialog').parentElement;

test('the anti-bot sign-in wall overlay is hidden', () => {
    const { document } = setup(authWall());
    assert.equal(importantValue(document, overlayOf(document), 'display'), 'none');
});

test('the scroll lock the wall puts on <html> and <body> is undone', () => {
    const { document } = setup(authWall(), { lock: true });
    const html = document.documentElement;
    assert.equal(importantValue(document, html, 'overflow'), 'visible');
    assert.match(importantValue(document, html, 'padding-right'), /^0(px)?$/);
    assert.equal(importantValue(document, html, 'height'), 'auto');
    assert.equal(importantValue(document, document.body, 'position'), 'static');
    assert.equal(importantValue(document, document.body, 'top'), 'auto');
    assert.equal(importantValue(document, document.body, 'overflow'), 'visible');
});

test('a sign-in modal the reader can close is left alone', () => {
    const { document } = setup(authWall({ dismissible: true }));
    assert.equal(importantValue(document, overlayOf(document), 'display'), '');
    assert.equal(importantValue(document, document.documentElement, 'overflow'), '');
    assert.equal(importantValue(document, document.body, 'position'), '');
});

test('pages without the wall keep their own <html> and <body> styles', () => {
    const { document } = setup('<div id="main-wrapper"></div>');
    assert.equal(importantValue(document, document.documentElement, 'overflow'), '');
    assert.equal(importantValue(document, document.documentElement, 'padding-right'), '');
    assert.equal(importantValue(document, document.body, 'position'), '');
});
