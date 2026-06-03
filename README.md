# Real Estate Potential Score

A web app that evaluates the investment potential of any property using a transparent, data-driven 1–100 scoring system. Built during a real estate tech internship in 2025.

## Live Demo
<!-- Add your GitHub Pages or deployment link here once deployed -->

## What it does

Users input property details and the app calculates a weighted investment score across five dimensions:

- **Valuation** — Is the property priced below assessed value? Is the yield strong?
- **Growth** — Appreciation trends, days on market, local employment
- **Cash Flow** — Net operating income after taxes, HOA, maintenance, and CapEx
- **Risk** — Crime index, vacancy rate, interest rate environment, property age
- **Livability** — School rating, walk score, bedroom/bathroom balance

Results are displayed as a 1–100 score with a radar chart, bar chart breakdown, suggested offer price, and actionable guidance on what's dragging the score down.

## Features

- 3-tab input form (Basics, Market, Income & Costs)
- Adjustable scoring weights — prioritize cash flow vs. growth vs. risk
- 4 built-in property presets (Move-in Ready, Fixer-Upper, Urban Condo, Investor Duplex)
- Suggested offer price based on target net yield
- JSON export of all inputs and results
- 3 color themes (Emerald, Ocean, Sunset)
- Fully client-side — no backend, no data stored

## Built with

- React
- Vite
- Tailwind CSS
- Recharts (radar + bar charts)
- Lucide React (icons)

## Getting started

```bash
npm install
npm run dev
```

## Disclaimer

This tool is a heuristic screening aid, not financial or appraisal advice. Always verify comps, local taxes, zoning, and legal disclosures before making offers.