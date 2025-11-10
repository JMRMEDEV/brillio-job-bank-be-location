# Location Service API Reference

Complete API documentation for the Service Club Location Service endpoints.

## Base URLs

| Environment | Base URL |
|-------------|----------|
| Development | `https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2` |
| QA | `https://us-central1-job-bank-qa.cloudfunctions.net/locationsAPIV2` |
| Production | `https://us-central1-job-bank-prod.cloudfunctions.net/locationsAPIV2` |

## Authentication

**Access Level**: Public API with optional authentication

- **Anonymous Access**: All endpoints accessible without authentication
- **Authenticated Access**: Optional Firebase ID token in `Authorization` header
- **Supported Roles**: All authenticated roles (contractor, admin, superadmin, owner)

### Authentication Header (Optional)

```http
Authorization: <firebase-id-token>
```

**Note**: No `Bearer` prefix required. Token is optional for all endpoints.

## Endpoints Overview

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/municipalities` | GET | Get all municipalities | None |
| `/settlements/search` | GET | Search settlements | `query` (required) |
| `/zipCode/check` | GET | Validate postal code | `postalCode` (required) |
| `/location/coordinates` | GET | Get GPS coordinates | `municipality`, `neighborhood`, `zipCode` (all required) |

---

## GET /municipalities

Get all unique municipalities in Jalisco, Mexico.

### Request

```http
GET /municipalities
```

**Parameters**: None

### Response

**Success (200)**:
```json
{
  "municipalities": [
    "Acatic",
    "Acatlán de Juárez", 
    "Ahualulco de Mercado",
    "Amacueca",
    "Amatitán",
    "Ameca",
    "Arandas",
    "Atemajac de Brizuela",
    "Atengo",
    "Atenguillo",
    "Atotonilco el Alto",
    "Atoyac",
    "Autlán de Navarro",
    "Ayotlán",
    "Ayutla",
    "Bolaños",
    "Cabo Corrientes",
    "Casimiro Castillo",
    "Cihuatlán",
    "Cocula",
    "Colotlán",
    "Concepción de Buenos Aires",
    "Cuautitlán de García Barragán",
    "Cuautla",
    "Cuquío",
    "Chapala",
    "Chimaltitán",
    "Chiquilistlán",
    "Degollado",
    "Ejutla",
    "El Arenal",
    "El Grullo",
    "El Limón",
    "El Salto",
    "Encarnación de Díaz",
    "Etzatlán",
    "Gómez Farías",
    "Guachinango",
    "Guadalajara",
    "Hostotipaquillo",
    "Huejúcar",
    "Huejuquilla el Alto",
    "Ixtlahuacán de los Membrillos",
    "Ixtlahuacán del Río",
    "Jalostotitlán",
    "Jamay",
    "Jesús María",
    "Jilotlán de los Dolores",
    "Jocotepec",
    "Juanacatlán",
    "Juchitlán",
    "La Barca",
    "La Huerta",
    "La Manzanilla de la Paz",
    "Lagos de Moreno",
    "Magdalena",
    "Mascota",
    "Mazamitla",
    "Mexticacán",
    "Mezquitic",
    "Mixtlán",
    "Ocotlán",
    "Ojuelos de Jalisco",
    "Pihuamo",
    "Poncitlán",
    "Puerto Vallarta",
    "Quitupan",
    "San Cristóbal de la Barranca",
    "San Diego de Alejandría",
    "San Gabriel",
    "San Ignacio Cerro Gordo",
    "San Juan de los Lagos",
    "San Julián",
    "San Marcos",
    "San Martín de Bolaños",
    "San Martín Hidalgo",
    "San Miguel el Alto",
    "San Sebastián del Oeste",
    "Santa María de los Ángeles",
    "Santa María del Oro",
    "Sayula",
    "Tala",
    "Talpa de Allende",
    "Tamazula de Gordiano",
    "Tapalpa",
    "Tecalitlán",
    "Techaluta de Montenegro",
    "Tecolotlán",
    "Tenamaxtlán",
    "Teocaltiche",
    "Teocuitatlán de Corona",
    "Tepatitlán de Morelos",
    "Tequila",
    "Teuchitlán",
    "Tizapán el Alto",
    "Tlajomulco de Zúñiga",
    "Tlaquepaque",
    "Tolimán",
    "Tomatlán",
    "Tonalá",
    "Tonaya",
    "Tonila",
    "Totatiche",
    "Tototlán",
    "Tuxcacuesco",
    "Tuxcueca",
    "Tuxpan",
    "Unión de San Antonio",
    "Unión de Tula",
    "Valle de Guadalupe",
    "Valle de Juárez",
    "Villa Corona",
    "Villa Guerrero",
    "Villa Hidalgo",
    "Villa Purificación",
    "Yahualica de González Gallo",
    "Zacoalco de Torres",
    "Zapopan",
    "Zapotiltic",
    "Zapotitlán de Vadillo",
    "Zapotlán del Rey",
    "Zapotlán el Grande"
  ],
  "count": 125
}
```

### Example Usage

```bash
curl -X GET "https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2/municipalities"
```

```javascript
// JavaScript/TypeScript
const response = await fetch('/municipalities');
const data = await response.json();
console.log(`Found ${data.count} municipalities`);
```

---

## GET /settlements/search

Search settlements (neighborhoods) by name with partial matching.

### Request

```http
GET /settlements/search?query={searchTerm}
```

**Parameters**:
- `query` (required): Search term, minimum 3 characters, maximum 100 characters

### Response

**Success (200)**:
```json
{
  "settlements": [
    "Guadalajara Centro",
    "Puerto Vallarta Centro", 
    "Zapopan Centro",
    "Centro",
    "Centro Histórico",
    "Centro Urbano"
  ],
  "count": 6,
  "searchParam": "centro"
}
```

**Validation Error (400)**:
```json
{
  "error": "Query validation failed",
  "details": [
    {
      "field": "query",
      "message": "\"query\" length must be at least 3 characters long"
    }
  ]
}
```

### Search Features

- **Case Insensitive**: Searches ignore case differences
- **Partial Matching**: Finds settlements containing the search term
- **Deduplication**: Returns unique settlement names only
- **Alphabetical Sorting**: Results sorted alphabetically
- **Minimum Length**: Requires at least 3 characters to prevent overly broad searches

### Example Usage

```bash
# Search for settlements containing "centro"
curl -X GET "https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2/settlements/search?query=centro"

