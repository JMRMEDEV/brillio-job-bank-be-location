# Geocoding Guide

Complete guide for SEPOMEX integration and geocoding processes in the Location Service.

## Overview

The Location Service uses geocoded SEPOMEX (Mexican Postal Service) data for Jalisco, Mexico. This guide covers the geocoding pipeline, data quality, and coordinate systems used.

## SEPOMEX Data Integration

### Data Source

**SEPOMEX (Servicio Postal Mexicano)**:
- Official Mexican postal service database
- Complete postal code coverage for Mexico
- Administrative boundary definitions
- Settlement type classifications

**Jalisco Subset**:
- State filter: `d_estado = "Jalisco"`
- 125 municipalities
- ~15,000+ postal code records
- Complete coverage of Jalisco state

### Original Data Structure

**Raw SEPOMEX Fields** (Spanish):
```csv
d_codigo,           # Postal code (5 digits)
d_asenta,           # Settlement name
d_tipo_asenta,      # Settlement type
d_mnpio,            # Municipality name
d_estado,           # State name
d_ciudad,           # City name
d_cp,               # Alternative postal code
c_estado,           # State code
c_oficina,          # Office code
c_cp,               # Postal code key
c_tipo_asenta,      # Settlement type code
c_mnpio,            # Municipality code
id_asenta_cpcons,   # Settlement ID
d_zona,             # Zone type
c_cve_ciudad        # City code
```

**Processed Fields** (English):
```csv
postalCode,         # Primary postal code
settlement,         # Settlement/neighborhood name
settlementType,     # Type of settlement
municipality,       # Municipality name
state,              # State name (Jalisco)
city,               # City name
postalCodeAlt,      # Alternative postal code
stateCode,          # State numeric code
officeCode,         # Postal office code
postalCodeKey,      # Internal postal key
settlementTypeCode, # Settlement type numeric code
municipalityCode,   # Municipality numeric code
settlementIdCpcons, # Unique settlement identifier
zone,               # Urban/rural zone designation
cityCode            # City numeric code
```

## Geocoding Pipeline

### Geocoding Process Overview

The geocoding was performed using OpenStreetMap Nominatim with a structured approach:

```
SEPOMEX Data → Geocoding Pipeline → Geocoded CSV → Location Service
     ↓              ↓                    ↓              ↓
Raw postal    Address matching     Coordinates +    Real-time API
   codes      & validation         confidence       responses
```

### Geocoding Strategy

**Hierarchical Geocoding Approach**:

1. **Postal Code Geocoding** (Highest Precision):
   ```
   postalcode=44100, state=Jalisco, country=Mexico
   ```

2. **Postal Code + Municipality**:
   ```
   postalcode=44100, city=Guadalajara, state=Jalisco, country=Mexico
   postalcode=44100, county=Guadalajara, state=Jalisco, country=Mexico
   ```

3. **Freetext Postal Code**:
   ```
   "44100, Jalisco, Mexico"
   ```

4. **Settlement Geocoding** (Medium Precision):
   ```
   "Guadalajara Centro, Guadalajara, Jalisco, Mexico"
   "Guadalajara Centro, 44100, Jalisco, Mexico"
   ```

5. **Municipality Fallback** (Low Precision):
   ```
   "Guadalajara, Jalisco, Mexico"
   ```

### Geocoding Implementation

**Pipeline Script** (`functions/scripts/create-csv-database/geocode-cp.js`):

