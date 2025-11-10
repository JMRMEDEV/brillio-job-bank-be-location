# Development Guide

Complete setup and development guide for the Location Service.

## Prerequisites

### Required Software

- **Node.js**: 20.x (LTS)
- **Yarn**: 4.10.1 (specified in package.json)
- **Firebase CLI**: Latest version
- **Git**: For version control

### Firebase Setup

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Verify Project Access**:
   ```bash
   firebase projects:list
   # Should show: job-bank-dev, job-bank-qa, job-bank-prod
   ```

## Project Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd brillio-job-bank-be-location
```

### 2. Install Dependencies

```bash
cd functions
yarn install
```

### 3. Environment Configuration

Create environment files for each environment:

```bash
# Copy template for each environment
cp .env.template .env.dev
cp .env.template .env.qa
cp .env.template .env.prod
```

**Environment File Structure** (`.env.dev`, `.env.qa`, `.env.prod`):
```bash
# Firebase Project Configuration
PROJECT_ID=job-bank-dev
PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----
CLIENT_EMAIL=firebase-adminsdk-xxxxx@job-bank-dev.iam.gserviceaccount.com

# Firebase Client Configuration (Optional)
AUTH_DOMAIN=job-bank-dev.firebaseapp.com
API_KEY=your-api-key-here
STORAGE_BUCKET=job-bank-dev.appspot.com

# Application Configuration
CSV_STORAGE_PATH=location/jalisco_cp_geocoded.csv
```

### 4. Firebase Project Configuration

Update `.firebaserc` with your project aliases:
```json
{
  "projects": {
    "dev": "job-bank-dev",
    "qa": "job-bank-qa", 
    "prod": "job-bank-prod"
  }
}
```

## Development Workflow

### Local Development

**Start Development Server**:
```bash
# Start with development environment
yarn debug:dev

# Or start with specific environment
yarn debug:qa
yarn debug:prod
```

This command:
1. Sets `NODE_ENV` to the specified environment
2. Switches Firebase project context
3. Starts TypeScript compilation in watch mode
4. Starts Firebase Functions emulator with debugging enabled

**Local URLs**:
- **Function URL**: `http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2`
- **Emulator UI**: `http://127.0.0.1:4000`

### Development Commands

```bash
# Environment switching
yarn dev          # Switch to development environment
yarn qa           # Switch to QA environment  
yarn prod         # Switch to production environment

# Building
yarn build        # Compile TypeScript to JavaScript
yarn build:watch  # Compile with file watching

# Development server
yarn debug        # Start development server (uses dev environment)
yarn debug:dev    # Start with development environment
yarn debug:qa     # Start with QA environment
yarn debug:prod   # Start with production environment

# Deployment
yarn deploy       # Deploy to current environment
yarn deploy:dev   # Deploy to development
yarn deploy:qa    # Deploy to QA
yarn deploy:prod  # Deploy to production

# Logs
yarn logs         # View function logs
```

### Project Structure

```
brillio-job-bank-be-location/
├── functions/                          # Firebase Functions directory
│   ├── src/                           # TypeScript source code
│   │   ├── config/                    # Environment configuration
│   │   │   └── environment.ts         # Multi-environment config loader
│   │   ├── helpers/                   # Business logic helpers
│   │   │   └── csv-helpers.ts         # CSV processing functions
│   │   ├── middleware/                # Express middleware
│   │   │   ├── anonymous.middleware.ts # Anonymous access middleware
│   │   │   ├── validation.middleware.ts # Input validation middleware
│   │   │   └── index.ts               # Middleware exports
│   │   ├── validators/                # Joi validation schemas
│   │   │   ├── location.validators.ts  # Location-specific schemas
│   │   │   └── index.ts               # Validator exports
│   │   ├── index.ts                   # Main function entry point
│   │   └── types.d.ts                 # TypeScript type definitions
│   ├── lib/                           # Compiled JavaScript (generated)
│   ├── scripts/                       # Utility scripts
│   │   └── create-csv-database/       # CSV geocoding pipeline
│   ├── .env.template                  # Environment template
│   ├── .env.dev                       # Development environment
│   ├── .env.qa                        # QA environment
│   ├── .env.prod                      # Production environment
│   ├── package.json                   # Dependencies and scripts
│   ├── tsconfig.json                  # TypeScript configuration
│   └── .yarnrc.yml                    # Yarn configuration
├── docs/                              # Documentation
├── firebase.json                      # Firebase configuration
├── .firebaserc                        # Firebase project aliases
└── README.md                          # Project overview
```

## Code Architecture

### Main Function (`src/index.ts`)

