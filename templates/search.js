(() => {
  const input = document.querySelector('[data-search-input]');
  const results = document.querySelector('[data-search-results]');
  const panel = document.querySelector('[data-search-panel]');
  const cards = Array.from(document.querySelectorAll('[data-search-card]'));

  if (!input || !results) return;

  const style = document.createElement('style');
  style.textContent = `
    .search-panel {
      margin: 0 0 24px;
      padding: 18px;
      border: 1px solid currentColor;
      background: rgba(255, 255, 255, 0.04);
    }
    .search-label {
      display: block;
      margin-bottom: 8px;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.72;
    }
    .search-input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid currentColor;
      border-radius: 0;
      background: transparent;
      color: inherit;
      font: inherit;
    }
    .search-input:focus {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
    .search-results {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }
    .search-result-link {
      display: block;
      color: inherit;
      text-decoration: none;
      border: 1px solid currentColor;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.04);
    }
    .search-result-link:hover {
      text-decoration: underline;
    }
    .search-result-meta,
    .search-empty {
      display: block;
      margin-top: 4px;
      font-size: 0.78rem;
      opacity: 0.68;
    }
  `;
  document.head.appendChild(style);

  const normalize = (value) => String(value || '').toLowerCase();
  const matchesPost = (post, query) => normalize([
    post.title,
    post.description,
    post.category,
    ...(post.tags || [])
  ].join(' ')).includes(query);

  const buildResult = (post) => {
    const link = document.createElement('a');
    link.className = 'search-result-link';
    link.href = `/posts/${post.slug}/index.html`;

    const title = document.createElement('strong');
    title.textContent = post.title || 'Untitled Post';
    link.appendChild(title);

    const meta = document.createElement('span');
    meta.className = 'search-result-meta';
    meta.textContent = [post.category, post.date].filter(Boolean).join(' / ');
    link.appendChild(meta);

    return link;
  };

  let searchIndex = [];
  fetch('/search.json')
    .then((res) => (res.ok ? res.json() : []))
    .then((data) => {
      searchIndex = Array.isArray(data) ? data : [];
    })
    .catch(() => {
      searchIndex = [];
    });

  const render = () => {
    const query = normalize(input.value).trim();
    results.replaceChildren();

    if (!query) {
      cards.forEach((card) => {
        card.hidden = false;
      });
      return;
    }

    cards.forEach((card) => {
      card.hidden = !normalize(card.dataset.searchText).includes(query);
    });

    const matches = searchIndex.filter((post) => matchesPost(post, query)).slice(0, 6);
    if (matches.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'search-empty';
      empty.textContent = panel?.dataset.searchEmpty || 'No matching posts found.';
      results.appendChild(empty);
      return;
    }

    matches.forEach((post) => {
      results.appendChild(buildResult(post));
    });
  };

  input.addEventListener('input', render);
})();
