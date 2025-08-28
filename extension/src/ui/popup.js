document.getElementById('beep').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'DF_HELLO_BEEP' });
  } catch (e) {
    console.warn('[DubFusion] popup beep error', e);
  }
});
document.getElementById('options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
