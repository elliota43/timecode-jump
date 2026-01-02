chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-timecode") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: "TIMEJUMP_TOGGLE" });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.windows.create({
      url: chrome.runtime.getURL("welcome.html"),
      type: "popup",
      width: 520,
      height: 700,
    });
  }
});
