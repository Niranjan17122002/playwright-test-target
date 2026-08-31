# Playwright Test Target App

A tiny static site with no backend, built to be used as the "QA app" when testing the
automation-poc AI Playwright accelerator end-to-end (including GitHub Actions CI execution).

## Pages
- `index.html` — home, nav links, and a "Modules" grid linking to every page below
- `login.html` — login form (`demo`/`demo123` for a standard user, `admin`/`admin123` for an admin), redirects to `welcome.html` on success, shows an error on failure
- `welcome.html` — post-login landing page, links to Dashboard/Profile/Admin, has a Log out link
- `contact.html` — contact form, shows a success message on submit
- `about.html` — static content
- `dashboard/index.html` — login-gated module (redirects to `login.html` if not logged in); add/delete tasks from a list
- `team/index.html` — public module; search/filter a static team member list by name
- `signup.html` — registration form; validates required fields, email format, password length/match, and duplicate usernames
- `forgot-password.html` — request a password reset; issues a fake token and a direct link to `reset-password.html` (no real email is sent)
- `reset-password.html` — reads `?token=` from the URL, validates it, sets a new password (min length + must include a number)
- `profile.html` — login-gated; edit display name/email and change password (current password is `demo123`)
- `products.html` — searchable, sortable (by name/price/stock), paginated (10/page) product table over 35 generated rows
- `admin.html` — login-gated *and* role-gated (`admin` only); shows an "access denied" message for non-admin users
- `session-timeout.html` — login-gated; a 20-second visible countdown that auto-logs-out and redirects to `login.html`, with a "Stay Logged In" button to reset it
- `upload.html` — file input + upload button; shows an error if no file is chosen, otherwise appends the file to an "uploaded files" list
- `wizard.html` — 3-step "Create Project" wizard (name → environment/description → review), with Back/Next validation
- `notifications.html` — triggers an auto-dismissing toast notification and logs each one to a history list

Login state is two simple `localStorage` flags — `ttapp_logged_in` (set by `login.html` on success,
cleared by the "Log out" links) and `ttapp_role` (`user` or `admin`, checked by `admin.html`) — good
enough to gate pages client-side without a real backend. `signup.html` stores new accounts under
`ttapp_registered_users`; `forgot-password.html`/`reset-password.html` use `ttapp_reset_token`.

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
