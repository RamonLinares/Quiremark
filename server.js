import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fm from 'front-matter';
import { marked } from 'marked';
import { execFile } from 'child_process';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Load environmental variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS || 8 * 60 * 60 * 1000);
const sessionStore = new Map();
const { window } = new JSDOM('');
const DOMPurify = createDOMPurify(window);

const SAFE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_BRANCH_RE = /^(?!.*\.\.)(?!.*\/\/)(?!.*@\{)(?!\/)(?!.*\/$)[A-Za-z0-9._/-]{1,128}$/;
const SAFE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']);

// Middleware configurations
app.use(cors({
  origin(origin, callback) {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  }
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Setup folder paths
const CONTENT_DIR = path.join(__dirname, 'content');
const POSTS_DIR = path.join(CONTENT_DIR, 'posts');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const OUT_DIR = path.join(__dirname, 'out');
const COMMON_SEARCH_SCRIPT = path.join(TEMPLATES_DIR, 'search.js');

// Ensure necessary directories exist on startup
[CONTENT_DIR, POSTS_DIR, IMAGES_DIR, OUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve frontend assets and public content with cache disabling to prevent browser cache traps during testing
const serveNoCache = (dir) => express.static(dir, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
});

app.use(serveNoCache(path.join(__dirname, 'out'))); // Compiled static public site at root
app.use('/admin', serveNoCache(path.join(__dirname, 'dist'))); // Admin dashboard SPA at /admin
app.use('/content/images', serveNoCache(IMAGES_DIR)); // Decoded images



// Setup initial settings if not present
const SETTINGS_FILE = path.join(CONTENT_DIR, 'settings.json');
if (!fs.existsSync(SETTINGS_FILE)) {
  const defaultSettings = {
    siteName: "Zenith Press",
    siteSubtitle: "Explorations in Design, Art & Technology",
    authorName: "Aara Dev",
    authorBio: "Designer and coder.",
    authorAvatar: "",
    socialLinks: { github: "", twitter: "", linkedin: "", instagram: "" },
    selectedTemplate: "nordic-minimal",
    widgets: [
      { id: "bio", name: "About Me", type: "bio", enabled: true, position: "sidebar", order: 1 },
      { id: "recent-posts", name: "Recent Posts", type: "recent-posts", enabled: true, position: "sidebar", order: 2 },
      { id: "tag-cloud", name: "Topics", type: "tag-cloud", enabled: true, position: "sidebar", order: 3 },
      {
        id: "newsletter",
        name: "Newsletter",
        type: "newsletter",
        enabled: true,
        position: "footer",
        order: 4,
        placeholderText: "Enter your email...",
        actionUrl: ""
      }
    ]
  };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2), 'utf-8');
}

// ----------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------

// Calculate reading time
function calculateReadingTime(text) {
  const wordsPerMinute = 200;
  const numberOfWords = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(numberOfWords / wordsPerMinute);
}

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel']
  });
}

function renderMarkdown(markdown) {
  return sanitizeHtml(marked.parse(String(markdown || '')));
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function isValidSlug(slug) {
  return SAFE_SLUG_RE.test(String(slug || ''));
}

function assertValidSlug(slug) {
  if (!isValidSlug(slug)) {
    const err = new Error('Slug must use lowercase letters, numbers, and single hyphens only.');
    err.statusCode = 400;
    throw err;
  }
}

function resolveInside(baseDir, ...segments) {
  const basePath = path.resolve(baseDir);
  const targetPath = path.resolve(basePath, ...segments);
  if (targetPath !== basePath && !targetPath.startsWith(`${basePath}${path.sep}`)) {
    const err = new Error('Resolved path escaped the allowed directory.');
    err.statusCode = 400;
    throw err;
  }
  return targetPath;
}

function postFilePath(slug) {
  assertValidSlug(slug);
  return resolveInside(POSTS_DIR, `${slug}.md`);
}

function postOutputDir(slug) {
  assertValidSlug(slug);
  return resolveInside(path.join(OUT_DIR, 'posts'), slug);
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map(tag => String(tag).trim()).filter(Boolean);
  }
  if (typeof tags === 'string') {
    return tags.split(',').map(tag => tag.trim()).filter(Boolean);
  }
  return [];
}

