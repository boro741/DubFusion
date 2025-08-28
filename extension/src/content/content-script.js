// Inject a small UI on YouTube pages — "Hello World" proof

(function init() {
  const TRY_MS = 30;
  let tries = 0;

  function getPlayerAnchor() {
    return (
      document.querySelector('#above-the-fold ytd-watch-metadata') ||
      document.querySelector('#info-contents') ||
      document.querySelector('#title')
    );
  }

  function injectUI() {
    if (document.getElementById('dubfusion-hello')) return;

    const host = getPlayerAnchor();
    if (!host) {
      if (tries++ < 400) setTimeout(injectUI, TRY_MS);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'dubfusion-hello';

    const btn = document.createElement('button');
    btn.textContent = 'DubFusion (Hello)';

    const status = document.createElement('span');
    status.className = 'status';
    status.textContent = 'ready';

    btn.addEventListener('click', async () => {
      status.textContent = 'ping…';
      try {
        await chrome.runtime.sendMessage({ type: 'DF_HELLO_BEEP' });
        status.textContent = 'beep ✓';
      } catch (e) {
        console.warn('[DubFusion] hello error', e);
        status.textContent = 'error';
      }
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(status);
    host.parentElement?.insertBefore(wrapper, host.nextSibling);
  }

  injectUI();
})();
