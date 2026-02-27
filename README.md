# Knowledge Garden

A personal knowledge garden of mental models, built with Vite + React and deployed on Netlify. Content is sourced live from your private `rishisaikia/quartz` GitHub repository — no manual syncing required.

## How It Works

```
GitHub repo (quartz)
  content/01 Mental Models/*.md
        │
        ▼  (GitHub API, server-side)
Netlify Function: /.netlify/functions/models
        │
        ▼
React App (browser)
```

Your `GITHUB_TOKEN` lives only in the server environment — it's never bundled into the browser JS.

---

## Local Development

### 1. Create your `.env` file

```bash
cp .env.example .env
# Then edit .env and paste your real GitHub token:
# GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

### 2. Install the Netlify CLI (if not already installed)

```bash
npm install -g netlify-cli
```

### 3. Run the dev server

```bash
npm run dev
```

This runs `netlify dev`, which starts both the Vite dev server (port 5173) and the Netlify Functions server — so `/.netlify/functions/models` works exactly as it will in production.

Open **http://localhost:8888**

---

## Deploy to Netlify

### Step 1: Push to a new GitHub repo

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/knowledge-garden.git
git push -u origin main
```

### Step 2: Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**
2. Choose your new `knowledge-garden` repo
3. Build settings (should auto-detect from `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`

### Step 3: Add the GitHub Token

1. In Netlify: **Site settings → Environment variables → Add a variable**
2. Key: `GITHUB_TOKEN`
3. Value: your GitHub Personal Access Token
4. Click **Save**

### Step 4: Trigger a deploy

Netlify will auto-deploy. Your mental models will now be fetched live from your private quartz repo.

---

## Content Updates

Just edit your `.md` files in the `quartz` repo under `content/01 Mental Models/`. The website fetches fresh content on every page load (with a 5-minute CDN cache). No redeployment needed.

## Expected `.md` Format

```yaml
---
type: mental-model
category:
  - Psychology
  - Decision Making
related_models:
  - "[[Other Model Name]]"
---
## Definition
...

## Key Insight
...

## How to Apply
...

## Real-World Example
...

## Common Pitfalls
...
```
