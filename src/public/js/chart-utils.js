(function (global) {
  function measureMaxLabelWidth(ctx, font, labels) {
    ctx.font = font;
    return labels.reduce((max, label) => Math.max(max, ctx.measureText(label).width), 0);
  }

  global.ChartUtils = { measureMaxLabelWidth };
})(window);
