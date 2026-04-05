# EquiLearn — Source Code Documentation

## How to Run

The visualization components are implemented in JavaScript and rely on browser APIsto render interactive graphs. The visual outputs can be displayed by loading the associated index.html file, which initializes the scripts, binds the data, and constructs the graphical elements within the page.

---

## File Structure

```
equilearn/
│
├── index.html          # Main page — HTML structure and layout
├── styles.css          # All visual styling (colors, fonts, layout)
│
├── data.js             # Pre-processed datasets (generated from raw data)
├── france-geo.js       # France GeoJSON map data (embedded as a JS variable)
├── app.js              # All interactive charts and visualizations ← main file
│
└── process_data.py     # Data pipeline (optional — only needed to regenerate data.js)
```

---

## Where the Charts Are (app.js)

All interactive charts are built inside `app.js`. Each function corresponds to one chart:

| Function | Chart | Section |
|---|---|---|
| `buildRegionalGenderChart()` | Girls vs Boys by region (grouped bars) | Gender |
| `buildSpecBreakdownChart()` | Girls vs Boys by specialization (horizontal bars) | Gender |
| `buildFunnelGirls()` | Parcoursup selection funnel — Girls vs Overall | Gender |
| `buildGirlsTimelineChart()` | Evolution of girls in CPGE over time (line) | Gender |
| `buildBoursiersChoropleth()` | Scholarship students by department (choropleth map) | Economic |
| `buildSectorChart()` | Public vs Private scholarship students (donut) | Economic |
| `buildFunnelScholarship()` | Parcoursup funnel — Scholarship students vs Overall | Economic |
| `buildScatterChart()` | Admission rate vs % scholarship students (scatter) | Economic |
| `buildIPSChoropleth()` | Social Position Index by department (choropleth map) | Territorial |
| `buildCPGEGeoMap()` | Geographic distribution of CPGE programs (dot map) | Territorial |
| `buildIPSRegionChart()` | Average IPS by academic region (horizontal bars) | Territorial |

Charts use **Chart.js** (bar, line, scatter, donut) and **D3.js** (choropleth maps, dot maps).

---

## Data Sources

All datasets come from open French government data portals:

- **Parcoursup** — data.enseignementsup-recherche.gouv.fr
- **CPGE Enrollments** — data.education.gouv.fr
- **High School Specializations** — data.education.gouv.fr
- **Scholarship Students by Department** — data.education.gouv.fr
- **Social Position Index (IPS)** — data.education.gouv.fr
