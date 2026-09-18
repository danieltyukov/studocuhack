// Test helper: run the content scripts against a jsdom document.
//
// The scripts are evaluated in the window's global scope exactly as the
// browser would, in manifest order. Nothing here touches the network: fetch is
// stubbed to fail unless a test provides its own, and images never load, so
// tests assert WHICH branch ran (a note was added, a fetch was attempted, an
// image injection started) rather than what the CDN returned.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.resolve(here, '..', '..', 'src');
export const MANIFEST = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));

export const CONTENT_SCRIPTS = MANIFEST.content_scripts[0].js;

const sources = new Map();
export function scriptSource(relPath) {
    if (!sources.has(relPath)) {
        sources.set(relPath, fs.readFileSync(path.join(SRC, relPath), 'utf8'));
    }
    return sources.get(relPath);
}

/**
 * Build a jsdom window for `html` with the browser extension APIs stubbed.
 *
 * @param {string} html
 * @param {object} [opts]
 * @param {object} [opts.storage]   values chrome.storage.sync.get returns
 * @param {Function} [opts.fetch]   replacement for window.fetch
 * @param {string} [opts.url]       document URL
 */
export function createWindow(html, opts = {}) {
    const logs = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('log', (...args) => logs.push(args.join(' ')));
    virtualConsole.on('error', (...args) => logs.push('ERROR ' + args.join(' ')));
    virtualConsole.on('jsdomError', (err) => logs.push('JSDOM ' + err.message));

    const dom = new JSDOM(html, {
        url: opts.url || 'https://www.studocu.com/en-us/document/test/1234',
        runScripts: 'outside-only',
        pretendToBeVisual: true,
        virtualConsole,
    });
    const { window } = dom;

    const stored = Object.assign({}, opts.storage || {});
    const writes = [];
    window.chrome = {
        storage: {
            sync: {
                get(defaults, cb) {
                    cb(Object.assign({}, defaults, stored));
                },
                set(patch, cb) {
                    writes.push(patch);
                    Object.assign(stored, patch);
                    if (cb) cb();
                },
            },
        },
        runtime: {
            getManifest() { return { version: MANIFEST.version }; },
        },
    };

    window.fetch = opts.fetch || (() => Promise.reject(new Error('network disabled in tests')));
    window.Element.prototype.scrollIntoView = function () {};
    window.HTMLElement.prototype.scrollIntoView = function () {};
    // jsdom has no layout; record scrollTo calls instead of "not implemented".
    const scrollCalls = [];
    window.scrollTo = (x, y) => { scrollCalls.push([x, y]); };
    window.print = () => { logs.push('print()'); };

    return { dom, window, document: window.document, logs, storageWrites: writes, scrollCalls };
}

/** Evaluate the given content scripts (relative to src/) in the window. */
export function loadScripts(window, relPaths = CONTENT_SCRIPTS) {
    for (const rel of relPaths) {
        window.eval(scriptSource(rel));
    }
    return window.StudocuHack;
}

/** Load every content script except main.js, so nothing runs on its own. */
export function loadModules(window) {
    return loadScripts(window, CONTENT_SCRIPTS.filter((p) => !p.endsWith('/main.js')));
}

export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
