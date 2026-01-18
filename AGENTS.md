# 🤖 AGENTS.md - Codebase Guidelines

This file provides context, rules, and workflows for AI agents working on the "AoAo Diary" project.

## 1. 🏗️ Project Overview

- **Type**: Static Web Application (HTML/CSS/JS) (PWA)
- **Framework**: Vue.js 3 (CDN Mode) - **NO Build Step**.
- **Backend**: Supabase (PostgreSQL + Storage) via JS SDK.
- **State Management**: Local component state + `localStorage` caching.
- **Deployment**: Cloudflare Pages / GitHub Pages.
- **Language**: JavaScript (ES6+), HTML5, CSS3.
- **Locale**: Chinese (zh-CN).

## 2. ⚠️ User Preferences & Critical Rules (MUST FOLLOW)

**General Behavior**:
1.  **Language**: Reply to the user in **Chinese** (中文).
2.  **No Emojis**: Do NOT use emojis in your conversational responses.
3.  **Windows Environment**: The system is Windows. Use strict path handling (e.g., `\` vs `/`).
4.  **Port Conflicts**: If a port is busy, **kill the process** occupying it. DO NOT change the port number.
5.  **Cleanup**: Always **DELETE** any temporary test files created during verification.

**Frontend Design**:
1.  **Aesthetic**: iOS/Clean style.
2.  **Forbidden**: Do **NOT** use purple gradients or emojis in the UI design (unless requested).
3.  **Simplicity**: Keep the UI clean and minimalist.

## 3. 🚀 Build & Run

### Build System
- **NONE**. This is a "No-Build" project.
- ❌ **DO NOT** run `npm install`, `npm build`, or `npm run dev`.
- ❌ **DO NOT** create `package.json` or `webpack.config.js`.
- ❌ **DO NOT** use `import` statements that require a bundler (e.g., `import Vue from 'vue'`).
- ✅ **DO** use global variables (`Vue`, `supabase`) loaded via CDN tags in `index.html`.

### Running Locally
- Open `index.html` directly in a browser.
- OR serve with a static server:
  - VS Code Live Server
  - `python -m http.server 8000`
  - `npx serve .`

### Testing Protocol
- **Manual Only**: No automated test suite exists.
- **Process**:
  1.  Modify code.
  2.  Open `index.html`.
  3.  Verify basic flows: Loading notes, posting a note, liking, switching tabs.
  4.  Check Console for errors (F12).
- **Test Files**: If you create a temporary HTML file to test a specific feature (e.g., `test_layout.html`), you **MUST** delete it after verification.

## 4. 📝 Code Style & Conventions

### JavaScript (Vanilla + Vue 3)
- **Indentation**: 4 spaces.
- **Semicolons**: Always use semicolons `;`.
- **Quotes**: Single quotes `'` for JS, Double quotes `"` for HTML attributes.
- **Vue Pattern**:
  - Use **Options API** (`data`, `methods`, `mounted`).
  - **Avoid** Composition API (`setup()`) unless necessary for complexity.
  - Access globals via destructuring: `const { createApp } = Vue;`.
- **Async/Await**: Prefer `async/await` over Promise chains (`.then()`).
- **Error Handling**:
  - Wrap network calls (Supabase) in `try...catch`.
  - Always handle loading states (`isLoading`) and error states (`loadError`).
  - Fail gracefully (UI should not crash).

### HTML/CSS structure
- **HTML**:
  - Use semantic tags (`<nav>`, `<main>`, `<article>`).
  - Keep Vue templates inside `index.html` (no `.vue` files).
  - Ensure `v-cloak` is on the root `#app` to prevent FOUC (Flash of Unstyled Content).
- **CSS** (`css/style.css`):
  - **Naming**: Kebab-case (e.g., `.note-card-title`).
  - **Responsive**: Mobile-first approach.
  - **Theme**: Support Dark Mode via `@media (prefers-color-scheme: dark)`.

### Naming Conventions
- **Variables/Functions**: `camelCase` (e.g., `fetchNotes`, `currentUser`).
- **Files**: `kebab-case` (e.g., `app.js`, `style.css`).
- **Supabase Tables**: `snake_case` (e.g., `notes`, `user_profiles`).

## 5. 📂 Directory Structure

```text
/
├── index.html       # Main entry & Vue Template
├── css/
│   └── style.css    # Global Styles
├── js/
│   ├── app.js       # Main Vue Logic (The "Brain")
│   ├── storage.js   # Supabase Data Access Layer (DAL)
│   └── supabase.js  # Supabase Config (URL/Key)
├── images/          # Static Assets (Icons, Placeholders)
└── README.md        # Project Docs
```

## 6. 🛠️ Library Usage

- **Vue.js 3**: Core framework (Global `Vue`).
- **Supabase JS**: Backend SDK (Global `supabase`).
- **SortableJS**: Drag and drop for images.
- **Canvas Confetti**: Easter egg effects.
- **Icons**: Inline SVGs or SVG Symbols in `index.html`. Do not add heavy icon fonts (FontAwesome).

## 7. 🐛 Troubleshooting & Debugging

### Common Issues
1.  **"Vue is not defined"**: Check internet connection (CDN load failure).
2.  **Supabase 400/500 Errors**:
    - Check RLS (Row Level Security) policies in Supabase dashboard.
    - Verify `anon` key in `js/supabase.js`.
    - Check Network tab for payload format.
3.  **UI Glitches**:
    - Verify CSS specificity in `style.css`.
    - Check for unclosed HTML tags in `index.html`.

### Debugging Steps
1.  Use `console.log` freely (no build step to strip them).
2.  Inspect `this.notes` or `this.newNote` in Console to view state.
3.  Check Network tab for failed `rest/v1/...` requests.

## 8. 🔄 Development Workflow

1.  **Analyze**: Read `README.md` and related files (`app.js`, `index.html`).
2.  **Plan**: Outline changes.
3.  **Implement**:
    - Edit `index.html` for structure/template.
    - Edit `css/style.css` for styling.
    - Edit `js/app.js` for logic.
4.  **Verify**: Open `index.html`, check console, test feature.
5.  **Clean**: Remove any `test.html` or temp files.

## 9. 🔒 Security Guidelines

- **API Keys**: Never commit `service_role` keys. Only `anon` public keys are allowed in client-side JS.
- **Input Validation**: Although Supabase handles SQL injection, always validate user input in JS (length, type) before sending.
- **XSS**: Vue handles escaping by default. Be careful with `v-html`.
