# Choropleth EDA — Univariate

An interactive univariate choropleth explorer linking a classified map to a histogram with bidirectional brushing.

The inspiration for this is the brushable EDA toolset in [GeoDa](https://geodacenter.github.io/), which I have been using for years. It's remarkable that ESRI and QGIS still haven't brought those tools into their own platforms. This is an effort to replicate that kind of linked-view interactivity for outward-facing web visualization.

Built with [D3.js](https://d3js.org). No build step required — plain HTML, CSS, and ES modules.

---

## Live demo

[View on GitHub Pages](https://ssitari.github.io/ChoroplethEDAUnivariate/)

---

## What it does

- **Choropleth map** — classifies features by a user-selected variable using quantile or equal-interval breaks, colored with any ColorBrewer palette
- **Linked histogram** — 30-bin distribution of the mapped variable, bars colored to match the map classification
- **Bidirectional selection** — lasso or rectangle selection on the map highlights the corresponding bars in the histogram; brushing a range in the histogram highlights the corresponding features on the map
- **Summary statistics panel** — count, mean, median, std deviation, min, and max for both the full dataset and the active selection, with percentage difference from the full population
- **Variable selector** — switch between any variable defined in `config.js`
- **Classification controls** — toggle between quantile and equal-interval; choose 3–8 classes
- **ColorBrewer palette picker** — 18 sequential and 9 diverging schemes, with a visual swatch strip and a warning when a diverging scheme is applied to a non-diverging variable
- **Zoom and pan** — scroll wheel, +/− buttons, and a reset button; Shift+drag for lasso selection, Shift+Alt+drag for rectangle

---

## Project structure

```
project/
├── index.html          # Layout and controls — do not edit
├── app.js              # Visualization engine — do not edit
├── config.js           # ← Edit this to use your own data
└── data/
    └── *.geojson       # Drop your GeoJSON file here
```

---

## Using your own data

### 1. Prepare your GeoJSON

Your file must meet these requirements before loading:

- **Coordinate system: WGS 84 (EPSG:4326)** — standard lat/lng decimal degrees. If your file uses a projected CRS (e.g. State Plane feet, UTM metres) you must reproject it first. [QGIS](https://qgis.org) and the Python `pyproj` library can both do this.
- **Geometry types: Polygon or MultiPolygon** only
- **All variables must be pre-computed numeric fields** in the feature properties. The tool does not perform calculations — prepare percentages, rates, and derived fields in your data before loading.
- **A unique ID field** — one property that is a unique integer or string identifier per feature (e.g. FIPS code, GEOID, an auto-incremented `fid`)
- **No null geometries** — features with missing or empty geometries should be removed before loading

A good workflow for preparation is QGIS (for reprojection and field calculation) or GeoPandas in Python. See [Data preparation notes](#data-preparation-notes) below.

### 2. Place your file

Copy your GeoJSON file into the `data/` folder.

### 3. Edit config.js

Open `config.js` and update the top section:

```javascript
export const DATA_FILE = './data/YourFile.geojson';

// What one feature is called (singular), e.g. 'county', 'tract', 'zip code'
export const GEOGRAPHY_LABEL = 'tract';

// A property that uniquely identifies each feature
export const FEATURE_ID_FIELD = 'GEOID';

// A human-readable name shown in tooltips
export const FEATURE_NAME_FIELD = 'NAME';

// Optional secondary label in tooltips (e.g. state, borough). Set null to omit.
export const FEATURE_GROUP_FIELD = 'STATE_NAME';
```

Then replace the `VARIABLES` array with entries for your own fields:

```javascript
export const VARIABLES = [
  {
    id:      'med_income',                // unique key, no spaces
    label:   'Median Household Income',   // shown in the dropdown, legend, and histogram axis
    prop:    'MED_HH_INC',               // exact property name in your GeoJSON
    fmt:     v => '$' + Math.round(v).toLocaleString(),  // tooltip/stats formatting
    nullVal: 0,                           // treat this value as "no data"
    diverge: false,                       // set true for variables with a meaningful midpoint
                                          // (e.g. percent change, z-score)
  },
  {
    id:      'pct_college',
    label:   'Percent College Educated',
    prop:    'PCT_COLLEGE',
    fmt:     v => v.toFixed(1) + '%',
    nullVal: 0,
    diverge: false,
  },
];
```

The `diverge` flag triggers a visual warning in the palette picker when a diverging ColorBrewer scheme is applied to a variable that doesn't have a meaningful midpoint.

Finally set your defaults:

```javascript
export const DEFAULT_VARIABLE       = 'med_income';   // id of the variable shown at load
export const DEFAULT_CLASSIFICATION = 'quantile';     // 'quantile' | 'equal'
export const DEFAULT_BUCKETS        = 5;              // 3–8
export const DEFAULT_SCHEME         = 'YlOrRd';       // any id from the palette catalogue
```

### 4. Serve and open

You need a local web server because the app loads data via `fetch()`, which browsers block on `file://` URLs.

**Python (simplest):**
```bash
cd your-project-folder
python3 -m http.server 8000
# then open http://localhost:8000
```

**Node / npx:**
```bash
npx serve your-project-folder
```

**VS Code:** Install the "Live Server" extension → right-click `index.html` → Open with Live Server.

---

## Interaction reference

| Action | Effect |
|---|---|
| Shift + drag on map | Freehand lasso selection of features |
| Shift + Alt + drag on map | Rectangle selection of features |
| Drag on histogram | Brush a value range to highlight matching features on the map |
| Scroll wheel on map | Zoom in/out centered on cursor |
| Drag on map (no Shift) | Pan |
| +/− buttons | Zoom in/out |
| ⊙ button | Reset map to full extent |
| Hover over feature | Tooltip with feature name and variable value |
| Clear selection button | Reset both views |
| Variable dropdown | Change the mapped and plotted variable |
| Classification dropdown | Switch between quantile and equal-interval |
| Classes dropdown | Change the number of classes (3–8) |
| Palette button | Open the ColorBrewer scheme picker |

---

## Deploying to GitHub Pages

1. Push the entire project folder to a GitHub repository
2. Go to **Settings → Pages → Source**: `main` branch, `/ (root)`
3. Your tool will be live at `https://<username>.github.io/<repo>/`

No build step required.

---

## Data preparation notes

### Reprojecting in Python

```python
import geopandas as gpd

gdf = gpd.read_file('your_file.shp')    # or .geojson
gdf = gdf.to_crs('EPSG:4326')           # reproject to WGS 84
gdf.to_file('your_file_wgs84.geojson', driver='GeoJSON')
```

### Adding a unique ID field

```python
gdf['fid'] = range(1, len(gdf) + 1)
```

### Simplifying geometry for web performance

For large datasets (1,000+ features), simplifying geometry significantly reduces file size and improves rendering speed:

```python
from shapely import simplify
gdf['geometry'] = gdf['geometry'].apply(
    lambda g: simplify(g, tolerance=0.0003, preserve_topology=True)
)
```

Tolerance values around 0.0002–0.0005 degrees work well for city/regional data. Increase for national datasets.

### Recommended file sizes

| Features | Target size | Notes |
|---|---|---|
| < 500 | < 1 MB | No simplification needed |
| 500–2,000 | 1–3 MB | Light simplification recommended |
| 2,000–5,000 | 2–5 MB | Moderate simplification required |
| 5,000+ | Consider vector tiles | SVG rendering becomes slow above ~5k features |

---

## Classification methods

- **Quantile** — features are divided into k equal-count classes. Produces a visually balanced map for most datasets but class boundaries may be unintuitive.
- **Equal interval** — the data range is divided into k equal-width classes. More intuitive boundaries but can produce visually unbalanced maps when the data is skewed.

The number of classes can be set from 3 to 8. ColorBrewer palettes support up to 9 classes; the swatch strip in the palette picker updates to reflect the current class count.

---

## Color schemes

All palettes are from [ColorBrewer](https://colorbrewer2.org), Cynthia Brewer's hand-tuned cartographic color schemes, accessed through D3's built-in scheme objects.

**Sequential schemes (18):** Blues, Greens, Greys, Oranges, Purples, Reds, BuGn, BuPu, GnBu, OrRd, PuBu, PuBuGn, PuRd, RdPu, YlGn, YlGnBu, YlOrBr, YlOrRd

**Diverging schemes (9):** BrBG, PiYG, PRGn, PuOr, RdBu, RdGy, RdYlBu, RdYlGn, Spectral

A warning appears in the palette picker when a diverging scheme is selected for a variable not flagged as `diverge: true` in config.js.

---

## Demo data

The included demo dataset covers **NYC Census Tracts (2020)** with demographic variables from the 2020 decennial census.

**Geographic boundaries:** NYC 2020 census tract boundaries from the [NYC Department of City Planning](https://www.nyc.gov/site/planning/data-maps/open-data.page), modified for this project.

**Demographic data:** 2020 decennial census variables (total population, population density, housing units, race/ethnicity) retrieved via the [Social Explorer](https://www.socialexplorer.com) platform.

Variables included: population density (per sq. mile), total population, housing units, White non-Hispanic, Black or African American non-Hispanic, Asian non-Hispanic, Hispanic or Latino (any race).

---

## Related tools

This project is part of a series of linked-view exploratory data analysis tools:

- **Choropleth EDA — Univariate** — this tool
- **Choropleth EDA — Bivariate** — two-variable choropleth linked to a scatterplot with OLS regression and bidirectional selection

---

## Libraries and tools

| Library | Use | License |
|---|---|---|
| [D3.js v7](https://d3js.org) | Visualization, mapping, statistics | ISC |

---

## Acknowledgements

Methodological inspiration from the GeoDa platform:

> Anselin, Luc, Ibnu Syabri and Youngihn Kho (2006). GeoDa: An Introduction to Spatial Data Analysis. *Geographical Analysis* 38 (1), 5–22.

Color palettes from [ColorBrewer](https://colorbrewer2.org) (Cynthia Brewer).

Most of the code written with assistance from [Claude](https://claude.ai) (Anthropic).

---

## License

MIT — free to use, adapt, and redistribute with attribution.