# Search for settlements containing "guadalajara"
curl -X GET "https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2/settlements/search?query=guadalajara"
```

```javascript
// JavaScript/TypeScript
const searchSettlements = async (query) => {
  const response = await fetch(`/settlements/search?query=${encodeURIComponent(query)}`);
  const data = await response.json();
  return data.settlements;
};

const results = await searchSettlements('centro');
```

---

## GET /zipCode/check

Validate if a postal code exists in the Jalisco dataset.

### Request

```http
GET /zipCode/check?postalCode={zipCode}
```

**Parameters**:
- `postalCode` (required): 5-digit numeric postal code

### Response

**Success (200) - Exists**:
```json
{
  "zipCode": "44100",
  "exists": true
}
```

**Success (200) - Not Found**:
```json
{
  "zipCode": "99999", 
  "exists": false
}
```

**Validation Error (400)**:
```json
{
  "error": "Query validation failed",
  "details": [
    {
      "field": "postalCode",
      "message": "\"postalCode\" with value \"1234\" fails to match the required pattern: /^\\d{5}$/"
    }
  ]
}
```

### Validation Rules

- **Format**: Exactly 5 digits
- **Type**: Numeric only (no letters or special characters)
- **Range**: Any 5-digit number (00000-99999)

### Example Usage

```bash
# Check if postal code 44100 exists
curl -X GET "https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2/zipCode/check?postalCode=44100"