```javascript
// Geocoding configuration
const GEOCODING_CONFIG = {
  baseUrl: 'https://nominatim.openstreetmap.org/search',
  userAgent: 'jalisco-geocoder/1.0 (contact@example.com)',
  requestDelay: 1000, // 1 request per second
  maxRetries: 5,
  timeout: 10000
};

// Geocoding strategies in order of preference
const GEOCODING_STRATEGIES = [
  {
    name: 'nominatim_cp_only_bias',
    buildQuery: (record) => ({
      postalcode: record.postalCode,
      state: 'Jalisco',
      country: 'Mexico',
      viewbox: '-105.8,18.7,-101.4,22.9', // Jalisco bounds
      bounded: 1
    })
  },
  {
    name: 'nominatim_cp_only',
    buildQuery: (record) => ({
      postalcode: record.postalCode,
      state: 'Jalisco',
      country: 'Mexico'
    })
  },
  {
    name: 'nominatim_cp_city',
    buildQuery: (record) => ({
      postalcode: record.postalCode,
      city: record.municipality,
      state: 'Jalisco',
      country: 'Mexico'
    })
  },
  {
    name: 'nominatim_cp_county',
    buildQuery: (record) => ({
      postalcode: record.postalCode,
      county: record.municipality,
      state: 'Jalisco',
      country: 'Mexico'
    })
  },
  {
    name: 'nominatim_cp_freetext',
    buildQuery: (record) => ({
      q: `${record.postalCode}, Jalisco, Mexico`
    })
  },
  {
    name: 'nominatim_freetext',
    buildQuery: (record) => ({
      q: `${record.settlement}, ${record.municipality}, Jalisco, Mexico`
    })
  },
  {
    name: 'nominatim_freetext_cp',
    buildQuery: (record) => ({
      q: `${record.settlement}, ${record.postalCode}, Jalisco, Mexico`
    })
  },
  {
    name: 'nominatim_municipality',
    buildQuery: (record) => ({
      q: `${record.municipality}, Jalisco, Mexico`
    })
  }
];
```

### Confidence and Precision System

**Confidence Levels**:

1. **exact_postcode** (Precision: 3):
   - Nominatim result type is `postcode`
   - Address contains exact postal code match
   - Highest accuracy for location queries

2. **text_locality** (Precision: 2):
   - Nominatim result type is `neighbourhood`, `suburb`, or `locality`
   - Settlement-level accuracy
   - Good for general area queries

3. **municipality_fallback** (Precision: 1):
   - Nominatim result type is `administrative`
   - Municipality centroid
   - Lowest accuracy, administrative fallback

4. **no_result** (Precision: 0):
   - No geocoding result found
   - No coordinates available
   - Excluded from coordinate queries

**Precision Validation**:
```javascript
function determineConfidence(nominatimResult, originalRecord) {
  const resultType = nominatimResult.type;
  const addressPostcode = nominatimResult.address?.postcode;
  
  // Exact postcode match
  if (resultType === 'postcode' || 
      addressPostcode === originalRecord.postalCode) {
    return {
      confidence: 'exact_postcode',
      precision: 3
    };
  }
  
  // Locality/settlement match
  if (['neighbourhood', 'suburb', 'locality', 'hamlet', 'village'].includes(resultType)) {
    return {
      confidence: 'text_locality',
      precision: 2
    };
  }
  
  // Municipality fallback
  if (['administrative', 'city', 'town'].includes(resultType)) {
    return {
      confidence: 'municipality_fallback',
      precision: 1
    };
  }
  
  // No valid result
  return {
    confidence: 'no_result',
    precision: 0
  };
}
```

## Coordinate System

### Geographic Coordinate System

**Coordinate Reference System**: WGS84 (EPSG:4326)
- **Datum**: World Geodetic System 1984
- **Units**: Decimal degrees
- **Precision**: 6-7 decimal places (~1 meter accuracy)

**Jalisco Coordinate Bounds**:
```javascript
const JALISCO_BOUNDS = {
  north: 22.9,   // Northern boundary
  south: 18.7,   // Southern boundary
  east: -101.4,  // Eastern boundary
  west: -105.8   // Western boundary
};
```

### Coordinate Validation

**Bounds Checking**:
```typescript
function validateCoordinates(lat: number, lon: number): boolean {
  // Check if coordinates are within Jalisco bounds
  return lat >= 18.7 && lat <= 22.9 && 
         lon >= -105.8 && lon <= -101.4;
}

function sanitizeCoordinates(lat: string, lon: string): {latitude: number, longitude: number} | null {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  
  // Validate numeric conversion
  if (isNaN(latitude) || isNaN(longitude)) {
    return null;
  }
  
  // Validate bounds
  if (!validateCoordinates(latitude, longitude)) {
    return null;
  }
  
  return {
    latitude: Math.round(latitude * 1000000) / 1000000,  // 6 decimal places
    longitude: Math.round(longitude * 1000000) / 1000000
  };
}
```

### Coordinate Precision

**Decimal Degree Precision**:
- **1 decimal place**: ~11 km accuracy
- **2 decimal places**: ~1.1 km accuracy
- **3 decimal places**: ~110 m accuracy
- **4 decimal places**: ~11 m accuracy
- **5 decimal places**: ~1.1 m accuracy
- **6 decimal places**: ~0.11 m accuracy (used in service)