function normalizeActionUrl(actionUrl) {
  const value = String(actionUrl || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? value : '';
  } catch {
    return '';
  }
}

function normalizeWidget(widget = {}) {
  return {
    ...widget,
    id: String(widget.id || `${widget.type || 'widget'}-${Date.now()}`),
    name: String(widget.name || widget.type || 'Widget'),
    type: String(widget.type || 'custom-html'),
    enabled: widget.enabled !== false,
    position: widget.position === 'footer' ? 'footer' : 'sidebar',
    order: Number.isFinite(Number(widget.order)) ? Number(widget.order) : 99,
    placeholderText: widget.placeholderText || '',
    actionUrl: normalizeActionUrl(widget.actionUrl),
    htmlContent: widget.htmlContent || ''
  };
}

function normalizeSettings(settings = {}) {
  return {
    siteName: String(settings.siteName || 'Zenith Press'),
    siteSubtitle: String(settings.siteSubtitle || ''),
    authorName: String(settings.authorName || ''),
    authorBio: String(settings.authorBio || ''),
    authorAvatar: String(settings.authorAvatar || ''),
    socialLinks: {
      github: settings.socialLinks?.github || '',
      twitter: settings.socialLinks?.twitter || '',
      linkedin: settings.socialLinks?.linkedin || '',
      instagram: settings.socialLinks?.instagram || ''
    },
    selectedTemplate: String(settings.selectedTemplate || 'nordic-minimal'),
    widgets: Array.isArray(settings.widgets) ? settings.widgets.map(normalizeWidget) : []
  };
}

function readSettings() {
  return normalizeSettings(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')));
}

function normalizePost(attributes = {}, body = '', fileName = '') {
  const fileSlug = slugify(path.basename(fileName, path.extname(fileName)));
  const title = String(attributes.title || 'Untitled Post');
  const slug = slugify(attributes.slug || fileSlug || title);
  return {
    title,
    slug: isValidSlug(slug) ? slug : fileSlug || slugify(title) || 'untitled-post',
    description: String(attributes.description || ''),
    date: String(attributes.date || new Date().toISOString().split('T')[0]),
    category: String(attributes.category || 'Uncategorized'),
    tags: normalizeTags(attributes.tags),
    coverImage: String(attributes.coverImage || ''),
    draft: attributes.draft === true,
    content: String(body || ''),
    readingTime: calculateReadingTime(body),
    fileName
  };
}

function normalizePostPayload(body = {}) {
  const title = String(body.title || '').trim();
  const slug = String(body.slug || '').trim();
  if (!title || !slug) {
    const err = new Error('Title and Slug are required.');
    err.statusCode = 400;
    throw err;
  }
  assertValidSlug(slug);
  return {
    title,
    slug,
    description: String(body.description || ''),
    date: String(body.date || new Date().toISOString().split('T')[0]),
    category: String(body.category || 'Uncategorized'),
    tags: normalizeTags(body.tags),
    coverImage: String(body.coverImage || ''),
    content: String(body.content || ''),
    draft: body.draft === true
  };
}

function serializePostMarkdown(post) {
  return [
    '---',
    `title: ${JSON.stringify(post.title)}`,
    `slug: ${JSON.stringify(post.slug)}`,
    `description: ${JSON.stringify(post.description)}`,
    `date: ${JSON.stringify(post.date)}`,
    `category: ${JSON.stringify(post.category)}`,
    `tags: ${JSON.stringify(post.tags)}`,
    `coverImage: ${JSON.stringify(post.coverImage)}`,
    `draft: ${post.draft === true}`,
    '---',
    '',
    post.content
  ].join('\n');
}

// Read and parse all posts
function getAllPosts(includeDrafts = true) {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR);
  const posts = files
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const filePath = path.join(POSTS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = fm(content);
      
      return normalizePost(parsed.attributes, parsed.body, file);
    });

  // Sort by date descending
  return posts
    .filter(post => includeDrafts || !post.draft)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function runCommand(command, args = [], cwd = __dirname) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (session.expiresAt <= now) {
      sessionStore.delete(token);
    }
  }
}

