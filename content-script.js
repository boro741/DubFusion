// content-script.js

(function init() {
  console.log('DubFusion: Content script loaded on', window.location.href);
  
  // Wait for the YouTube player container
  const TRY_MS = 50; // Increased delay
  let tries = 0;
  const MAX_TRIES = 600; // Increased max tries

  function getPlayerContainer() {
    // Try multiple selectors for different YouTube layouts
    const selectors = [
      '#above-the-fold ytd-watch-metadata',
      '#info-contents',
      '#title',
      '#meta-contents',
      '#primary-inner',
      '#content',
      'ytd-watch-metadata',
      '#below',
      '#description'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('DubFusion: Found container with selector:', selector);
        return element;
      }
    }
    
    return null;
  }

  function findInjectionPoint() {
    // Try to find a good injection point
    const possibleHosts = [
      document.querySelector('#above-the-fold ytd-watch-metadata'),
      document.querySelector('#info-contents'),
      document.querySelector('#title'),
      document.querySelector('#meta-contents'),
      document.querySelector('#primary-inner'),
      document.querySelector('#content'),
      document.querySelector('ytd-watch-metadata'),
      document.querySelector('#below'),
      document.querySelector('#description')
    ].filter(Boolean);

    if (possibleHosts.length > 0) {
      const host = possibleHosts[0];
      console.log('DubFusion: Using injection host:', host.tagName, host.id || host.className);
      return host;
    }

    // Fallback: try to inject near the video player
    const videoContainer = document.querySelector('#movie_player') || 
                          document.querySelector('#player') ||
                          document.querySelector('video')?.closest('div');
    
    if (videoContainer) {
      console.log('DubFusion: Using video container as fallback');
      return videoContainer;
    }

    return null;
  }

  function injectUI() {
    if (document.getElementById('dubfusion-hello')) {
      console.log('DubFusion: UI already injected, skipping');
      return; // idempotent
    }

    const host = findInjectionPoint();
    if (!host) {
      if (tries++ < MAX_TRIES) {
        if (tries % 50 === 0) { // Log every 50th attempt to avoid spam
          console.log(`DubFusion: Player container not found, attempt ${tries}/${MAX_TRIES}`);
        }
        setTimeout(injectUI, TRY_MS);
      } else {
        console.warn('DubFusion: Failed to find player container after', MAX_TRIES, 'attempts');
        // Try one last time with a more aggressive approach
        injectUIFallback();
      }
      return;
    }

    console.log('DubFusion: Found player container, injecting UI');

    const wrapper = document.createElement('div');
    wrapper.id = 'dubfusion-hello';
    wrapper.style.cssText = `
      margin: 8px 0;
      display: flex;
      gap: 8px;
      align-items: center;
      background: #f8f9fa;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      z-index: 9999;
      position: relative;
    `;

    const btn = document.createElement('button');
    btn.textContent = 'DubFusion (Hello)';
    btn.style.cssText = `
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #ccc;
      cursor: pointer;
      font-size: 14px;
      background: #007bff;
      color: white;
      font-weight: bold;
    `;
    btn.title = 'Play a short overlay beep and toggle ducking';

    const settingsLink = document.createElement('a');
    settingsLink.textContent = '⚙ Settings';
    settingsLink.href = '#';
    settingsLink.style.cssText = `
      font-size: 12px;
      color: #007bff;
      text-decoration: none;
      cursor: pointer;
      align-self: center;
    `;
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });

    const status = document.createElement('span');
    status.textContent = 'ready';
    status.style.cssText = `
      font-size: 12px;
      opacity: 0.7;
      margin-left: 8px;
    `;

    btn.addEventListener('click', async () => {
      console.log('DubFusion: Button clicked, playing beep...');
      status.textContent = 'beep…';
      try {
        await chrome.runtime.sendMessage({ type: 'DF_PLAY_BEEP' });
        console.log('DubFusion: Beep message sent successfully');
        await new Promise(r => setTimeout(r, 100));
        await chrome.runtime.sendMessage({ type: 'DF_TOGGLE_DUCK' });
        console.log('DubFusion: Toggle duck message sent successfully');
        status.textContent = 'played ✓';
      } catch (e) {
        console.warn('DubFusion hello error', e);
        status.textContent = 'error';
      }
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(settingsLink);
    wrapper.appendChild(status);
    
    // Try different insertion methods
    try {
      if (host.parentElement) {
        host.parentElement.insertBefore(wrapper, host.nextSibling);
      } else {
        host.appendChild(wrapper);
      }
      console.log('DubFusion: UI injected successfully');
    } catch (e) {
      console.warn('DubFusion: Failed to inject UI, trying fallback:', e);
      injectUIFallback();
    }
  }

  function injectUIFallback() {
    console.log('DubFusion: Using fallback injection method');
    
    // Create a floating button that's always visible
    const floatingBtn = document.createElement('div');
    floatingBtn.id = 'dubfusion-hello';
    floatingBtn.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 10000;
      background: #007bff;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-size: 14px;
    `;
    floatingBtn.textContent = 'DubFusion (Hello)';
    floatingBtn.title = 'Play a short overlay beep and toggle ducking';

    floatingBtn.addEventListener('click', async () => {
      console.log('DubFusion: Floating button clicked, playing beep...');
      try {
        await chrome.runtime.sendMessage({ type: 'DF_PLAY_BEEP' });
        console.log('DubFusion: Beep message sent successfully');
        await new Promise(r => setTimeout(r, 100));
        await chrome.runtime.sendMessage({ type: 'DF_TOGGLE_DUCK' });
        console.log('DubFusion: Toggle duck message sent successfully');
        
        // Visual feedback
        floatingBtn.style.background = '#28a745';
        floatingBtn.textContent = 'DubFusion ✓';
        setTimeout(() => {
          floatingBtn.style.background = '#007bff';
          floatingBtn.textContent = 'DubFusion (Hello)';
        }, 1000);
      } catch (e) {
        console.warn('DubFusion hello error', e);
        floatingBtn.style.background = '#dc3545';
        floatingBtn.textContent = 'DubFusion Error';
        setTimeout(() => {
          floatingBtn.style.background = '#007bff';
          floatingBtn.textContent = 'DubFusion (Hello)';
        }, 2000);
      }
    });

    // Add settings link for fallback UI
    const settingsLink = document.createElement('a');
    settingsLink.textContent = '⚙ Settings';
    settingsLink.href = '#';
    settingsLink.style.cssText = `
      position: fixed;
      top: 140px;
      right: 20px;
      z-index: 10000;
      font-size: 12px;
      color: #007bff;
      text-decoration: none;
      cursor: pointer;
      background: white;
      padding: 8px 12px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });

    document.body.appendChild(floatingBtn);
    document.body.appendChild(settingsLink);
    console.log('DubFusion: Floating UI injected successfully');
  }

  // Start injection process
  injectUI();

  // Listen for background relay to toggle mute/duck
  chrome.runtime.onMessage.addListener((msg) => {
    console.log('DubFusion: Received message from background:', msg);
    if (msg?.type === 'DF_TOGGLE_DUCK') {
      toggleDuck();
    }
  });

  function toggleDuck() {
    const vid = document.querySelector('video');
    if (!vid) {
      console.warn('DubFusion: No video element found for ducking');
      return;
    }

    // Simple toggle: if not muted, duck to 0.1; else restore to 1.0
    // We store state on the element dataset for simplicity.
    const ducked = vid.dataset.dubfusionDucked === '1';

    if (!ducked) {
      vid.dataset.dubfusionPrevVolume = vid.volume.toString();
      vid.volume = Math.max(0.0, Math.min(vid.volume, 0.1));
      vid.dataset.dubfusionDucked = '1';
      console.log('DubFusion: Audio ducked to', vid.volume);
    } else {
      const prev = parseFloat(vid.dataset.dubfusionPrevVolume || '1');
      vid.volume = Math.max(0.0, Math.min(prev, 1.0));
      vid.dataset.dubfusionDucked = '0';
      console.log('DubFusion: Audio restored to', vid.volume);
    }
  }
})();
