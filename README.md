# ZenithPress

> A database-free static blogging platform with a local React admin dashboard, Markdown content, switchable EJS themes, generated search, and GitHub Pages deployment.

## Features

- **Markdown content store**: Posts live in `content/posts/`; site settings live in `content/settings.json`.
- **Local admin dashboard**: The `/admin` React app manages posts, settings, themes, widgets, publishing, and deployment.
- **Authenticated local API**: Login issues an expiring bearer token, and all non-login `/api/*` routes require it.
- **Safer static compiler**: Markdown is sanitized before template injection, slugs are validated, and output paths are constrained to the expected folders.
- **Client-side search**: Publish generates `out/search.json` and `out/search.js`, and every index template renders a search box that filters visible posts and shows linked results.
- **Configurable newsletter forms**: Newsletter widgets use a static-site-friendly `actionUrl` endpoint. If no endpoint is configured, the generated form is disabled instead of pretending to subscribe.
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
```

Set `ADMIN_PASSWORD` before using the admin dashboard beyond local testing.

Newsletter widgets support:

```json
{
  "type": "newsletter",
  "placeholderText": "Enter your email...",
  "actionUrl": "https://your-form-provider.example/subscribe"
}
```

The generated static site submits a single `email` field with `method="post"` to `actionUrl`.

## Static Publishing

Click **Compile** in the dashboard or send an authenticated `POST /api/publish`.

The compiler:

- Cleans `out/` while preserving `out/.git`.
- Reads non-draft Markdown posts.
- Sanitizes rendered Markdown HTML.
- Generates `index.html`, clean post URLs under `out/posts/<slug>/index.html`, `search.json`, and `search.js`.
- Copies the selected template stylesheet and uploaded images.

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
