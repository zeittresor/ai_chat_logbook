/* AI Chat Logbook - popup */
(function () {
  const api = typeof browser !== "undefined" ? browser : chrome;
  document.getElementById("options").addEventListener("click", () => {
    if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
  });
  document.getElementById("downloads").addEventListener("click", () => {
    if (api.downloads && api.downloads.showDefaultFolder) api.downloads.showDefaultFolder();
  });
})();
