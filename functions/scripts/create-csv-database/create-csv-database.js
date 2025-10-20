// Node 18+
// npm i xlsx csv-parse csv-stringify node-fetch dotenv
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import fetch from 'node-fetch';
import { stringify } from 'csv-stringify';
import { parse as parseCsv } from 'csv-parse';

/* ---------- ENV ---------- */
const INPUT_XLS = process.env.INPUT_XLS || './jalisco.xls';
const OUTPUT_CSV = process.env.OUTPUT_CSV || './jalisco_cp_geocoded.csv';
const SHEET_NAME = (process.env.SHEET_NAME || 'Jalisco').trim();
const EMAIL = process.env.NOMINATIM_EMAIL || '';
const USER_AGENT = process.env.USER_AGENT || (EMAIL ? `jalisco-cp-geocoder/1.0 (${EMAIL})` : 'jalisco-cp-geocoder/1.0');
const STATE_FILTER = (process.env.STATE_FILTER || 'Jalisco').toUpperCase();
const SAMPLE_LIMIT = process.env.SAMPLE_LIMIT ? parseInt(process.env.SAMPLE_LIMIT, 10) : null;
const START_AT = process.env.START_AT ? parseInt(process.env.START_AT, 10) : 0;

// No dedupe. We only use a resume key to avoid re-geocoding rows already written with coords.
const RESUME_KEY_FIELDS = (process.env.RESUME_KEY_FIELDS || 'postalCode|settlement|municipality|settlementIdCpcons')
    .split('|')
    .map(s => s.trim())
    .filter(Boolean);

const USE_BIAS = (process.env.USE_BIAS || 'true').toLowerCase() === 'true';
// Jalisco-ish bounds: west,south,east,north
const BBOX = (process.env.BBOX || '-105.8,18.7,-101.4,22.9').split(',').map(Number);

/* ---------- CONSTANTS ---------- */
const ONE_SECOND_MS = 1000;
const MAX_RETRIES = 5;

const WHITELIST_TYPES = new Set([
    'postcode', 'neighbourhood', 'suburb', 'residential', 'city_district', 'quarter',
    'hamlet', 'village', 'town', 'locality', 'administrative'
]);
const WHITELIST_CLASSES = new Set(['place', 'boundary', 'addr']);
const BLACKLIST_CLASSES = new Set(['highway', 'railway', 'shop', 'amenity', 'office']);

/* ---------- SEPOMEX → english camelCase ---------- */
const headerMap = {
    'd_codigo': 'postalCode',          // real CP to geocode
    'd_asenta': 'settlement',
    'd_tipo_asenta': 'settlementType',
    'd_mnpio': 'municipality',
    'd_estado': 'state',
    'd_ciudad': 'city',
    'd_cp': 'postalCodeAlt',           // post office CP (not used to query)
    'c_estado': 'stateCode',
    'c_oficina': 'officeCode',
    'c_cp': 'postalCodeKey',           // key/id, not the 5-digit CP
    'c_tipo_asenta': 'settlementTypeCode',
    'c_mnpio': 'municipalityCode',
    'id_asenta_cpcons': 'settlementIdCpcons',
    'd_zona': 'zone',
    'c_cve_ciudad': 'cityCode'
};

const outputColumns = [
    'postalCode', 'settlement', 'settlementType', 'municipality', 'state', 'city',
    'postalCodeAlt', 'stateCode', 'officeCode', 'postalCodeKey',
    'settlementTypeCode', 'municipalityCode', 'settlementIdCpcons', 'zone', 'cityCode',
    'lat', 'lon', 'geocodeSource', 'geocodeNote', 'confidence', 'missReason', 'precision'
];

/* ---------- utils ---------- */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function headers() {
    return { 'User-Agent': USER_AGENT, 'Accept': 'application/json', 'Accept-Language': 'es' };
}

