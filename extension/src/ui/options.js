const KEY = 'dfHelloText';
async function load() {
  const { [KEY]: txt } = await chrome.storage.sync.get(KEY);
  document.getElementById('hello').value = txt || 'Hello DubFusion!';
}
async function save() {
  const val = document.getElementById('hello').value.trim();
  await chrome.storage.sync.set({ [KEY]: val });
  const s = document.getElementById('status');
  s.textContent = 'Saved!';
  setTimeout(() => (s.textContent = ''), 1200);
}
document.getElementById('save').addEventListener('click', save);
load();
