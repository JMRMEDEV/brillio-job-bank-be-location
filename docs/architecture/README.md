# Location Service Architecture

## Overview

The Location Service is a Firebase Cloud Functions microservice that provides location data for Jalisco, Mexico. It follows a serverless architecture pattern with CSV-based data storage and anonymous access capabilities.

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client Apps   │───▶│  Firebase CDN    │───▶│ Cloud Functions │
│                 │    │   (Global)       │    │   (us-central1) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ Express.js App  │
                                               │ - CORS enabled  │
                                               │ - Joi validation│
                                               │ - Anonymous auth│
                                               └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ CSV Helpers     │
                                               │ - Data parsing  │
                                               │ - Search logic  │
                                               │ - Deduplication │
                                               └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │Firebase Storage │
                                               │ jalisco_cp_     │
                                               │ geocoded.csv    │
                                               └─────────────────┘
```

## Core Components

### 1. Firebase Cloud Function (`locationsAPIV2`)

**Configuration:**
- **Region**: `us-central1`
- **Memory**: `256MiB`
- **Timeout**: `60 seconds`
- **CORS**: Enabled for all origins

**Runtime:**
- **Node.js**: 20
- **TypeScript**: 5.4.2
- **Express.js**: 4.19.2

### 2. Express.js Application

**Middleware Stack:**
```typescript
app.use(cors());                    // Enable CORS
app.use(express.json());            // JSON parsing
app.use(allowAnonymousOrRoles());   // Authentication
app.use(validateQuery());           // Input validation
```

**Route Structure:**
```
GET /municipalities              # List all municipalities
GET /settlements/search          # Search settlements
GET /zipCode/check              # Validate postal codes
GET /location/coordinates       # Get GPS coordinates
```

### 3. Authentication Middleware

**Access Control:**
- **Anonymous Users**: Full access to all endpoints
- **Authenticated Users**: All roles (contractor, admin, superadmin, owner)
- **Token Verification**: Firebase ID token validation

**Implementation:**
```typescript
// functions/src/middleware/anonymous.middleware.ts
export const allowAnonymousOrRoles = (allowedRoles: string[]) => {
  return async (req, res, next) => {
    const token = req.headers.authorization;
    
    if (!token) {
      // Allow anonymous access
      return next();
    }
    
    // Verify Firebase ID token for authenticated users
    const decodedToken = await admin.auth().verifyIdToken(token);
    // ... role validation logic
  };
};
```

### 4. Data Processing Layer

**CSV Helpers (`functions/src/helpers/csv-helpers.ts`):**
- **Data Source**: Firebase Storage CSV file
- **Processing**: Real-time parsing and filtering
- **Caching**: No persistent caching (stateless)
- **Search**: Case-insensitive partial matching

**Key Functions:**
```typescript
export async function getMunicipalities(): Promise<string[]>
export async function searchSettlements(query: string): Promise<string[]>
export async function searchPostalCode(postalCode: string): Promise<boolean>
export async function searchLocationCoordinates(
  municipality: string, 
  neighborhood: string, 
  zipCode: string
): Promise<{latitude: number, longitude: number} | null>
```

### 5. Validation Layer

**Joi Schemas (`functions/src/validators/location.validators.ts`):**
```typescript
export const searchQuerySchema = Joi.object({
  query: Joi.string().min(3).max(100).required()
});

export const postalCodeSchema = Joi.object({
  postalCode: Joi.string().pattern(/^\d{5}$/).required()
});

export const locationSearchSchema = Joi.object({
  municipality: Joi.string().min(1).max(100).required(),
  neighborhood: Joi.string().min(1).max(100).required(),
  zipCode: Joi.string().pattern(/^\d{5}$/).required()
});
```

## Data Architecture

### CSV Data Structure

**Source File**: `gs://job-bank-dev.appspot.com/location/jalisco_cp_geocoded.csv`

**Schema:**
```csv
postalCode,settlement,settlementType,municipality,state,city,
postalCodeAlt,stateCode,officeCode,postalCodeKey,settlementTypeCode,
municipalityCode,settlementIdCpcons,zone,cityCode,
lat,lon,geocodeSource,geocodeNote,confidence,missReason,precision
```

**Key Fields:**
- `postalCode`: 5-digit postal code
- `settlement`: Neighborhood/settlement name
- `municipality`: Municipality name
- `lat`/`lon`: GPS coordinates
- `precision`: Geocoding accuracy (0-3)

### Data Processing Pipeline

1. **CSV Parsing**: Uses `csv-parse` library for robust parsing
2. **Filtering**: State filter for Jalisco records only
3. **Deduplication**: Set-based unique value extraction
4. **Sorting**: Alphabetical ordering for consistent results
5. **Coordinate Mapping**: CSV `lat`/`lon` → API `latitude`/`longitude`

## Security Architecture

### Authentication Strategy