# Check invalid postal code
curl -X GET "https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2/zipCode/check?postalCode=99999"
```

```javascript
// JavaScript/TypeScript
const checkPostalCode = async (postalCode) => {
  const response = await fetch(`/zipCode/check?postalCode=${postalCode}`);
  const data = await response.json();
  return data.exists;
};

const exists = await checkPostalCode('44100'); // true
```

---

## GET /location/coordinates

Get GPS coordinates for a specific location using municipality, neighborhood, and postal code.

### Request

```http
GET /location/coordinates?municipality={municipality}&neighborhood={neighborhood}&zipCode={zipCode}
```

**Parameters** (all required):
- `municipality`: Municipality name (1-100 characters)
- `neighborhood`: Neighborhood/settlement name (1-100 characters)  
- `zipCode`: 5-digit postal code

### Response

**Success (200)**:
```json
{
  "municipality": "Guadalajara",
  "neighborhood": "Guadalajara Centro", 
  "zipCode": "44100",
  "coordinates": {
    "latitude": 20.6772283,
    "longitude": -103.3539401
  }
}
```

**Not Found (404)**:
```json
{
  "error": "Location not found",
  "municipality": "InvalidCity",
  "neighborhood": "InvalidNeighborhood",
  "zipCode": "99999"
}
```

**Validation Error (400)**:
```json
{
  "error": "Query validation failed",
  "details": [
    {
      "field": "municipality",
      "message": "\"municipality\" is required"
    },
    {
      "field": "zipCode", 
      "message": "\"zipCode\" with value \"1234\" fails to match the required pattern: /^\\d{5}$/"
    }
  ]
}
```

### Matching Logic

The service performs exact matching on all three parameters:
1. **Municipality**: Case-sensitive exact match
2. **Neighborhood**: Case-sensitive exact match  
3. **Postal Code**: Exact numeric match

All three parameters must match a single record in the dataset.

### Example Usage

```bash
# Get coordinates for Guadalajara Centro
curl -X GET "https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2/location/coordinates?municipality=Guadalajara&neighborhood=Guadalajara%20Centro&zipCode=44100"

# URL-encoded version
curl -X GET "https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2/location/coordinates" \
  -G \
  -d "municipality=Guadalajara" \
  -d "neighborhood=Guadalajara Centro" \
  -d "zipCode=44100"
```

```javascript
// JavaScript/TypeScript
const getCoordinates = async (municipality, neighborhood, zipCode) => {
  const params = new URLSearchParams({
    municipality,
    neighborhood, 
    zipCode
  });
  
  const response = await fetch(`/location/coordinates?${params}`);
  
  if (response.status === 404) {
    return null; // Location not found
  }
  
  const data = await response.json();
  return data.coordinates;
};

