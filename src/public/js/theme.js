(function () {
  var STORAGE_KEY = 'theme';
  var DARK = '#17191b', LIGHT = '#f2ede0';
  var buttons = document.querySelectorAll('[data-theme-choice]');
  if (!buttons.length) return;

  function storedChoice() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (e) {}
    return 'system';
  }

  function apply(choice) {
    if (choice === 'light' || choice === 'dark') {
      document.documentElement.setAttribute('data-theme', choice);
      try { localStorage.setItem(STORAGE_KEY, choice); } catch (e) {}
    } else {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }

    var resolved = choice === 'light' || choice === 'dark'
      ? choice
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'light' ? LIGHT : DARK);

    buttons.forEach(function (btn) {
      var active = btn.dataset.themeChoice === choice;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      apply(btn.dataset.themeChoice);
    });
  });

  apply(storedChoice());
})();
