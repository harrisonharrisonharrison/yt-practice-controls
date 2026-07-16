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
      <button id="rr-set-a">Set A (-)</button>
      <button id="rr-set-b">Set B (-)</button>
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
  
  const bpmInput = document.querySelector('#rr-bpm');
  const delayInput = document.querySelector('#rr-delay');
  const countInToggle = document.querySelector('#rr-countin-toggle');

  let loopStart = null;
  let loopEnd = null;
  let isDelaying = false; 
  let clicksEnabled = true;

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
      countInToggle.innerText = '🔊 Clicks On';
      countInToggle.style.backgroundColor = '#3ea6ff';
    } else {
      countInToggle.innerText = '🔇 Clicks Off';
      countInToggle.style.backgroundColor = '#555555';
    }
  });

  btnA.addEventListener('click', () => {
    loopStart = video.currentTime;
    btnA.innerText = `Set A (${loopStart.toFixed(1)}s)`;
    if (audioCtx.state === 'suspended') audioCtx.resume(); 
  });

  btnB.addEventListener('click', () => {
    loopEnd = video.currentTime;
    btnB.innerText = `Set B (${loopEnd.toFixed(1)}s)`;
  });

  btnClear.addEventListener('click', () => {
    loopStart = null;
    loopEnd = null;
    isDelaying = false;
    btnA.innerText = 'Set A (-)';
    btnB.innerText = 'Set B (-)';
  });

  speedSlider.addEventListener('input', (e) => {
    video.playbackRate = parseFloat(e.target.value);
    speedDisplay.innerText = `${video.playbackRate.toFixed(2)}x`;
  });

  video.addEventListener('timeupdate', () => {
    if (loopStart !== null && loopEnd !== null && loopEnd > loopStart) {
      
      if (video.currentTime >= loopEnd && !isDelaying) {
        isDelaying = true;
        video.pause(); 
        video.currentTime = loopStart; 
        
        const bpm = parseInt(bpmInput.value);
        const beatsToWait = parseInt(delayInput.value);
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
      }
      
      if (video.currentTime < loopStart && !isDelaying) {
        video.currentTime = loopStart;
      }
    }
  });
}

waitForElements();