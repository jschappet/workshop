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

## Submit site changes

Run `./upload.sh "Describe the change"` from the site repository. The message
is used for the commit and a new pull request's title (default: `Update site`).
Requires Git, npm, and an authenticated GitHub CLI (`gh auth login`).

The script builds the site, stages all non-ignored changes, commits them, pushes
the current branch to `origin`, and creates a PR against the repository's default
branch. Review `git status` first and keep local databases and credentials ignored.
When run on the default branch it first creates a `codex/site-update-…` branch.
An existing open PR is reused. A clean working tree can still push existing
commits; if there are no commits ahead of the base, no PR is created. Failures
stop the script.

This submits changes for review; it does not merge the PR or upload files to the
production server. Deployment uses `deploy.site.toml` separately after merging.