**Anonymous Access Pattern:**
- All endpoints accessible without authentication
- Optional Firebase ID token for authenticated users
- No role-based restrictions (universal access)

**Token Validation:**
```typescript
// Middleware checks for optional token
const token = req.headers.authorization;
if (token) {
  const decodedToken = await admin.auth().verifyIdToken(token);
  // Token valid but not required
}
// Continue processing regardless
```

### Input Validation

**Joi Schema Validation:**
- Query parameters validated before processing
- Proper error messages for validation failures
- SQL injection prevention through parameterized queries

**Example Validation:**
```typescript
const { error } = searchQuerySchema.validate(req.query);
if (error) {
  return res.status(400).json({
    error: 'Query validation failed',
    details: error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }))
  });
}
```

## Performance Architecture

### Optimization Strategies

1. **Stateless Design**: No persistent state between requests
2. **CSV Streaming**: Efficient memory usage for large datasets
3. **Set-Based Deduplication**: O(n) complexity for unique values
4. **Minimal Dependencies**: Lightweight function package

### Resource Allocation

**Function Configuration:**
- **Memory**: 256MiB (sufficient for CSV processing)
- **Timeout**: 60 seconds (handles large CSV files)
- **Cold Start**: ~2-3 seconds for first request
- **Warm Execution**: ~100-500ms for subsequent requests

### Scalability Considerations

**Horizontal Scaling:**
- Firebase Functions auto-scale based on demand
- No shared state between function instances
- CSV file cached at Firebase Storage level

**Vertical Scaling:**
- Memory can be increased to 512MiB if needed
- Timeout can be extended for larger datasets
- CPU allocation scales with memory

## Deployment Architecture

### Multi-Environment Setup

**Environment Configuration:**
```typescript
// functions/src/config/environment.ts
const nodeEnv = process.env.NODE_ENV || 'dev';
const envFile = `.env.${nodeEnv}`;

export const config = {
  firebase: {
    projectId: process.env.PROJECT_ID,
    // ... other config
  }
};
```

**Deployment Targets:**
- **Development**: `job-bank-dev` project
- **QA**: `job-bank-qa` project  
- **Production**: `job-bank-prod` project

### Build Pipeline

**TypeScript Compilation:**
```bash
yarn build          # Compile TypeScript to JavaScript
yarn deploy:dev     # Deploy to development environment
yarn deploy:qa      # Deploy to QA environment
yarn deploy:prod    # Deploy to production environment
```

## Integration Architecture

### Firebase Services Integration

**Firebase Admin SDK:**
- Authentication token verification
- Storage access for CSV files
- Project configuration management

**Firebase Storage:**
- CSV file hosting and access
- Automatic CDN distribution
- Version control for data updates

### External Dependencies

**Core Libraries:**
- `express`: Web framework
- `csv-parse`: CSV processing
- `joi`: Input validation
- `cors`: Cross-origin resource sharing
- `winston`: Logging

**Development Dependencies:**
- `typescript`: Type checking
- `eslint`: Code linting
- `prettier`: Code formatting

## Monitoring and Observability

### Logging Strategy

**Winston Logger Configuration:**
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
});
```

**Log Levels:**
- `error`: Function errors and exceptions
- `warn`: Validation failures and edge cases
- `info`: Request processing and data operations
- `debug`: Detailed execution flow (development only)

### Error Handling

**Structured Error Responses:**
```typescript
// Validation errors (400)
{
  "error": "Query validation failed",
  "details": [
    {
      "field": "query",
      "message": "\"query\" length must be at least 3 characters long"
    }
  ]
}

// Not found errors (404)
{
  "error": "Location not found",
  "municipality": "InvalidCity",
  "neighborhood": "InvalidNeighborhood", 
  "zipCode": "99999"
}

// Server errors (500)
{
  "error": "Internal server error"
}
```

### Performance Monitoring

**Firebase Functions Metrics:**
- Execution time per request
- Memory usage patterns
- Error rates and types
- Cold start frequency

**Custom Metrics:**
- CSV processing time
- Search result counts
- Validation failure rates

## Future Architecture Considerations

### Scalability Improvements

1. **Caching Layer**: Redis for frequently accessed data
2. **Database Migration**: Move from CSV to Cloud Firestore
3. **CDN Integration**: Cache responses at edge locations
4. **Batch Processing**: Pre-compute search indexes

### Performance Optimizations

1. **Data Indexing**: Create search indexes for faster queries
2. **Compression**: Gzip CSV files for faster downloads
3. **Pagination**: Implement pagination for large result sets
4. **Connection Pooling**: Optimize database connections

### Security Enhancements

1. **Rate Limiting**: Implement request throttling
2. **API Keys**: Optional API key authentication
3. **CORS Restrictions**: Environment-specific CORS policies
4. **Input Sanitization**: Enhanced XSS protection
