# Hide the "Watch & Play" box (EnAIgh 1.2.0)

## Goal
Add an optional setting that hides only the "Watch & Play" box in the watch-page right column. Do not hide the recommendations list, live chat, playlist panel, or the column itself.

## Findings
- The user-supplied element `<div id="header-container" class="style-scope ytd-horizontal-card-list-renderer">` is only the box's header. Its parent `ytd-horizontal-card-list-renderer` is the whole box (header + cards).
- `ytd-horizontal-card-list-renderer` is a generic YouTube component and may be reused for other card lists, so the tag alone is not specific enough.
- The box was not present in the logged-out page data I could fetch, so the markup is user-reported and not independently verified.

## Decisions
- New setting `hideWatchAndPlay`, default `false`.
- Independent of the master AI-filter switch. The toolbar icon still reflects only the AI-filter state.
- Matching: on watch pages (`ytd-watch-flexy`), find each `ytd-horizontal-card-list-renderer` inside `#secondary`; hide it only if its `#header-container` text matches `/watch\s*(&|and)\s*play/i`.
- Use a separate class `eai-wp-hidden`, not `eai-hidden`, because `scan()` strips `eai-hidden` when the master switch is off.
- Known limitation: the header text is localized, so the match works for English YouTube only. State this in the README. Do not hide every card list as a fallback, since that could hide unrelated boxes.

## Tasks
1. `extension/settings.js`: add `hideWatchAndPlay: false` to `defaults`. `onChanged` already iterates `defaults`, so no other change.
2. `extension/content.css`: add `.eai-wp-hidden { display: none !important; }`.
3. `extension/content.js`:
   - Add `hideWatchAndPlay()` that toggles `eai-wp-hidden` on the matching renderers, and removes it from all elements when the setting is off.
   - Call it from `scan()` before the `!settings.enabled` early return, so it runs regardless of the master switch.
   - Existing triggers cover updates: the `MutationObserver`, `yt-navigate-finish`, and the settings `onChanged` handler.
4. `extension/options.html`: add a separate `<section>` below the filter list, titled e.g. "Layout", with a "Hide Watch & Play" checkbox (`id="hideWatchAndPlay"`), small text "Watch-page side box only".
5. `extension/options.js`: include the new checkbox in the save/render logic but exclude it from the "disable when master is off" rule (currently `checkboxes.slice(1)`); keep that rule for the three filter checkboxes only.
6. `README.md`: document the option, its English-only matching, and that it is independent of the master switch.
7. Version: set `1.2.0` in both `manifest.json` and `extension/manifest.json`.
8. Rebuild `Firefox.zip` and `Chrome.zip` as before (Firefox: contents of `extension/` plus `LICENSE`; Chrome: root manifest + `extension/` minus its manifest + `LICENSE`), verify manifests, version and icons, then replace the workspace ZIPs.

## Validation
- Check JSON validity and ZIP contents/versions as in prior builds (no JS runtime is available here).
- Manual, in the browser, on a watch page that shows the box:
  - Option off: the box shows.
  - Option on: only the box disappears; recommendations, chat and playlist remain.
  - Toggle with the master switch off: the box still hides.
  - Navigate to another video: behavior persists.
- If the box is not hidden, send the full outer HTML of its `ytd-horizontal-card-list-renderer` so the match can be adjusted.

## Out of scope
- Hiding the whole right column or the recommendations list.
- Localized header text beyond English.
