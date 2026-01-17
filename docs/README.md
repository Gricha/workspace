# Perry Documentation

This directory contains the Docusaurus-based documentation website for Perry.

## Development

### Install Dependencies

```bash
cd docs
npm install
```

### Start Development Server

```bash
npm start
```

This starts a development server at `http://0.0.0.0:3000` (accessible remotely) with live reload.

To use a different port:
```bash
npm start -- --port 3001
```

### Build for Production

```bash
npm run build
```

This generates static content in the `build` directory that can be served by any static hosting service.

### Test Production Build

```bash
npm run serve
```

Serves the production build locally for testing.

## Structure

```
docs/
├── docs/                    # Documentation content (Markdown)
│   ├── introduction.md
│   ├── quickstart.md
│   ├── workspaces.md
│   ├── connect.md
│   ├── agents.md
│   ├── networking.md
│   ├── sync-update.md
│   ├── configuration/      # Configuration guides
│   ├── api/                # API reference (generated)
│   └── troubleshooting.md
├── src/
│   ├── components/         # React components
│   ├── css/               # Custom styles
│   └── pages/             # Custom pages (homepage)
├── static/                # Static assets (images, etc.)
├── docusaurus.config.ts   # Docusaurus configuration
└── sidebars.ts            # Sidebar structure
```

## Writing Documentation

### Create a New Page

1. Create a Markdown file in the appropriate directory under `docs/`
2. Add frontmatter:
   ```md
   ---
   sidebar_position: 1
   ---

   # Page Title

   Content here...
   ```
3. Update `sidebars.ts` if needed

### Markdown Features

Docusaurus supports:

- **GitHub-flavored Markdown**
- **MDX** (React components in Markdown)
- **Admonitions**: `:::tip`, `:::warning`, `:::note`
- **Code blocks** with syntax highlighting
- **Tabs**, **Tables**, **Diagrams**

See [Docusaurus documentation](https://docusaurus.io/docs/markdown-features) for full features.

### Admonitions Example

```md
:::tip
This is a helpful tip!
:::

:::warning
This is a warning!
:::

:::danger
This is dangerous!
:::
```

### Code Blocks

````md
```typescript
const example = "code";
```
````

## Configuration

### Site Config

Edit `docusaurus.config.ts` to change:

- Site title, tagline, favicon
- URL and base URL
- Navbar and footer
- Theme configuration

### Sidebar

Edit `sidebars.ts` to:

- Add/remove sections
- Reorder pages
- Create multiple sidebars

### Styling

Edit `src/css/custom.css` to customize:

- Color scheme
- Typography
- Component styles

## Deployment

### GitHub Pages

```bash
npm run deploy
```

### Other Platforms

Build the site and deploy the `build` directory:

```bash
npm run build
# Deploy build/ to your hosting provider
```

Supported platforms:
- Netlify
- Vercel
- AWS Amplify
- Cloudflare Pages
- Any static hosting service

## Tips

- **Use relative links**: `[Link](./other-page.md)` not `[Link](/docs/other-page)`
- **Check broken links**: Run `npm run build` to detect broken links
- **Preview changes**: Use `npm start` for live preview
- **Keep sidebar organized**: Group related pages in categories
- **Write clear titles**: Frontmatter title overrides H1

## Resources

- [Docusaurus Documentation](https://docusaurus.io/docs)
- [Markdown Guide](https://docusaurus.io/docs/markdown-features)
- [MDX Documentation](https://mdxjs.com/)
- [Infima (CSS Framework)](https://infima.dev/)
