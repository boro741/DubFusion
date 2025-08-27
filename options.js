const DEFAULTS = {
  stylePrompt: "Translate into conversational Hinglish. Keep technical terms in English. Be concise and natural.",
  mix: 70,
  glossary: "API, class, state, overloading"
};

function parseGlossary(str) {
  return (str || "")
    .split(/[\n,]/g)
    .map(s => s.trim())
    .filter(Boolean);
}

async function load() {
  const { dfSettings } = await chrome.storage.sync.get("dfSettings");
  const cfg = dfSettings || DEFAULTS;

  document.getElementById('stylePrompt').value = cfg.stylePrompt || DEFAULTS.stylePrompt;
  document.getElementById('mix').value = typeof cfg.mix === 'number' ? cfg.mix : DEFAULTS.mix;
  document.getElementById('glossary').value = Array.isArray(cfg.glossary)
    ? cfg.glossary.join(", ")
    : (cfg.glossary || DEFAULTS.glossary);
}

async function save() {
  const stylePrompt = document.getElementById('stylePrompt').value.trim();
  const mixRaw = Number(document.getElementById('mix').value);
  const mix = isFinite(mixRaw) ? Math.max(0, Math.min(100, Math.round(mixRaw))) : 70;
  const glossary = parseGlossary(document.getElementById('glossary').value);

  await chrome.storage.sync.set({ dfSettings: { stylePrompt, mix, glossary } });
  status("Saved!", true);
}

async function resetDefaults() {
  await chrome.storage.sync.set({ dfSettings: DEFAULTS });
  await load();
  status("Defaults restored", true);
}

function status(msg, ok) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = ok ? "ok" : "err";
  setTimeout(() => { el.textContent = ""; el.className = ""; }, 1500);
}

document.getElementById('save').addEventListener('click', save);
document.getElementById('reset').addEventListener('click', resetDefaults);
load();
