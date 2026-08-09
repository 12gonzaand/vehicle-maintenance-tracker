// Keeps the fake filename readout next to a visually-hidden <input
// type="file"> in sync with what's actually selected. See the .file-field
// CSS comment for why the native control is hidden in the first place.
document.querySelectorAll('.file-field').forEach((field) => {
  const input = field.querySelector('input[type="file"]');
  const nameEl = field.querySelector('.file-field-name');
  if (!input || !nameEl) return;

  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    if (files.length === 0) nameEl.textContent = 'No file chosen';
    else if (files.length === 1) nameEl.textContent = files[0].name;
    else nameEl.textContent = `${files.length} files selected`;
  });
});
