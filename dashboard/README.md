# UPOS-7-VS Enhancement Dashboard

Web-based dashboard for tracking and managing UPOS-7-VS enhancements.

## Setup

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- View all enhancements by category (Critical, Table-Stakes, Value-Added)
- Filter and search enhancements
- Track status and progress
- Generate reports
- Export data

## Architecture

Built with Next.js 14 (App Router) for server-side rendering and optimal performance.

### Data Source

The API reads from `dashboard/data/enhancements.json`, which is generated from the markdown catalog via:

```bash
npm run catalog:build
```

This command also emits the same JSON under `enhancements/catalog/enhancements.json` for use by other tooling.
