# Locations Service - Firebase Cloud Functions

A Firebase Cloud Functions service for retrieving location data from Jalisco postal code CSV stored in Firebase Storage.

## Features

- **CSV Data Source**: Reads from `gs://job-bank-dev.appspot.com/location/jalisco_cp_geocoded.csv`
- **Anonymous Access**: All endpoints accessible via `allowAnonymousOrRoles` middleware
- **Multiple Search Types**: Municipalities, settlements, postal codes, and coordinates
- **Joi Validation**: Comprehensive input validation with proper error messages
- **Multi-Environment**: Dev, QA, and Production configurations
- **TypeScript**: Full TypeScript support with strict typing

## Endpoints

### `GET /municipalities`
Get unique municipalities from Jalisco CSV data
- **Access**: Anonymous users and all authenticated roles
- **Response**: `{ municipalities: string[], count: number }`
- **Data**: 125 unique municipalities from Jalisco postal codes

### `GET /settlements/search`
Search settlements by query parameter
- **Access**: Anonymous users and all authenticated roles
- **Parameters**: 
  - `query` (required): Search term, minimum 3 characters
- **Response**: `{ settlements: string[], count: number, searchParam: string }`
- **Features**: Case-insensitive partial matching, deduplication, alphabetical sorting

### `GET /postalcode/check`
Check if a postal code exists in the dataset
- **Access**: Anonymous users and all authenticated roles
- **Parameters**: 
  - `postalCode` (required): 5-digit numeric postal code
- **Response**: `{ postalCode: string, exists: boolean }`
- **Validation**: Must be exactly 5 digits

### `GET /location/coordinates`
Get coordinates for a specific location (requires all parameters)
- **Access**: Anonymous users and all authenticated roles
- **Parameters** (all required): 
  - `municipality` (required): Municipality name
  - `neighborhood` (required): Neighborhood/settlement name
  - `zipCode` (required): 5-digit postal code
- **Response**: `{ municipality: string, neighborhood: string, zipCode: string, coordinates: { lat: number, lng: number } }`
- **Error Response**: `404` if location not found

## Setup

1. **Install dependencies**:
   ```bash
   cd functions
   yarn install
   ```

2. **Configure environment**:
   ```bash
   cp .env.template .env.dev
   cp .env.template .env.qa
   cp .env.template .env.prod
   # Fill in Firebase credentials for each environment
   ```

3. **Development**:
   ```bash
   yarn debug:dev    # Debug with dev environment
   yarn debug:qa     # Debug with qa environment
   ```

4. **Deployment**:
   ```bash
   yarn deploy:dev   # Deploy to development
   yarn deploy:qa    # Deploy to QA
   yarn deploy:prod  # Deploy to production
   ```

## Usage Examples

### Get All Municipalities
```bash
curl -X GET "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/municipalities" \
  -H "Authorization: your-firebase-jwt-token"
```

**Response:**
```json
{
  "municipalities": [
    "Acatic",
    "Acatlán de Juárez",
    "Ahualulco de Mercado",
    ...
    "Zapotlán el Grande"
  ],
  "count": 125
}
```

### Search Settlements
```bash
curl -X GET "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/settlements/search?query=centro" \
  -H "Authorization: your-firebase-jwt-token"
```

**Response:**
```json
{
  "settlements": [
    "Guadalajara Centro",
    "Puerto Vallarta Centro",
    "Zapopan Centro",
    ...
  ],
  "count": 82,
  "searchParam": "centro"
}
```

### Check Postal Code
```bash
curl -X GET "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/postalcode/check?postalCode=44100" \
  -H "Authorization: your-firebase-jwt-token"
```

**Response:**
```json
{
  "postalCode": "44100",
  "exists": true
}
```

### Get Location Coordinates
```bash
curl -X GET "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/location/coordinates?municipality=Guadalajara&neighborhood=Guadalajara%20Centro&zipCode=44100" \
  -H "Authorization: your-firebase-jwt-token"
```

**Response:**
```json
{
  "municipality": "Guadalajara",
  "neighborhood": "Guadalajara Centro",
  "zipCode": "44100",
  "coordinates": {
    "lat": 20.6772283,
    "lng": -103.3539401
  }
}
```

## Validation Rules

### Settlement Search
- `query`: Required, minimum 3 characters, maximum 100 characters

### Postal Code Check
- `postalCode`: Required, exactly 5 digits, numeric only

### Location Coordinates
- `municipality`: Required, 1-100 characters
- `neighborhood`: Required, 1-100 characters  
- `zipCode`: Required, exactly 5 digits, numeric only
- **All three parameters must be provided**

## Error Responses

### Validation Errors (400)
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

### Location Not Found (404)
```json
{
  "error": "Location not found",
  "municipality": "InvalidCity",
  "neighborhood": "InvalidNeighborhood",
  "zipCode": "99999"
}
```

## Architecture

- **CSV Parsing**: Uses `csv-parse` library for robust CSV handling
- **Firebase Storage**: Direct access to CSV files in Firebase Storage
- **Middleware**: `allowAnonymousOrRoles` for universal access
- **Data Processing**: Set-based deduplication with alphabetical sorting
- **Validation**: Joi schemas for comprehensive input validation
- **Coordinate Mapping**: CSV columns `lat`/`lon` mapped to `lat`/`lng` response format

## Data Source

The service reads postal code data from Jalisco, Mexico with the following CSV structure:
- **Source**: SEPOMEX Jalisco geocoded data
- **Key Columns**: `postalCode`, `settlement`, `municipality`, `state`, `lat`, `lon`
- **Processing**: Extracts unique values and provides coordinate lookup functionality
- **Coverage**: Complete Jalisco state postal code database with geocoded coordinates
