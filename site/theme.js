/*
 * The theme toggle, and nothing else. The head script has already applied a
 * stored choice by the time this runs; this only handles the click and keeps
 * the button's pressed state honest.
 *
 * The visible word is the accessible name and the state is `aria-pressed`,
 * rather than an aria-label that says something the button does not.
 * "System" stays reachable by clearing the stored value, which is what a
 * browser's own site-data control does.
 */
const root = document.documentElement;
const button = document.getElementById('theme');
const media = window.matchMedia('(prefers-color-scheme: dark)');

function isDark() {
    const choice = root.dataset.theme;
    return choice === 'dark' || (choice === undefined && media.matches);
}

function sync() {
    button.setAttribute('aria-pressed', String(isDark()));
}

button.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
        localStorage.setItem('studocuhack-theme', next);
    } catch {
        // Storage refused. The choice still applies to this page view.
    }
    sync();
});

// Only moves the button while the visitor is on system: an explicit choice
// outranks the system flipping underneath it.
media.addEventListener('change', sync);

sync();
