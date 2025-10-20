# Jalisco CP Geocoding (SEPOMEX → CSV)

Offline-friendly pipeline to geocode SEPOMEX rows for **Jalisco, MX** into a CSV with **postcode / locality / municipality** centroids using **OpenStreetMap Nominatim** (free), with retry/backoff, 1 rps throttle, and resume support.

- **Input**: SEPOMEX `.xls` (sheet: `Jalisco`)
- **Output**: `jalisco_cp_geocoded.csv` (all rows) + `misses.csv` (subset where precision < 3)
- **No dedupe**: every input row is written; previously geocoded rows are skipped using a *resume key* so you can safely rerun.

---

## Features

- Header normalization (Spanish SEPOMEX → English `camelCase`)
- CP-first geocoding with strict acceptance:
  - Structured: `postalcode` (with/without viewbox bias)
  - Structured: `postalcode + city=<municipio>` and `postalcode + county=<municipio>`
  - Freetext: `"CP, Jalisco, Mexico"`
- Locality fallbacks with POI/road filtering:
  - Freetext: `"<asentamiento>, <municipio>, Jalisco, Mexico"`
  - Freetext: `"<asentamiento>, <CP>, Jalisco, Mexico"`
- Municipality centroid as last resort
- Policy-friendly: ≤ 1 req/sec, `User-Agent` + contact email, exponential backoff on 429/403
- Confidence + numeric precision:
  - `exact_postcode` → precision `3`
  - `text_locality` → precision `2`
  - `municipality_fallback` → precision `1`
  - `no_result` → precision `0`

---

## Quick Start

```bash
# 1) Install deps
npm i xlsx csv-parse csv-stringify node-fetch dotenv

# 2) Put your SEPOMEX Excel as ./jalisco.xls (or set INPUT_XLS in .env)

# 3) Create .env (see template below)

# 4) Run
node geocode-cp.js
```

### .env template

```ini
# Input & output
INPUT_XLS=./jalisco.xls
OUTPUT_CSV=./jalisco_cp_geocoded.csv
SHEET_NAME=Jalisco

# Contact & UA (strongly recommended for Nominatim)
NOMINATIM_EMAIL=you@example.com
USER_AGENT=my-jalisco-app/1.0 (you@example.com)

# Scope & sampling (no dedupe; raw slice applied after state filter)
STATE_FILTER=Jalisco
SAMPLE_LIMIT=30
START_AT=0

# Resume key: defines how we detect "already geocoded" rows in OUTPUT_CSV
RESUME_KEY_FIELDS=postalCode|settlement|municipality|settlementIdCpcons

# Optional viewbox bias (west,south,east,north) to prefer Jalisco candidates
USE_BIAS=true
BBOX=-105.8,18.7,-101.4,22.9
```

---

## Input: SEPOMEX Headers → English camelCase

```
d_codigo            → postalCode
d_asenta            → settlement
d_tipo_asenta       → settlementType
d_mnpio             → municipality
d_estado            → state
d_ciudad            → city
d_cp                → postalCodeAlt
c_estado            → stateCode
c_oficina           → officeCode
c_cp                → postalCodeKey
c_tipo_asenta       → settlementTypeCode
c_mnpio             → municipalityCode
id_asenta_cpcons    → settlementIdCpcons
d_zona              → zone
c_cve_ciudad        → cityCode
```

---

## Output CSV Schema

```
postalCode, settlement, settlementType, municipality, state, city,
postalCodeAlt, stateCode, officeCode, postalCodeKey, settlementTypeCode,
municipalityCode, settlementIdCpcons, zone, cityCode,
lat, lon,
geocodeSource, geocodeNote, confidence, missReason, precision
```

---

## Confidence & Precision Semantics

- **exact_postcode (3)**: postcode centroid or candidate with exact postalCode match.
- **text_locality (2)**: neighbourhood/suburb/locality centroid.
- **municipality_fallback (1)**: municipio centroid (administrative fallback).
- **no_result (0)**: failed geocoding.

---

## Geocoding Strategy (in order)

1. `postalcode=<CP>, state=Jalisco, country=Mexico` (bias)
2. `postalcode=<CP>, state=Jalisco, country=Mexico` (no bias)
3. `postalcode=<CP>, city=<municipio>, state=Jalisco, country=Mexico`
4. `postalcode=<CP>, county=<municipio>, state=Jalisco, country=Mexico`
5. `"<CP>, Jalisco, Mexico"`
6. `"<settlement>, <municipio>, Jalisco, Mexico"`
7. `"<settlement>, <CP>, Jalisco, Mexico"`
8. `"<municipio>, Jalisco, Mexico"`

A result is **exact** if:
- type=`postcode` or address.postcode === input.postalCode.

---

## Throttle, Retries, and Resume

- 1 req/sec minimum
- Exponential backoff (up to 5 retries)
- Resume uses RESUME_KEY_FIELDS from output CSV to skip completed rows.

---

## Misses

`misses.csv` contains rows with precision < 3 for secondary passes or manual QA.

---

## Type Scheme (TS-like)

```ts
type SepomexIn = {
  postalCode: string;
  settlement: string;
  settlementType: string;
  municipality: string;
  state: string;
  city: string;
  postalCodeAlt: string;
  stateCode: string;
  officeCode: string;
  postalCodeKey: string;
  settlementTypeCode: string;
  municipalityCode: string;
  settlementIdCpcons: string;
  zone: string;
  cityCode: string;
};

type GeocodeOut = SepomexIn & {
  lat: string;
  lon: string;
  geocodeSource:
    | 'nominatim_cp_only_bias'
    | 'nominatim_cp_only'
    | 'nominatim_cp_city'
    | 'nominatim_cp_county'
    | 'nominatim_cp_freetext'
    | 'nominatim_freetext'
    | 'nominatim_freetext_cp'
    | 'nominatim_municipality'
    | 'nominatim';
  geocodeNote: string;
  confidence: 'exact_postcode' | 'text_locality' | 'municipality_fallback' | 'no_result' | 'unknown';
  missReason: string;
  precision: 0 | 1 | 2 | 3;
};
```

---

## License / Credits

Data geocoding powered by **OpenStreetMap Nominatim**.  
OSM data © OpenStreetMap contributors.  
Respect OSM usage policies: https://operations.osmfoundation.org/policies/nominatim/
