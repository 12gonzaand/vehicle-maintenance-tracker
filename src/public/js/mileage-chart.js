(function () {
  const canvas = document.getElementById('mileage-chart');
  if (!canvas) return;

  const points = JSON.parse(canvas.dataset.points || '[]');
  if (points.length < 2) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.parentElement.clientWidth;
  const height = 160;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const topPadding = 20;
  const bottomPadding = 20;
  const dates = points.map(p => new Date(p.date).getTime());
  const miles = points.map(p => p.mileage);
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const minMiles = Math.min(...miles);
  const maxMiles = Math.max(...miles);

  const minLabel = minMiles.toLocaleString() + ' mi';
  const maxLabel = maxMiles.toLocaleString() + ' mi';

  const FONT = '11px "IBM Plex Mono", monospace';
  const maxLabelWidth = ChartUtils.measureMaxLabelWidth(ctx, FONT, [minLabel, maxLabel]);
  const leftPadding = Math.min(maxLabelWidth + 14, width * 0.4);
  const rightPadding = 10;

  const xScale = (t) => leftPadding + ((t - minDate) / ((maxDate - minDate) || 1)) * (width - leftPadding - rightPadding);
  const yScale = (m) => height - bottomPadding - ((m - minMiles) / ((maxMiles - minMiles) || 1)) * (height - topPadding - bottomPadding);

  const styles = getComputedStyle(document.documentElement);
  const lineColor = styles.getPropertyValue('--orange').trim() || '#ff6a1a';
  const textColor = styles.getPropertyValue('--ink-muted').trim() || '#8d9297';

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xScale(new Date(p.date).getTime());
    const y = yScale(p.mileage);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = lineColor;
  points.forEach((p) => {
    const x = xScale(new Date(p.date).getTime());
    const y = yScale(p.mileage);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = textColor;
  ctx.fillText(minLabel, 2, height - bottomPadding + 4);
  ctx.fillText(maxLabel, 2, topPadding - 4);
})();
