# ZenithPress

> A database-free static blogging platform with a local React admin dashboard, Markdown content, switchable EJS themes, generated search, and GitHub Pages deployment.

## Features

- **Markdown content store**: The main website uses `content/posts/` and `content/settings.json`; additional websites use isolated `sites/<id>/content/` workspaces.
- **Multi-website admin**: Select or create websites from the admin sidebar, edit each site independently, compile to its own output folder, and deploy each one to its own GitHub repository.
- **Local admin dashboard**: The `/admin` React app manages posts, settings, themes, widgets, publishing, and deployment.
- **Authenticated local API**: Login issues an expiring bearer token, and all non-login `/api/*` routes require it.
- **Safer static compiler**: Markdown is sanitized before template injection, slugs are validated, and output paths are constrained to the expected folders.
- **Optional public features**: Search, category archives, RSS, mailing-list signup, and About Me blocks can be toggled from Settings.
- **First-class categories**: Categories are configurable records with stable slugs, names, descriptions, and colors. Publish generates category archive pages under `out/categories/<slug>/`, category links in post metadata, category navigation, sitemap entries, LLM Markdown alternates, RSS categories, and Schema.org collection metadata.
- **Client-side search**: When enabled, publish generates `out/search.json` and `out/search.js`, and every index template renders a search box that filters visible posts and shows linked results.
- **Multilingual public UI**: The website locale controls built-in theme labels, date/time formatting, search text, newsletter copy, footer copy, and default widget labels. Post content is left exactly as authored.
- **SEO and AI discovery output**: Generated pages include canonical metadata, Open Graph/Twitter tags, Schema.org JSON-LD, semantic dates, optional `feed.xml`, `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, and Markdown alternates for LLM-friendly reading.
- **Google Analytics consent flow**: Add a GA4 `G-...` measurement ID to emit a localized consent dialog, Google Consent Mode defaults, and privacy preference controls on the static site.
- **Configurable newsletter forms**: Newsletter widgets use a static-site-friendly `actionUrl` endpoint. If no endpoint is configured, the generated form is disabled instead of pretending to subscribe.
- **Theme copy overrides**: Public theme text such as search labels, empty states, read-more links, newsletter copy, footer credits, and theme status labels can be overridden from Settings.
- **GitHub Pages deployer**: The local backend deploys the selected website output to a GitHub remote using local Git credentials. Remote URLs, branch names, and commit messages are validated before Git runs.
- **7 visual templates**:
  - `nordic-minimal`
  - `neo-glass`
  - `cyber-monospace`
  - `sunset-vaporwave`
  - `brutalist-newspaper`
  - `lensdigest-magazine`
  - `eco-forest`

## Getting Started

Install dependencies:

```bash
npm install
```

Start the Vite admin client and Express backend:

```bash
npm run dev
```

Default endpoints:

- Public static website: [http://localhost:3001](http://localhost:3001)
- Admin dashboard: [http://localhost:3001/admin](http://localhost:3001/admin)
- Vite dev client: [http://localhost:3000/admin](http://localhost:3000/admin)
- Default admin password: `admin`

## Configuration

Useful environment variables:

```bash
PORT=3001
ADMIN_PASSWORD=admin
ADMIN_SESSION_TTL_MS=28800000
PUBLIC_SITE_URL=https://example.com
BLOGSYSTEM_DATA_DIR=/data
```

Set `ADMIN_PASSWORD` before using the admin dashboard beyond local testing.

`BLOGSYSTEM_DATA_DIR` is optional for local development. Set it on persistent hosts such as Railway when posts, websites, uploads, and compiled output should live outside the deployment image.

## Railway Deployment

This repository includes `railway.toml` so Railway builds the admin bundle with `npm run build`, starts the Express server with `npm start`, and checks `/api/health`.

Recommended Railway variables:

```bash
ADMIN_PASSWORD=<strong-password>
PUBLIC_SITE_URL=https://dev.smallweblab.com
BLOGSYSTEM_DATA_DIR=/data
```

For a persistent multisite admin, add a Railway Volume mounted at `/data`. On first boot, BlogSystem seeds the volume from the bundled `content/` and `sites/` folders if the mounted folders are empty. Future admin edits, uploaded images, generated static output, and the multisite registry then remain on the volume across deployments.

To use `dev.smallweblab.com`, add it as a custom domain on the Railway service under **Settings → Networking → Public Networking**. Railway will provide the exact DNS records to add at your DNS provider: a `CNAME` record for routing and a `TXT` record for ownership verification. Both are required before the domain routes successfully.

Website workspaces are tracked in `sites/registry.json`. The built-in `main` website keeps using the existing `content/` and `out/` folders. New websites created from the admin use:

```text
sites/<id>/content/settings.json
sites/<id>/content/posts/
sites/<id>/content/images/
sites/<id>/out/
```

Each registry entry stores a display name and deployment defaults:

```json
{
  "id": "portfolio",
  "name": "Portfolio",
  "deploy": {
    "remoteUrl": "git@github.com:user/portfolio.git",
    "branch": "gh-pages",
    "commitMessage": "Publish: Static Pages Deploy"
  }
}
```

Locale is a top-level setting inside each website's `settings.json`:

```json
{
  "locale": "en",
  "features": {
    "search": true,
    "newsletter": true,
    "about": true,
    "rss": true,
    "categories": true
  },
  "categories": [
    {
      "slug": "design",
      "name": "Design",
      "description": "Visual design, brand systems, typography, and creative direction.",
      "color": "#a855f7"
    }
  ],
  "analytics": {
    "googleMeasurementId": ""
  },
  "siteUrl": "https://example.com",
  "seoDescription": "A short public description for search and social previews.",
  "seoKeywords": "design, development, static blog",
  "seoImage": "/content/images/social-card.jpg",
  "allowIndexing": true
}
```

The `features` flags control public output. Disabled search omits the search UI, `search.css`, `search.js`, `search.json`, and Schema.org `SearchAction`. Disabled categories omit category navigation, `taxonomy.css`, and generated category archive pages. Disabled RSS omits `feed.xml` and feed discovery links. Disabled newsletter or about features hide matching widgets even if those widgets remain enabled in the widget list.

Google Analytics is optional. Set `analytics.googleMeasurementId` to a GA4 measurement ID such as `G-XXXXXXXXXX` to publish:

- `<meta name="google-analytics-id">`
- `consent.css` and `consent.js`
- a localized analytics consent dialog
- a persistent Privacy preferences button

The generated script uses Google Consent Mode with analytics storage denied by default, denies advertising storage, user data, and personalization, and only grants analytics storage after the visitor accepts optional analytics. If the field is blank or invalid, no analytics or consent assets are emitted.

Posts store their category as the category `slug` in front matter:

```yaml
category: "design"
```

The public templates display the configured category `name`, so category labels can be renamed without changing post front matter or public category URLs. Slugs are locked in the admin while posts still use that category.

Newsletter widgets support:

```json
{
  "type": "newsletter",
  "placeholderText": "Enter your email...",
  "actionUrl": "https://your-form-provider.example/subscribe"
}
```

The generated static site submits a single `email` field with `method="post"` to `actionUrl`.

Supported website locales are `en`, `es`, `ca`, and `zh`. Locale is stored as `locale` in each website's `settings.json` and can be changed from **Site Settings** in the admin. Theme defaults and exact default widget labels are localized; custom copy overrides and Markdown post content are not machine-translated.

Set `siteUrl` or `PUBLIC_SITE_URL` before publishing a production site. The compiler uses that base URL for canonical links, Open Graph URLs, Schema.org identifiers, sitemap entries, and LLM discovery links. If it is omitted, the site still builds, but absolute discovery URLs are intentionally left blank or relative.

Theme text overrides are stored under `themeText` in `content/settings.json`. Empty strings use the active template's default wording. Dynamic variables can be used in theme copy, `siteSubtitle`, `authorBio`, widget titles, newsletter placeholders, and custom HTML widgets:

```json
{
  "themeText": {
    "searchLabel": "Search Notes from {year}",
    "emptyState": "No essays yet.",
    "newsletterDescription": "Get new essays by email. Latest: {lastPostTitle}",
    "footerCreditText": "ZenithPress"
  }
}
```

Supported variables include:

- `{date}`, `{time}`, `{generatedAt}`, `{isoDate}`, `{year}`, `{month}`, `{day}`
- `{locale}`, `{language}`, `{siteName}`, `{siteSubtitle}`, `{authorName}`, `{authorBio}`, `{template}`, `{homeUrl}`, `{postCount}`, `{categoryCount}`, `{categories}`
- `{category}`, `{categoryName}`, `{categorySlug}`, `{categoryDescription}`, `{categoryUrl}`
- `{lastPost}`, `{lastPostUrl}`, `{lastPostTitle}`, `{lastPostDescription}`, `{lastPostDate}`, `{lastPostIsoDate}`, `{lastPostCategory}`, `{lastPostCategoryUrl}`, `{lastPostTags}`, `{lastPostReadingTime}`
- `{post}`, `{postUrl}`, `{postTitle}`, `{postDescription}`, `{postDate}`, `{postIsoDate}`, `{postCategory}`, `{postCategoryUrl}`, `{postTags}`, `{postReadingTime}`

`{date}`, `{time}`, `{generatedAt}`, `{month}`, `{lastPostDate}`, and `{postDate}` use the website locale. `{lastPost}` is the generated URL for the newest published post. `{post*}` variables resolve on individual post pages and are blank on index pages.

## Static Publishing

Select a website in the admin sidebar, then click **Compile** in the dashboard or send an authenticated `POST /api/publish` with `X-Zenith-Site: <id>`.

The compiler:

- Cleans the selected website output folder while preserving its `.git` directory.
- Reads non-draft Markdown posts.
- Sanitizes rendered Markdown HTML.
- Generates `index.html`, clean post URLs under `posts/<slug>/index.html`, optional category archives under `categories/<slug>/index.html`, Markdown alternates under `index.html.md`, optional search assets, optional analytics consent assets, optional `feed.xml`, `sitemap.xml`, `robots.txt`, `llms.txt`, and `llms-full.txt`.
- Adds Schema.org `WebSite`, `Blog`, `BlogPosting`, `CollectionPage`, `ItemList`, `Person`, `Organization`, and `BreadcrumbList` JSON-LD where relevant.
- Copies the selected template stylesheet, optional shared search stylesheet/script, optional shared taxonomy stylesheet, optional shared consent stylesheet/script, favicon, and uploaded images.

Click **Deploy** in the dashboard or send an authenticated `POST /api/deploy` with `X-Zenith-Site: <id>`.

The deployer only accepts GitHub SSH/HTTPS remotes, safe branch names, and bounded commit messages. It runs Git through argument arrays, not shell interpolation. Each website output folder is its own local Git workspace, so different websites can target different repositories without remote collisions.

## Project Structure

```text
content/                 Blog settings, posts, and uploaded images
sites/                   Multi-website registry and extra website workspaces
src/                     React admin dashboard
templates/               EJS themes plus shared search/taxonomy/consent assets
out/                     Generated static site output
dist/                    Built admin dashboard bundle
server.js                Express API, compiler, and deployer
vite.config.js           Vite config and local API proxy
```

`dist/`, `out/`, `sites/*/out/`, and `node_modules/` are ignored because they are generated artifacts.
