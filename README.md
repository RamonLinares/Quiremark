# ZenithPress

> A database-free static blogging platform with a local React admin dashboard, Markdown content, switchable EJS themes, generated search, and GitHub Pages deployment.

## Features

- **Markdown content store**: Posts live in `content/posts/`; site settings live in `content/settings.json`.
- **Local admin dashboard**: The `/admin` React app manages posts, settings, themes, widgets, publishing, and deployment.
- **Authenticated local API**: Login issues an expiring bearer token, and all non-login `/api/*` routes require it.
- **Safer static compiler**: Markdown is sanitized before template injection, slugs are validated, and output paths are constrained to the expected folders.
- **Client-side search**: Publish generates `out/search.json` and `out/search.js`, and every index template renders a search box that filters visible posts and shows linked results.
- **Multilingual public UI**: The website locale controls built-in theme labels, date/time formatting, search text, newsletter copy, footer copy, and default widget labels. Post content is left exactly as authored.
- **SEO and AI discovery output**: Generated pages include canonical metadata, Open Graph/Twitter tags, Schema.org JSON-LD, semantic dates, `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, and Markdown alternates for LLM-friendly reading.
- **Configurable newsletter forms**: Newsletter widgets use a static-site-friendly `actionUrl` endpoint. If no endpoint is configured, the generated form is disabled instead of pretending to subscribe.
- **Theme copy overrides**: Public theme text such as search labels, empty states, read-more links, newsletter copy, footer credits, and theme status labels can be overridden from Settings.
- **GitHub Pages deployer**: The local backend deploys `out/` to a GitHub remote using local Git credentials. Remote URLs, branch names, and commit messages are validated before Git runs.
- **6 visual templates**:
  - `nordic-minimal`
  - `neo-glass`
  - `cyber-monospace`
  - `sunset-vaporwave`
  - `brutalist-newspaper`
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
```

Set `ADMIN_PASSWORD` before using the admin dashboard beyond local testing.

Locale is a top-level site setting:

```json
{
  "locale": "en",
  "siteUrl": "https://example.com",
  "seoDescription": "A short public description for search and social previews.",
  "seoKeywords": "design, development, static blog",
  "seoImage": "/content/images/social-card.jpg",
  "allowIndexing": true
}
```

Newsletter widgets support:

```json
{
  "type": "newsletter",
  "placeholderText": "Enter your email...",
  "actionUrl": "https://your-form-provider.example/subscribe"
}
```

The generated static site submits a single `email` field with `method="post"` to `actionUrl`.

Supported website locales are `en`, `es`, `fr`, `de`, and `pt`. Locale is stored as `locale` in `content/settings.json` and can be changed from **Site Settings** in the admin. Theme defaults and exact default widget labels are localized; custom copy overrides and Markdown post content are not machine-translated.

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
- `{locale}`, `{language}`, `{siteName}`, `{siteSubtitle}`, `{authorName}`, `{authorBio}`, `{template}`, `{homeUrl}`, `{postCount}`
- `{lastPost}`, `{lastPostUrl}`, `{lastPostTitle}`, `{lastPostDescription}`, `{lastPostDate}`, `{lastPostIsoDate}`, `{lastPostCategory}`, `{lastPostTags}`, `{lastPostReadingTime}`
- `{post}`, `{postUrl}`, `{postTitle}`, `{postDescription}`, `{postDate}`, `{postIsoDate}`, `{postCategory}`, `{postTags}`, `{postReadingTime}`

`{date}`, `{time}`, `{generatedAt}`, `{month}`, `{lastPostDate}`, and `{postDate}` use the website locale. `{lastPost}` is the generated URL for the newest published post. `{post*}` variables resolve on individual post pages and are blank on index pages.

## Static Publishing

Click **Compile** in the dashboard or send an authenticated `POST /api/publish`.

The compiler:

- Cleans `out/` while preserving `out/.git`.
- Reads non-draft Markdown posts.
- Sanitizes rendered Markdown HTML.
- Generates `index.html`, clean post URLs under `out/posts/<slug>/index.html`, Markdown alternates under `index.html.md`, `search.json`, `search.js`, `sitemap.xml`, `robots.txt`, `llms.txt`, and `llms-full.txt`.
- Adds Schema.org `WebSite`, `Blog`, `BlogPosting`, `Person`, `Organization`, and `BreadcrumbList` JSON-LD where relevant.
- Copies the selected template stylesheet, shared search stylesheet/script, favicon, and uploaded images.

Click **Deploy** in the dashboard or send an authenticated `POST /api/deploy`.

The deployer only accepts GitHub SSH/HTTPS remotes, safe branch names, and bounded commit messages. It runs Git through argument arrays, not shell interpolation.

## Project Structure

```text
content/                 Blog settings, posts, and uploaded images
src/                     React admin dashboard
templates/               EJS themes plus shared search.js
out/                     Generated static site output
dist/                    Built admin dashboard bundle
server.js                Express API, compiler, and deployer
vite.config.js           Vite config and local API proxy
```

`dist/`, `out/`, and `node_modules/` are ignored because they are generated artifacts.
