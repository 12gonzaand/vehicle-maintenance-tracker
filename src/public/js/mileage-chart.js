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

  const padding = 30;
  const dates = points.map(p => new Date(p.date).getTime());
  const miles = points.map(p => p.mileage);
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const minMiles = Math.min(...miles);
  const maxMiles = Math.max(...miles);

  const xScale = (t) => padding + ((t - minDate) / ((maxDate - minDate) || 1)) * (width - padding * 2);
  const yScale = (m) => height - padding - ((m - minMiles) / ((maxMiles - minMiles) || 1)) * (height - padding * 2);

  const styles = getComputedStyle(document.documentElement);
  const lineColor = styles.getPropertyValue('--primary').trim() || '#2563eb';
  const textColor = styles.getPropertyValue('--text-muted').trim() || '#6b6b73';

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
  ctx.font = '11px sans-serif';
  ctx.fillText(minMiles.toLocaleString() + ' mi', 2, height - padding);
  ctx.fillText(maxMiles.toLocaleString() + ' mi', 2, padding);
})();
