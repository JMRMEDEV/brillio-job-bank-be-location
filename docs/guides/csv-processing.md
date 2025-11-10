# CSV Processing Guide

Complete guide for handling CSV data in the Location Service.

## Overview

The Location Service processes SEPOMEX (Mexican Postal Service) data for Jalisco, Mexico stored as CSV files in Firebase Storage. This guide covers the data pipeline, processing logic, and optimization strategies.

## Data Source

### SEPOMEX Data Structure

**Source File**: `gs://job-bank-{env}.appspot.com/location/jalisco_cp_geocoded.csv`

**Original SEPOMEX Headers** (Spanish):
```csv
d_codigo,d_asenta,d_tipo_asenta,d_mnpio,d_estado,d_ciudad,d_cp,
c_estado,c_oficina,c_cp,c_tipo_asenta,c_mnpio,id_asenta_cpcons,
d_zona,c_cve_ciudad
```

**Processed Headers** (English camelCase):
```csv
postalCode,settlement,settlementType,municipality,state,city,
postalCodeAlt,stateCode,officeCode,postalCodeKey,settlementTypeCode,
municipalityCode,settlementIdCpcons,zone,cityCode,
lat,lon,geocodeSource,geocodeNote,confidence,missReason,precision
```

### Data Characteristics

- **Total Records**: ~15,000+ postal code entries
- **Coverage**: Complete Jalisco state
- **Municipalities**: 125 unique municipalities
- **Settlements**: ~8,000+ unique settlements
- **Geocoding**: OpenStreetMap Nominatim coordinates
- **Precision Levels**: 0-3 (see [Geocoding Guide](./geocoding.md))

## CSV Processing Architecture

### Real-Time Processing Pattern

The service uses a real-time CSV processing pattern without persistent caching:

```typescript
// functions/src/helpers/csv-helpers.ts
import { parse } from 'csv-parse';
import * as admin from 'firebase-admin';

interface LocationRecord {
  postalCode: string;
  settlement: string;
  municipality: string;
  state: string;
  lat: string;
  lon: string;
  precision: string;
}

async function loadCsvData(): Promise<LocationRecord[]> {
  const bucket = admin.storage().bucket();
  const file = bucket.file('location/jalisco_cp_geocoded.csv');
  
  // Download CSV file from Firebase Storage
  const [buffer] = await file.download();
  const csvContent = buffer.toString('utf-8');
  
  return new Promise((resolve, reject) => {
    const records: LocationRecord[] = [];
    
    parse(csvContent, {
      columns: true,           // Use first row as headers
      skip_empty_lines: true,  // Skip empty rows
      trim: true              // Trim whitespace
    })
    .on('data', (record) => {
      // Filter for Jalisco records only
      if (record.state === 'Jalisco') {
        records.push(record);
      }
    })
    .on('end', () => resolve(records))
    .on('error', reject);
  });
}
```

### Benefits of Real-Time Processing

1. **Data Freshness**: Always uses latest CSV data
2. **Stateless Design**: No cache invalidation needed
3. **Simple Updates**: Replace CSV file to update data
4. **Memory Efficiency**: Data loaded per request
5. **Consistency**: Same data across all function instances

### Performance Considerations

**Memory Usage**:
- CSV file size: ~2-3 MB
- Parsed records: ~15,000 objects
- Memory footprint: ~50-100 MB per request
- Function memory: 256 MiB (sufficient)

**Processing Time**:
- CSV download: ~100-200ms
- CSV parsing: ~200-500ms
- Data filtering: ~50-100ms
- Total processing: ~500-1000ms

## Data Processing Functions

### 1. Municipality Extraction

```typescript
export async function getMunicipalities(): Promise<string[]> {
  const records = await loadCsvData();
  const municipalities = new Set<string>();
  
  records.forEach(record => {
    if (record.municipality && record.municipality.trim()) {
      municipalities.add(record.municipality.trim());
    }
  });
  
  return Array.from(municipalities).sort();
}
```

**Features**:
- **Deduplication**: Uses Set for unique values
- **Sorting**: Alphabetical order for consistency
- **Validation**: Filters empty/null values
- **Trimming**: Removes whitespace

