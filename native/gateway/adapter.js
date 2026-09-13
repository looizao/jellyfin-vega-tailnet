// Runs before Jellyfin's scripts. Only preferences and browser state live here;
// Tailscale credentials and node identity stay in the native engine.
(() => {
  const server = __SERVER_URL__;
  if (localStorage.getItem('jellyvega.server') !== server) {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('jellyvega.server', server);
  }
  localStorage.setItem('layout', 'tv');
  document.addEventListener('keydown', event => {
    if (event.keyCode === 82 || event.key === 'ContextMenu') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('jellyvega.settings');
      }
    }
  }, true);
})();
