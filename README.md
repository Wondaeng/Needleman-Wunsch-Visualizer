# Needleman-Wunsch Visualizer

Interactive web visualizer for the Needleman-Wunsch algorithm.

## Local development

```bash
npm install
npm run dev
```

- Dev server: `http://localhost:5173`

## Build (lightweight)

```bash
npm run build
```

- Build output: `dist/`

## Preview production build

```bash
npm run preview
```

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

1. Push this project to a GitHub repository.
2. Ensure your default branch is `main` (or update the workflow branch name).
3. In GitHub: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
4. Push to `main`.
5. The workflow builds and deploys automatically to GitHub Pages.

## Notes

- Uses Vite for a fast, minimal build setup.
- `base: "./"` is configured in `vite.config.js` for easy static hosting.