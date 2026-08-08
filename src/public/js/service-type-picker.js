// Progressively enhances a <select> + hidden fieldset into a "pick from
// dropdown, add as removable chip" widget. Picking an option adds it and
// hides it from the dropdown (so it can't be added twice); each chip carries
// its own hidden `service_types` input so the server sees the same field
// shape it always has.
document.querySelectorAll('[data-service-type-picker]').forEach((picker) => {
  const select = picker.querySelector('select');
  const chipsEl = picker.querySelector('.service-type-chips');

  let selected;
  try {
    selected = JSON.parse(picker.dataset.selected || '[]');
  } catch (e) {
    selected = [];
  }

  function syncOptions() {
    Array.from(select.options).forEach((opt) => {
      if (!opt.value) return;
      opt.hidden = selected.includes(opt.value);
    });
  }

  function renderChips() {
    chipsEl.innerHTML = '';
    selected.forEach((name) => {
      const chip = document.createElement('span');
      chip.className = 'service-type-chip';
      chip.textContent = name;

      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'service_types';
      hidden.value = name;
      chip.appendChild(hidden);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'service-type-chip-remove';
      remove.setAttribute('aria-label', `Remove ${name}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        selected = selected.filter((n) => n !== name);
        renderChips();
        syncOptions();
      });
      chip.appendChild(remove);

      chipsEl.appendChild(chip);
    });
  }

  select.addEventListener('change', () => {
    const name = select.value;
    if (name && !selected.includes(name)) {
      selected.push(name);
      renderChips();
      syncOptions();
    }
    select.value = '';
  });

  renderChips();
  syncOptions();
});
