function formatShortcut(s) {
  if (!s) return "Not set";

  return s
    .replaceAll("Command", "⌘")
    .replaceAll("MacCtrl", "⌃")
    .replaceAll("Ctrl", "⌃")
    .replaceAll("Alt", "⌥")
    .replaceAll("Shift", "⇧")
    .replaceAll("+", " + ");
}

chrome.commands.getAll((commands) => {
  const cmd = commands.find((c) => c.name === "open-timecode");
  const el = document.getElementById("shortcut");
  if (el) el.textContent = formatShortcut(cmd?.shortcut);
});

document.getElementById("changeShortcut")?.addEventListener("click", () => {
  // This is sometimes blocked by Chrome; the page includes a fallback instruction.
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});
