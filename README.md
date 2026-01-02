# Timecode Jump

A Chrome extension that lets you jump to a specific timestamp in the current page's video by typing a timecode.

## Use

1. Open a page with a video (YouTube, Vimeo, etc.).
2. Press the extension shortcut to open the timecode input.
   - macOS (default): `⌘ + ⌃ + J`
   - Windows/Linux (default): `Ctrl + Shift + J`
3. Type a timecode and press **Enter** to jump.
4. Press **Esc** to close.

To change the default shortcut:
`chrome://extensions/shortcuts`

## Timecode formats

- `1:23` (mm:ss)
- `01:02:03` (hh:mm:ss)
- `90` (seconds)
- `1h2m3s`

## Install (developer)

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select this project folder