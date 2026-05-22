(() => {
  const overlay = document.querySelector('[data-search-overlay]');
  const input = document.querySelector('[data-search-input]');
  const toggles = Array.from(document.querySelectorAll('[data-search-toggle]'));
  const closeButtons = Array.from(document.querySelectorAll('[data-search-close]'));

  if (!overlay || !input || toggles.length === 0) return;

  const setExpanded = (expanded) => {
    toggles.forEach((toggle) => {
      toggle.setAttribute('aria-expanded', String(expanded));
    });
  };

  const openSearch = () => {
    overlay.hidden = false;
    document.documentElement.classList.add('search-overlay-open');
    setExpanded(true);
    window.requestAnimationFrame(() => input.focus());
  };

  const closeSearch = () => {
    overlay.hidden = true;
    document.documentElement.classList.remove('search-overlay-open');
    setExpanded(false);
  };

  toggles.forEach((toggle) => {
    toggle.addEventListener('click', openSearch);
  });

  closeButtons.forEach((button) => {
    button.addEventListener('click', closeSearch);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden) {
      closeSearch();
    }
  });

  if (input.value.trim()) {
    openSearch();
  }
})();
