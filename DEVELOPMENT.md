# Local development

Run these commands from this site’s directory:

| Command | Behavior |
| --- | --- |
| `npm run build` | Build the site into `dist/` and exit. |
| `npm run dev` | Build, watch for changes, and serve at http://localhost:8580. |
| `npm run watch` | Build and rebuild `dist/` on file changes without starting a server. |

Use `npm run watch` when Heron serves the site locally, including its API routes.
The standalone development server serves the frontend; API routes need Heron.
Stop either development command with Ctrl+C.
