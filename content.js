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
      <input type="range" id="rr-speed" min="0.25" max="1.5" step="0.05" value="1.0">
      <span id="rr-speed-display">1.00x</span>
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

  const btnAMinus = document.querySelector('#rr-a-minus');
  const btnAPlus = document.querySelector('#rr-a-plus');
  const btnBMinus = document.querySelector('#rr-b-minus');
  const btnBPlus = document.querySelector('#rr-b-plus');
  
  const bpmInput = document.querySelector('#rr-bpm');
  const delayInput = document.querySelector('#rr-delay');
  const countInToggle = document.querySelector('#rr-countin-toggle');

  let loopStart = null;
  let loopEnd = null;
  let isDelaying = false; 
  let clicksEnabled = true;
  
  let currentSpeed = parseFloat(speedSlider.value);
  let baseBpm = parseInt(bpmInput.value) / currentSpeed; 

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

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
  });
  
  speedSlider.addEventListener('input', (e) => {
    currentSpeed = parseFloat(e.target.value);
    video.playbackRate = currentSpeed;
    speedDisplay.innerText = `${currentSpeed.toFixed(2)}x`;
    
    bpmInput.value = Math.round(baseBpm * currentSpeed);
  });

  bpmInput.addEventListener('change', (e) => {
    const newBpm = parseInt(e.target.value);
    if (!isNaN(newBpm)) {
      baseBpm = newBpm / currentSpeed;
    }
  });

  btnA.addEventListener('click', () => {
    loopStart = video.currentTime;
    btnA.innerText = `Set A (${loopStart.toFixed(2)}s)`;
    if (audioCtx.state === 'suspended') audioCtx.resume(); 
  });

  btnB.addEventListener('click', () => {
    loopEnd = video.currentTime;
    btnB.innerText = `Set B (${loopEnd.toFixed(2)}s)`;
  });

  btnAMinus.addEventListener('click', () => {
    if (loopStart !== null) {
      loopStart = Math.max(0, loopStart - 0.01);
      btnA.innerText = `Set A (${loopStart.toFixed(2)}s)`;
      video.currentTime = loopStart; 
    }
  });

  btnAPlus.addEventListener('click', () => {
    if (loopStart !== null) {
      loopStart += 0.01;
      if (loopEnd !== null && loopStart >= loopEnd) loopStart = loopEnd - 0.01;
      btnA.innerText = `Set A (${loopStart.toFixed(2)}s)`;
      video.currentTime = loopStart;
    }
  });

  btnBMinus.addEventListener('click', () => {
    if (loopEnd !== null) {
      loopEnd -= 0.01;
      if (loopStart !== null && loopEnd <= loopStart) loopEnd = loopStart + 0.01;
      btnB.innerText = `Set B (${loopEnd.toFixed(2)}s)`;
      video.currentTime = loopEnd;
    }
  });

  btnBPlus.addEventListener('click', () => {
    if (loopEnd !== null) {
      loopEnd += 0.01;
      btnB.innerText = `Set B (${loopEnd.toFixed(2)}s)`;
      video.currentTime = loopEnd;
    }
  });

  btnClear.addEventListener('click', () => {
    loopStart = null;
    loopEnd = null;
    isDelaying = false;
    btnA.innerText = 'Set A (-)';
    btnB.innerText = 'Set B (-)';
  });

  video.addEventListener('timeupdate', () => {
    if (loopStart !== null && loopEnd !== null && loopEnd > loopStart) {
      
      if (video.currentTime >= loopEnd && !isDelaying) {
        isDelaying = true;
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