const coords = await getCoordinates('Guadalajara', 'Guadalajara Centro', '44100');
// Returns: { latitude: 20.6772283, longitude: -103.3539401 }
```

---

## Error Handling

### HTTP Status Codes

| Code | Description | When It Occurs |
|------|-------------|----------------|
| 200 | Success | Request processed successfully |
| 400 | Bad Request | Validation errors, malformed parameters |
| 404 | Not Found | Location not found (coordinates endpoint only) |
| 500 | Internal Server Error | Server-side processing errors |

### Error Response Format

All error responses follow a consistent structure:

```json
{
  "error": "Error description",
  "details": [
    {
      "field": "fieldName",
      "message": "Specific validation message"
    }
  ]
}
```

### Common Error Scenarios

**Missing Required Parameters**:
```json
{
  "error": "Query validation failed",
  "details": [
    {
      "field": "query",
      "message": "\"query\" is required"
    }
  ]
}
```

**Invalid Postal Code Format**:
```json
{
  "error": "Query validation failed", 
  "details": [
    {
      "field": "postalCode",
      "message": "\"postalCode\" with value \"abc\" fails to match the required pattern: /^\\d{5}$/"
    }
  ]
}
```

**String Length Validation**:
```json
{
  "error": "Query validation failed",
  "details": [
    {
      "field": "query", 
      "message": "\"query\" length must be at least 3 characters long"
    }
  ]
}
```

---

## Rate Limiting

Currently, no rate limiting is implemented. The service relies on Firebase Functions' built-in scaling and throttling mechanisms.

**Recommendations for Production**:
- Implement client-side request throttling
- Consider API key authentication for high-volume usage
- Monitor usage patterns through Firebase Console

---

## CORS Policy

The service enables CORS for all origins:

```typescript
app.use(cors()); // Allows all origins
```

**Headers Supported**:
- `Authorization`: For optional Firebase ID tokens
- `Content-Type`: For JSON requests
- `Accept`: For response format negotiation

---

## Data Freshness

**Data Source**: Static CSV file in Firebase Storage
**Update Frequency**: Manual updates as needed
**Cache Duration**: No client-side caching headers set

**Data Characteristics**:
- **Coverage**: Complete Jalisco, Mexico postal code database
- **Accuracy**: Geocoded using OpenStreetMap Nominatim
- **Precision Levels**: 0-3 (see [Geocoding Guide](../guides/geocoding.md))
- **Total Records**: ~15,000+ postal code entries

---

## SDK Examples

### JavaScript/TypeScript Client

```typescript
class LocationService {
  private baseUrl: string;
  
  constructor(environment: 'dev' | 'qa' | 'prod' = 'dev') {
    const urls = {
      dev: 'https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2',
      qa: 'https://us-central1-job-bank-qa.cloudfunctions.net/locationsAPIV2', 
      prod: 'https://us-central1-job-bank-prod.cloudfunctions.net/locationsAPIV2'
    };
    this.baseUrl = urls[environment];
  }
  
  async getMunicipalities(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/municipalities`);
    const data = await response.json();
    return data.municipalities;
  }
  
  async searchSettlements(query: string): Promise<string[]> {
    const response = await fetch(
      `${this.baseUrl}/settlements/search?query=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    return data.settlements;
  }
  
  async checkPostalCode(postalCode: string): Promise<boolean> {
    const response = await fetch(
      `${this.baseUrl}/zipCode/check?postalCode=${postalCode}`
    );
    const data = await response.json();
    return data.exists;
  }
  
  async getCoordinates(
    municipality: string, 
    neighborhood: string, 
    zipCode: string
  ): Promise<{latitude: number, longitude: number} | null> {
    const params = new URLSearchParams({
      municipality,
      neighborhood,
      zipCode
    });
    
    const response = await fetch(`${this.baseUrl}/location/coordinates?${params}`);
    
    if (response.status === 404) {
      return null;
    }
    
    const data = await response.json();
    return data.coordinates;
  }
}

// Usage
const locationService = new LocationService('dev');
const municipalities = await locationService.getMunicipalities();
const settlements = await locationService.searchSettlements('centro');
const exists = await locationService.checkPostalCode('44100');
const coords = await locationService.getCoordinates('Guadalajara', 'Centro', '44100');
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

export const useLocationService = (environment: 'dev' | 'qa' | 'prod' = 'dev') => {
  const [locationService] = useState(() => new LocationService(environment));
  
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadMunicipalities = async () => {
      try {
        setLoading(true);
        const data = await locationService.getMunicipalities();
        setMunicipalities(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    loadMunicipalities();
  }, [locationService]);
  
  return {
    municipalities,
    loading,
    error,
    searchSettlements: locationService.searchSettlements.bind(locationService),
    checkPostalCode: locationService.checkPostalCode.bind(locationService),
    getCoordinates: locationService.getCoordinates.bind(locationService)
  };
};
```
