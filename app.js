(() => {
  const canvas = document.getElementById("oscilloscope");
  const ctx = canvas.getContext("2d", { alpha: false });

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const SAMPLE_POINTS = 360;
  const points = new Array(SAMPLE_POINTS).fill(0);
  const targets = new Array(SAMPLE_POINTS).fill(0);
  const smoothed = new Array(SAMPLE_POINTS).fill(0);

  let width = 0;
  let height = 0;
  let dpr = window.devicePixelRatio || 1;

  const resizeCanvas = () => {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;

    for (let i = 0; i < SAMPLE_POINTS; i += 1) {
      points[i] = 0;
      targets[i] = 0;
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
    const amplitude = height * 0.22;

    for (let i = 0; i < SAMPLE_POINTS; i += 1) {
      if (Math.random() < 0.06) {
        targets[i] = (Math.random() - 0.5) * amplitude;
      }

      points[i] += (targets[i] - points[i]) * 0.18;
    }

    smoothed[0] = points[0];
    for (let i = 1; i < SAMPLE_POINTS - 1; i += 1) {
      smoothed[i] =
        (points[i - 1] + points[i] * 2.6 + points[i + 1]) / 4.6;
    }
    smoothed[SAMPLE_POINTS - 1] = points[SAMPLE_POINTS - 1];
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

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  requestAnimationFrame(draw);
})();