```typescript
import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';

// Import middleware and helpers
import { allowAnonymousOrRoles, validateQuery } from './middleware';
import { getMunicipalities, searchSettlements } from './helpers/csv-helpers';

const app = express();
app.use(cors());
app.use(express.json());

// Define routes
app.get('/municipalities', 
  allowAnonymousOrRoles(['contractor', 'admin', 'superadmin', 'owner']),
  async (req, res) => {
    // Implementation
  }
);

// Export Firebase Function
export const locationsAPIV2 = onRequest({
  cors: true,
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 60
}, app);
```

### Environment Configuration (`src/config/environment.ts`)

```typescript
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as admin from 'firebase-admin';

// Load environment-specific .env file
const nodeEnv = process.env.NODE_ENV || 'dev';
const envFile = `.env.${nodeEnv}`;

// Try multiple path resolutions
const possiblePaths = [
  resolve(process.cwd(), envFile),
  resolve(__dirname, '../../', envFile),
  resolve(process.cwd(), 'functions', envFile)
];

let envLoaded = false;
for (const envPath of possiblePaths) {
  try {
    dotenv.config({ path: envPath });
    envLoaded = true;
    break;
  } catch (error) {
    continue;
  }
}

// Export configuration
export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  firebase: {
    projectId: process.env.PROJECT_ID || '',
    privateKey: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    clientEmail: process.env.CLIENT_EMAIL || '',
  },
  csvStoragePath: process.env.CSV_STORAGE_PATH || 'location/jalisco_cp_geocoded.csv'
};

// Initialize Firebase Admin
export const adminApp = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: config.firebase.projectId,
    privateKey: config.firebase.privateKey,
    clientEmail: config.firebase.clientEmail,
  }),
});
```

### CSV Processing (`src/helpers/csv-helpers.ts`)

```typescript
import { parse } from 'csv-parse';
import * as admin from 'firebase-admin';

interface LocationRecord {
  postalCode: string;
  settlement: string;
  municipality: string;
  lat: string;
  lon: string;
}

export async function getMunicipalities(): Promise<string[]> {
  const records = await loadCsvData();
  const municipalities = new Set<string>();
  
  records.forEach(record => {
    if (record.municipality) {
      municipalities.add(record.municipality);
    }
  });
  
  return Array.from(municipalities).sort();
}

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

async function loadCsvData(): Promise<LocationRecord[]> {
  const bucket = admin.storage().bucket();
  const file = bucket.file('location/jalisco_cp_geocoded.csv');
  
  const [buffer] = await file.download();
  const csvContent = buffer.toString('utf-8');
  
  return new Promise((resolve, reject) => {
    const records: LocationRecord[] = [];
    
    parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    })
    .on('data', (record) => records.push(record))
    .on('end', () => resolve(records))
    .on('error', reject);
  });
}
```

### Middleware (`src/middleware/anonymous.middleware.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

export const allowAnonymousOrRoles = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization as string;
    
    if (!token) {
      // Allow anonymous access
      return next();
    }
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Check if anonymous user
      if (decodedToken.firebase.sign_in_provider === 'anonymous') {
        req.user = { uid: decodedToken.uid, role: 'anonymous' };
        return next();
      }
      
      // Check role-based access
      const userRole = decodedToken.role;
      if (allowedRoles.includes(userRole)) {
        req.user = { uid: decodedToken.uid, role: userRole };
        return next();
      }
      
      return res.status(403).json({ error: 'Insufficient permissions' });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};
```

### Validation (`src/validators/location.validators.ts`)

```typescript
import * as Joi from 'joi';

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

## Testing

### Manual Testing

**Test Endpoints Locally**:
```bash
# Start development server
yarn debug:dev

# Test municipalities endpoint
curl "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/municipalities"

# Test settlements search
curl "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/settlements/search?query=centro"

# Test postal code check
curl "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/zipCode/check?postalCode=44100"

# Test coordinates lookup
curl "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/location/coordinates?municipality=Guadalajara&neighborhood=Guadalajara%20Centro&zipCode=44100"
```

### Integration Testing

**Test Against Deployed Functions**:
```bash
# Development environment
curl "https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2/municipalities"

# QA environment  
curl "https://us-central1-job-bank-qa.cloudfunctions.net/locationsAPIV2/municipalities"

# Production environment
curl "https://us-central1-job-bank-prod.cloudfunctions.net/locationsAPIV2/municipalities"
```

### Error Testing

**Test Validation Errors**:
```bash
# Missing query parameter
curl "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/settlements/search"

# Invalid postal code format
curl "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/zipCode/check?postalCode=abc"

# Missing required parameters
curl "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/location/coordinates?municipality=Test"
```

## Debugging

### Local Debugging