## Data Quality Metrics

### Geocoding Success Rates

**Expected Quality Distribution**:
```typescript
interface QualityMetrics {
  totalRecords: number;
  exactPostcode: number;      // Precision 3: ~60-70%
  textLocality: number;       // Precision 2: ~20-25%
  municipalityFallback: number; // Precision 1: ~5-10%
  noResult: number;           // Precision 0: ~5-10%
}
```

**Quality Validation**:
```typescript
function validateDataQuality(records: LocationRecord[]): QualityMetrics {
  const metrics: QualityMetrics = {
    totalRecords: records.length,
    exactPostcode: 0,
    textLocality: 0,
    municipalityFallback: 0,
    noResult: 0
  };
  
  records.forEach(record => {
    const precision = parseInt(record.precision || '0');
    
    switch (precision) {
      case 3: metrics.exactPostcode++; break;
      case 2: metrics.textLocality++; break;
      case 1: metrics.municipalityFallback++; break;
      case 0: metrics.noResult++; break;
    }
  });
  
  return metrics;
}
```

### Data Quality Checks

**Coordinate Validation**:
```typescript
function validateGeocodeQuality(records: LocationRecord[]): string[] {
  const issues: string[] = [];
  
  // Check for missing coordinates
  const missingCoords = records.filter(r => !r.lat || !r.lon);
  if (missingCoords.length > 0) {
    issues.push(`${missingCoords.length} records missing coordinates`);
  }
  
  // Check for invalid coordinates
  const invalidCoords = records.filter(r => {
    if (!r.lat || !r.lon) return false;
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    return !validateCoordinates(lat, lon);
  });
  
  if (invalidCoords.length > 0) {
    issues.push(`${invalidCoords.length} records with invalid coordinates`);
  }
  
  // Check precision distribution
  const precisionCounts = records.reduce((acc, r) => {
    const precision = r.precision || '0';
    acc[precision] = (acc[precision] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const lowPrecisionCount = (precisionCounts['0'] || 0) + (precisionCounts['1'] || 0);
  const lowPrecisionPercent = (lowPrecisionCount / records.length) * 100;
  
  if (lowPrecisionPercent > 20) {
    issues.push(`${lowPrecisionPercent.toFixed(1)}% records have low precision (0-1)`);
  }
  
  return issues;
}
```

## Geocoding Service Integration

### Location Service Usage

**Coordinate Lookup**:
```typescript
export async function searchLocationCoordinates(
  municipality: string,
  neighborhood: string,
  zipCode: string
): Promise<{latitude: number, longitude: number} | null> {
  const records = await loadCsvData();
  
  // Find exact match
  const match = records.find(record =>
    record.municipality === municipality &&
    record.settlement === neighborhood &&
    record.postalCode === zipCode
  );
  
  if (match && match.lat && match.lon) {
    // Validate and sanitize coordinates
    const coords = sanitizeCoordinates(match.lat, match.lon);
    
    // Only return high-precision coordinates
    const precision = parseInt(match.precision || '0');
    if (coords && precision >= 2) {
      return coords;
    }
  }
  
  return null;
}
```

**Precision Filtering**:
```typescript
// Filter by minimum precision level
function filterByPrecision(records: LocationRecord[], minPrecision: number = 2): LocationRecord[] {
  return records.filter(record => {
    const precision = parseInt(record.precision || '0');
    return precision >= minPrecision;
  });
}

// Get high-quality coordinates only
export async function getHighQualityCoordinates(
  municipality: string,
  neighborhood: string,
  zipCode: string
): Promise<{latitude: number, longitude: number} | null> {
  const records = await loadCsvData();
  const highQualityRecords = filterByPrecision(records, 2); // Precision 2+
  
  const match = highQualityRecords.find(record =>
    record.municipality === municipality &&
    record.settlement === neighborhood &&
    record.postalCode === zipCode
  );
  
  if (match && match.lat && match.lon) {
    return sanitizeCoordinates(match.lat, match.lon);
  }
  
  return null;
}
```

## Geocoding Pipeline Maintenance

### Data Updates

