# EnAIgh

A small Firefox and Chrome extension that hides videos carrying YouTube's own "Made with AI" disclosure. It does not infer whether a video was made with AI or send data to an extension-operated backend. For uncached visible videos whose result cards omit the disclosure, it requests the public YouTube watch page without cookies.

It is available on Firefox's addon site ( https://addons.mozilla.org/en-US/firefox/addon/enaigh/ ). Feel free to upload it to Chrome's extensions site. I don't have a developer account with Google.

## Install for testing

- Chrome: open `chrome://extensions`, enable Developer mode, and choose **Load unpacked** with this folder. Chrome uses the root `manifest.json`.
- Firefox: open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `extension/manifest.json`. It is named `manifest.json` and uses `background.scripts`; do not select the root Chrome manifest.
- The toolbar badge shows `ON` or `OFF`; click the extension button to toggle the master filter.
- Open the extension's options to control sidebar recommendations, search results, and Shorts independently.

## Detection

YouTube's search `videoRenderer` data does not always include its AI badge. For visible supported cards without a DOM disclosure marker, the extension fetches that video's public watch page without cookies and checks the structured `howThisWasMadeSectionViewModel` disclosure (`bodyHeader: "Made with AI"`). Results are cached locally for seven days, with at most three checks running concurrently. Direct DOM checks also recognize the accessible AI label and official disclosure link (`youtube/answer/15447836`); titles and thumbnails are never used as heuristics.

Supported surfaces are watch-page sidebar recommendations, search results, Shorts cards, and the Shorts feed. YouTube frequently changes its component markup, so selectors and disclosure markers may need maintenance. Disclosure wording is localized by YouTube; the language-independent help link is recognized alongside the exact English accessible label and disclosure text.

Only videos explicitly labeled by YouTube as "Made with AI" are filtered. Undisclosed AI-generated videos are not detected. Other surfaces such as the home feed and channel pages are not generally filtered, except for Shorts cards and Shorts feed items.

## Settings and permissions

Settings are stored in `storage.sync` with a local-storage fallback. The extension requests only the storage permission and access to YouTube pages.

## Disclosure
This extension is also made with AI. I tested it for some time on my own machine, but I don't claim to understand the whole code.
I understand most people have reservations about using slopcoded applications. Still, feel free to analyze, use, debug, revise, or otherwise comment on the code. The code is yours, hoping it will save you from some irritating videos.
