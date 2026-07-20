# WorkFlow Pro — Salary & Payroll Management

A complete, working hourly work-tracking and payroll app: live timer, work
reports, salary auto-calculation (₹50/hr by default), leave, fines, expenses,
payment history, calendar, analytics, and downloadable CSV/Excel/PDF reports —
with login and an admin panel to manage employees.

## Requirements

- [Node.js](https://nodejs.org) version 18 or newer
- npm (comes with Node.js)

## Installation

```bash
cd workflow-pro-app
npm install
```

## Run it locally

```bash
npm run dev
```

Then open the URL it prints (usually `http://localhost:5173`) in your browser.

## Build for production (a static site)

```bash
npm run build
```

This produces a `dist/` folder containing plain HTML/CSS/JS. You can host it
on any static host — Vercel, Netlify, GitHub Pages, your own server, etc.
Preview the production build locally with:

```bash
npm run preview
```

## First login

The app has no accounts yet on first run. Open it, click **Register**, and
create your account — the very first account created automatically becomes
the **Admin**. From the Admin tab you can then add employee accounts, set
their hourly rate, reset their password, and view their workspace directly.

## How data is stored

This build stores everything in your browser's `localStorage` — there is no
external server or database. That means:

- Your data persists across page reloads and browser restarts, on that one
  browser/device.
- It is **not** synced across different browsers or devices. If you open the
  app on your phone, that's a separate, empty dataset.
- Clearing your browser's site data / cache for this app will erase it. Use
  the CSV/Excel export in the Reports tab regularly if you want backups.

If you need real multi-device sync, multi-user accounts with actual
server-side security, file/photo uploads, or automated email — those all
require a real backend (a database + API server), which is a separate,
larger build. This project is intentionally a fully self-contained, no-backend
version so it runs immediately with zero setup beyond `npm install`.

## Notes on security

Passwords are hashed with SHA-256 before being stored (never in plain text).
However, since this is a client-only app with no server, this is **not**
enterprise-grade security — anyone with access to the browser's storage can
see the raw data. Treat this as a personal or small-team tool, not a system
for sensitive company-wide payroll with untrusted users.

## Tech stack

- React 18 + Vite
- Tailwind CSS
- Recharts (charts)
- lucide-react (icons)
- SheetJS / xlsx (Excel export)
- Browser localStorage (data persistence)

## Project structure

```
workflow-pro-app/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx       # app entry point, installs the storage layer
    ├── App.jsx        # the entire application
    ├── storage.js      # localStorage-backed data layer
    └── index.css      # Tailwind imports
```