function createSessionToken() {
  cleanupExpiredSessions();
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessionStore.set(token, { expiresAt });
  return { token, expiresAt };
}

function requireAuth(req, res, next) {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }
  const auth = req.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const session = sessionStore.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessionStore.delete(token);
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  next();
}

function validateRemoteUrl(remoteUrl) {
  const value = String(remoteUrl || '').trim();
  const githubSsh = /^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/;
  const githubHttps = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/;
  if (!githubSsh.test(value) && !githubHttps.test(value)) {
    const err = new Error('Remote URL must be a GitHub SSH or HTTPS repository URL.');
    err.statusCode = 400;
    throw err;
  }
  return value;
}

function validateBranch(branch) {
  const value = String(branch || 'gh-pages').trim();
  if (!SAFE_BRANCH_RE.test(value) || value.endsWith('.lock')) {
    const err = new Error('Branch name contains unsupported characters.');
    err.statusCode = 400;
    throw err;
  }
  return value;
}

function validateCommitMessage(message) {
  const value = String(message || 'Publish: Static Pages Deploy').trim();
  if (!value || value.length > 160 || /[\r\n\0]/.test(value)) {
    const err = new Error('Commit message must be 1-160 characters without control characters.');
    err.statusCode = 400;
    throw err;
  }
  return value;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Authentication endpoint
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const { token, expiresAt } = createSessionToken();
    res.json({ success: true, token, expiresAt });
  } else {
    res.status(401).json({ success: false, message: 'Invalid administrative credential password.' });
  }
});

app.use('/api', requireAuth);

// Fetch settings
app.get('/api/settings', (req, res) => {
  try {
    res.json(readSettings());
  } catch (err) {
    res.status(500).json({ error: 'Failed to read settings configuration.' });
  }
});

// Update settings
app.post('/api/settings', (req, res) => {
  try {
    const settings = normalizeSettings(req.body);
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write settings configuration.' });
  }
});

// Fetch all posts (for admin view)
app.get('/api/posts', (req, res) => {
  try {
    const posts = getAllPosts(true);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts.' });
  }
});

// Fetch a single post
app.get('/api/posts/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const filePath = postFilePath(slug);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = fm(content);
    const post = normalizePost(parsed.attributes, parsed.body, `${slug}.md`);
    res.json({
      meta: { ...post, content: undefined },
      content: post.content
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to fetch post.' });
  }
});

// Create new post
app.post('/api/posts', (req, res) => {
  try {
    const post = normalizePostPayload(req.body);
    const filePath = postFilePath(post.slug);
    if (fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'A post with this slug already exists.' });
    }

    fs.writeFileSync(filePath, serializePostMarkdown(post), 'utf-8');
    res.json({ success: true, message: 'Post created successfully.' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to create post.' });
  }
});

// Update post
app.put('/api/posts/:slug', (req, res) => {
  try {
    const oldSlug = req.params.slug;
    assertValidSlug(oldSlug);
    const post = normalizePostPayload(req.body);
    const oldFilePath = postFilePath(oldSlug);
    const newFilePath = postFilePath(post.slug);

    if (!fs.existsSync(oldFilePath)) {
      return res.status(404).json({ error: 'Original post not found.' });
    }

    // Handle slug change
    if (oldSlug !== post.slug && fs.existsSync(newFilePath)) {
      return res.status(400).json({ error: 'A post with the new slug already exists.' });
    }

    // If slug changed, delete the old file
    if (oldSlug !== post.slug) {
      fs.unlinkSync(oldFilePath);
    }

    fs.writeFileSync(newFilePath, serializePostMarkdown(post), 'utf-8');
    res.json({ success: true, message: 'Post updated successfully.' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to update post.' });
  }
});

// Delete post
app.delete('/api/posts/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const filePath = postFilePath(slug);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'Post deleted successfully.' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to delete post.' });
  }
});

