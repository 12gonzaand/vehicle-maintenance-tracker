(function () {
  const canvas = document.getElementById('fuel-efficiency-chart');
  if (!canvas) return;

  const raw = JSON.parse(canvas.dataset.points || '[]');
  const points = raw.filter(p => p.mpg != null);
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

  const padding = 30;

  let sum = 0;
  const avgs = points.map((p, i) => {
    sum += p.mpg;
    return sum / (i + 1);
  });

  const allValues = points.map(p => p.mpg).concat(avgs);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const valRange = (maxVal - minVal) || 1;

  const slot = (width - padding * 2) / points.length;
  const xAt = (i) => padding + slot * (i + 0.5);
  const baseY = height - padding;
  const yScale = (v) => baseY - ((v - minVal) / valRange) * (height - padding * 2);

  const styles = getComputedStyle(document.documentElement);
  const barColor = styles.getPropertyValue('--orange').trim() || '#ff6a1a';
  const avgColor = styles.getPropertyValue('--ok-green').trim() || '#4f9a63';
  const textColor = styles.getPropertyValue('--ink-muted').trim() || '#8d9297';

  const barWidth = Math.min(slot * 0.5, 28);
  ctx.fillStyle = barColor;
  points.forEach((p, i) => {
    const x = xAt(i);
    const y = yScale(p.mpg);
    ctx.fillRect(x - barWidth / 2, y, barWidth, baseY - y);
  });

  ctx.strokeStyle = avgColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  avgs.forEach((v, i) => {
    const x = xAt(i);
    const y = yScale(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = avgColor;
  avgs.forEach((v, i) => {
    const x = xAt(i);
    const y = yScale(v);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.fillStyle = textColor;
  ctx.fillText(minVal.toFixed(1) + ' mpg', 2, baseY);
  ctx.fillText(maxVal.toFixed(1) + ' mpg', 2, padding + 10);

  ctx.fillStyle = barColor;
  ctx.fillRect(width - 150, 6, 10, 10);
  ctx.fillStyle = textColor;
  ctx.fillText('Per fill-up', width - 134, 15);
  ctx.fillStyle = avgColor;
  ctx.fillRect(width - 150, 22, 10, 10);
  ctx.fillStyle = textColor;
  ctx.fillText('Running avg', width - 134, 31);
})();
