# 🌍 World Crisis Globe

An interactive 3D globe that visualizes current global challenges as a heatmap, powered by real-world CSV data.

![World Crisis Globe](https://github.com/Randemperson/HacklyticsProject2/blob/main/public/Screenshot%202026-02-22%20063143.png)

## Features

- **Interactive 3D Globe** – Drag to rotate, scroll to zoom, auto-rotates slowly
- **GeoJSON Polygon Heatmap** – Country-level choropleth coloring with smooth animated transitions between categories
- **Click to Explore** – Click any country to open a full detail panel with crisis indices, World Bank stats, a country silhouette, and AI-powered news
- **7 Crisis Categories** – Switch between Conflict, Climate Vulnerability, Food Insecurity, Poverty, Disease Burden, Funding, and Disparity
- **Hover Tooltips** – Hover over any country to see its name, severity score, and description
- **AI News Panel** – Powered by Gemini 2.5 Flash; generates representative recent headlines for any clicked country
- **World Bank Integration** – Live population, GDP, and area data fetched per country
- **Custom CSV Upload** – Load your own dataset in the required format
- **Country Silhouette** – SVG silhouette of the clicked country rendered from its GeoJSON geometry

## Getting Started

```bash
git clone https://github.com/Randemperson/HacklyticsProject2.git
cd HacklyticsProject2
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## CSV Data Format

The app loads `public/world_problems.csv` by default. Custom CSV files must have these columns:

| Column | Description |
|--------|-------------|
| `country` | Country or region name |
| `lat` | Latitude (decimal degrees) |
| `lng` | Longitude (decimal degrees) |
| `category` | One of: `conflict`, `climate`, `food_insecurity`, `poverty`, `disease`, `funding` |
| `value` | Calculated Severity score of 0–100 (higher = more severe) |
| `description` | Brief description of the issue |

## Tech Stack

- [React](https://react.dev/) + [Vite](https://vite.dev/)
- [globe.gl](https://globe.gl/) – WebGL 3D globe with GeoJSON polygon rendering
- [PapaParse](https://www.papaparse.com/) – CSV parsing
- [Gemini 2.5 Flash](https://deepmind.google/technologies/gemini/) – AI-generated country news summaries
- [three.js](https://threejs.org/) – Underlying 3D engine
- [DataBricks](https://www.databricks.com/) – Data cleaning and analysis