function toCamelEnglishHeaders(rawRow) {
    const out = {};
    for (const [k, v] of Object.entries(rawRow)) {
        const key = (k || '').toString().trim().toLowerCase();
        const mapped = headerMap[key] || key.replace(/\s+/g, '_');
        out[mapped] = typeof v === 'string' ? v.trim() : v;
    }
    return out;
}

function makeResumeKey(row) {
    const parts = RESUME_KEY_FIELDS.map(f => (row[f] ?? '')).map(x => String(x).toUpperCase());
    const key = parts.join('|').trim();
    return key || JSON.stringify(row);
}

async function readAlreadyProcessedKeys() {
    if (!fs.existsSync(OUTPUT_CSV)) return new Set();
    const processed = new Set();
    await new Promise((resolve, reject) => {
        fs.createReadStream(OUTPUT_CSV)
            .pipe(parseCsv({ columns: true }))
            .on('data', (row) => {
                const hasCoords = row.lat && row.lon;
                if (!hasCoords) return;
                const key = RESUME_KEY_FIELDS.map(f => (row[f] ?? '')).map(x => String(x).toUpperCase()).join('|').trim();
                if (key) processed.add(key);
            })
            .on('end', resolve)
            .on('error', reject);
    });
    return processed;
}

/* ---------- Nominatim fetch with retries ---------- */
async function nominatimFetch(url, attempt = 1) {
    const res = await fetch(url.toString(), { headers: headers() });
    if (res.status === 429 || res.status === 403) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
        const backoff = retryAfter ? retryAfter * 1000
            : Math.min(30000, (2 ** attempt) * 1000) + Math.floor(Math.random() * 500);
        if (attempt <= MAX_RETRIES) {
            console.warn(`[${res.status}] throttled; retrying in ${backoff}ms (attempt ${attempt})`);
            await sleep(backoff);
            return nominatimFetch(url, attempt + 1);
        }
        return { ok: false, status: res.status, data: [] };
    }
    if (!res.ok) {
        if (attempt <= MAX_RETRIES) {
            const backoff = Math.min(20000, (2 ** attempt) * 500) + Math.floor(Math.random() * 300);
            console.warn(`[${res.status}] error; retrying in ${backoff}ms (attempt ${attempt})`);
            await sleep(backoff);
            return nominatimFetch(url, attempt + 1);
        }
        return { ok: false, status: res.status, data: [] };
    }
    const data = await res.json();
    return { ok: true, status: 200, data: Array.isArray(data) ? data : [] };
}

/* ---------- URL builders ---------- */
function addBias(url, withBias) {
    if (!withBias || !USE_BIAS || BBOX.length !== 4) return;
    const [w, s, e, n] = BBOX;
    url.searchParams.set('viewbox', `${w},${n},${e},${s}`);
    // no bounded=1; it can hide postcode features
}
function cpOnlyUrl({ postalCode }, withBias = true) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    url.searchParams.set('country', 'Mexico');
    url.searchParams.set('state', 'Jalisco');
    if (postalCode) url.searchParams.set('postalcode', String(postalCode));
    if (EMAIL) url.searchParams.set('email', EMAIL);
    addBias(url, withBias);
    return url;
}
function cpWithCityUrl({ postalCode, municipality }) {
    const u = new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('format', 'jsonv2');
    u.searchParams.set('addressdetails', '1');
    u.searchParams.set('limit', '5');
    u.searchParams.set('country', 'Mexico');
    u.searchParams.set('state', 'Jalisco');
    if (municipality) u.searchParams.set('city', municipality);
    if (postalCode) u.searchParams.set('postalcode', String(postalCode));
    if (EMAIL) u.searchParams.set('email', EMAIL);
    addBias(u, true);
    return u;
}
function cpWithCountyUrl({ postalCode, municipality }) {
    const u = new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('format', 'jsonv2');
    u.searchParams.set('addressdetails', '1');
    u.searchParams.set('limit', '5');
    u.searchParams.set('country', 'Mexico');
    u.searchParams.set('state', 'Jalisco');
    if (municipality) u.searchParams.set('county', municipality);
    if (postalCode) u.searchParams.set('postalcode', String(postalCode));
    if (EMAIL) u.searchParams.set('email', EMAIL);
    addBias(u, true);
    return u;
}
function cpFreetextUrl({ postalCode }) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', `${postalCode || ''}, Jalisco, Mexico`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'mx');
    if (EMAIL) url.searchParams.set('email', EMAIL);
    addBias(url, true);
    return url;
}
function freeTextUrl({ settlement, municipality }) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    const q = `${settlement || ''}, ${municipality || ''}, Jalisco, Mexico`;
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'mx');
    if (EMAIL) url.searchParams.set('email', EMAIL);
    addBias(url, true);
    return url;
}
function freeTextSettlementCpUrl({ settlement, postalCode }) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    const q = `${settlement || ''}, ${postalCode || ''}, Jalisco, Mexico`;
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'mx');
    if (EMAIL) url.searchParams.set('email', EMAIL);
    addBias(url, true);
    return url;
}
function muniOnlyUrl({ municipality }) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', `${municipality || ''}, Jalisco, Mexico`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'mx');
    if (EMAIL) url.searchParams.set('email', EMAIL);
    addBias(url, true);
    return url;
}

