(() => {
  const canvas = document.getElementById("oscilloscope");
  const ctx = canvas.getContext("2d", { alpha: false });

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const SAMPLE_POINTS = 360;

  const createLayer = (amplitudeRatio, changeProbability, response) => ({
    amplitudeRatio,
    changeProbability,
    response,
    values: new Array(SAMPLE_POINTS).fill(0),
    targets: new Array(SAMPLE_POINTS).fill(0),
  });

  const layers = [
    createLayer(0.05, 0.06, 0.45),
    createLayer(0.1, 0.03, 0.28),
    createLayer(0.3, 0.015, 0.12),
  ];

  const composite = new Array(SAMPLE_POINTS).fill(0);
  const smoothed = new Array(SAMPLE_POINTS).fill(0);

  let width = 0;
  let height = 0;
  let dpr = window.devicePixelRatio || 1;

  // Mouse tracking state
  let mouseX = 0;
  let mouseY = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let mouseVelocity = 0;
  let pathLength = 0;
  let lastMoveTime = Date.now();
  const PAUSE_THRESHOLD = 100; // ms without movement counts as pause
  const MAX_VELOCITY = 50; // pixels per frame for normalization
  const MAX_PATH_LENGTH = 2000; // pixels for normalization

  // Touch tracking state
  let touchStartTime = 0;
  let touchDuration = 0;
  let touchDistance = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;
  let isTouching = false;
  const MAX_TOUCH_DURATION = 3000; // ms for normalization
  const MAX_TOUCH_DISTANCE = 500; // pixels for normalization

  // Decay state
  let lastInputTime = Date.now();
  let targetAmplitudeMultiplier = 1.0;
  let targetFrequencyMultiplier = 1.0;
  const DECAY_DURATION = 3000; // ms to decay to baseline
  const BASELINE_AMPLITUDE = 1.0;
  const BASELINE_FREQUENCY = 1.0;

  const resizeCanvas = () => {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;

    for (const layer of layers) {
      for (let i = 0; i < SAMPLE_POINTS; i += 1) {
        layer.values[i] = 0;
        layer.targets[i] = 0;
      }
    }

    for (let i = 0; i < SAMPLE_POINTS; i += 1) {
      composite[i] = 0;
      smoothed[i] = 0;
    }

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#071912";
    ctx.fillRect(0, 0, width, height);
  };

  const updateSignal = () => {
    const now = Date.now();
    const timeSinceMove = now - lastMoveTime;

    // Reset path length after pause
    if (timeSinceMove > PAUSE_THRESHOLD) {
      pathLength = 0;
    }

    // Calculate target multipliers based on current input
    if (isTouching) {
      // Mobile: amplitude from touch distance, frequency from duration
      targetAmplitudeMultiplier = 0.3 + (Math.min(touchDistance, MAX_TOUCH_DISTANCE) / MAX_TOUCH_DISTANCE) * 2.5;
      targetFrequencyMultiplier = 0.1 + (Math.min(touchDuration, MAX_TOUCH_DURATION) / MAX_TOUCH_DURATION) * 3.0;
      lastInputTime = now;
    } else if (mouseVelocity > 0.1) {
      // Desktop: amplitude from path length, frequency from velocity
      targetAmplitudeMultiplier = 0.3 + (Math.min(pathLength, MAX_PATH_LENGTH) / MAX_PATH_LENGTH) * 2.5;
      const normalizedVelocity = Math.min(mouseVelocity, MAX_VELOCITY) / MAX_VELOCITY;
      targetFrequencyMultiplier = 0.1 + normalizedVelocity * 3.0;
      lastInputTime = now;

      // Decay mouse velocity
      mouseVelocity *= 0.85;
    }

    // Calculate decay factor based on time since last input
    const timeSinceInput = now - lastInputTime;
    let decayFactor = 1.0;

    if (timeSinceInput > 0) {
      // Smooth decay over DECAY_DURATION (3 seconds)
      decayFactor = Math.max(0, 1 - (timeSinceInput / DECAY_DURATION));
    }

    // Interpolate current multipliers toward baseline based on decay factor
    const amplitudeMultiplier = BASELINE_AMPLITUDE + (targetAmplitudeMultiplier - BASELINE_AMPLITUDE) * decayFactor;
    const frequencyMultiplier = BASELINE_FREQUENCY + (targetFrequencyMultiplier - BASELINE_FREQUENCY) * decayFactor;

    for (const layer of layers) {
      const layerAmplitude = height * layer.amplitudeRatio * amplitudeMultiplier;

      // 90% based on mouse/touch input, 10% random
      const baseFrequency = layer.changeProbability * frequencyMultiplier * 0.9;
      const randomComponent = layer.changeProbability * 0.1;
      const effectiveFrequency = baseFrequency + randomComponent;

      for (let i = 0; i < SAMPLE_POINTS; i += 1) {
        if (Math.random() < effectiveFrequency) {
          layer.targets[i] = (Math.random() - 0.5) * layerAmplitude;
        }

        layer.values[i] += (layer.targets[i] - layer.values[i]) * layer.response;
      }
    }

    for (let i = 0; i < SAMPLE_POINTS; i += 1) {
      let sum = 0;
      for (const layer of layers) {
        sum += layer.values[i];
      }
      composite[i] = sum;
    }

    smoothed[0] = composite[0];
    for (let i = 1; i < SAMPLE_POINTS - 1; i += 1) {
      smoothed[i] =
        (composite[i - 1] + composite[i] * 2.6 + composite[i + 1]) / 4.6;
    }
    smoothed[SAMPLE_POINTS - 1] = composite[SAMPLE_POINTS - 1];
  };

  const addScreenNoise = () => {
    const speckles = Math.max(40, Math.floor((width * height) / 8000));

    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(140, 210, 160, 0.015)";
    for (let i = 0; i < speckles; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.fillStyle = "rgba(12, 24, 16, 0.035)";
    for (let i = 0; i < speckles * 0.6; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.globalCompositeOperation = "source-over";
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "rgba(7, 24, 18, 0.38)";
    ctx.fillRect(0, 0, width, height);

    updateSignal();

    const baseline = height * 0.52;
    const stride = width / (SAMPLE_POINTS - 1);

    ctx.beginPath();
    ctx.moveTo(0, baseline + smoothed[0]);
    for (let i = 1; i < SAMPLE_POINTS; i += 1) {
      const x = i * stride;
      const y = baseline + smoothed[i];
      ctx.lineTo(x, y);
    }

    const lineWidth = Math.max(2.6, height * 0.0026);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = "rgba(118, 255, 168, 0.55)";
    ctx.shadowColor = "rgba(70, 230, 135, 0.5)";
    ctx.shadowBlur = 45;
    ctx.globalCompositeOperation = "lighter";
    ctx.stroke();

    ctx.lineWidth = lineWidth * 0.55;
    ctx.strokeStyle = "rgba(200, 255, 220, 0.36)";
    ctx.shadowColor = "rgba(120, 255, 190, 0.5)";
    ctx.shadowBlur = 18;
    ctx.stroke();

    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    addScreenNoise();

    requestAnimationFrame(draw);
  };

  // Mouse event handlers
  const handleMouseMove = (e) => {
    const currentTime = Date.now();
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Calculate velocity
    const dx = mouseX - lastMouseX;
    const dy = mouseY - lastMouseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    mouseVelocity = distance;

    // Update path length
    pathLength += distance;

    lastMouseX = mouseX;
    lastMouseY = mouseY;
    lastMoveTime = currentTime;
  };

  // Touch event handlers
  const handleTouchStart = (e) => {
    e.preventDefault();
    isTouching = true;
    touchStartTime = Date.now();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    lastTouchX = touchStartX;
    lastTouchY = touchStartY;
    touchDistance = 0;
    touchDuration = 0;
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (!isTouching) return;

    const touch = e.touches[0];
    const currentX = touch.clientX;
    const currentY = touch.clientY;

    // Calculate distance moved in this touch
    const dx = currentX - lastTouchX;
    const dy = currentY - lastTouchY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    touchDistance += distance;
    touchDuration = Date.now() - touchStartTime;

    lastTouchX = currentX;
    lastTouchY = currentY;
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    isTouching = false;
    // Keep the last values to allow decay
  };

  // Add event listeners
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("touchstart", handleTouchStart, { passive: false });
  window.addEventListener("touchmove", handleTouchMove, { passive: false });
  window.addEventListener("touchend", handleTouchEnd);
  window.addEventListener("touchcancel", handleTouchEnd);
  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  requestAnimationFrame(draw);
})();
