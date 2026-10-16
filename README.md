# YouTube AI Label Blocker

A small Firefox and Chrome extension that hides videos carrying YouTube's own "Made with AI" disclosure. It does not infer whether a video was made with AI and does not contact a remote service.

## Install for testing

- Chrome: open `chrome://extensions`, enable Developer mode, and choose **Load unpacked** with this folder.
- Firefox: open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `manifest.firefox.json`.
- The toolbar badge shows `ON` or `OFF`; click the extension button to toggle the master filter.
- Open the extension's options to control sidebar recommendations, search results, and Shorts independently.

## Detection

The supplied sample pages both include YouTube's structured `metadataBadgeRenderer.accessibilityData.label` value `AI: Content was made with AI` and a disclosure section headed `Made with AI`. The content script checks the label's `aria-label`/`title`, YouTube's video-attribute disclosure element, and the accompanying official help link (`youtube/answer/15447836`). Those markers are checked only inside supported video cards; titles, descriptions, and thumbnails are not used as AI heuristics.

Supported surfaces are watch-page sidebar recommendations, search results, Shorts cards, and the Shorts feed. YouTube frequently changes its component markup, so selectors and disclosure markers may need maintenance. Disclosure wording is localized by YouTube; the language-independent help link is recognized alongside the exact English accessible label and disclosure text.

Only videos YouTube labels are filtered. Undisclosed AI-generated videos are not detected. Other surfaces such as the home feed and channel pages are not generally filtered, except for Shorts cards and Shorts feed items.

## Settings and permissions

Settings are stored in `storage.sync` with a local-storage fallback. The extension requests only the storage permission and access to YouTube pages.
