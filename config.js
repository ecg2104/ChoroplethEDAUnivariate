// ============================================================
//  config.js  —  Edit this file to use your own data
// ============================================================
//
//  QUICK START
//  1. Drop your GeoJSON file into the data/ folder
//  2. Update DATA_FILE to match its filename
//  3. Set GEOGRAPHY_LABEL to describe your areal unit (tract, county, zip…)
//  4. Replace the VARIABLES array with fields from your GeoJSON properties
//  5. Open index.html via a local server (or GitHub Pages) and you're done
//
// ============================================================

export const DATA_FILE = './data/NycTracts2020Demography.geojson';

// Label shown in the UI for individual features (singular)
export const GEOGRAPHY_LABEL = 'tract';

// ID field — a unique identifier for each feature in your GeoJSON properties.
export const FEATURE_ID_FIELD = 'fid';

// Human-readable name field — shown in tooltips
export const FEATURE_NAME_FIELD = 'GEOID';

// Optional secondary label in tooltips (e.g. borough, county). Set to null to omit.
export const FEATURE_GROUP_FIELD = 'BoroName';

// ============================================================
//  VARIABLES
//  Each entry defines one mappable variable.
//
//  Fields:
//    id       — unique key (no spaces)
//    label    — shown in the dropdown and legend
//    prop     — exact property name in your GeoJSON features
//    fmt      — formats a value for tooltip display
//    nullVal  — treat this value as "no data" (default 0)
//    diverge  — set true if the variable has a meaningful midpoint
//               (e.g. percent change, z-score). Triggers a note in
//               the palette picker when a diverging scheme is selected
//               on a non-diverging variable.
// ============================================================

export const VARIABLES = [
  {
    id: 'density',
    label: 'Population Density (per sq. mile)',
    prop: 'Population Density (per sq. mile)',
    fmt: v => Math.round(v).toLocaleString() + ' /mi²',
    nullVal: 0,
    diverge: false,
  },
  {
    id: 'pop',
    label: 'Total Population',
    prop: 'Total Population',
    fmt: v => Math.round(v).toLocaleString(),
    nullVal: 0,
    diverge: false,
  },
  {
    id: 'housing',
    label: 'Housing Units',
    prop: 'Housing units',
    fmt: v => Math.round(v).toLocaleString(),
    nullVal: 0,
    diverge: false,
  },
  {
    id: 'white',
    label: 'White alone, non-Hispanic',
    prop: 'Total population: Not Hispanic or Latino: White alone',
    fmt: v => Math.round(v).toLocaleString(),
    nullVal: 0,
    diverge: false,
  },
  {
    id: 'black',
    label: 'Black or African American, non-Hispanic',
    prop: 'Total population: Not Hispanic or Latino: Black or African American alone',
    fmt: v => Math.round(v).toLocaleString(),
    nullVal: 0,
    diverge: false,
  },
  {
    id: 'asian',
    label: 'Asian alone, non-Hispanic',
    prop: 'Total population: Not Hispanic or Latino: Asian alone',
    fmt: v => Math.round(v).toLocaleString(),
    nullVal: 0,
    diverge: false,
  },
  {
    id: 'hispanic',
    label: 'Hispanic or Latino (any race)',
    prop: 'Total population: Hispanic or Latino',
    fmt: v => Math.round(v).toLocaleString(),
    nullVal: 0,
    diverge: false,
  },
];

// ============================================================
//  MAP DEFAULTS
// ============================================================

export const DEFAULT_VARIABLE       = 'density';
export const DEFAULT_CLASSIFICATION = 'quantile'; // 'quantile' | 'equal'
export const DEFAULT_BUCKETS        = 5;          // 3–8
export const DEFAULT_SCHEME         = 'YlOrRd';   // any name from PALETTE_SCHEMES in app.js

// Color for features with null / no-data values
export const NULL_COLOR = '#d4d4d4';

// Highlight color for map-brushed selections in the histogram
export const SELECTION_COLOR = '#e07b39';

// Opacity for de-emphasised (non-selected) features
export const DEEMPHASIS_OPACITY = 0.25;