**Re-geocoding Process**:
```bash
# 1. Update SEPOMEX source data
# Download latest SEPOMEX data from official source

# 2. Run geocoding pipeline
cd functions/scripts/create-csv-database
node geocode-cp.js

# 3. Validate output quality
node validate-geocoding.js

# 4. Upload to Firebase Storage
gsutil cp jalisco_cp_geocoded.csv gs://job-bank-dev.appspot.com/location/
gsutil cp jalisco_cp_geocoded.csv gs://job-bank-qa.appspot.com/location/
gsutil cp jalisco_cp_geocoded.csv gs://job-bank-prod.appspot.com/location/
```

**Quality Assurance**:
```javascript
// validate-geocoding.js
const fs = require('fs');
const { parse } = require('csv-parse');

async function validateGeocodingOutput(csvPath) {
  const records = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(parse({ columns: true, skip_empty_lines: true }))
      .on('data', (record) => records.push(record))
      .on('end', () => {
        const metrics = validateDataQuality(records);
        const issues = validateGeocodeQuality(records);
        
        console.log('Geocoding Quality Report:');
        console.log('Total Records:', metrics.totalRecords);
        console.log('Exact Postcode (3):', metrics.exactPostcode, `(${(metrics.exactPostcode/metrics.totalRecords*100).toFixed(1)}%)`);
        console.log('Text Locality (2):', metrics.textLocality, `(${(metrics.textLocality/metrics.totalRecords*100).toFixed(1)}%)`);
        console.log('Municipality Fallback (1):', metrics.municipalityFallback, `(${(metrics.municipalityFallback/metrics.totalRecords*100).toFixed(1)}%)`);
        console.log('No Result (0):', metrics.noResult, `(${(metrics.noResult/metrics.totalRecords*100).toFixed(1)}%)`);
        
        if (issues.length > 0) {
          console.log('\nQuality Issues:');
          issues.forEach(issue => console.log('⚠️', issue));
        } else {
          console.log('\n✅ No quality issues detected');
        }
        
        resolve({ metrics, issues });
      })
      .on('error', reject);
  });
}

// Run validation
validateGeocodingOutput('./jalisco_cp_geocoded.csv')
  .then(result => {
    if (result.issues.length === 0) {
      console.log('\n🎉 Geocoding validation passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Geocoding validation failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
  });
```

### Performance Optimization

**Geocoding Rate Limiting**:
```javascript
// Respect Nominatim usage policy
const RATE_LIMIT = {
  requestsPerSecond: 1,
  maxConcurrent: 1,
  retryDelay: 1000,
  maxRetries: 5
};

class RateLimitedGeocoder {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastRequestTime = 0;
  }
  
  async geocode(query) {
    return new Promise((resolve, reject) => {
      this.queue.push({ query, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const { query, resolve, reject } = this.queue.shift();
      
      try {
        // Ensure rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minDelay = 1000 / RATE_LIMIT.requestsPerSecond;
        
        if (timeSinceLastRequest < minDelay) {
          await new Promise(r => setTimeout(r, minDelay - timeSinceLastRequest));
        }
        
        const result = await this.makeRequest(query);
        this.lastRequestTime = Date.now();
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
    
    this.processing = false;
  }
  
  async makeRequest(query) {
    // Implement actual Nominatim request with retries
    // ... implementation details
  }
}
```

## Best Practices

### 1. Geocoding Ethics

**OpenStreetMap Nominatim Usage Policy**:
- Maximum 1 request per second
- Include User-Agent with contact information
- Respect rate limits and implement backoff
- Don't abuse the free service
- Consider commercial alternatives for high volume

### 2. Data Quality

**Validation Strategies**:
- Always validate coordinate bounds
- Check precision levels before using coordinates
- Implement fallback strategies for missing data
- Monitor geocoding success rates

### 3. Performance

**Optimization Techniques**:
- Cache geocoding results
- Use appropriate precision levels
- Implement efficient search algorithms
- Monitor response times

### 4. Maintenance

**Regular Tasks**:
- Update SEPOMEX source data quarterly
- Re-geocode when address formats change
- Monitor data quality metrics
- Validate coordinate accuracy

## Troubleshooting

### Common Geocoding Issues

**Low Success Rates**:
- Check Nominatim service availability
- Verify address format consistency
- Review rate limiting implementation
- Validate input data quality

**Coordinate Accuracy**:
- Check precision levels in data
- Validate coordinate bounds
- Compare with known reference points
- Review geocoding strategy effectiveness

**Performance Issues**:
- Monitor request rates
- Implement proper caching
- Optimize search algorithms
- Consider data preprocessing