/* ---------- picking / scoring ---------- */
function isGoodCPMatch(cp, candidate) {
    const type = candidate.type || '';
    const postcode = candidate.address && (candidate.address.postcode || candidate.address.postal_code);
    if (type === 'postcode') return true;
    if (cp && postcode && String(cp) === String(postcode)) return true;
    return false;
}

// Always drop POIs/roads/rail; require Jalisco if address.state present; prefer muni match
function pickBestGeneric(postalCode, municipality, candidates) {
    const wantMuni = (municipality || '').toString().toLowerCase();
    const pool = candidates.filter(c => !BLACKLIST_CLASSES.has((c.class || '')));
    let best = null, bestScore = -Infinity;
    for (const c of pool) {
        const type = c.type || '';
        const cls = c.class || '';
        const addr = c.address || {};
        const muni = (addr.city || addr.town || addr.municipality || addr.county || '').toLowerCase();
        if (addr.state && addr.state.toLowerCase() !== 'jalisco') continue;

        let score = (c.importance || 0) * 10;
        if (WHITELIST_TYPES.has(type)) score += 12;
        if (WHITELIST_CLASSES.has(cls)) score += 6;
        if (wantMuni && muni.includes(wantMuni)) score += 6;

        if (score > bestScore) { bestScore = score; best = c; }
    }
    return best || null;
}

function confidenceTag(source, note) {
    if (source.startsWith('nominatim_cp') && note === 'postcode') return 'exact_postcode';
    if (source === 'nominatim_freetext' || source === 'nominatim_freetext_cp') return 'text_locality';
    if (source === 'nominatim_municipality') return 'municipality_fallback';
    if (note === 'no_result') return 'no_result';
    return 'unknown';
}

