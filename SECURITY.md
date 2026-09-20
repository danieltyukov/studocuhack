# Security

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private reporting instead: on the repository page, open the **Security** tab and choose **Report a vulnerability**. You should get a first reply within a week.

## What the extension does with data

- It runs only on `www.studocu.com`, `www.studeersnel.nl`, `www.studocu.vn` and `www.studocu.id`, and requests host access only to `doc-assets.studocu.com` (the CDN that serves document pages).
- It reads the signed asset parameters that Studocu embeds in the page and uses them to fetch page images and text fragments from that CDN. Requests are made without credentials.
- It stores five boolean settings in `chrome.storage.sync`. Nothing else is stored, and nothing is sent anywhere.
- There is no background service worker, no remote code, no analytics.

## Content that comes from the network

The one place external content is inserted into the page is the text-layer fetch in `src/content/pages.js`. A `.page` fragment is parsed in a detached document, active content (`script`, `iframe`, `object`, `embed`, `link`, `style`, `on*` handlers, `javascript:` URLs) is stripped, and the remaining nodes are adopted into the page. If you find a way past that sanitiser, that is a vulnerability; please report it.

Everything else the extension builds (buttons, the overlay, the popup, the labels) is created with DOM methods from constant strings.
