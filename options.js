const DEFAULTS = {
  stylePrompt: "Translate into conversational Hinglish. Keep technical terms in English. Be concise and natural.",
  mix: 70,
  glossary: "API, class, state, overloading",
  ttsProvider: "None",
  ttsVoiceHint: ""
};

// Schema version for future migrations
const SCHEMA_VERSION = 2;

function parseGlossary(str) {
  return (str || "")
    .split(/[\n,]/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function showProviderFields(provider) {
  // Hide all provider-specific fields
  document.getElementById('elevenLabsFields').style.display = 'none';
  document.getElementById('azureFields').style.display = 'none';
  document.getElementById('googleFields').style.display = 'none';
  document.getElementById('openaiFields').style.display = 'none';
  
  // Show provider fields container if not "None"
  const providerFields = document.getElementById('providerFields');
  if (provider === 'None') {
    providerFields.style.display = 'none';
    return;
  }
  
  providerFields.style.display = 'block';
  
  // Show specific fields based on provider
  switch (provider) {
    case 'ElevenLabs':
      document.getElementById('elevenLabsFields').style.display = 'block';
      break;
    case 'Azure':
      document.getElementById('azureFields').style.display = 'block';
      break;
    case 'Google':
      document.getElementById('googleFields').style.display = 'block';
      break;
    case 'OpenAI':
      document.getElementById('openaiFields').style.display = 'block';
      break;
  }
  
  validateProviderFields(provider);
}

function validateProviderFields(provider) {
  const warning = document.getElementById('validationWarning');
  const missingFields = [];
  
  switch (provider) {
    case 'ElevenLabs':
      if (!document.getElementById('elevenApiKey').value) {
        missingFields.push('ElevenLabs API Key');
      }
      break;
    case 'Azure':
      if (!document.getElementById('azureKey').value) {
        missingFields.push('Azure API Key');
      }
      if (!document.getElementById('azureRegion').value) {
        missingFields.push('Azure Region');
      }
      break;
    case 'Google':
      if (!document.getElementById('googleKeyOrSA').value) {
        missingFields.push('Google Cloud API Key or Service Account JSON');
      }
      break;
    case 'OpenAI':
      if (!document.getElementById('openaiKey').value) {
        missingFields.push('OpenAI API Key');
      }
      break;
  }
  
  if (missingFields.length > 0) {
    warning.textContent = `Missing required fields: ${missingFields.join(', ')}`;
    warning.style.display = 'block';
  } else {
    warning.style.display = 'none';
  }
}

function maskSecretField(field, hasValue) {
  if (hasValue) {
    field.value = '';
    field.placeholder = '•••• set ••••';
  } else {
    field.placeholder = field.getAttribute('data-original-placeholder') || '';
  }
}

async function load() {
  // Load both sync and local storage
  const [syncResult, localResult] = await Promise.all([
    chrome.storage.sync.get("dfSettings"),
    chrome.storage.local.get("dfSecrets")
  ]);
  
  const cfg = syncResult.dfSettings || {};
  const secrets = localResult.dfSecrets || {};
  
  // Handle schema migration
  if (!cfg.version || cfg.version < SCHEMA_VERSION) {
    console.log('DubFusion: Migrating settings from version', cfg.version || 'v1', 'to v' + SCHEMA_VERSION);
    cfg.version = SCHEMA_VERSION;
    cfg.ttsProvider = cfg.ttsProvider || DEFAULTS.ttsProvider;
    cfg.ttsVoiceHint = cfg.ttsVoiceHint || DEFAULTS.ttsVoiceHint;
  }
  
  // Populate non-sensitive fields
  document.getElementById('stylePrompt').value = cfg.stylePrompt || DEFAULTS.stylePrompt;
  document.getElementById('mix').value = typeof cfg.mix === 'number' ? cfg.mix : DEFAULTS.mix;
  document.getElementById('glossary').value = Array.isArray(cfg.glossary)
    ? cfg.glossary.join(", ")
    : (cfg.glossary || DEFAULTS.glossary);
  document.getElementById('ttsProvider').value = cfg.ttsProvider || DEFAULTS.ttsProvider;
  document.getElementById('ttsVoiceHint').value = cfg.ttsVoiceHint || DEFAULTS.ttsVoiceHint;
  
  // Populate and mask secret fields
  const elevenApiKey = document.getElementById('elevenApiKey');
  const azureKey = document.getElementById('azureKey');
  const azureRegion = document.getElementById('azureRegion');
  const googleKeyOrSA = document.getElementById('googleKeyOrSA');
  const openaiKey = document.getElementById('openaiKey');
  
  // Store original placeholders
  elevenApiKey.setAttribute('data-original-placeholder', 'Enter your ElevenLabs API key');
  azureKey.setAttribute('data-original-placeholder', 'Enter your Azure Speech API key');
  azureRegion.setAttribute('data-original-placeholder', 'e.g., eastus, westus2');
  googleKeyOrSA.setAttribute('data-original-placeholder', 'Paste your API key or service account JSON here');
  openaiKey.setAttribute('data-original-placeholder', 'Enter your OpenAI API key');
  
  // Mask fields that have values
  maskSecretField(elevenApiKey, !!secrets.elevenApiKey);
  maskSecretField(azureKey, !!secrets.azureKey);
  azureRegion.value = secrets.azureRegion || '';
  maskSecretField(googleKeyOrSA, !!secrets.googleKeyOrSA);
  maskSecretField(openaiKey, !!secrets.openaiKey);
  
  // Show appropriate provider fields
  showProviderFields(cfg.ttsProvider || DEFAULTS.ttsProvider);
}

async function save() {
  const stylePrompt = document.getElementById('stylePrompt').value.trim();
  const mixRaw = Number(document.getElementById('mix').value);
  const mix = isFinite(mixRaw) ? Math.max(0, Math.min(100, Math.round(mixRaw))) : 70;
  const glossary = parseGlossary(document.getElementById('glossary').value);
  const ttsProvider = document.getElementById('ttsProvider').value;
  const ttsVoiceHint = document.getElementById('ttsVoiceHint').value.trim();
  
  // Get current secrets to preserve unchanged ones
  const { dfSecrets: currentSecrets = {} } = await chrome.storage.local.get("dfSecrets");
  
  // Collect new secret values (only if fields are visible and have values)
  const newSecrets = { ...currentSecrets };
  
  if (ttsProvider === 'ElevenLabs') {
    const elevenApiKey = document.getElementById('elevenApiKey').value;
    if (elevenApiKey) newSecrets.elevenApiKey = elevenApiKey;
  }
  
  if (ttsProvider === 'Azure') {
    const azureKey = document.getElementById('azureKey').value;
    const azureRegion = document.getElementById('azureRegion').value;
    if (azureKey) newSecrets.azureKey = azureKey;
    if (azureRegion) newSecrets.azureRegion = azureRegion;
  }
  
  if (ttsProvider === 'Google') {
    const googleKeyOrSA = document.getElementById('googleKeyOrSA').value;
    if (googleKeyOrSA) newSecrets.googleKeyOrSA = googleKeyOrSA;
  }
  
  if (ttsProvider === 'OpenAI') {
    const openaiKey = document.getElementById('openaiKey').value;
    if (openaiKey) newSecrets.openaiKey = openaiKey;
  }
  
  // Save to both storages
  await Promise.all([
    chrome.storage.sync.set({ 
      dfSettings: { 
        stylePrompt, 
        mix, 
        glossary, 
        ttsProvider, 
        ttsVoiceHint,
        version: SCHEMA_VERSION
      } 
    }),
    chrome.storage.local.set({ dfSecrets: newSecrets })
  ]);
  
  status("Saved!", true);
}

async function resetDefaults() {
  // Reset only non-sensitive fields
  await chrome.storage.sync.set({ 
    dfSettings: { 
      ...DEFAULTS,
      version: SCHEMA_VERSION
    } 
  });
  await load();
  status("Defaults restored", true);
}

async function clearSecrets() {
  await chrome.storage.local.set({ dfSecrets: {} });
  await load();
  status("Secrets cleared", true);
}

function status(msg, ok) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = ok ? "ok" : "err";
  setTimeout(() => { el.textContent = ""; el.className = ""; }, 1500);
}

// Event listeners
document.getElementById('save').addEventListener('click', save);
document.getElementById('reset').addEventListener('click', resetDefaults);
document.getElementById('clearSecrets').addEventListener('click', clearSecrets);

// Provider change handler
document.getElementById('ttsProvider').addEventListener('change', (e) => {
  showProviderFields(e.target.value);
});

// Validation on field changes
document.getElementById('elevenApiKey').addEventListener('input', () => {
  if (document.getElementById('ttsProvider').value === 'ElevenLabs') {
    validateProviderFields('ElevenLabs');
  }
});

document.getElementById('azureKey').addEventListener('input', () => {
  if (document.getElementById('ttsProvider').value === 'Azure') {
    validateProviderFields('Azure');
  }
});

document.getElementById('azureRegion').addEventListener('input', () => {
  if (document.getElementById('ttsProvider').value === 'Azure') {
    validateProviderFields('Azure');
  }
});

document.getElementById('googleKeyOrSA').addEventListener('input', () => {
  if (document.getElementById('ttsProvider').value === 'Google') {
    validateProviderFields('Google');
  }
});

document.getElementById('openaiKey').addEventListener('input', () => {
  if (document.getElementById('ttsProvider').value === 'OpenAI') {
    validateProviderFields('OpenAI');
  }
});

// Initialize
load();
