(function () {
  function setStatus(el, text) {
    if (el) el.textContent = text;
  }

  // Leaves a field untouched if Gemini returned null/empty for it, rather
  // than clobbering whatever the user may have already typed.
  function fillField(form, name, value) {
    if (value === null || value === undefined || value === '') return;
    const el = form.elements.namedItem(name);
    if (!el) return;
    el.value = value;
  }

  // Ticks the checkbox for each returned service type that has one;
  // anything without a matching checkbox (a service Gemini identified that
  // isn't in the known list) goes into the "Other" text field instead.
  function fillServiceTypes(form, names) {
    if (!Array.isArray(names) || names.length === 0) return;
    const matched = new Set();
    form.querySelectorAll('input[name="service_types"]').forEach((cb) => {
      if (names.includes(cb.value)) {
        cb.checked = true;
        matched.add(cb.value);
      }
    });
    const unmatched = names.filter((n) => !matched.has(n));
    if (unmatched.length === 0) return;
    const otherInput = form.elements.namedItem('other_types');
    if (!otherInput) return;
    const existing = otherInput.value.split(',').map((s) => s.trim()).filter(Boolean);
    otherInput.value = Array.from(new Set([...existing, ...unmatched])).join(', ');
  }

  async function scanAndFill({ button, fileInput, statusEl, form, kind, fieldMap, specialFields }) {
    const files = fileInput.files ? Array.from(fileInput.files) : [];
    if (files.length === 0) {
      setStatus(statusEl, 'Pick a receipt photo first.');
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append('receipt', file));
    formData.append('kind', kind);

    button.disabled = true;
    setStatus(statusEl, files.length > 1 ? `Scanning ${files.length} pages…` : 'Scanning…');

    try {
      const res = await fetch(`/vehicles/${button.dataset.vehicleId}/receipt-scan`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.ok) {
        setStatus(statusEl, data.error || "Couldn't read that receipt — enter details manually.");
        return;
      }
      Object.keys(fieldMap).forEach((responseKey) => {
        fillField(form, fieldMap[responseKey], data.fields[responseKey]);
      });
      if (specialFields) {
        Object.keys(specialFields).forEach((responseKey) => {
          specialFields[responseKey](form, data.fields[responseKey]);
        });
      }
      setStatus(statusEl, 'Scanned — please check the fields below.');
    } catch (err) {
      setStatus(statusEl, "Couldn't read that receipt — enter details manually.");
    } finally {
      button.disabled = false;
    }
  }

  function wire(buttonId, fileInputId, statusId, kind, fieldMap, specialFields) {
    const button = document.getElementById(buttonId);
    const fileInput = document.getElementById(fileInputId);
    const statusEl = document.getElementById(statusId);
    if (!button || !fileInput) return;
    const form = button.closest('form');
    button.addEventListener('click', () => scanAndFill({ button, fileInput, statusEl, form, kind, fieldMap, specialFields }));
  }

  // Service record "Add" form — reuses the existing permanent-attachment
  // file input, so scanning never requires picking the file(s) twice.
  // service_types is handled separately (fillServiceTypes) since a record
  // can now cover more than one type.
  wire('service-scan-btn', 'service-receipt-files', 'service-scan-status', 'service', {
    service_date: 'service_date',
    mileage: 'mileage',
    cost: 'cost',
    shop: 'shop'
  }, {
    service_types: fillServiceTypes
  });

  // Fuel log form — its file input has no `name` attribute, so it's
  // excluded from the form's own submission; the photo(s) are only ever
  // used here, never stored.
  wire('fuel-scan-btn', 'fuel-receipt-photo', 'fuel-scan-status', 'fuel', {
    fill_date: 'fill_date',
    mileage: 'mileage',
    gallons: 'gallons',
    cost: 'cost',
    fuel_grade: 'fuel_grade'
  });
})();
