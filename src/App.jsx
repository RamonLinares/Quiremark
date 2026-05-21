import React, { useState, useEffect } from 'react';
import { marked } from 'marked';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
    category: 'Design',
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

  // Initialize
  useEffect(() => {
    const token = localStorage.getItem('zenith_token');
    if (token) {
      setIsLoggedIn(true);
      fetchData();
    }
  }, [isLoggedIn]);

  const fetchData = async () => {
    try {
      const settingsRes = await fetch('/api/settings');
      const settingsData = await settingsRes.json();
      setSettings(settingsData);
      if (settingsData.socialLinks?.github) {
        setDeploySettings(prev => ({
          ...prev,
          remoteUrl: settingsData.socialLinks.github + '.git'
        }));
      }

      const postsRes = await fetch('/api/posts');
      const postsData = await postsRes.json();
      setPosts(postsData);
    } catch (err) {
      logMsg('Failed to sync settings and post databases from local Express server.', 'error');
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
        localStorage.setItem('zenith_token', data.token);
        setIsLoggedIn(true);
        setAuthError('');
      } else {
        setAuthError(data.message || 'Invalid password.');
      }
    } catch (err) {
      setAuthError('Connection to local Express server failed.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zenith_token');
    setIsLoggedIn(false);
  };

  // Settings Save handler
  const saveSettings = async (updatedSettings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      const data = await res.json();
      if (data.success) {
        setSettings(updatedSettings);
        logMsg('Settings configuration saved locally.');
      }
    } catch (err) {
      logMsg('Failed to save settings configurations.', 'error');
    }
  };

  // Image base64 upload helper
  const handleImageUpload = async (file, type) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/images/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            base64Data: reader.result
          })
        });
        const data = await res.json();
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
        logMsg('Image upload failed.', 'error');
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

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingPost,
          tags: typeof editingPost.tags === 'string' 
            ? editingPost.tags.split(',').map(t => t.trim()) 
            : editingPost.tags
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setIsEditingPost(false);
        fetchData();
        logMsg(`Article post saved: "${editingPost.title}"`);
      } else {
        logMsg(data.error || 'Failed to save post.', 'error');
      }
    } catch (err) {
      logMsg('Error saving post.', 'error');
    }
  };

  // Delete Post
  const handleDeletePost = async (slug) => {
    if (!window.confirm(`Are you sure you want to delete the post "${slug}"?`)) return;
    try {
      const res = await fetch(`/api/posts/${slug}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchData();
        logMsg(`Article post deleted: "${slug}"`);
      }
    } catch (err) {
      logMsg('Failed to delete post.', 'error');
    }
  };

  // Compile SSG
  const handleCompile = async () => {
    setIsCompiling(true);
    setActiveTab('publisher');
    logMsg('Initiating static pages compiler...');
    try {
      const res = await fetch('/api/publish', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        // Stream build logs
        data.log.forEach(l => logMsg(l));
        logMsg('Static compilation finished. Local build stored in /out directory.', 'system');
      } else {
        logMsg(data.error || 'Compilation failed.', 'error');
      }
    } catch (err) {
      logMsg('Compilation request failed.', 'error');
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
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deploySettings)
      });
      const data = await res.json();
      
      // Stream deploy logs
      data.log.forEach(l => logMsg(l, 'deploy'));
      
      if (data.success) {
        logMsg(`Deployment completed successfully! Pushed static pages to ${deploySettings.branch}.`);
        alert('Blog successfully published and deployed to GitHub Pages!');
      } else {
        logMsg(data.error || 'Deploy failed.', 'error');
        alert(`Deploy failed: ${data.error}`);
      }
    } catch (err) {
      logMsg('Deploy request failed.', 'error');
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
                      Switch themes instantly in the Appearance tab. You can toggle between <b>NordicMinimal</b> (clean grid light), <b>NeoGlass</b> (dark visual depth), and <b>CyberMonospace</b> (retro monochrome terminal).
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
                        category: 'Design',
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
                            <span className="tag-badge">{post.category}</span>
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
                          {widget.type === 'newsletter' && widget.enabled && (
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
                    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
                  onChange={(e) => setEditingPost({ ...editingPost, slug: e.target.value })}
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
                  <option value="Design">Design</option>
                  <option value="Development">Development</option>
                  <option value="Creative">Creative</option>
                  <option value="Tech">Tech</option>
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
                    dangerouslySetInnerHTML={{ __html: marked.parse(editingPost.content || '*Empty post draft...*') }}
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