/* ---------- CP-first + fallbacks ---------- */
async function geocodeWithFallback(row) {
    // A0a) CP-only with bias
    let r = await nominatimFetch(cpOnlyUrl(row, true));
    if (r.ok && r.data.length) {
        const exact = r.data.find(c => isGoodCPMatch(row.postalCode, c));
        if (exact) return { lat: exact.lat, lon: exact.lon, geocodeSource: 'nominatim_cp_only_bias', geocodeNote: exact.type || 'ok' };
    }
    // A0b) CP-only without bias
    r = await nominatimFetch(cpOnlyUrl(row, false));
    if (r.ok && r.data.length) {
        const exact = r.data.find(c => isGoodCPMatch(row.postalCode, c));
        if (exact) return { lat: exact.lat, lon: exact.lon, geocodeSource: 'nominatim_cp_only', geocodeNote: exact.type || 'ok' };
    }
    // A1) CP + city
    r = await nominatimFetch(cpWithCityUrl(row));
    if (r.ok && r.data.length) {
        const exact = r.data.find(c => isGoodCPMatch(row.postalCode, c));
        if (exact) return { lat: exact.lat, lon: exact.lon, geocodeSource: 'nominatim_cp_city', geocodeNote: exact.type || 'ok' };
    }
    // A2) CP + county
    r = await nominatimFetch(cpWithCountyUrl(row));
    if (r.ok && r.data.length) {
        const exact = r.data.find(c => isGoodCPMatch(row.postalCode, c));
        if (exact) return { lat: exact.lat, lon: exact.lon, geocodeSource: 'nominatim_cp_county', geocodeNote: exact.type || 'ok' };
    }
    // A3) CP freetext (strict)
    r = await nominatimFetch(cpFreetextUrl(row));
    if (r.ok && r.data.length) {
        const exact = r.data.find(c => isGoodCPMatch(row.postalCode, c));
        if (exact) return { lat: exact.lat, lon: exact.lon, geocodeSource: 'nominatim_cp_freetext', geocodeNote: exact.type || 'ok' };
    }
    // B1) settlement + municipality freetext
    r = await nominatimFetch(freeTextUrl(row));
    if (r.ok && r.data.length) {
        const pick = pickBestGeneric(row.postalCode, row.municipality, r.data);
        if (pick) return { lat: pick.lat, lon: pick.lon, geocodeSource: 'nominatim_freetext', geocodeNote: pick.type || 'ok' };
    }
    // B2) settlement + CP freetext
    r = await nominatimFetch(freeTextSettlementCpUrl(row));
    if (r.ok && r.data.length) {
        const pick = pickBestGeneric(row.postalCode, row.municipality, r.data);
        if (pick) return { lat: pick.lat, lon: pick.lon, geocodeSource: 'nominatim_freetext_cp', geocodeNote: pick.type || 'ok' };
    }
    // C) Municipality centroid
    r = await nominatimFetch(muniOnlyUrl(row));
    if (r.ok && r.data.length) {
        const pick = pickBestGeneric('', row.municipality, r.data);
        if (pick) return { lat: pick.lat, lon: pick.lon, geocodeSource: 'nominatim_municipality', geocodeNote: pick.type || 'ok' };
    }
    return { lat: '', lon: '', geocodeSource: 'nominatim', geocodeNote: 'no_result' };
}

/* ---------- CSV IO ---------- */
function createCsvWriter(file, columns) {
    const exists = fs.existsSync(file);
    const stream = fs.createWriteStream(file, { flags: exists ? 'a' : 'w' });
    const stringifier = stringify({ header: !exists, columns });
    stringifier.pipe(stream);
    return { stringifier, stream };
}

function normalizeRowForOutput(row, geo) {
    const out = {}; for (const col of outputColumns) out[col] = '';
    for (const k of Object.values(headerMap)) if (k in row) out[k] = row[k] ?? '';
    out.lat = geo.lat ?? ''; out.lon = geo.lon ?? '';
    out.geocodeSource = geo.geocodeSource ?? 'nominatim';
    out.geocodeNote = geo.geocodeNote ?? 'ok';
    out.confidence = confidenceTag(out.geocodeSource, out.geocodeNote);
    out.missReason = (out.confidence === 'municipality_fallback' || out.confidence === 'no_result') ? out.geocodeNote : '';

    // New: numeric precision (3 exact CP, 2 locality, 1 municipality, 0 no result)
    const precisionMap = { exact_postcode: 3, text_locality: 2, municipality_fallback: 1, no_result: 0 };
    out.precision = precisionMap[out.confidence] ?? 0;

    return out;
}