### 2. Settlement Search

```typescript
export async function searchSettlements(query: string): Promise<string[]> {
  const records = await loadCsvData();
  const settlements = new Set<string>();
  const lowerQuery = query.toLowerCase();
  
  records.forEach(record => {
    if (record.settlement && 
        record.settlement.toLowerCase().includes(lowerQuery)) {
      settlements.add(record.settlement);
    }
  });
  
  return Array.from(settlements).sort();
}
```

**Features**:
- **Case Insensitive**: Converts to lowercase for matching
- **Partial Matching**: Uses `includes()` for substring search
- **Deduplication**: Set-based unique results
- **Performance**: O(n) linear search through records

### 3. Postal Code Validation

```typescript
export async function searchPostalCode(postalCode: string): Promise<boolean> {
  const records = await loadCsvData();
  
  return records.some(record => 
    record.postalCode === postalCode
  );
}
```

**Features**:
- **Exact Match**: Uses strict equality
- **Early Exit**: `some()` stops on first match
- **Boolean Result**: Simple true/false response

### 4. Coordinate Lookup

```typescript
export async function searchLocationCoordinates(
  municipality: string,
  neighborhood: string,
  zipCode: string
): Promise<{latitude: number, longitude: number} | null> {
  const records = await loadCsvData();
  
  const match = records.find(record =>
    record.municipality === municipality &&
    record.settlement === neighborhood &&
    record.postalCode === zipCode
  );
  
  if (match && match.lat && match.lon) {
    return {
      latitude: parseFloat(match.lat),
      longitude: parseFloat(match.lon)
    };
  }
  
  return null;
}
```

**Features**:
- **Exact Matching**: All three parameters must match
- **Type Conversion**: String to number for coordinates
- **Null Handling**: Returns null if no match or invalid coordinates
- **Data Mapping**: CSV `lat`/`lon` → API `latitude`/`longitude`

## Data Quality and Validation

### Input Data Validation

```typescript
function validateRecord(record: any): boolean {
  // Required fields validation
  if (!record.postalCode || !record.municipality || !record.state) {
    return false;
  }
  
  // Postal code format validation
  if (!/^\d{5}$/.test(record.postalCode)) {
    return false;
  }
  
  // State filter
  if (record.state !== 'Jalisco') {
    return false;
  }
  
  // Coordinate validation (if present)
  if (record.lat && record.lon) {
    const lat = parseFloat(record.lat);
    const lon = parseFloat(record.lon);
    
    // Jalisco coordinate bounds check
    if (lat < 18.7 || lat > 22.9 || lon < -105.8 || lon > -101.4) {
      return false;
    }
  }
  
  return true;
}
```

### Data Cleaning Pipeline

```typescript
function cleanRecord(record: any): LocationRecord {
  return {
    postalCode: record.postalCode?.trim() || '',
    settlement: record.settlement?.trim() || '',
    municipality: record.municipality?.trim() || '',
    state: record.state?.trim() || '',
    lat: record.lat?.trim() || '',
    lon: record.lon?.trim() || '',
    precision: record.precision?.trim() || '0'
  };
}
```

## Performance Optimization

### Memory Optimization

**Streaming Parser** (for large files):
```typescript
import { Transform } from 'stream';

class LocationFilter extends Transform {
  constructor() {
    super({ objectMode: true });
  }
  
  _transform(record: any, encoding: string, callback: Function) {
    if (record.state === 'Jalisco' && validateRecord(record)) {
      this.push(cleanRecord(record));
    }
    callback();
  }
}

async function loadCsvDataStreaming(): Promise<LocationRecord[]> {
  const bucket = admin.storage().bucket();
  const file = bucket.file('location/jalisco_cp_geocoded.csv');
  
  const records: LocationRecord[] = [];
  
  return new Promise((resolve, reject) => {
    file.createReadStream()
      .pipe(parse({ columns: true, skip_empty_lines: true }))
      .pipe(new LocationFilter())
      .on('data', (record) => records.push(record))
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}
```

