// StudocuHack - toolbar popup.
//
// Reads and writes the same settings the content scripts read on load (see
// DEFAULT_SETTINGS in content/common.js). Kept dependency-free on purpose.

(function () {
    'use strict';

    const DEFAULTS = {
        hideAds: true,
        hideAiToolbar: true,
        replaceLogo: true,
        showDownloadButton: true,
        autoLoadPages: true,
    };

    const api = globalThis.chrome;
    const inputs = Array.from(document.querySelectorAll('input[data-setting]'));
    const status = document.getElementById('status');
    const versionEl = document.getElementById('version');

    try {
        versionEl.textContent = 'v' + api.runtime.getManifest().version;
    } catch (e) {
        versionEl.textContent = '';
    }

    function render(settings) {
        inputs.forEach(function (input) {
            const key = input.dataset.setting;
            input.checked = typeof settings[key] === 'boolean' ? settings[key] : DEFAULTS[key];
        });
    }

    function flash(text) {
        status.textContent = text;
        status.classList.add('saved');
        clearTimeout(flash.timer);
        flash.timer = setTimeout(function () {
            status.classList.remove('saved');
            status.textContent = 'Changes apply the next time a document page loads.';
        }, 1600);
    }

    api.storage.sync.get(DEFAULTS, function (stored) {
        render(stored || DEFAULTS);
    });

    inputs.forEach(function (input) {
        input.addEventListener('change', function () {
            const patch = {};
            patch[input.dataset.setting] = input.checked;
            api.storage.sync.set(patch, function () {
                flash('Saved. Reload the document page to apply.');
            });
        });
    });
})();
