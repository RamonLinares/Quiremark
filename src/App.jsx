import React, { useState, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const TOKEN_KEY = 'zenith_token';
const TOKEN_EXPIRY_KEY = 'zenith_token_expires_at';

const sanitizeSlugInput = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/(^-|-$)/g, '');

const THEME_TEXT_FIELDS = [
  { key: 'searchLabel', label: 'Search Label', placeholder: 'Search Archive' },
  { key: 'searchPlaceholder', label: 'Search Placeholder', placeholder: 'Search posts, categories, or tags...' },
  { key: 'searchNoResults', label: 'Search Empty Result', placeholder: 'No matching posts found.' },
  { key: 'emptyState', label: 'No Posts Message', placeholder: 'Use selected theme default' },
  { key: 'readMoreLabel', label: 'Read More Link', placeholder: 'Use selected theme default' },
  { key: 'backLinkLabel', label: 'Post Back Link', placeholder: 'Use selected theme default' },
  { key: 'statusLabel', label: 'Status Label', placeholder: 'Use selected theme default' },
  { key: 'editionLabel', label: 'Edition Label', placeholder: 'Use selected theme default' },
  { key: 'terminalTitle', label: 'Terminal Title', placeholder: 'Use selected theme default' },
  { key: 'footerTerminalTitle', label: 'Footer Terminal Title', placeholder: 'Use selected theme default' },
  { key: 'newsletterDescription', label: 'Newsletter Description', placeholder: 'Use selected theme default', multiline: true },
  { key: 'newsletterPlaceholder', label: 'Newsletter Email Placeholder', placeholder: 'Use selected theme default' },
  { key: 'newsletterEmailLabel', label: 'Newsletter Email Label', placeholder: 'Use selected theme default' },
  { key: 'newsletterSubmitLabel', label: 'Newsletter Submit Button', placeholder: 'Use selected theme default' },
  { key: 'newsletterDisabledPlaceholder', label: 'Newsletter Disabled Placeholder', placeholder: 'Use selected theme default' },
  { key: 'newsletterDisabledLabel', label: 'Newsletter Disabled Button', placeholder: 'Use selected theme default' },
  { key: 'footerRights', label: 'Footer Rights Text', placeholder: 'Use selected theme default' },
  { key: 'footerCreditLabel', label: 'Footer Credit Label', placeholder: 'Use selected theme default' },
  { key: 'footerCreditText', label: 'Footer Credit Text', placeholder: 'Use selected theme default' },
  { key: 'footerCreditUrl', label: 'Footer Credit URL', placeholder: '#' }
];

const SUPPORTED_LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'ca', label: 'Català' },
  { value: 'zh', label: '中文' }
];

const DEFAULT_CATEGORIES = [
  {
    slug: 'design',
    name: 'Design',
    description: 'Visual design, brand systems, typography, and creative direction.',
    color: '#a855f7'
  },
  {
    slug: 'development',
    name: 'Development',
    description: 'Engineering notes, architecture, tooling, and implementation details.',
    color: '#06b6d4'
  },
  {
    slug: 'creative',
    name: 'Creative',
    description: 'Experiments across art, media, writing, and making.',
    color: '#ec4899'
  },
  {
    slug: 'tech',
    name: 'Tech',
    description: 'Technology trends, platforms, and digital culture.',
    color: '#22c55e'
  }
];

const DYNAMIC_VARIABLE_TOKENS = [
  '{date}',
  '{time}',
  '{generatedAt}',
  '{isoDate}',
  '{year}',
  '{month}',
  '{day}',
  '{locale}',
  '{language}',
  '{siteName}',
  '{authorName}',
  '{postCount}',
  '{categoryCount}',
  '{categories}',
  '{categoryName}',
  '{categorySlug}',
  '{categoryDescription}',
  '{categoryUrl}',
  '{lastPost}',
  '{lastPostTitle}',
  '{lastPostDate}',
  '{lastPostIsoDate}',
  '{lastPostCategory}',
  '{lastPostCategoryUrl}',
  '{postUrl}',
  '{postTitle}',
  '{postDate}',
  '{postIsoDate}',
  '{postCategory}',
  '{postCategoryUrl}'
];

const PUBLIC_FEATURE_FIELDS = [
  {
    key: 'search',
    label: 'Search',
    description: 'Show the public search box and emit search assets.'
  },
  {
    key: 'newsletter',
    label: 'Mailing List',
    description: 'Show newsletter signup widgets when they are enabled.'
  },
  {
    key: 'about',
    label: 'About Me',
    description: 'Show author bio widgets when they are enabled.'
  },
  {
    key: 'rss',
    label: 'RSS Feed',
    description: 'Generate /feed.xml and add feed discovery links.'
  },
  {
    key: 'categories',
    label: 'Categories',
    description: 'Show category navigation and generate public category archive pages.'
  }
];

