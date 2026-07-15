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

  let loopStart = null;
  let loopEnd = null;

  btnA.addEventListener('click', () => {
    loopStart = video.currentTime;
    btnA.innerText = `Set A (${loopStart.toFixed(1)}s)`;
  });

  btnB.addEventListener('click', () => {
    loopEnd = video.currentTime;
    btnB.innerText = `Set B (${loopEnd.toFixed(1)}s)`;
  });

  btnClear.addEventListener('click', () => {
    loopStart = null;
    loopEnd = null;
    btnA.innerText = 'Set A (-)';
    btnB.innerText = 'Set B (-)';
  });

  speedSlider.addEventListener('input', (e) => {
    const newSpeed = parseFloat(e.target.value);
    video.playbackRate = newSpeed;
    speedDisplay.innerText = `${newSpeed.toFixed(2)}x`;
  });
}

waitForElements();