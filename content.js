function waitForElements() {
  const video = document.querySelector('video');
  const anchor = document.querySelector('#below'); 

  if (video && anchor) {
    injectUI(video, anchor);
  } else {
    setTimeout(waitForElements, 500); 
  }
}

function injectUI(video, anchor) {
  if (document.querySelector('#riff-repeater-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'riff-repeater-panel';
  
  panel.innerHTML = `
    <div class="rr-header">Video Controls</div>
    <div class="rr-controls">
      <div class="rr-btn-group">
        <button id="rr-a-minus" title="Back 10ms">&lt;</button>
        <button id="rr-set-a">Set A (-)</button>
        <button id="rr-a-plus" title="Forward 10ms">&gt;</button>
      </div>

      <div class="rr-btn-group">
        <button id="rr-b-minus" title="Back 10ms">&lt;</button>
        <button id="rr-set-b">Set B (-)</button>
        <button id="rr-b-plus" title="Forward 10ms">&gt;</button>
      </div>

      <button id="rr-clear">Clear Loop</button>
      
      <div class="rr-divider"></div>

      <label title="Metronome BPM">BPM:</label>
      <input type="number" id="rr-bpm" value="120" min="40" max="300" style="width: 50px;">
      
      <label title="Delay before loop restarts">Count-in (Beats):</label>
      <input type="number" id="rr-delay" value="4" min="0" max="16" style="width: 40px;">
      <button id="rr-countin-toggle">Clicks On</button>
      
      <div class="rr-divider"></div>

      <label for="rr-speed">Speed:</label>
      <input type="range" id="rr-speed" min="0.10" max="1.5" step="0.05" value="1.0">
      <span id="rr-speed-display">1.00x</span>

      <label>Presets:</label>
      <select id="rr-preset-select" style="background: #121212; color: #fff; border: 1px solid #3d3d3d; padding: 6px; border-radius: 4px; max-width: 110px; cursor: pointer;">
        <option value="none">-- Select --</option>
        <option value="save_new">+ Save Current...</option>
      </select>
      <button id="rr-delete-preset" title="Delete selected preset">🗑️</button>

      <div style="margin-left: auto; font-weight: bold; color: #3ea6ff; padding-left: 16px;">
        Reps This Session: <span id="rr-rep-count">0</span>
      </div>
    </div>
  `;

  anchor.prepend(panel);

  attachListeners(video);
}

function attachListeners(video) {
  const btnA = document.querySelector('#rr-set-a');
  const btnB = document.querySelector('#rr-set-b');
  const btnClear = document.querySelector('#rr-clear');
  const speedSlider = document.querySelector('#rr-speed');
  const speedDisplay = document.querySelector('#rr-speed-display');
  const repCountDisplay = document.querySelector('#rr-rep-count');

  const bpmInput = document.querySelector('#rr-bpm');
  const delayInput = document.querySelector('#rr-delay');
  const countInToggle = document.querySelector('#rr-countin-toggle');

  const btnAMinus = document.querySelector('#rr-a-minus');
  const btnAPlus = document.querySelector('#rr-a-plus');
  const btnBMinus = document.querySelector('#rr-b-minus');
  const btnBPlus = document.querySelector('#rr-b-plus');

  let loopStart = null;
  let loopEnd = null;
  let isDelaying = false; 
  let clicksEnabled = true;
  let repsSession = 0;
  
  let currentSpeed = parseFloat(speedSlider.value);
  let baseBpm = parseInt(bpmInput.value) / currentSpeed; 

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  
  function getVideoId() {
    return new URLSearchParams(window.location.search).get('v');
  }

  function savePreset() {
    const videoId = getVideoId();
    if (!videoId) return;
    
    const preset = {
      loopStart,
      loopEnd,
      speed: currentSpeed,
      baseBpm, 
      delayBeats: delayInput.value,
      clicksEnabled
    };
    
    chrome.storage.local.set({ [videoId]: preset });
  }

  function loadPreset() {
    const videoId = getVideoId();
    if (!videoId) return;
    
    chrome.storage.local.get([videoId], (result) => {
      const preset = result[videoId];
      if (preset) {
        loopStart = preset.loopStart;
        loopEnd = preset.loopEnd;
        if (loopStart !== null) btnA.innerText = `Set A (${loopStart.toFixed(2)}s)`;
        if (loopEnd !== null) btnB.innerText = `Set B (${loopEnd.toFixed(2)}s)`;
        
        currentSpeed = preset.speed || 1.0;
        video.playbackRate = currentSpeed;
        speedSlider.value = currentSpeed;
        speedDisplay.innerText = `${currentSpeed.toFixed(2)}x`;
        
        baseBpm = preset.baseBpm || 120;
        bpmInput.value = Math.round(baseBpm * currentSpeed);
        if (preset.delayBeats !== undefined) delayInput.value = preset.delayBeats;
        
        if (preset.clicksEnabled !== undefined) {
          clicksEnabled = preset.clicksEnabled;
          countInToggle.innerText = clicksEnabled ? 'Clicks On' : 'Clicks Off';
          countInToggle.style.backgroundColor = clicksEnabled ? '#3ea6ff' : '#555555';
        }
      }
    });
  }

  loadPreset();

  const presetSelect = document.querySelector('#rr-preset-select');
  const btnDeletePreset = document.querySelector('#rr-delete-preset');
  
  let savedVideoPresets = []; 

  function loadDropdown(indexToSelect = 'none') {
    const videoId = getVideoId();
    if (!videoId) return;

    chrome.storage.local.get([videoId + '_presets'], (result) => {
      savedVideoPresets = result[videoId + '_presets'] || [];
      
      presetSelect.innerHTML = `
        <option value="none">-- Select --</option>
        <option value="save_new">+ Save Current...</option>
      `;
      
      savedVideoPresets.forEach((p, index) => {
        const opt = document.createElement('option');
        opt.value = index; 
        opt.innerText = p.name;
        presetSelect.appendChild(opt);
      });

      presetSelect.value = indexToSelect;
    });
  }

  loadDropdown();

  presetSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    const videoId = getVideoId();

    if (val === 'save_new') {
      const name = prompt("Name this loop preset (e.g., Solo Fast):", `Loop ${savedVideoPresets.length + 1}`);
      
      if (name) {
        const newPreset = {
          name, loopStart, loopEnd, speed: currentSpeed, baseBpm, delayBeats: delayInput.value, clicksEnabled
        };
        
        savedVideoPresets.push(newPreset);
        chrome.storage.local.set({ [videoId + '_presets']: savedVideoPresets }, () => {
          loadDropdown(savedVideoPresets.length - 1); 
        });
      } else {
        presetSelect.value = 'none'; 
      }
      
    } else if (val !== 'none') {
      const preset = savedVideoPresets[parseInt(val)];
      if (preset) {
        loopStart = preset.loopStart;
        loopEnd = preset.loopEnd;
        
        btnA.innerText = loopStart !== null ? `Set A (${loopStart.toFixed(2)}s)` : 'Set A (-)';
        btnB.innerText = loopEnd !== null ? `Set B (${loopEnd.toFixed(2)}s)` : 'Set B (-)';
        
        currentSpeed = preset.speed || 1.0;
        video.playbackRate = currentSpeed;
        speedSlider.value = currentSpeed;
        speedDisplay.innerText = `${currentSpeed.toFixed(2)}x`;
        
        baseBpm = preset.baseBpm || 120;
        bpmInput.value = Math.round(baseBpm * currentSpeed);
        if (preset.delayBeats !== undefined) delayInput.value = preset.delayBeats;
        
        if (preset.clicksEnabled !== undefined) {
          clicksEnabled = preset.clicksEnabled;
          countInToggle.innerText = clicksEnabled ? '🔊 Clicks On' : '🔇 Clicks Off';
          countInToggle.style.backgroundColor = clicksEnabled ? '#3ea6ff' : '#555555';
        }
        
        if (loopStart !== null) video.currentTime = loopStart;
        
        savePreset();
      }
    }
  });

  btnDeletePreset.addEventListener('click', () => {
    const val = presetSelect.value;
    if (val === 'none' || val === 'save_new') {
      alert("Please select a saved preset to delete.");
      return;
    }
    
    const presetName = savedVideoPresets[parseInt(val)].name;
    if (confirm(`Are you sure you want to delete the preset "${presetName}"?`)) {
      savedVideoPresets.splice(parseInt(val), 1); 
      
      const videoId = getVideoId();
      chrome.storage.local.set({ [videoId + '_presets']: savedVideoPresets }, () => {
        loadDropdown();
        presetSelect.value = 'none';
      });
    }
  });

  function playClick(time, isFirstBeat) {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.frequency.value = isFirstBeat ? 1000 : 800;
    
    gainNode.gain.setValueAtTime(1, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    
    osc.start(time);
    osc.stop(time + 0.1);
  }

  countInToggle.addEventListener('click', () => {
    clicksEnabled = !clicksEnabled;
    if (clicksEnabled) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      countInToggle.innerText = 'Clicks On';
      countInToggle.style.backgroundColor = '#3ea6ff';
    } else {
      countInToggle.innerText = 'Clicks Off';
      countInToggle.style.backgroundColor = '#555555';
    }
    savePreset();
  });

  speedSlider.addEventListener('input', (e) => {
    currentSpeed = parseFloat(e.target.value);
    video.playbackRate = currentSpeed;
    speedDisplay.innerText = `${currentSpeed.toFixed(2)}x`;
    bpmInput.value = Math.round(baseBpm * currentSpeed);
  });
  
  speedSlider.addEventListener('change', savePreset);

  bpmInput.addEventListener('change', (e) => {
    const newBpm = parseInt(e.target.value);
    if (!isNaN(newBpm)) {
      baseBpm = newBpm / currentSpeed;
      savePreset();
    }
  });

  delayInput.addEventListener('change', savePreset);

  btnA.addEventListener('click', () => {
    loopStart = video.currentTime;
    btnA.innerText = `Set A (${loopStart.toFixed(2)}s)`;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    savePreset();
  });

  btnB.addEventListener('click', () => {
    loopEnd = video.currentTime;
    btnB.innerText = `Set B (${loopEnd.toFixed(2)}s)`;
    savePreset();
  });

  btnClear.addEventListener('click', () => {
    loopStart = null;
    loopEnd = null;
    isDelaying = false;
    btnA.innerText = 'Set A (-)';
    btnB.innerText = 'Set B (-)';
    
    repsSession = 0;
    repCountDisplay.innerText = repsSession;
    
    const videoId = getVideoId();
    if (videoId) chrome.storage.local.remove(videoId);
  });

  btnAMinus.addEventListener('click', () => {
    if (loopStart !== null) {
      loopStart = Math.max(0, loopStart - 0.01);
      btnA.innerText = `Set A (${loopStart.toFixed(2)}s)`;
      video.currentTime = loopStart;
      savePreset();
    }
  });

  btnAPlus.addEventListener('click', () => {
    if (loopStart !== null) {
      loopStart += 0.01;
      if (loopEnd !== null && loopStart >= loopEnd) loopStart = loopEnd - 0.01;
      btnA.innerText = `Set A (${loopStart.toFixed(2)}s)`;
      video.currentTime = loopStart;
      savePreset();
    }
  });

  btnBMinus.addEventListener('click', () => {
    if (loopEnd !== null) {
      loopEnd -= 0.01;
      if (loopStart !== null && loopEnd <= loopStart) loopEnd = loopStart + 0.01;
      btnB.innerText = `Set B (${loopEnd.toFixed(2)}s)`;
      video.currentTime = loopEnd;
      savePreset();
    }
  });

  btnBPlus.addEventListener('click', () => {
    if (loopEnd !== null) {
      loopEnd += 0.01;
      btnB.innerText = `Set B (${loopEnd.toFixed(2)}s)`;
      video.currentTime = loopEnd;
      savePreset();
    }
  });
  
  function handleVideoChange() {
    loopStart = null;
    loopEnd = null;
    isDelaying = false;
    
    btnA.innerText = 'Set A (-)';
    btnB.innerText = 'Set B (-)';
    
    currentSpeed = 1.0;
    video.playbackRate = currentSpeed;
    speedSlider.value = 1.0;
    speedDisplay.innerText = '1.00x';
    
    baseBpm = 120;
    bpmInput.value = 120;
    delayInput.value = 4;
    
    clicksEnabled = true;
    countInToggle.innerText = 'Clicks On';
    countInToggle.style.backgroundColor = '#3ea6ff';
    
    repsSession = 0;
    if (repCountDisplay) repCountDisplay.innerText = repsSession;
    
    loadPreset();
    loadDropdown();
  }

  window.addEventListener('yt-navigate-finish', () => {
    setTimeout(handleVideoChange, 500); 
  });

  document.addEventListener('keydown', (e) => {
    const activeElement = document.activeElement.tagName.toLowerCase();
    if (activeElement === 'input' || activeElement === 'textarea') return; 

    if (e.key === 'a' || e.key === 'd') {
      let step = e.key === 'd' ? 0.05 : -0.05;
      let newSpeed = currentSpeed + step;
      newSpeed = Math.max(0.10, Math.min(1.5, newSpeed));

      if (newSpeed !== currentSpeed) {
        currentSpeed = newSpeed;
        video.playbackRate = currentSpeed;
        speedSlider.value = currentSpeed.toFixed(2);
        speedDisplay.innerText = `${currentSpeed.toFixed(2)}x`;
        bpmInput.value = Math.round(baseBpm * currentSpeed);
        savePreset();
      }
    }
  });

  video.addEventListener('timeupdate', () => {
    if (loopStart !== null && loopEnd !== null && loopEnd > loopStart) {
      if (video.currentTime >= loopEnd && !isDelaying) {
        isDelaying = true;
        
        repsSession++;
        repCountDisplay.innerText = repsSession;
        
        video.pause(); 
        video.currentTime = loopStart;
        
        const bpm = parseInt(bpmInput.value);
        const beatsToWait = parseInt(delayInput.value);
        
        if (bpm > 0) {
          const secondsPerBeat = 60 / bpm;
          const delayMs = (beatsToWait * secondsPerBeat) * 1000;

          if (clicksEnabled && beatsToWait > 0) {
            const startTime = audioCtx.currentTime;
            for (let i = 0; i < beatsToWait; i++) {
              playClick(startTime + (i * secondsPerBeat), i === 0);
            }
          }

          setTimeout(() => {
            video.play();
            isDelaying = false;
          }, delayMs);
        } else {
          video.play();
          isDelaying = false;
        }
      }
      
      if (video.currentTime < loopStart && !isDelaying) {
        video.currentTime = loopStart;
      }
    }
  });
}

waitForElements();