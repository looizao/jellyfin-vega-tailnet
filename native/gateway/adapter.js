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
    const target = event.target;
    const editing = target && (/^(INPUT|TEXTAREA)$/.test(target.tagName) || target.isContentEditable);
    // Legacy remote codes can overlap letter R on a real keyboard. Only use
    // that fallback for an unidentified remote key outside a text field.
    const legacyMenu = event.keyCode === 82 && !editing && (!event.key || event.key === 'Unidentified');
    if (event.key === 'ContextMenu' || event.key === 'Menu' || event.key === 'F2' || event.keyCode === 93 || legacyMenu) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('jellyvega.settings');
      }
    }
  }, true);
})();