export default function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, posts, appearance, settings, publisher

  // App States
  const [settings, setSettings] = useState(null);
  const [posts, setPosts] = useState([]);
  const [consoleLogs, setConsoleLogs] = useState([
    '[SYSTEM] ZenithPress Admin Dashboard booted.',
    '[SYSTEM] Local Express server connection status: VERIFIED.'
  ]);

  // Post Editor States
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editingPost, setEditingPost] = useState({
    title: '',
    slug: '',
    description: '',
    category: DEFAULT_CATEGORIES[0].slug,
    tags: [],
    coverImage: '',
    date: new Date().toISOString().split('T')[0],
    content: '',
    draft: false,
    isNew: true
  });

  // Deploy settings
  const [deploySettings, setDeploySettings] = useState({
    remoteUrl: '',
    branch: 'gh-pages',
    commitMessage: 'Publish: Static Pages Deploy'
  });

  const [isCompiling, setIsCompiling] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const previewHtml = useMemo(
    () => DOMPurify.sanitize(marked.parse(editingPost.content || '*Empty post draft...*')),
    [editingPost.content]
  );
  const categories = useMemo(
    () => (Array.isArray(settings?.categories) && settings.categories.length ? settings.categories : DEFAULT_CATEGORIES),
    [settings?.categories]
  );
  const categoryBySlug = useMemo(
    () => new Map(categories.map(category => [category.slug, category])),
    [categories]
  );
  const postCountByCategory = useMemo(() => posts.reduce((counts, post) => {
    const slug = post.categorySlug || post.category;
    if (slug) counts[slug] = (counts[slug] || 0) + 1;
    return counts;
  }, {}), [posts]);

  // Initialize
  useEffect(() => {
    const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0);
    if (authToken && expiresAt > Date.now()) {
      setIsLoggedIn(true);
      fetchData(authToken);
    } else if (authToken) {
      handleLogout('Session expired. Please sign in again.');
    }
  }, []);

  const handleUnauthorized = (message = 'Session expired. Please sign in again.') => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    setAuthToken('');
    setIsLoggedIn(false);
    setSettings(null);
    setAuthError(message);
  };

  const apiFetch = async (url, options = {}, tokenOverride = authToken) => {
    const headers = new Headers(options.headers || {});
    if (tokenOverride) {
      headers.set('Authorization', `Bearer ${tokenOverride}`);
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      handleUnauthorized();
    }
    return res;
  };

  const readApiResponse = async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
    }
    return data;
  };

  const fetchData = async (tokenOverride = authToken) => {
    try {
      const [settingsRes, postsRes] = await Promise.all([
        apiFetch('/api/settings', {}, tokenOverride),
        apiFetch('/api/posts', {}, tokenOverride)
      ]);
      const settingsData = await readApiResponse(settingsRes);
      const postsData = await readApiResponse(postsRes);
      setSettings(settingsData);
      if (settingsData.socialLinks?.github) {
        const githubRemote = settingsData.socialLinks.github.endsWith('.git')
          ? settingsData.socialLinks.github
          : `${settingsData.socialLinks.github}.git`;
        setDeploySettings(prev => ({
          ...prev,
          remoteUrl: githubRemote
        }));
      }
      setPosts(postsData);
    } catch (err) {
      logMsg(err.message || 'Failed to sync settings and post databases from local Express server.', 'error');
    }
  };

  const logMsg = (msg, type = 'system') => {
    const time = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [...prev, `[${time}] ${msg}`]);
  };

  // Auth handler
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(TOKEN_EXPIRY_KEY, String(data.expiresAt || 0));
        setAuthToken(data.token);
        setIsLoggedIn(true);
        setPassword('');
        setAuthError('');
        fetchData(data.token);
      } else {
        setAuthError(data.message || 'Invalid password.');
      }
    } catch (err) {
      setAuthError('Connection to local Express server failed.');
    }
  };

  const handleLogout = (message = '') => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    setAuthToken('');
    setIsLoggedIn(false);
    setSettings(null);
    if (typeof message === 'string' && message) setAuthError(message);
  };

  // Settings Save handler
  const saveSettings = async (updatedSettings) => {
    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      const data = await readApiResponse(res);
      if (data.success) {
        setSettings(data.settings || updatedSettings);
        logMsg('Settings configuration saved locally.');
      }
    } catch (err) {
      logMsg(err.message || 'Failed to save settings configurations.', 'error');
    }
  };

  const updateThemeText = (key, value) => {
    setSettings(prev => ({
      ...prev,
      themeText: {
        ...(prev.themeText || {}),
        [key]: value
      }
    }));
  };

  const updateFeatureFlag = (key, value) => {
    setSettings(prev => ({
      ...prev,
      features: {
        search: true,
        newsletter: true,
        about: true,
        rss: true,
        categories: true,
        ...(prev.features || {}),
        [key]: value
      }
    }));
  };

  const updateCategory = (index, patch) => {
    setSettings(prev => {
      const nextCategories = [...(prev.categories || DEFAULT_CATEGORIES)];
      nextCategories[index] = { ...nextCategories[index], ...patch };
      return { ...prev, categories: nextCategories };
    });
  };

  const addCategory = () => {
    setSettings(prev => {
      const nextCategories = [...(prev.categories || DEFAULT_CATEGORIES)];
      const nextNumber = nextCategories.length + 1;
      nextCategories.push({
        slug: `category-${nextNumber}`,
        name: `Category ${nextNumber}`,
        description: '',
        color: '#64748b'
      });
      return { ...prev, categories: nextCategories };
    });
  };

  const removeCategory = (index) => {
    setSettings(prev => {
      const nextCategories = [...(prev.categories || DEFAULT_CATEGORIES)];
      if (nextCategories.length <= 1) return prev;
      nextCategories.splice(index, 1);
      return { ...prev, categories: nextCategories };
    });
  };

  // Image base64 upload helper
  const handleImageUpload = async (file, type) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiFetch('/api/images/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            base64Data: reader.result
          })
        });
        const data = await readApiResponse(res);
        if (data.success) {
          if (type === 'avatar') {
            saveSettings({ ...settings, authorAvatar: data.url });
          } else if (type === 'post') {
            setEditingPost(prev => ({ ...prev, coverImage: data.url }));
          } else if (type === 'inline') {
            insertInlineImage(data.url);
          }
          logMsg(`Asset uploaded successfully: ${data.url}`);
        }
      } catch (err) {
        logMsg(err.message || 'Image upload failed.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  // Create or Update Post
  const handleSavePost = async (e) => {
    e.preventDefault();
    try {
      const url = editingPost.isNew ? '/api/posts' : `/api/posts/${editingPost.slug}`;
      const method = editingPost.isNew ? 'POST' : 'PUT';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingPost,
          tags: typeof editingPost.tags === 'string'
            ? editingPost.tags.split(',').map(t => t.trim())
            : editingPost.tags
        })
      });

      const data = await readApiResponse(res);
      if (data.success) {
        setIsEditingPost(false);
        fetchData();
        logMsg(`Article post saved: "${editingPost.title}"`);
      } else {
        logMsg(data.error || 'Failed to save post.', 'error');
      }
    } catch (err) {
      logMsg(err.message || 'Error saving post.', 'error');
    }
  };

  // Delete Post
  const handleDeletePost = async (slug) => {
    if (!window.confirm(`Are you sure you want to delete the post "${slug}"?`)) return;
    try {
      const res = await apiFetch(`/api/posts/${slug}`, { method: 'DELETE' });
      const data = await readApiResponse(res);
      if (data.success) {
        fetchData();
        logMsg(`Article post deleted: "${slug}"`);
      }
    } catch (err) {
      logMsg(err.message || 'Failed to delete post.', 'error');
    }
  };

  // Compile SSG
  const handleCompile = async () => {
    setIsCompiling(true);
    setActiveTab('publisher');
    logMsg('Initiating static pages compiler...');
    try {
      const res = await apiFetch('/api/publish', { method: 'POST' });
      const data = await readApiResponse(res);
      if (data.success) {
        // Stream build logs
        data.log.forEach(l => logMsg(l));
        logMsg('Static compilation finished. Local build stored in /out directory.', 'system');
      } else {
        logMsg(data.error || 'Compilation failed.', 'error');
      }
    } catch (err) {
      logMsg(err.message || 'Compilation request failed.', 'error');
    } finally {
      setIsCompiling(false);
    }
  };

  // Deploy to GitHub Pages
  const handleDeploy = async () => {
    if (!deploySettings.remoteUrl) {
      alert('Git Remote Target Repository URL is required to push deployment!');
      return;
    }
    setIsDeploying(true);
    setActiveTab('publisher');
    logMsg(`Initiating shell Deployer to target: ${deploySettings.remoteUrl}...`);
    try {
      const res = await apiFetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deploySettings)
      });
      const data = await res.json().catch(() => ({}));

      // Stream deploy logs
      (data.log || []).forEach(l => logMsg(l, 'deploy'));

      if (res.ok && data.success) {
        logMsg(`Deployment completed successfully! Pushed static pages to ${deploySettings.branch}.`);
        alert('Blog successfully published and deployed to GitHub Pages!');
      } else {
        logMsg(data.error || 'Deploy failed.', 'error');
        alert(`Deploy failed: ${data.error}`);
      }
    } catch (err) {
      logMsg(err.message || 'Deploy request failed.', 'error');
    } finally {
      setIsDeploying(false);
    }
  };

  // Quick helper to insert Markdown formatting tags
  const insertMarkdown = (syntax) => {
    const textarea = document.getElementById('editor-textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const selected = text.substring(start, end);

    let replacement = '';
    if (syntax === 'bold') replacement = `**${selected || 'bold text'}**`;
    else if (syntax === 'italic') replacement = `*${selected || 'italic text'}*`;
    else if (syntax === 'link') replacement = `[${selected || 'link description'}](https://example.com)`;
    else if (syntax === 'code') replacement = `\`${selected || 'code code'}\``;
    else if (syntax === 'quote') replacement = `\n> ${selected || 'Blockquote text'}\n`;

    setEditingPost(prev => ({ ...prev, content: before + replacement + after }));
    textarea.focus();
  };

  // Helper to insert an uploaded inline image into selection
  const insertInlineImage = (imageUrl) => {
    const textarea = document.getElementById('editor-textarea');
    if (!textarea) {
      setEditingPost(prev => ({ ...prev, content: prev.content + `\n![Image Description](${imageUrl})\n` }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const replacement = `\n![Image Description](${imageUrl})\n`;

    setEditingPost(prev => ({ ...prev, content: before + replacement + after }));
    setTimeout(() => {
      textarea.focus();
    }, 50);
  };

  if (!isLoggedIn) {
    return (
      <div className="auth-wrapper">
        <div className="admin-glow-1"></div>
        <div className="admin-glow-2"></div>
        <div className="auth-card">
          <div className="auth-logo">ZenithPress</div>
          <div className="auth-subtitle">Static Blogging Control Center</div>
          <form onSubmit={handleLogin}>
            <div className="auth-input-group">
              <label>Administrative Password</label>
              <input
                type="password"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (default: admin)"
                required
              />
            </div>
            <button type="submit" className="auth-btn">Authenticate Console</button>
            {authError && <div className="auth-error">{authError}</div>}
          </form>
        </div>
      </div>
    );
  }

  if (!settings) {
    return <div className="auth-wrapper"><p>Connecting and synching configuration databases...</p></div>;
  }

  return (
    <div className="dashboard-container">
      <div className="admin-glow-1"></div>
      <div className="admin-glow-2"></div>

      {/* Sidebar navigation */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <span>☄️</span> ZenithPress
        </div>
        <ul className="sidebar-menu">
          <li
            className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setIsEditingPost(false); }}
          >
            📊 Dashboard
          </li>
          <li
            className={`menu-item ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => { setActiveTab('posts'); }}
          >
            📝 Manage Posts
          </li>
          <li
            className={`menu-item ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => { setActiveTab('appearance'); setIsEditingPost(false); }}
          >
            🎨 Appearance
          </li>
          <li
            className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('settings'); setIsEditingPost(false); }}
          >
            ⚙️ Site Settings
          </li>
          <li
            className={`menu-item ${activeTab === 'publisher' ? 'active' : ''}`}
            onClick={() => { setActiveTab('publisher'); setIsEditingPost(false); }}
          >
            🚀 Publish & Deploy
          </li>
        </ul>
        <div className="sidebar-footer">
          <div className="logout-btn" onClick={handleLogout}>
            🚪 Logout Dashboard
          </div>
        </div>
      </div>

      {/* Main Panel View */}
      <div className="main-panel">

        {/* Render Tab Views */}
        {!isEditingPost ? (
          <>
            {/* Dashboard Summary Tab */}
            {activeTab === 'dashboard' && (
              <div>
                <div className="panel-header">
                  <div className="panel-title">
                    <h2>Administrative Overview</h2>
                    <p>Track site status, posts database, and compile packages.</p>
                  </div>
                  <button className="quick-action-btn" onClick={handleCompile}>
                    ☄️ Compile Static Site
                  </button>
                </div>

                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon purple">📝</div>
                    <div className="stat-info">
                      <h3>{posts.length}</h3>
                      <p>Total Posts</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon cyan">🎨</div>
                    <div className="stat-info">
                      <h3 style={{ fontSize: '1.25rem' }}>{settings.selectedTemplate}</h3>
                      <p>Active Template</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon pink">🧩</div>
                    <div className="stat-info">
                      <h3>{settings.widgets.filter(w => w.enabled).length}</h3>
                      <p>Active Widgets</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon green">🚀</div>
                    <div className="stat-info">
                      <h3 style={{ fontSize: '1.1rem', color: '#4ade80' }}>Static (Git)</h3>
                      <p>DB engine</p>
                    </div>
                  </div>
                </div>

                {/* Dashboard layout lower panel split */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '40px' }}>
                  <div className="brand-settings-card">
                    <h3>📢 Live Public Site</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Your blog generates clean, lightning-fast static pages optimized for search engines (SEO) and zero load latency. Pushing updates deploys them straight to GitHub Pages!
                    </p>
                    <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                      <button className="solid-btn" onClick={handleCompile}>Build Local</button>
                      <button
                        className="text-btn"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                        onClick={() => setActiveTab('publisher')}
                      >
                        Push to GitHub Pages
                      </button>
                    </div>
                  </div>
                  <div className="brand-settings-card">
                    <h3>💡 Creative Templates</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Switch themes instantly in the Appearance tab. Choose from <b>NordicMinimal</b>, <b>NeoGlass</b>, <b>CyberMonospace</b>, <b>Sunset Vaporwave</b>, <b>Brutalist Newspaper</b>, and <b>Eco-Forest</b>.
                    </p>
                    <button className="solid-btn" style={{ alignSelf: 'flex-start', marginTop: '10px' }} onClick={() => setActiveTab('appearance')}>
                      Manage Themes & Widgets
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Posts Manager Tab */}
            {activeTab === 'posts' && (
              <div>
                <div className="panel-header">
                  <div className="panel-title">
                    <h2>Manage Posts</h2>
                    <p>Compose new articles, write tags, and update drafts.</p>
                  </div>
                  <button
                    className="quick-action-btn"
                    onClick={() => {
                      setEditingPost({
                        title: '',
                        slug: '',
                        description: '',
                        category: categories[0]?.slug || DEFAULT_CATEGORIES[0].slug,
                        tags: '',
                        coverImage: '',
                        date: new Date().toISOString().split('T')[0],
                        content: '',
                        draft: false,
                        isNew: true
                      });
                      setIsEditingPost(true);
                    }}
                  >
                    ➕ Write New Post
                  </button>
                </div>

                <div className="posts-table-card">
                  <table className="posts-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posts.map(post => (
                        <tr key={post.slug}>
                          <td>
                            <div className="post-table-title">{post.title}</div>
                            <div className="post-table-slug">posts/{post.slug}</div>
                          </td>
                          <td>
                            <span className="tag-badge">{post.categoryName || categoryBySlug.get(post.category)?.name || post.category}</span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{post.date}</td>
                          <td>
                            <span className={`status-badge ${post.draft ? 'draft' : 'published'}`}>
                              {post.draft ? 'Draft' : 'Published'}
                            </span>
                          </td>
                          <td>
                            <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                              <button
                                className="icon-btn edit"
                                title="Edit Post"
                                onClick={() => {
                                  setEditingPost({
                                    ...post,
                                    category: post.categorySlug || post.category || categories[0]?.slug || DEFAULT_CATEGORIES[0].slug,
                                    tags: Array.isArray(post.tags) ? post.tags.join(', ') : post.tags,
                                    isNew: false
                                  });
                                  setIsEditingPost(true);
                                }}
                              >
                                ✏️
                              </button>
                              <button
                                className="icon-btn delete"
                                title="Delete Post"
                                onClick={() => handleDeletePost(post.slug)}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div>
                <div className="panel-header">
                  <div className="panel-title">
                    <h2>Theme & Widgets Settings</h2>
                    <p>Select visual layout, toggles, sidebar elements, and customize html.</p>
                  </div>
                </div>

                <div className="settings-layout">
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '20px' }}>Select Styling Template</h3>
                    <div className="templates-grid">

                      {/* Nordic Minimal Card */}
                      <div
                        className={`template-card ${settings.selectedTemplate === 'nordic-minimal' ? 'active' : ''}`}
                        onClick={() => saveSettings({ ...settings, selectedTemplate: 'nordic-minimal' })}
                      >
                        <div className="template-card-preview minimalist">
                          <span style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'serif' }}>Nordic</span>
                          {settings.selectedTemplate === 'nordic-minimal' && <span className="template-preview-badge">Active</span>}
                        </div>
                        <div className="template-card-info">
                          <h4>NordicMinimal Theme</h4>
                          <p>Elegant black-and-white layout with playfair serif headings and high-contrast grids.</p>
                        </div>
                      </div>

                      {/* Neo Glass Card */}
                      <div
                        className={`template-card ${settings.selectedTemplate === 'neo-glass' ? 'active' : ''}`}
                        onClick={() => saveSettings({ ...settings, selectedTemplate: 'neo-glass' })}
                      >
                        <div className="template-card-preview neoglass">
                          <span style={{ fontSize: '2.2rem', fontWeight: '800', background: 'linear-gradient(135deg, #a855f7, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>GLASS</span>
                          {settings.selectedTemplate === 'neo-glass' && <span className="template-preview-badge">Active</span>}
                        </div>
                        <div className="template-card-info">
                          <h4>NeoGlass Theme</h4>
                          <p>Futuristic glassmorphic panels, glowing violet gradients, and micro-hover transitions.</p>
                        </div>
                      </div>

                      {/* Cyber Monospace Card */}
                      <div
                        className={`template-card ${settings.selectedTemplate === 'cyber-monospace' ? 'active' : ''}`}
                        onClick={() => saveSettings({ ...settings, selectedTemplate: 'cyber-monospace' })}
                      >
                        <div className="template-card-preview cyberpunk">
                          <span style={{ fontSize: '1.4rem', fontFamily: 'monospace' }}>&gt;_ cyber.sh</span>
                          {settings.selectedTemplate === 'cyber-monospace' && <span className="template-preview-badge">Active</span>}
                        </div>
                        <div className="template-card-info">
                          <h4>CyberMonospace Theme</h4>
                          <p>Retro command prompt CRT shell with scanlines and lime-green glowing monospace texts.</p>
                        </div>
                      </div>

                      {/* Sunset Vaporwave Card */}
                      <div
                        className={`template-card ${settings.selectedTemplate === 'sunset-vaporwave' ? 'active' : ''}`}
                        onClick={() => saveSettings({ ...settings, selectedTemplate: 'sunset-vaporwave' })}
                      >
                        <div className="template-card-preview vaporwave">
                          <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#ff007f', textShadow: '0 0 10px rgba(255, 0, 127, 0.8), 0 0 20px rgba(0, 240, 255, 0.6)', fontFamily: "'Orbitron', sans-serif" }}>NEON</span>
                          {settings.selectedTemplate === 'sunset-vaporwave' && <span className="template-preview-badge">Active</span>}
                        </div>
                        <div className="template-card-info">
                          <h4>Sunset Vaporwave Theme</h4>
                          <p>Retro-futuristic synthwave theme with deep violet skies, animated perspective neon grids, and glowing glass panels.</p>
                        </div>
                      </div>

                      {/* Brutalist Newspaper Card */}
                      <div
                        className={`template-card ${settings.selectedTemplate === 'brutalist-newspaper' ? 'active' : ''}`}
                        onClick={() => saveSettings({ ...settings, selectedTemplate: 'brutalist-newspaper' })}
                      >
                        <div className="template-card-preview brutalist">
                          <span style={{ fontSize: '1.3rem', fontWeight: '800', border: '3px solid #000', padding: '4px 8px', background: '#ffff00', color: '#000', boxShadow: '4px 4px 0 #000', fontFamily: "'Space Grotesk', sans-serif" }}>ZINE</span>
                          {settings.selectedTemplate === 'brutalist-newspaper' && <span className="template-preview-badge">Active</span>}
                        </div>
                        <div className="template-card-info">
                          <h4>Brutalist Newspaper Theme</h4>
                          <p>Bold, raw, high-contrast publication design with heavy borders, zine-like grids, and flat block shadows.</p>
                        </div>
                      </div>

                      {/* Eco-Forest Minimalist Card */}
                      <div
                        className={`template-card ${settings.selectedTemplate === 'eco-forest' ? 'active' : ''}`}
                        onClick={() => saveSettings({ ...settings, selectedTemplate: 'eco-forest' })}
                      >
                        <div className="template-card-preview ecoforest">
                          <span style={{ fontSize: '1.6rem', fontWeight: '600', fontStyle: 'italic', color: '#1d3b28', fontFamily: 'Lora, serif' }}>Forest</span>
                          {settings.selectedTemplate === 'eco-forest' && <span className="template-preview-badge">Active</span>}
                        </div>
                        <div className="template-card-info">
                          <h4>Eco-Forest Minimalist Theme</h4>
                          <p>Warm, serene editorial design with organic sage palette, humanist serifs, and spacious breathing margins.</p>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Widget Side drawer */}
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '20px' }}>Active Widgets</h3>
                    <div className="widgets-list">
                      {settings.widgets.map((widget, idx) => (
                        <div className="widget-settings-card" key={widget.id}>
                          <div className="widget-card-header">
                            <h4>{widget.name} ({widget.position})</h4>
                            <label className="switch">
                              <input
                                type="checkbox"
                                checked={widget.enabled}
                                onChange={(e) => {
                                  const updatedWidgets = [...settings.widgets];
                                  updatedWidgets[idx].enabled = e.target.checked;
                                  saveSettings({ ...settings, widgets: updatedWidgets });
                                }}
                              />
                              <span className="slider"></span>
                            </label>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Type: {widget.type}
                          </span>
                          <input
                            type="text"
                            className="meta-field"
                            value={widget.name || ''}
                            onChange={(e) => {
                              const updatedWidgets = [...settings.widgets];
                              updatedWidgets[idx].name = e.target.value;
                              setSettings({ ...settings, widgets: updatedWidgets });
                            }}
                            onBlur={() => saveSettings(settings)}
                            placeholder="Widget title, supports {date} variables..."
                          />
                          {widget.type === 'newsletter' && widget.enabled && (
                            <>
                              <input
                                type="text"
                                className="meta-field"
                                value={widget.placeholderText || ''}
                                onChange={(e) => {
                                  const updatedWidgets = [...settings.widgets];
                                  updatedWidgets[idx].placeholderText = e.target.value;
                                  setSettings({ ...settings, widgets: updatedWidgets });
                                }}
                                onBlur={() => saveSettings(settings)}
                                placeholder="Newsletter placeholder text..."
                              />
                              <input
                                type="url"
                                className="meta-field"
                                value={widget.actionUrl || ''}
                                onChange={(e) => {
                                  const updatedWidgets = [...settings.widgets];
                                  updatedWidgets[idx].actionUrl = e.target.value;
                                  setSettings({ ...settings, widgets: updatedWidgets });
                                }}
                                onBlur={() => saveSettings(settings)}
                                placeholder="Newsletter form endpoint URL..."
                              />
                            </>
                          )}
                          {widget.type === 'custom-html' && widget.enabled && (
                            <textarea
                              className="meta-field"
                              style={{ height: '80px', fontFamily: 'monospace', fontSize: '0.8rem' }}
                              value={widget.htmlContent || ''}
                              onChange={(e) => {
                                const updatedWidgets = [...settings.widgets];
                                updatedWidgets[idx].htmlContent = e.target.value;
                                setSettings({ ...settings, widgets: updatedWidgets });
                              }}
                              onBlur={() => saveSettings(settings)}
                              placeholder="Inject custom html code..."
                            />
                          )}
                        </div>
                      ))}

                      {/* Button to seed custom widgets */}
                      <button
                        className="text-btn"
                        style={{ border: '1px dashed rgba(255,255,255,0.1)', width: '100%' }}
                        onClick={() => {
                          const customId = `custom-${Date.now()}`;
                          const newWidget = {
                            id: customId,
                            name: "Custom HTML Block",
                            type: "custom-html",
                            enabled: true,
                            position: "sidebar",
                            order: 5,
                            htmlContent: "<!-- Add custom widgets HTML here -->"
                          };
                          saveSettings({ ...settings, widgets: [...settings.widgets, newWidget] });
                        }}
                      >
                        ➕ Inject Custom HTML Widget
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* General Settings Tab */}
            {activeTab === 'settings' && (
              <div>
                <div className="panel-header">
                  <div className="panel-title">
                    <h2>Site Settings & Author Bio</h2>
                    <p>Customize blog name, tags, description, avatar photo, and social coordinates.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
                  <div className="brand-settings-card">
                    <h3>📢 Branding Configuration</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div className="meta-input-group">
                        <label>Site Name</label>
                        <input
                          type="text"
                          className="meta-field"
                          value={settings.siteName}
                          onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                        />
                      </div>
                      <div className="meta-input-group">
                        <label>Site Subtitle</label>
                        <input
                          type="text"
                          className="meta-field"
                          value={settings.siteSubtitle}
                          onChange={(e) => setSettings({ ...settings, siteSubtitle: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="meta-input-group">
                      <label>Website Locale</label>
                      <select
                        className="meta-field"
                        value={settings.locale || 'en'}
                        onChange={(e) => setSettings({ ...settings, locale: e.target.value })}
                      >
                        {SUPPORTED_LOCALES.map(locale => (
                          <option key={locale.value} value={locale.value}>
                            {locale.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div className="meta-input-group">
                        <label>Author Display Name</label>
                        <input
                          type="text"
                          className="meta-field"
                          value={settings.authorName}
                          onChange={(e) => setSettings({ ...settings, authorName: e.target.value })}
                        />
                      </div>
                      <div className="meta-input-group">
                        <label>Author Profile Picture (Avatar URL)</label>
                        <div className="avatar-preview-container">
                          {settings.authorAvatar && <img src={settings.authorAvatar} className="avatar-preview" />}
                          <input
                            type="text"
                            className="meta-field"
                            style={{ flexGrow: 1 }}
                            value={settings.authorAvatar}
                            onChange={(e) => setSettings({ ...settings, authorAvatar: e.target.value })}
                            placeholder="Avatar URL or Upload image..."
                          />
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                          onChange={(e) => handleImageUpload(e.target.files[0], 'avatar')}
                        />
                      </div>
                    </div>

                    <div className="meta-input-group">
                      <label>Author Short Biography</label>
                      <textarea
                        className="meta-field"
                        style={{ height: '80px', resize: 'none' }}
                        value={settings.authorBio}
                        onChange={(e) => setSettings({ ...settings, authorBio: e.target.value })}
                      />
                    </div>

                    <button
                      className="solid-btn"
                      style={{ alignSelf: 'flex-start', marginTop: '10px' }}
                      onClick={() => saveSettings(settings)}
                    >
                      💾 Save Branding Settings
                    </button>
                  </div>

                  <div className="brand-settings-card">
                    <h3>📱 Social Handles</h3>

                    <div className="meta-input-group">
                      <label>GitHub Profile / Repo</label>
                      <input
                        type="text"
                        className="meta-field"
                        value={settings.socialLinks.github}
                        onChange={(e) => setSettings({
                          ...settings,
                          socialLinks: { ...settings.socialLinks, github: e.target.value }
                        })}
                        placeholder="https://github.com/user/repo"
                      />
                    </div>
                    <div className="meta-input-group">
                      <label>Twitter/X URL</label>
                      <input
                        type="text"
                        className="meta-field"
                        value={settings.socialLinks.twitter}
                        onChange={(e) => setSettings({
                          ...settings,
                          socialLinks: { ...settings.socialLinks, twitter: e.target.value }
                        })}
                      />
                    </div>
                    <div className="meta-input-group">
                      <label>LinkedIn URL</label>
                      <input
                        type="text"
                        className="meta-field"
                        value={settings.socialLinks.linkedin}
                        onChange={(e) => setSettings({
                          ...settings,
                          socialLinks: { ...settings.socialLinks, linkedin: e.target.value }
                        })}
                      />
                    </div>

                    <button
                      className="solid-btn"
                      style={{ alignSelf: 'flex-start', marginTop: '10px' }}
                      onClick={() => saveSettings(settings)}
                    >
                      💾 Save Social Links
                    </button>
                  </div>
                </div>

                <div className="brand-settings-card" style={{ marginTop: '30px' }}>
                  <h3>SEO & AI Discovery</h3>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '-8px', marginBottom: '18px' }}>
                    Configure canonical URLs, social previews, sitemap output, and LLM-readable discovery files.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="meta-input-group">
                      <label>Public Site URL</label>
                      <input
                        type="url"
                        className="meta-field"
                        value={settings.siteUrl || ''}
                        onChange={(e) => setSettings({ ...settings, siteUrl: e.target.value })}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div className="meta-input-group">
                      <label>Default Share Image</label>
                      <input
                        type="text"
                        className="meta-field"
                        value={settings.seoImage || ''}
                        onChange={(e) => setSettings({ ...settings, seoImage: e.target.value })}
                        placeholder="/content/images/social-card.jpg"
                      />
                    </div>
                  </div>
                  <div className="meta-input-group">
                    <label>SEO Description</label>
                    <textarea
                      className="meta-field"
                      style={{ height: '82px', resize: 'vertical' }}
                      value={settings.seoDescription || ''}
                      onChange={(e) => setSettings({ ...settings, seoDescription: e.target.value })}
                      placeholder="Overrides the homepage meta description. Post descriptions still come from post metadata."
                    />
                  </div>
                  <div className="meta-input-group">
                    <label>SEO Keywords</label>
                    <input
                      type="text"
                      className="meta-field"
                      value={settings.seoKeywords || ''}
                      onChange={(e) => setSettings({ ...settings, seoKeywords: e.target.value })}
                      placeholder="design, development, static blog"
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={settings.allowIndexing !== false}
                      onChange={(e) => setSettings({ ...settings, allowIndexing: e.target.checked })}
                    />
                    Allow search engines and LLM crawlers to index this site
                  </label>
                  <button
                    className="solid-btn"
                    style={{ alignSelf: 'flex-start', marginTop: '18px' }}
                    onClick={() => saveSettings(settings)}
                  >
                    💾 Save SEO Settings
                  </button>
                </div>

                <div className="brand-settings-card" style={{ marginTop: '30px' }}>
                  <h3>Public Feature Visibility</h3>
                  <div style={{ display: 'grid', gap: '14px' }}>
                    {PUBLIC_FEATURE_FIELDS.map(feature => (
                      <div
                        key={feature.key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '18px',
                          padding: '14px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px'
                        }}
                      >
                        <div>
                          <strong style={{ display: 'block', marginBottom: '4px' }}>{feature.label}</strong>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                            {feature.description}
                          </span>
                        </div>
                        <label className="switch" aria-label={`Toggle ${feature.label}`}>
                          <input
                            type="checkbox"
                            checked={(settings.features?.[feature.key] ?? true) !== false}
                            onChange={(e) => updateFeatureFlag(feature.key, e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <button
                    className="solid-btn"
                    style={{ alignSelf: 'flex-start', marginTop: '18px' }}
                    onClick={() => saveSettings(settings)}
                  >
                    Save Feature Visibility
                  </button>
                </div>

                <div className="brand-settings-card" style={{ marginTop: '30px' }}>
                  <h3>Categories</h3>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '-8px', marginBottom: '18px' }}>
                    Manage the public taxonomy used by post metadata, category archive pages, search, RSS, sitemap, and Schema.org output.
                  </p>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {categories.map((category, index) => {
                      const postCount = postCountByCategory[category.slug] || 0;
                      const categoryColor = /^#[0-9a-fA-F]{6}$/.test(category.color || '') ? category.color : '#64748b';
                      return (
                        <div
                          key={category.slug || index}
                          style={{
                            display: 'grid',
                            gap: '12px',
                            padding: '16px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                            <strong>{category.name || 'Untitled Category'}</strong>
                            <span className="tag-badge">{postCount} posts</span>
                          </div>
                          <div className="category-editor-grid">
                            <div className="meta-input-group">
                              <label>Name</label>
                              <input
                                type="text"
                                className="meta-field"
                                value={category.name || ''}
                                onChange={(e) => updateCategory(index, { name: e.target.value })}
                                placeholder="Design"
                              />
                            </div>
                            <div className="meta-input-group">
                              <label>Slug</label>
                              <input
                                type="text"
                                className="meta-field"
                                value={category.slug || ''}
                                onChange={(e) => updateCategory(index, { slug: sanitizeSlugInput(e.target.value) })}
                                placeholder="design"
                                disabled={postCount > 0}
                              />
                            </div>
                            <div className="meta-input-group">
                              <label>Color</label>
                              <div className="category-color-control">
                                <input
                                  type="color"
                                  className="category-color-input"
                                  value={categoryColor}
                                  onChange={(e) => updateCategory(index, { color: e.target.value })}
                                  aria-label={`${category.name || 'Category'} color`}
                                />
                                <span className="category-color-value">{categoryColor}</span>
                              </div>
                            </div>
                          </div>
                          <div className="meta-input-group">
                            <label>Description</label>
                            <textarea
                              className="meta-field"
                              style={{ height: '76px', resize: 'vertical' }}
                              value={category.description || ''}
                              onChange={(e) => updateCategory(index, { description: e.target.value })}
                              placeholder="Short description shown on the category archive page."
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                              {postCount > 0 ? 'Slug and deletion are locked while posts use this category.' : 'Safe to rename or remove before assigning posts.'}
                            </span>
                            <button
                              type="button"
                              className="text-btn"
                              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                              onClick={() => removeCategory(index)}
                              disabled={categories.length <= 1 || postCount > 0}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '18px', flexWrap: 'wrap' }}>
                    <button type="button" className="text-btn" style={{ border: '1px dashed rgba(255,255,255,0.16)' }} onClick={addCategory}>
                      Add Category
                    </button>
                    <button className="solid-btn" onClick={() => saveSettings({ ...settings, categories })}>
                      Save Categories
                    </button>
                  </div>
                </div>

                <div className="brand-settings-card" style={{ marginTop: '30px' }}>
                  <h3>Theme Copy Overrides</h3>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '-8px', marginBottom: '18px' }}>
                    Leave fields blank to keep the selected theme defaults.
                  </p>
                  <div style={{ marginBottom: '20px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Dynamic Variables</h4>
                    <p style={{ color: 'var(--text-secondary)', margin: '0 0 12px 0', fontSize: '0.82rem' }}>
                      These also work in site subtitle, author bio, widget titles, newsletter placeholders, and custom HTML widgets.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {DYNAMIC_VARIABLE_TOKENS.map(token => (
                        <code
                          key={token}
                          style={{ padding: '4px 7px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--accent-cyan)' }}
                        >
                          {token}
                        </code>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                    {THEME_TEXT_FIELDS.map(field => (
                      <div className="meta-input-group" key={field.key}>
                        <label>{field.label}</label>
                        {field.multiline ? (
                          <textarea
                            className="meta-field"
                            style={{ height: '92px', resize: 'vertical' }}
                            value={(settings.themeText && settings.themeText[field.key]) || ''}
                            onChange={(e) => updateThemeText(field.key, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        ) : (
                          <input
                            type={field.type || 'text'}
                            className="meta-field"
                            value={(settings.themeText && settings.themeText[field.key]) || ''}
                            onChange={(e) => updateThemeText(field.key, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    className="solid-btn"
                    style={{ alignSelf: 'flex-start', marginTop: '20px' }}
                    onClick={() => saveSettings(settings)}
                  >
                    Save Theme Copy
                  </button>
                </div>
              </div>
            )}

            {/* Publisher Tab */}
            {activeTab === 'publisher' && (
              <div>
                <div className="panel-header">
                  <div className="panel-title">
                    <h2>Publisher Center & Git Deployer</h2>
                    <p>Compile static posts, review logs, and push output directly to GitHub.</p>
                  </div>
                </div>

                <div className="publisher-layout">
                  <div className="brand-settings-card" style={{ height: 'fit-content' }}>
                    <h3 style={{ fontSize: '1.15rem' }}>⚙️ Deployment Variables</h3>

                    <div className="meta-input-group" style={{ marginTop: '10px' }}>
                      <label>GitHub Remote Repository Target</label>
                      <input
                        type="text"
                        className="meta-field"
                        value={deploySettings.remoteUrl}
                        onChange={(e) => setDeploySettings({ ...deploySettings, remoteUrl: e.target.value })}
                        placeholder="git@github.com:user/repo.git"
                        required
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Ensure you have SSH/HTTPS credentials configured locally.
                      </span>
                    </div>

                    <div className="meta-input-group">
                      <label>Target Branch</label>
                      <input
                        type="text"
                        className="meta-field"
                        value={deploySettings.branch}
                        onChange={(e) => setDeploySettings({ ...deploySettings, branch: e.target.value })}
                      />
                    </div>

                    <div className="meta-input-group">
                      <label>Commit Message</label>
                      <input
                        type="text"
                        className="meta-field"
                        value={deploySettings.commitMessage}
                        onChange={(e) => setDeploySettings({ ...deploySettings, commitMessage: e.target.value })}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
                      <button
                        className="quick-action-btn"
                        onClick={handleCompile}
                        disabled={isCompiling}
                      >
                        {isCompiling ? '🔧 Compiling HTML...' : '☄️ Run Static SSG Compile'}
                      </button>
                      <button
                        className="solid-btn"
                        style={{ background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-pink) 100%)' }}
                        onClick={handleDeploy}
                        disabled={isDeploying || isCompiling}
                      >
                        {isDeploying ? '🚀 Pushing static branch...' : '🚀 Deploy Static to GitHub'}
                      </button>
                    </div>
                  </div>

                  {/* Terminal Log Console */}
                  <div className="console-card">
                    <div className="console-header">
                      <span>●</span> zenith_press_shell.sh - real-time log logger
                    </div>
                    <div className="console-logs" id="console-logs">
                      {consoleLogs.map((log, i) => {
                        let className = 'log-entry';
                        if (log.includes('[DEPLOY]')) className += ' deploy';
                        if (log.includes('ERROR') || log.includes('Failed') || log.includes('CRITICAL')) className += ' error';
                        if (log.includes('[SYSTEM]')) className += ' system';
                        return <div key={i} className={className}>{log}</div>;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (

          /* Full Screen Markdown Editor Panel */
          <div>
            <div className="panel-header" style={{ marginBottom: '20px' }}>
              <div className="panel-title">
                <h2>{editingPost.isNew ? 'Compose New Article' : `Editing: "${editingPost.title}"`}</h2>
                <p>Support standard Markdown syntax, custom tags, categories, and cover picture drops.</p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="text-btn"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                  onClick={() => setIsEditingPost(false)}
                >
                  Cancel
                </button>
                <button className="quick-action-btn" onClick={handleSavePost}>
                  💾 Save Post File
                </button>
              </div>
            </div>

            {/* Post Metadata Inputs bar */}
            <div className="meta-panel-grid">
              <div className="meta-input-group">
                <label>Article Title</label>
                <input
                  type="text"
                  className="meta-field"
                  value={editingPost.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    const slug = sanitizeSlugInput(title);
                    setEditingPost(prev => ({
                      ...prev,
                      title,
                      slug: prev.isNew ? slug : prev.slug // auto-slug on creation
                    }));
                  }}
                  placeholder="Enter title..."
                  required
                />
              </div>
              <div className="meta-input-group">
                <label>URL Slug Path</label>
                <input
                  type="text"
                  className="meta-field"
                  value={editingPost.slug}
                  onChange={(e) => setEditingPost({ ...editingPost, slug: sanitizeSlugInput(e.target.value) })}
                  placeholder="hello-world"
                  disabled={!editingPost.isNew} // Lock slug on edit to prevent routing breaks
                  required
                />
              </div>
              <div className="meta-input-group">
                <label>Category</label>
                <select
                  className="meta-field"
                  value={editingPost.category}
                  onChange={(e) => setEditingPost({ ...editingPost, category: e.target.value })}
                >
                  {categories.map(category => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="meta-input-group">
                <label>Tags (Comma separated)</label>
                <input
                  type="text"
                  className="meta-field"
                  value={editingPost.tags}
                  onChange={(e) => setEditingPost({ ...editingPost, tags: e.target.value })}
                  placeholder="Static, Web, CSS"
                />
              </div>
              <div className="meta-input-group">
                <label>Publication Date</label>
                <input
                  type="date"
                  className="meta-field"
                  value={editingPost.date}
                  onChange={(e) => setEditingPost({ ...editingPost, date: e.target.value })}
                />
              </div>
            </div>

            <div className="meta-panel-grid" style={{ gridTemplateColumns: '2fr 1fr', padding: '15px 24px', marginTop: '-15px' }}>
              <div className="meta-input-group">
                <label>Cover Photo URL or Drop Upload</label>
                <div className="avatar-preview-container">
                  {editingPost.coverImage && <img src={editingPost.coverImage} className="avatar-preview" style={{ borderRadius: '8px' }} />}
                  <input
                    type="text"
                    className="meta-field"
                    style={{ flexGrow: 1 }}
                    value={editingPost.coverImage}
                    onChange={(e) => setEditingPost({ ...editingPost, coverImage: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                  />
                  <input
                    type="file"
                    accept="image/*"
                    style={{ fontSize: '0.75rem', width: '180px', color: 'var(--text-secondary)' }}
                    onChange={(e) => handleImageUpload(e.target.files[0], 'post')}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingPost.draft}
                    onChange={(e) => setEditingPost({ ...editingPost, draft: e.target.checked })}
                  />
                  <span>Save as Draft (Excludes from static compile builds)</span>
                </label>
              </div>
            </div>

            {/* Split Screen Panel */}
            <div className="editor-container" style={{ marginTop: '20px' }}>

              {/* Left pane: Markdown typing */}
              <div className="editor-left">
                <div className="editor-card">
                  <div className="editor-card-header">
                    <span>📝 MARKDOWN EDITOR PANEL</span>
                    <div className="editor-toolbar">
                      <button className="toolbar-btn" onClick={() => insertMarkdown('bold')} title="Bold"><b>B</b></button>
                      <button className="toolbar-btn" onClick={() => insertMarkdown('italic')} title="Italic"><i>I</i></button>
                      <button className="toolbar-btn" onClick={() => insertMarkdown('link')} title="Insert Link">🔗</button>
                      <button className="toolbar-btn" onClick={() => insertMarkdown('code')} title="Code Block"><code>&lt;/&gt;</code></button>
                      <button className="toolbar-btn" onClick={() => insertMarkdown('quote')} title="Quote">❝</button>
                      <button
                        className="toolbar-btn"
                        title="Upload & Insert Inline Image"
                        onClick={() => document.getElementById('inline-image-uploader').click()}
                      >
                        📷
                      </button>
                      <input
                        type="file"
                        id="inline-image-uploader"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleImageUpload(e.target.files[0], 'inline');
                            e.target.value = ''; // Reset
                          }
                        }}
                      />
                    </div>
                  </div>
                  <textarea
                    id="editor-textarea"
                    className="editor-textarea"
                    value={editingPost.content}
                    onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                    placeholder="Write your article in Markdown syntax here..."
                  />
                </div>
              </div>

              {/* Right pane: Compiled Preview */}
              <div className="editor-right">
                <div className="editor-card">
                  <div className="editor-card-header">
                    <span>⚡ LIVE PREVIEW (COMPILED HTML)</span>
                  </div>
                  <div
                    className="preview-body markdown-body"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
