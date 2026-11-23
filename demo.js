(() => {
  const duration = 18;
  const startingTime = 1.65;
  const hold = 2.15;
  const screen = document.querySelector('.demo-screen');
  const scene = screen.querySelector('.demo-scene');
  const layer = screen.querySelector('.comment-layer');
  const progress = screen.querySelector('.progress');
  const timecode = document.querySelector('#demo-time');
  const playButton = screen.querySelector('.play-button');
  const modes = [...document.querySelectorAll('[data-demo-mode]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const samples = [
    { at: 1.05, x: 22, y: 29, text: '여기서부터 분위기 바뀐다' },
    { at: 1.55, x: 74, y: 54, text: '파도 소리 진짜 좋다' },
    { at: 2.05, x: 44, y: 78, text: '이 장면 다시 보는 중' },
    { at: 4.35, x: 27, y: 39, text: '여기 색감 좋다' },
    { at: 5.10, x: 64, y: 22, text: '저 끝까지 걸어가 보고 싶다' },
    { at: 7.85, x: 24, y: 29, text: '딱 이 순간' },
    { at: 8.20, x: 72, y: 45, text: '물안개 들어오는 거 봐' },
    { at: 8.55, x: 38, y: 75, text: '여기서 잠깐 멈췄다' },
    { at: 9.05, x: 66, y: 21, text: '배경화면으로 하고 싶어' },
    { at: 11.50, x: 29, y: 46, text: '구름 움직임 좋다' },
    { at: 12.25, x: 75, y: 29, text: '노을까지 보고 싶다' },
    { at: 15.15, x: 28, y: 30, text: '마지막 장면 좋다' },
    { at: 15.65, x: 70, y: 59, text: '한 번 더 보고 갈게요' },
  ];

  let time = startingTime;
  let playing = !motion.matches;
  let inView = false;
  let scrubbing = false;
  let frame = null;
  let previousFrame;
  let displayedSecond = -1;
  const visible = new Map();
  layer.replaceChildren();

  function drawDensity() {
    const width = 720;
    const baseline = 29;
    const scores = Array.from({ length: 91 }, (_, index) => {
      const second = index / 90 * duration;
      return samples.reduce((sum, { at }) => sum + Math.exp(-0.5 * ((second - at) / 0.48) ** 2), 0);
    });
    const peak = Math.max(...scores);
    const points = scores.map((score, index) => [index / 90 * width, baseline - score / peak * 25]);
    const path = points.map(([x, y], index) => (index === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2)).join(' ');
    screen.querySelector('.density-line').setAttribute('d', path);
    screen.querySelector('.density-area').setAttribute('d', path + ' L720 30 L0 30 Z');
  }

  function renderComments() {
    for (const sample of samples) {
      const age = time - sample.at;
      let node = visible.get(sample);
      if (age < 0 || age >= hold) {
        node?.remove();
        visible.delete(sample);
        continue;
      }

      if (!node) {
        node = document.createElement('span');
        node.className = 'sample-comment';
        node.style.setProperty('--x', sample.x + '%');
        node.style.setProperty('--y', sample.y + '%');
        node.textContent = sample.text;
        layer.append(node);
        visible.set(sample, node);
      }
      const phase = motion.matches ? 1 : Math.min(1, age / 0.11, (hold - age) / 0.16);
      node.style.opacity = phase ** 2 * (3 - 2 * phase);
    }
  }

  function render() {
    const second = Math.floor(time);
    if (second !== displayedSecond) {
      displayedSecond = second;
      const label = '0:' + String(second).padStart(2, '0');
      timecode.textContent = label;
      progress.setAttribute('aria-valuetext', label + ' / 0:18');
    }

    progress.value = time;
    progress.style.setProperty('--progress', (time / duration * 100).toFixed(2) + '%');
    if (!motion.matches) {
      const drift = Math.sin(time / duration * Math.PI);
      scene.style.setProperty('--scene-transform', `scale(${1.025 + drift * 0.065}) translateX(${drift * -0.9}%)`);
    }
    renderComments();
  }

  function updateClock() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    previousFrame = undefined;
    screen.dataset.playing = String(playing);
    playButton.setAttribute('aria-label', playing ? '미리보기 일시정지' : '미리보기 재생');
    if (playing && inView && !scrubbing && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    const elapsed = previousFrame === undefined ? 0 : Math.min((now - previousFrame) / 1000, 0.1);
    previousFrame = now;
    time = (time + elapsed) % duration;
    render();
    frame = requestAnimationFrame(tick);
  }

  function stopSeeking() {
    if (!scrubbing) return;
    scrubbing = false;
    updateClock();
  }

  for (const button of modes) {
    button.addEventListener('click', () => {
      const mode = button.dataset.demoMode;
      if (screen.dataset.mode === mode) return;
      screen.dataset.mode = mode;
      for (const option of modes) option.setAttribute('aria-pressed', String(option === button));
      if (!motion.matches) {
        for (const animation of layer.getAnimations()) animation.cancel();
        layer.animate([{ opacity: 0.42 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      }
    });
  }

  playButton.addEventListener('click', () => {
    playing = !playing;
    updateClock();
  });

  progress.addEventListener('pointerdown', () => {
    scrubbing = true;
    updateClock();
  });
  window.addEventListener('pointerup', stopSeeking);
  window.addEventListener('pointercancel', stopSeeking);
  progress.addEventListener('input', () => {
    time = progress.valueAsNumber;
    render();
  });

  document.addEventListener('visibilitychange', updateClock);
  motion.addEventListener('change', () => {
    playing = !motion.matches;
    render();
    updateClock();
  });

  const screenObserver = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updateClock();
  }, { threshold: 0.12 });
  screenObserver.observe(screen);

  const reveals = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealing');
      reveals.unobserve(entry.target);
    }
  }, { threshold: 0.3 });
  for (const section of document.querySelectorAll('[data-reveal]')) reveals.observe(section);

  drawDensity();
  render();
  updateClock();
})();
