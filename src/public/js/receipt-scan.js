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

  async function scanAndFill({ button, fileInput, statusEl, form, kind, fieldMap }) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      setStatus(statusEl, 'Pick a receipt photo first.');
      return;
    }

    const formData = new FormData();
    formData.append('receipt', file);
    formData.append('kind', kind);

    button.disabled = true;
    setStatus(statusEl, 'Scanning…');

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
      setStatus(statusEl, 'Scanned — please check the fields below.');
    } catch (err) {
      setStatus(statusEl, "Couldn't read that receipt — enter details manually.");
    } finally {
      button.disabled = false;
    }
  }

  function wire(buttonId, fileInputId, statusId, kind, fieldMap) {
    const button = document.getElementById(buttonId);
    const fileInput = document.getElementById(fileInputId);
    const statusEl = document.getElementById(statusId);
    if (!button || !fileInput) return;
    const form = button.closest('form');
    button.addEventListener('click', () => scanAndFill({ button, fileInput, statusEl, form, kind, fieldMap }));
  }

  // Service record "Add" form — reuses the existing permanent-attachment
  // file input, so scanning never requires picking the file twice.
  wire('service-scan-btn', 'service-receipt-files', 'service-scan-status', 'service', {
    service_type: 'service_type',
    service_date: 'service_date',
    mileage: 'mileage',
    cost: 'cost',
    shop: 'shop'
  });

  // Fuel log form — its file input has no `name` attribute, so it's
  // excluded from the form's own submission; the photo is only ever used
  // here, never stored.
  wire('fuel-scan-btn', 'fuel-receipt-photo', 'fuel-scan-status', 'fuel', {
    fill_date: 'fill_date',
    mileage: 'mileage',
    gallons: 'gallons',
    cost: 'cost',
    fuel_grade: 'fuel_grade'
  });
})();