**Enable Debug Mode**:
```bash
# Start with debugging enabled
yarn debug:dev

# Function logs will appear in terminal
# Emulator UI available at http://127.0.0.1:4000
```

**Debug Configuration**:
- **Breakpoints**: Set in TypeScript source files
- **Console Logs**: Appear in terminal output
- **Error Stack Traces**: Full stack traces in development mode

### Production Debugging

**View Function Logs**:
```bash
# View recent logs
yarn logs

# View logs with filtering
firebase functions:log --only locationsAPIV2

# View logs for specific environment
firebase use qa
firebase functions:log --only locationsAPIV2
```

**Firebase Console**:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to Functions → locationsAPIV2
4. View logs, metrics, and performance data

## Performance Optimization

### Local Performance Testing

**Measure Response Times**:
```bash
# Test with time measurement
time curl "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/municipalities"

# Test with verbose output
curl -w "@curl-format.txt" "http://127.0.0.1:5001/job-bank-dev/us-central1/locationsAPIV2/municipalities"
```

**Create `curl-format.txt`**:
```
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
```

### Memory Optimization

**Monitor Memory Usage**:
- Check Firebase Console for memory usage patterns
- Adjust function memory allocation if needed
- Optimize CSV processing for large datasets

**Current Configuration**:
```typescript
export const locationsAPIV2 = onRequest({
  memory: '256MiB',    // Sufficient for CSV processing
  timeoutSeconds: 60   // Handles large CSV files
}, app);
```

## Deployment

### Pre-Deployment Checklist

1. **Code Quality**:
   ```bash
   yarn build  # Ensure TypeScript compiles without errors
   ```

2. **Environment Configuration**:
   - Verify `.env.*` files have correct values
   - Check Firebase project aliases in `.firebaserc`

3. **Testing**:
   - Test all endpoints locally
   - Verify CSV data is accessible
   - Check authentication middleware

### Deployment Process

**Deploy to Development**:
```bash
yarn deploy:dev
```

**Deploy to QA**:
```bash
yarn deploy:qa
```

**Deploy to Production**:
```bash
yarn deploy:prod
```

### Post-Deployment Verification

**Test Deployed Function**:
```bash
# Test each environment after deployment
curl "https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2/municipalities"
curl "https://us-central1-job-bank-qa.cloudfunctions.net/locationsAPIV2/municipalities"
curl "https://us-central1-job-bank-prod.cloudfunctions.net/locationsAPIV2/municipalities"
```

**Monitor Function Health**:
1. Check Firebase Console for deployment status
2. Monitor function logs for errors
3. Verify response times and memory usage

## Troubleshooting

### Common Issues

**1. Environment File Not Loading**:
```bash
# Check if .env files exist
ls -la functions/.env.*

# Verify environment variables
echo $NODE_ENV
```

**2. Firebase Project Access**:
```bash
# Check current project
firebase use

# List available projects
firebase projects:list

# Switch project
firebase use dev
```

**3. TypeScript Compilation Errors**:
```bash
# Check TypeScript configuration
cat functions/tsconfig.json

# Compile with verbose output
cd functions && npx tsc --noEmit
```

**4. CSV File Access Issues**:
- Verify Firebase Storage permissions
- Check CSV file path in environment configuration
- Ensure service account has Storage access

**5. Function Deployment Failures**:
```bash
# Check deployment logs
firebase deploy --only functions:locationsAPIV2 --debug

# Verify function configuration
cat firebase.json
```

### Debug Commands

```bash
# Check function status
firebase functions:list

# View detailed logs
firebase functions:log --only locationsAPIV2 --lines 50

# Test function locally with specific environment
NODE_ENV=qa yarn debug

# Check Firebase CLI version
firebase --version

# Update Firebase CLI
npm install -g firebase-tools@latest
```

## Development Best Practices

### Code Style

- **TypeScript**: Use strict type checking
- **ESLint**: Follow Airbnb style guide
- **Prettier**: Consistent code formatting
- **Imports**: Use absolute imports where possible

### Error Handling

- **Validation**: Use Joi schemas for all inputs
- **HTTP Status**: Return appropriate status codes
- **Logging**: Log errors with context information
- **User Messages**: Provide clear error messages

### Performance

- **CSV Processing**: Stream large files when possible
- **Memory Usage**: Monitor function memory consumption
- **Response Times**: Keep under 2 seconds for all endpoints
- **Caching**: Consider caching for frequently accessed data

### Security

- **Input Validation**: Validate all user inputs
- **Authentication**: Support both anonymous and authenticated access
- **CORS**: Configure appropriate CORS policies
- **Environment Variables**: Never commit sensitive data to git