// Base64 Image Upload
app.post('/api/images/upload', (req, res) => {
  try {
    const { filename, base64Data } = req.body;
    if (!filename || !base64Data) {
      return res.status(400).json({ error: 'Missing filename or image data.' });
    }

    const cleanBase64 = String(base64Data).replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // Save locally
    const ext = path.extname(filename).toLowerCase() || '.jpg';
    if (!SAFE_IMAGE_EXTENSIONS.has(ext)) {
      return res.status(400).json({ error: 'Unsupported image file type.' });
    }
    const uniqueName = `image_${Date.now()}${ext}`;
    const targetPath = resolveInside(IMAGES_DIR, uniqueName);
    
    fs.writeFileSync(targetPath, buffer);
    
    // Return relative URL path
    res.json({
      success: true,
      url: `/content/images/${uniqueName}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save base64 image.' });
  }
});

// ----------------------------------------------------
// STATIC SITE COMPILATION ENGINE
// ----------------------------------------------------
app.post('/api/publish', async (req, res) => {
  const log = [];
  const logMsg = (msg) => { log.push(`[SSG] ${msg}`); console.log(`[SSG] ${msg}`); };

  try {
    logMsg("Starting static compilation pipeline...");

    // 1. Read settings and verified templates
    const settings = readSettings();
    const templateName = settings.selectedTemplate || 'nordic-minimal';
    const activeTemplateDir = resolveInside(TEMPLATES_DIR, templateName);
    
    logMsg(`Selected template structure: "${templateName}"`);

    if (!fs.existsSync(activeTemplateDir)) {
      throw new Error(`Template directory not found: ${templateName}`);
    }

    // 2. Refresh output folder
    if (fs.existsSync(OUT_DIR)) {
      // Clear out older files, keeping .git if present to maintain history
      const files = fs.readdirSync(OUT_DIR);
      files.forEach(f => {
        if (f !== '.git') {
          fs.rmSync(path.join(OUT_DIR, f), { recursive: true, force: true });
        }
      });
      logMsg("Output directory out/ cleaned.");
    } else {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      logMsg("Created output directory out/");
    }

    // 3. Read posts (excl drafts for compilation)
    const posts = getAllPosts(false);
    logMsg(`Found ${posts.length} published posts to compile.`);

    // 4. Render markdown content for each post
    const compiledPosts = posts.map(post => ({
      ...post,
      content: renderMarkdown(post.content)
    }));

    // 5. Load EJS layouts
    const indexEjsPath = path.join(activeTemplateDir, 'index.ejs');
    const postEjsPath = path.join(activeTemplateDir, 'post.ejs');
    
    if (!fs.existsSync(indexEjsPath) || !fs.existsSync(postEjsPath)) {
      throw new Error("Missing index.ejs or post.ejs in templates folder.");
    }

    const indexTemplate = fs.readFileSync(indexEjsPath, 'utf-8');
    const postTemplate = fs.readFileSync(postEjsPath, 'utf-8');

    // 6. Build index/home page
    logMsg("Compiling blog home page (index.html)...");
    
    const homepageData = {
      siteName: settings.siteName,
      siteSubtitle: settings.siteSubtitle,
      authorName: settings.authorName,
      authorBio: settings.authorBio,
      authorAvatar: settings.authorAvatar,
      socialLinks: settings.socialLinks,
      widgets: settings.widgets,
      helpers: { upper: value => String(value || '').toUpperCase() },
      posts: compiledPosts
    };

    // Render using EJS
    // EJS imported as default
    const homeHtml = await import('ejs').then(m => m.default.render(indexTemplate, homepageData));
    fs.writeFileSync(path.join(OUT_DIR, 'index.html'), homeHtml, 'utf-8');
    logMsg("Home page successfully written.");

    // 7. Build individual post pages under out/posts/[slug]/index.html for clean URLs
    const postsOutDir = path.join(OUT_DIR, 'posts');
    if (!fs.existsSync(postsOutDir)) {
      fs.mkdirSync(postsOutDir, { recursive: true });
    }

    for (const post of compiledPosts) {
      logMsg(`Compiling article page: "/posts/${post.slug}"...`);
      const singlePostDir = postOutputDir(post.slug);
      if (!fs.existsSync(singlePostDir)) {
        fs.mkdirSync(singlePostDir, { recursive: true });
      }

      const singlePostData = {
        siteName: settings.siteName,
        siteSubtitle: settings.siteSubtitle,
        authorName: settings.authorName,
        authorBio: settings.authorBio,
        authorAvatar: settings.authorAvatar,
        socialLinks: settings.socialLinks,
        widgets: settings.widgets,
        helpers: { upper: value => String(value || '').toUpperCase() },
        posts: compiledPosts,
        post: post
      };

      const postHtml = await import('ejs').then(m => m.default.render(postTemplate, singlePostData));
      fs.writeFileSync(path.join(singlePostDir, 'index.html'), postHtml, 'utf-8');
    }
    logMsg(`All ${compiledPosts.length} posts compiled successfully.`);

    // 8. Copy active template stylesheets and client assets
    const styleSrc = path.join(activeTemplateDir, 'style.css');
    if (fs.existsSync(styleSrc)) {
      fs.copyFileSync(styleSrc, path.join(OUT_DIR, 'style.css'));
      logMsg("Copied template stylesheet (style.css).");
    }

    const scriptSrc = path.join(activeTemplateDir, 'script.js');
    if (fs.existsSync(scriptSrc)) {
      fs.copyFileSync(scriptSrc, path.join(OUT_DIR, 'script.js'));
      logMsg("Copied template script asset (script.js).");
    }

    if (fs.existsSync(COMMON_SEARCH_SCRIPT)) {
      fs.copyFileSync(COMMON_SEARCH_SCRIPT, path.join(OUT_DIR, 'search.js'));
      logMsg("Copied shared search script (search.js).");
    }

    // 9. Copy uploaded images
    const imagesOutDir = path.join(OUT_DIR, 'content', 'images');
    if (fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(imagesOutDir, { recursive: true });
      const imageFiles = fs.readdirSync(IMAGES_DIR);
      imageFiles.forEach(file => {
        fs.copyFileSync(path.join(IMAGES_DIR, file), path.join(imagesOutDir, file));
      });
      logMsg(`Copied ${imageFiles.length} uploaded images to static assets.`);
    }

    // 10. Generate search JSON index
    logMsg("Building client-side search database (search.json)...");
    const searchIndex = compiledPosts.map(p => ({
      title: p.title,
      slug: p.slug,
      category: p.category,
      description: p.description,
      date: p.date,
      tags: p.tags
    }));
    fs.writeFileSync(path.join(OUT_DIR, 'search.json'), JSON.stringify(searchIndex, null, 2), 'utf-8');
    logMsg("Search database written.");

    logMsg("Static compilation process finished successfully!");
    res.json({ success: true, log });
  } catch (err) {
    logMsg(`CRITICAL SYSTEM COMPILE ERROR: ${err.message}`);
    res.status(500).json({ success: false, error: err.message, log });
  }
});

// ----------------------------------------------------
// GIT DEPLOYMENT CONTROLLER
// ----------------------------------------------------
app.post('/api/deploy', async (req, res) => {
  const { remoteUrl, branch = 'gh-pages', commitMessage = 'Publish: Static Pages Deploy' } = req.body;
  const log = [];
  const logMsg = (msg) => { log.push(`[DEPLOY] ${msg}`); console.log(`[DEPLOY] ${msg}`); };

  try {
    const safeRemoteUrl = validateRemoteUrl(remoteUrl);
    const safeBranch = validateBranch(branch);
    const safeCommitMessage = validateCommitMessage(commitMessage);
    logMsg(`Starting Git Deployment pipeline for branch "${safeBranch}"...`);

    // Ensure out directory exists
    if (!fs.existsSync(OUT_DIR) || fs.readdirSync(OUT_DIR).length <= 1) {
      throw new Error("No static files compiled yet. Run static compilation first.");
    }

    // Check if Git is initialized in out/
    const isGitRepo = fs.existsSync(path.join(OUT_DIR, '.git'));
    if (!isGitRepo) {
      logMsg("Initializing new local Git workspace inside /out...");
      await runCommand('git', ['init'], OUT_DIR);
      await runCommand('git', ['remote', 'add', 'origin', safeRemoteUrl], OUT_DIR);
      logMsg("Workspace successfully initialized with remote target.");
    } else {
      // Update remote just in case it changed
      try {
        await runCommand('git', ['remote', 'set-url', 'origin', safeRemoteUrl], OUT_DIR);
      } catch (err) {
        // If set-url fails because origin doesn't exist
        await runCommand('git', ['remote', 'add', 'origin', safeRemoteUrl], OUT_DIR);
      }
    }

    // Configure credentials locally inside the subfolder so we don't interfere with global configs
    logMsg("Configuring local directory git targets...");
    await runCommand('git', ['config', 'user.name', 'ZenithPress Compiler'], OUT_DIR);
    await runCommand('git', ['config', 'user.email', 'compiler@zenithpress.local'], OUT_DIR);

    // Checkout deployment branch
    try {
      logMsg(`Checking out branch: "${safeBranch}"...`);
      await runCommand('git', ['checkout', '-B', safeBranch], OUT_DIR);
    } catch (err) {
      // If branch checkout fails, create it
      await runCommand('git', ['checkout', '-b', safeBranch], OUT_DIR);
    }

    // Add and commit files
    logMsg("Staging files...");
    await runCommand('git', ['add', '.'], OUT_DIR);

    // Check git status to see if anything changed
    const status = await runCommand('git', ['status', '--porcelain'], OUT_DIR);
    if (!status.trim()) {
      logMsg("No changes detected since last publication.");
      return res.json({ success: true, message: "Static pages are already up-to-date.", log });
    }

    logMsg(`Committing updates: "${safeCommitMessage}"...`);
    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const finalMsg = `${safeCommitMessage} (${dateStr})`;
    await runCommand('git', ['commit', '-m', finalMsg], OUT_DIR);

    // Push to GitHub
    logMsg(`Pushing assets to origin/${safeBranch}...`);
    // Using --force to guarantee hosting files replace whatever is currently in gh-pages
    await runCommand('git', ['push', 'origin', safeBranch, '--force'], OUT_DIR);

    logMsg("Pushed to GitHub Pages successfully!");
    res.json({ success: true, log });
  } catch (err) {
    logMsg(`DEPLOYMENT PIPELINE CRASHED: ${err.message || err.stderr || JSON.stringify(err)}`);
    res.status(err.statusCode || 500).json({ success: false, error: err.message || err.stderr, log });
  }
});

// For index fallback in admin SPA routing
app.get('/admin*', (req, res) => {
  const spaIndex = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(spaIndex)) {
    res.sendFile(spaIndex);
  } else {
    res.status(404).send("ZenithPress Server: Admin panel UI not built yet. Run `npm run build` first.");
  }
});

// Standard public site 404 fallback
app.get('*', (req, res) => {
  res.status(404).send("404: Sector Not Found on ZenithPress Static Blog.");
});

// Run Server
app.listen(PORT, () => {
  console.log(`===========================================================`);
  console.log(` ZenithPress Local Server is listening on port ${PORT}      `);
  console.log(` Access public website at http://localhost:${PORT}         `);
  console.log(` Access admin dashboard at http://localhost:${PORT}/admin  `);
  console.log(`===========================================================`);
});
