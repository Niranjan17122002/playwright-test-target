# Playwright Test Target App

A tiny static site with no backend, built to be used as the "QA app" when testing the
automation-poc AI Playwright accelerator end-to-end (including GitHub Actions CI execution).

## Pages
- `index.html` — home, nav links
- `login.html` — login form (demo / demo123), redirects to `welcome.html` on success, shows an error on failure
- `welcome.html` — post-login landing page, links to Dashboard, has a Log out link
- `contact.html` — contact form, shows a success message on submit
- `about.html` — static content
- `dashboard/index.html` — login-gated module (redirects to `login.html` if not logged in); add/delete tasks from a list
- `team/index.html` — public module; search/filter a static team member list by name

Login state is a simple `localStorage` flag (`ttapp_logged_in`) set by `login.html` on success and
cleared by the "Log out" links on `welcome.html`/`dashboard/index.html` — good enough to gate a page
client-side without a real backend.

## How to use this for testing

1. Push this folder to a new GitHub repo.
2. Enable GitHub Pages for that repo (Settings → Pages → deploy from the `main` branch, root folder).
   This gives you a public URL like `https://<username>.github.io/<repo>/` — required because
   GitHub Actions runners can't reach `localhost` on your machine.
3. In the automation-poc app, create a project with:
   - `github_owner` / `github_repo` set to this repo
   - `execution_mode` set to `github_ci`
   - `base_url` set to the GitHub Pages URL from step 2
4. Run analysis → planning → generation → approve a spec → execute.
