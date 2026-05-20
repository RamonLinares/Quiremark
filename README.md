# ☄️ ZenithPress

> A database-free, high-performance static blogging platform featuring a stunning local admin dashboard, customizable aesthetic themes, and one-click GitHub Pages deployment.

---

## ✨ Features

- **Zero-Database Architecture**: Posts are saved as standard Markdown files under `/content/posts/` and configurations are saved in `/content/settings.json`.
- **Desktop-Class Admin Dashboard**: A premium, glassmorphic administrator panel (built with Vite + React) located securely at `/admin` for drafting, categorizing, theme selection, and widget customization.
- **Rich Markdown Editor**: A split-screen drafting environment featuring instant Markdown rendering previews and toolbar helpers (bold, italic, links, code blocks, blockquotes).
- **Zero-Dependency Asset Hub**: Image upload system using Base64 transfer, decoding assets directly into `/content/images/` without heavy database dependencies.
- **Dynamic SSG EJS Compiler**: Automatic compilation of Markdown documents and dynamic active widgets (About Biography, Recent Posts, Tag Cloud, Newsletter subscriptions) into clean-URL pages (e.g. `/posts/slug/index.html`) in `/out`.
- **Programmatic Git Deployer**: Deploys compiled static output forcefuly to the `gh-pages` branch of your GitHub repository using local Git credentials, avoiding insecure PAT token leakage in browsers.
- **3 Visual Aesthetic Templates**:
  - 🏔️ **NordicMinimal**: Serif typography, clean lines, and generous minimalist margins.
  - 🌌 **NeoGlass**: Frosted glassmorphism, dynamic glowing gradients, and CSS micro-animations.
  - 👾 **CyberMonospace**: Monospace green-terminal style, retro scanlines, and pixelated border layouts.

---

## 🛠️ Getting Started

### 1. Installation

Clone this repository to your local machine and install dependencies:
```bash
npm install
```

### 2. Launch Development Servers

Start both the hot-reloading Vite frontend and local Express compiler backend concurrently:
```bash
npm run dev
```

The console will print out the listening endpoints:
- **Public Static Website**: [http://localhost:3001](http://localhost:3001)
- **Administrative Control Panel**: [http://localhost:3001/admin](http://localhost:3001/admin)
- **Default Authentication Password**: `admin`

---

## 📂 Project Structure

```
├── content/               # Blog databases (settings & markdown posts)
│   ├── images/            # Locally decoded Base64 upload images
│   ├── posts/             # Markdown post files (.md)
│   └── settings.json      # Site details, social links, template, widgets
├── dist/                  # Built React dashboard bundle served at /admin
├── out/                   # Compiled static website output (gh-pages target)
├── src/                   # React admin dashboard source code
│   ├── App.css            # Dark premium dashboard stylesheet
│   ├── App.jsx            # Control panel logic and workspace views
│   └── main.jsx           # Mounting SPA entrypoint
├── templates/             # Aesthetic design stylesheets & EJS layouts
│   ├── nordic-minimal/    # Clean serif grid style
│   ├── neo-glass/         # Deep space glassmorphism style
│   └── cyber-monospace/   # Monospace terminal retro style
├── package.json           # Scripts and core dependencies
├── server.js              # Express API endpoints & EJS SSG Compiler
└── vite.config.js         # Hot-reloading and proxy configs
```

---

## 🚀 Static Site Generation & Deployment

1. **Local EJS Compiling**:
   When you click **Compile** in the Dashboard (or make a POST request to `/api/publish`), the SSG engine:
   - Cleans the `/out` directory.
   - Converts Markdown bodies into semantic HTML.
   - Generates the clean directory structure for clean URLs.
   - Injects enabled sidebar/footer widgets.
   - Automatically builds `/out/search.json` for lightweight, client-side blog searching.

2. **Programmatic Git Publishing**:
   When you click **Deploy** in the Dashboard (or make a POST request to `/api/deploy` passing your git remote target URL):
   - Initializes a separate, clean git environment inside `/out`.
   - Checks out a local `gh-pages` branch.
   - Stages all static files and commits them with a timestamped message.
   - Forces push straight to `origin/gh-pages` of your remote repository.
   - **No insecure Personal Access Tokens (PATs) are saved!** The dashboard runs locally and leverages your system's pre-configured SSH/HTTPS credentials.

---

## ⚖️ License

ZenithPress is open-source software licensed under the MIT License.