### Caching Strategies

**Function-Level Caching**:
```typescript
let cachedData: LocationRecord[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getCachedCsvData(): Promise<LocationRecord[]> {
  const now = Date.now();
  
  if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedData;
  }
  
  cachedData = await loadCsvData();
  cacheTimestamp = now;
  
  return cachedData;
}
```

**Note**: Function-level caching is not recommended for Firebase Functions due to instance lifecycle unpredictability.

### Search Optimization

**Indexed Search** (for frequent queries):
```typescript
interface SearchIndex {
  municipalities: Set<string>;
  settlements: Map<string, string[]>; // municipality -> settlements
  postalCodes: Set<string>;
}

async function buildSearchIndex(): Promise<SearchIndex> {
  const records = await loadCsvData();
  const index: SearchIndex = {
    municipalities: new Set(),
    settlements: new Map(),
    postalCodes: new Set()
  };
  
  records.forEach(record => {
    // Index municipalities
    index.municipalities.add(record.municipality);
    
    // Index settlements by municipality
    if (!index.settlements.has(record.municipality)) {
      index.settlements.set(record.municipality, []);
    }
    index.settlements.get(record.municipality)!.push(record.settlement);
    
    // Index postal codes
    index.postalCodes.add(record.postalCode);
  });
  
  return index;
}
```

## Error Handling

### CSV Processing Errors

```typescript
async function loadCsvDataWithErrorHandling(): Promise<LocationRecord[]> {
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file('location/jalisco_cp_geocoded.csv');
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('CSV file not found in Firebase Storage');
    }
    
    // Download with timeout
    const [buffer] = await Promise.race([
      file.download(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Download timeout')), 30000)
      )
    ]) as [Buffer];
    
    const csvContent = buffer.toString('utf-8');
    
    // Validate CSV content
    if (!csvContent || csvContent.length < 100) {
      throw new Error('Invalid or empty CSV file');
    }
    
    return await parseCsvContent(csvContent);
    
  } catch (error) {
    console.error('CSV processing error:', error);
    
    // Return empty array or cached data as fallback
    return [];
  }
}
```

### Data Validation Errors

```typescript
function validateCsvStructure(records: any[]): void {
  if (!records || records.length === 0) {
    throw new Error('No records found in CSV');
  }
  
  const firstRecord = records[0];
  const requiredFields = ['postalCode', 'municipality', 'settlement'];
  
  for (const field of requiredFields) {
    if (!(field in firstRecord)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Validate data types
  const jaliscoRecords = records.filter(r => r.state === 'Jalisco');
  if (jaliscoRecords.length === 0) {
    throw new Error('No Jalisco records found in CSV');
  }
}
```

## Data Updates

### CSV File Replacement

**Manual Update Process**:
```bash
# Upload new CSV file to Firebase Storage
gsutil cp jalisco_cp_geocoded.csv gs://job-bank-dev.appspot.com/location/
gsutil cp jalisco_cp_geocoded.csv gs://job-bank-qa.appspot.com/location/
gsutil cp jalisco_cp_geocoded.csv gs://job-bank-prod.appspot.com/location/

# No function redeployment needed - data loaded dynamically
```

**Automated Update Script**:
```typescript
// scripts/update-csv-data.ts
import * as admin from 'firebase-admin';

async function updateCsvData(filePath: string, environment: string) {
  const bucket = admin.storage().bucket(`job-bank-${environment}.appspot.com`);
  const file = bucket.file('location/jalisco_cp_geocoded.csv');
  
  // Upload new file
  await file.save(fs.readFileSync(filePath), {
    metadata: {
      contentType: 'text/csv',
      cacheControl: 'public, max-age=3600'
    }
  });
  
  console.log(`CSV updated for ${environment} environment`);
}
```

### Data Versioning