/* ---------- main ---------- */
(async function main() {
    console.log(`Reading XLS: ${INPUT_XLS}`);
    if (!fs.existsSync(INPUT_XLS)) { console.error(`Input file not found`); process.exit(1); }

    const wb = XLSX.readFile(INPUT_XLS, { raw: false, cellDates: false });
    const names = wb.SheetNames;
    console.log(`Available sheets: ${names.join(', ')}`);

    let target =
        names.find(n => n === SHEET_NAME) ||
        names.find(n => n.toLowerCase() === SHEET_NAME.toLowerCase()) ||
        names[0];

    if (target !== SHEET_NAME) console.warn(`Requested sheet "${SHEET_NAME}" not found. Using "${target}".`);
    else console.log(`Using sheet: "${target}"`);

    const sheet = wb.Sheets[target];
    let rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }).map(toCamelEnglishHeaders);

    if (rows.length) {
        console.log(`Detected columns (first row): ${Object.keys(rows[0]).slice(0, 20).join(', ')}`);
    }

    const originalCount = rows.length;
    rows = rows.filter(r => (r.state || '').toUpperCase() === STATE_FILTER);
    console.log(`Rows read: ${originalCount}, after state filter (${STATE_FILTER}): ${rows.length}`);

    // No dedupe: apply START_AT / SAMPLE_LIMIT on the filtered rows directly
    if (START_AT || SAMPLE_LIMIT) {
        const start = Math.min(START_AT, rows.length);
        const end = SAMPLE_LIMIT ? Math.min(rows.length, start + SAMPLE_LIMIT) : rows.length;
        rows = rows.slice(start, end);
        console.log(`Processing raw slice [${start}..${end}) → ${rows.length} rows (no dedupe).`);
    } else {
        console.log(`Processing all ${rows.length} rows (no dedupe).`);
    }

    const doneKeys = await readAlreadyProcessedKeys();
    console.log(`Already in output with coords (by resume key ${RESUME_KEY_FIELDS.join('|')}): ${doneKeys.size}`);

    const { stringifier, stream } = createCsvWriter(OUTPUT_CSV, outputColumns);
    const missesPath = path.resolve(path.dirname(OUTPUT_CSV), 'misses.csv');
    const { stringifier: missStr, stream: missStream } = createCsvWriter(missesPath, outputColumns);

    let processed = 0, skipped = 0, errors = 0, lastCallAt = 0;
    const startedAt = Date.now();

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const key = makeResumeKey(row);
        const label = `${i + 1}/${rows.length} [${key}]`;

        if (!row.municipality) { console.warn(`${label} SKIP (missing municipality)`); skipped++; continue; }

        if (doneKeys.has(key)) {
            console.log(`${label} SKIP (already in output)`);
            skipped++;
            continue;
        }

        const since = Date.now() - lastCallAt;
        if (since < ONE_SECOND_MS) await sleep(ONE_SECOND_MS - since);

        try {
            const geo = await geocodeWithFallback(row);
            lastCallAt = Date.now();

            const out = normalizeRowForOutput(row, geo);
            stringifier.write(out);
            processed++;

            if (out.confidence === 'municipality_fallback' || out.confidence === 'no_result') {
                missStr.write(out);
            }

            const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
            console.log(`${label} → CP=${row.postalCode} (alt=${row.postalCodeAlt || '-'}) -> lat=${out.lat || '-'} lon=${out.lon || '-'} [${out.geocodeSource}/${out.geocodeNote} | ${out.confidence} p=${out.precision}] | processed=${processed}, skipped=${skipped}, errors=${errors}, elapsed=${elapsed}s`);
        } catch (e) {
            errors++; lastCallAt = Date.now();
            const out = normalizeRowForOutput(row, { lat: '', lon: '', geocodeSource: 'nominatim', geocodeNote: `error_${e?.message || 'unknown'}` });
            out.confidence = 'no_result'; out.missReason = out.geocodeNote; out.precision = 0;
            stringifier.write(out);
            missStr.write(out);
            console.error(`${label} ERROR: ${e?.message || e}`);
        }
    }

    stringifier.end(); missStr.end();
    await Promise.all([
        new Promise(res => stream.on('finish', res)),
        new Promise(res => missStream.on('finish', res))
    ]);

    console.log(`Done. Wrote:
  - ${path.resolve(OUTPUT_CSV)}
  - ${missesPath}
  | processed=${processed}, skipped=${skipped}, errors=${errors}`);
})();
