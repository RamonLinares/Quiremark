(() => {
  const input = document.querySelector('[data-search-input]');
  const results = document.querySelector('[data-search-results]');
  const panel = document.querySelector('[data-search-panel]');
  const cards = Array.from(document.querySelectorAll('[data-search-card]'));

  if (!input || !results) return;

  const normalize = (value) => String(value || '').toLowerCase();
  const matchesPost = (post, query) => normalize([
    post.title,
    post.description,
    post.categoryName,
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
    meta.textContent = [post.categoryName || post.category, post.formattedDate || post.date].filter(Boolean).join(' / ');
    link.appendChild(meta);

    return link;
  };

  let searchIndex = [];
  let searchIndexPromise = null;

  const loadSearchIndex = () => {
    if (!searchIndexPromise) {
      searchIndexPromise = fetch('/search.json')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          searchIndex = Array.isArray(data) ? data : [];
          return searchIndex;
        })
        .catch(() => {
          searchIndex = [];
          return searchIndex;
        });
    }
    return searchIndexPromise;
  };

  const setQueryParam = (query) => {
    if (!window.history?.replaceState) return;
    const url = new URL(window.location.href);
    if (query) {
      url.searchParams.set('q', query);
    } else {
      url.searchParams.delete('q');
    }
    window.history.replaceState({}, '', url);
  };

  const render = async () => {
    const query = normalize(input.value).trim();
    results.replaceChildren();
    setQueryParam(query);

    if (!query) {
      cards.forEach((card) => {
        card.hidden = false;
      });
      return;
    }

    cards.forEach((card) => {
      card.hidden = !normalize(card.dataset.searchText).includes(query);
    });

    const index = searchIndex.length ? searchIndex : await loadSearchIndex();
    if (query !== normalize(input.value).trim()) return;

    const matches = index.filter((post) => matchesPost(post, query)).slice(0, 6);
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

  const initialQuery = new URLSearchParams(window.location.search).get('q') || '';
  if (initialQuery) {
    input.value = initialQuery;
    render();
  }

  input.addEventListener('focus', loadSearchIndex, { once: true });
  input.addEventListener('input', () => {
    render();
  });
})();