**Version Tracking**:
```typescript
interface CsvMetadata {
  version: string;
  uploadDate: string;
  recordCount: number;
  checksum: string;
}

async function getCsvMetadata(): Promise<CsvMetadata> {
  const bucket = admin.storage().bucket();
  const file = bucket.file('location/jalisco_cp_geocoded.csv');
  
  const [metadata] = await file.getMetadata();
  
  return {
    version: metadata.metadata?.version || 'unknown',
    uploadDate: metadata.timeCreated || '',
    recordCount: parseInt(metadata.metadata?.recordCount || '0'),
    checksum: metadata.md5Hash || ''
  };
}
```

## Monitoring and Analytics

### Processing Metrics

```typescript
interface ProcessingMetrics {
  downloadTime: number;
  parseTime: number;
  filterTime: number;
  totalRecords: number;
  validRecords: number;
  memoryUsage: number;
}

async function measureCsvProcessing(): Promise<ProcessingMetrics> {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();
  
  // Download phase
  const downloadStart = process.hrtime.bigint();
  const csvContent = await downloadCsvFile();
  const downloadTime = Number(process.hrtime.bigint() - downloadStart) / 1000000;
  
  // Parse phase
  const parseStart = process.hrtime.bigint();
  const allRecords = await parseCsvContent(csvContent);
  const parseTime = Number(process.hrtime.bigint() - parseStart) / 1000000;
  
  // Filter phase
  const filterStart = process.hrtime.bigint();
  const validRecords = allRecords.filter(r => r.state === 'Jalisco');
  const filterTime = Number(process.hrtime.bigint() - filterStart) / 1000000;
  
  const endMemory = process.memoryUsage();
  
  return {
    downloadTime,
    parseTime,
    filterTime,
    totalRecords: allRecords.length,
    validRecords: validRecords.length,
    memoryUsage: endMemory.heapUsed - startMemory.heapUsed
  };
}
```

### Data Quality Monitoring

```typescript
interface DataQualityReport {
  totalRecords: number;
  validCoordinates: number;
  missingCoordinates: number;
  invalidPostalCodes: number;
  duplicateRecords: number;
  precisionDistribution: Record<string, number>;
}

function generateDataQualityReport(records: LocationRecord[]): DataQualityReport {
  const report: DataQualityReport = {
    totalRecords: records.length,
    validCoordinates: 0,
    missingCoordinates: 0,
    invalidPostalCodes: 0,
    duplicateRecords: 0,
    precisionDistribution: {}
  };
  
  const seenRecords = new Set<string>();
  
  records.forEach(record => {
    // Check coordinates
    if (record.lat && record.lon && 
        !isNaN(parseFloat(record.lat)) && 
        !isNaN(parseFloat(record.lon))) {
      report.validCoordinates++;
    } else {
      report.missingCoordinates++;
    }
    
    // Check postal codes
    if (!/^\d{5}$/.test(record.postalCode)) {
      report.invalidPostalCodes++;
    }
    
    // Check duplicates
    const recordKey = `${record.postalCode}-${record.settlement}-${record.municipality}`;
    if (seenRecords.has(recordKey)) {
      report.duplicateRecords++;
    } else {
      seenRecords.add(recordKey);
    }
    
    // Precision distribution
    const precision = record.precision || '0';
    report.precisionDistribution[precision] = 
      (report.precisionDistribution[precision] || 0) + 1;
  });
  
  return report;
}
```

## Best Practices

### 1. Memory Management

- **Stream Processing**: Use streams for large CSV files
- **Garbage Collection**: Clear references after processing
- **Memory Monitoring**: Track memory usage patterns
- **Function Sizing**: Allocate appropriate memory (256MiB minimum)

### 2. Error Resilience

- **Graceful Degradation**: Return partial results on errors
- **Retry Logic**: Implement exponential backoff for downloads
- **Fallback Data**: Cache last known good data
- **Monitoring**: Log processing errors and metrics

### 3. Performance Optimization

- **Lazy Loading**: Load data only when needed
- **Efficient Algorithms**: Use appropriate data structures
- **Early Exit**: Stop processing when possible
- **Batch Processing**: Group similar operations

### 4. Data Integrity

- **Validation**: Validate all input data
- **Sanitization**: Clean and normalize data
- **Consistency**: Maintain consistent data formats
- **Versioning**: Track data changes and versions
