# 🌍 World Crisis Globe

An interactive 3D globe that visualizes current global challenges as a heatmap, powered by real-world CSV data.

![World Crisis Globe](https://github.com/user-attachments/assets/fa721507-291e-4c30-9029-9543a660a894)

## Features

- **Interactive 3D Globe** – Drag to rotate, scroll to zoom, auto-rotates slowly
- **Heatmap Visualization** – Severity-scaled colored disc markers with pulsing rings
- **5 Crisis Categories** – Switch between Conflict, Climate Vulnerability, Food Insecurity, Poverty, and Disease Burden
- **Hover Tooltips** – Hover over any hotspot to see country name, severity score, and description
- **Custom CSV Upload** – Load your own dataset in the required format
- **Responsive Legend** – Color scale and category description update with each selection

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
| `category` | One of: `conflict`, `climate`, `food_insecurity`, `poverty`, `disease` |
| `value` | Severity score 0–100 (higher = more severe) |
| `description` | Brief description of the issue |

## Tech Stack

- [React](https://react.dev/) + [Vite](https://vite.dev/)
- [globe.gl](https://globe.gl/) – WebGL 3D globe rendering
- [PapaParse](https://www.papaparse.com/) – CSV parsing
- [three.js](https://threejs.org/) – underlying 3D engine
