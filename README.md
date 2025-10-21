# Locations Service - Firebase Cloud Functions

A Firebase Cloud Functions service for retrieving municipality data from Jalisco postal code CSV stored in Firebase Storage.

## Features

- **CSV Data Source**: Reads from `gs://job-bank-dev.appspot.com/location/jalisco_cp_geocoded.csv`
- **Anonymous Access**: Endpoint accessible via `allowAnonymousOrRoles` middleware
- **Unique Municipalities**: Returns deduplicated, sorted list of municipalities
- **Multi-Environment**: Dev, QA, and Production configurations
- **TypeScript**: Full TypeScript support with strict typing

## Endpoint

- `GET /municipalities` - Get unique municipalities from Jalisco CSV data
  - **Access**: Anonymous users and all authenticated roles
  - **Response**: `{ municipalities: string[], count: number }`
  - **Data**: 125 unique municipalities from Jalisco postal codes

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

## Usage Example

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

## Architecture

- **CSV Parsing**: Uses `csv-parse` library for robust CSV handling
- **Firebase Storage**: Direct access to CSV files in Firebase Storage
- **Middleware**: `allowAnonymousOrRoles` for universal access
- **Data Processing**: Set-based deduplication with alphabetical sorting

## Data Source

The service reads postal code data from Jalisco, Mexico with the following CSV structure:
- **Source**: SEPOMEX Jalisco geocoded data
- **Columns**: postalCode, settlement, municipality, state, coordinates, etc.
- **Processing**: Extracts unique municipality names and returns sorted array
