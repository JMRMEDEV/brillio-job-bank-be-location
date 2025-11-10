# Deployment Guide

Complete deployment procedures for the Location Service across multiple environments.

## Overview

The Location Service uses Firebase Functions with a multi-environment deployment strategy supporting Development, QA, and Production environments.

## Environment Configuration

### Firebase Projects

| Environment | Project ID | Region | Function Name |
|-------------|------------|--------|---------------|
| Development | `job-bank-dev` | `us-central1` | `locationsAPIV2` |
| QA | `job-bank-qa` | `us-central1` | `locationsAPIV2` |
| Production | `job-bank-prod` | `us-central1` | `locationsAPIV2` |

### Environment Files

Each environment requires its own configuration file:

**`.env.dev`** (Development):
```bash
# Firebase Project Configuration
PROJECT_ID=job-bank-dev
PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n[DEV_PRIVATE_KEY]\n-----END PRIVATE KEY-----
CLIENT_EMAIL=firebase-adminsdk-xxxxx@job-bank-dev.iam.gserviceaccount.com

# Firebase Client Configuration
AUTH_DOMAIN=job-bank-dev.firebaseapp.com
API_KEY=[DEV_API_KEY]
STORAGE_BUCKET=job-bank-dev.appspot.com

# Application Configuration
CSV_STORAGE_PATH=location/jalisco_cp_geocoded.csv
```

**`.env.qa`** (QA):
```bash
# Firebase Project Configuration
PROJECT_ID=job-bank-qa
PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n[QA_PRIVATE_KEY]\n-----END PRIVATE KEY-----
CLIENT_EMAIL=firebase-adminsdk-xxxxx@job-bank-qa.iam.gserviceaccount.com

# Firebase Client Configuration
AUTH_DOMAIN=job-bank-qa.firebaseapp.com
API_KEY=[QA_API_KEY]
STORAGE_BUCKET=job-bank-qa.appspot.com

# Application Configuration
CSV_STORAGE_PATH=location/jalisco_cp_geocoded.csv
```

**`.env.prod`** (Production):
```bash
# Firebase Project Configuration
PROJECT_ID=job-bank-prod
PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n[PROD_PRIVATE_KEY]\n-----END PRIVATE KEY-----
CLIENT_EMAIL=firebase-adminsdk-xxxxx@job-bank-prod.iam.gserviceaccount.com

# Firebase Client Configuration
AUTH_DOMAIN=job-bank-prod.firebaseapp.com
API_KEY=[PROD_API_KEY]
STORAGE_BUCKET=job-bank-prod.appspot.com

# Application Configuration
CSV_STORAGE_PATH=location/jalisco_cp_geocoded.csv
```

## Deployment Scripts

### Ultra-DRY Script Architecture

The project uses a modular script architecture for maximum reusability:

**Environment Setup Scripts** (Reusable):
```json
{
  "dev": "cross-env NODE_ENV=dev firebase use dev",
  "qa": "cross-env NODE_ENV=qa firebase use qa", 
  "prod": "cross-env NODE_ENV=prod firebase use prod"
}
```

**Base Action Scripts** (Reusable):
```json
{
  "debug:base": "concurrently --kill-others \"yarn run build:watch\" \"yarn run inspect\"",
  "deploy:base": "yarn run build && firebase deploy --only functions:locationsAPIV2"
}
```

**Composed Scripts** (Environment + Action):
```json
{
  "debug:dev": "yarn dev && yarn debug:base",
  "debug:qa": "yarn qa && yarn debug:base", 
  "debug:prod": "yarn prod && yarn debug:base",
  
  "deploy:dev": "yarn dev && yarn deploy:base",
  "deploy:qa": "yarn qa && yarn deploy:base",
  "deploy:prod": "yarn prod && yarn deploy:base"
}
```

## Pre-Deployment Checklist

### 1. Code Quality Verification

```bash
# Ensure TypeScript compiles without errors
cd functions
yarn build

# Check for linting issues
yarn lint

# Verify all tests pass (if applicable)
yarn test
```

### 2. Environment Configuration

```bash
# Verify environment files exist
ls -la functions/.env.*

# Check Firebase project configuration
cat .firebaserc

# Verify current Firebase CLI login
firebase login:list
```

### 3. Data Dependencies

```bash
# Verify CSV file exists in Firebase Storage
firebase use dev
gsutil ls gs://job-bank-dev.appspot.com/location/

firebase use qa  
gsutil ls gs://job-bank-qa.appspot.com/location/

firebase use prod
gsutil ls gs://job-bank-prod.appspot.com/location/
```

### 4. Function Configuration

**Verify `firebase.json`**:
```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git", 
        "firebase-debug.log",
        "firebase-debug.*.log",
        "scripts"
      ]
    }
  ]
}
```

## Deployment Procedures

### Development Deployment

**Purpose**: Development testing and feature validation

```bash
# Deploy to development environment
yarn deploy:dev
```

**Verification**:
```bash
# Test deployed function
curl "https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2/municipalities"

# Check function logs
firebase use dev
firebase functions:log --only locationsAPIV2
```

### QA Deployment

**Purpose**: Quality assurance and integration testing

```bash
# Deploy to QA environment
yarn deploy:qa
```

**Verification**:
```bash
# Test deployed function
curl "https://us-central1-job-bank-qa.cloudfunctions.net/locationsAPIV2/municipalities"

# Run integration tests
curl "https://us-central1-job-bank-qa.cloudfunctions.net/locationsAPIV2/settlements/search?query=centro"
curl "https://us-central1-job-bank-qa.cloudfunctions.net/locationsAPIV2/zipCode/check?postalCode=44100"

# Check function logs
firebase use qa
firebase functions:log --only locationsAPIV2
```

### Production Deployment

**Purpose**: Live production environment

**Prerequisites**:
- ✅ Development deployment successful
- ✅ QA deployment successful and tested
- ✅ All integration tests passing
- ✅ Code review completed
- ✅ Change management approval (if required)

```bash
# Deploy to production environment
yarn deploy:prod
```

**Verification**:
```bash
# Test deployed function
curl "https://us-central1-job-bank-prod.cloudfunctions.net/locationsAPIV2/municipalities"

# Verify all endpoints
curl "https://us-central1-job-bank-prod.cloudfunctions.net/locationsAPIV2/settlements/search?query=centro"
curl "https://us-central1-job-bank-prod.cloudfunctions.net/locationsAPIV2/zipCode/check?postalCode=44100"

# Check function logs
firebase use prod
firebase functions:log --only locationsAPIV2
```

## Deployment Monitoring

### Function Health Checks

**Automated Health Check Script**:
```bash
#!/bin/bash
# health-check.sh

ENVIRONMENTS=("dev" "qa" "prod")
BASE_URL="https://us-central1-job-bank"

for env in "${ENVIRONMENTS[@]}"; do
  echo "Checking $env environment..."
  
  url="$BASE_URL-$env.cloudfunctions.net/locationsAPIV2/municipalities"
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  
  if [ "$response" = "200" ]; then
    echo "✅ $env: Healthy"
  else
    echo "❌ $env: Unhealthy (HTTP $response)"
  fi
done
```

### Performance Monitoring

**Response Time Monitoring**:
```bash
#!/bin/bash
# performance-check.sh

check_performance() {
  local env=$1
  local url="https://us-central1-job-bank-$env.cloudfunctions.net/locationsAPIV2/municipalities"
  
  echo "Testing $env performance..."
  curl -w "Time: %{time_total}s\nSize: %{size_download} bytes\n" -s -o /dev/null "$url"
}

check_performance "dev"
check_performance "qa" 
check_performance "prod"
```

### Log Monitoring

**View Recent Logs**:
```bash
# Development logs
firebase use dev
firebase functions:log --only locationsAPIV2 --lines 20

# QA logs
firebase use qa
firebase functions:log --only locationsAPIV2 --lines 20

# Production logs
firebase use prod
firebase functions:log --only locationsAPIV2 --lines 20
```

**Monitor Error Rates**:
```bash
# Filter for errors only
firebase functions:log --only locationsAPIV2 | grep -i error

# Monitor in real-time
firebase functions:log --only locationsAPIV2 --follow
```

## Rollback Procedures

### Immediate Rollback

If issues are detected after deployment:

```bash
# Get previous deployment version
firebase functions:list

# Deploy previous version (if available)
# Note: Firebase Functions don't have built-in rollback
# Rollback requires redeploying previous code version

# Alternative: Disable function temporarily
firebase functions:delete locationsAPIV2 --force
```

### Code-Based Rollback

```bash
# Revert to previous git commit
git log --oneline -10
git checkout <previous-commit-hash>

# Redeploy previous version
yarn deploy:prod

# Return to latest code after fix
git checkout main
```

## Environment-Specific Configurations

### Development Environment

**Purpose**: Feature development and initial testing
**Characteristics**:
- Frequent deployments
- Debug logging enabled
- Relaxed error handling
- Test data acceptable

**Configuration**:
```typescript
// Development-specific settings
export const devConfig = {
  logLevel: 'debug',
  enableDetailedErrors: true,
  allowTestData: true
};
```

### QA Environment

**Purpose**: Integration testing and quality assurance
**Characteristics**:
- Stable deployments
- Production-like data
- Comprehensive testing
- Performance monitoring

**Configuration**:
```typescript
// QA-specific settings
export const qaConfig = {
  logLevel: 'info',
  enableDetailedErrors: true,
  allowTestData: false
};
```

### Production Environment

**Purpose**: Live user traffic
**Characteristics**:
- Stable, tested code only
- Production data
- Minimal logging
- High availability

**Configuration**:
```typescript
// Production-specific settings
export const prodConfig = {
  logLevel: 'warn',
  enableDetailedErrors: false,
  allowTestData: false
};
```

## Security Considerations

### Service Account Management

**Development**:
- Limited permissions
- Separate service account
- Regular key rotation

**QA**:
- Production-like permissions
- Separate service account
- Controlled access

**Production**:
- Minimal required permissions
- Dedicated service account
- Strict access controls

### Environment Isolation

**Network Isolation**:
- Each environment uses separate Firebase projects
- No cross-environment data access
- Isolated storage buckets

**Data Isolation**:
- Environment-specific CSV files
- Separate authentication databases
- Isolated logging and monitoring

## Continuous Integration/Deployment

### GitHub Actions Integration

**Example Workflow** (`.github/workflows/deploy.yml`):
```yaml
name: Deploy Location Service

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        
    - name: Install dependencies
      run: |
        cd functions
        yarn install
        
    - name: Build project
      run: |
        cd functions
        yarn build
        
    - name: Deploy to Development
      if: github.ref == 'refs/heads/develop'
      run: |
        cd functions
        yarn deploy:dev
      env:
        FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
        
    - name: Deploy to Production
      if: github.ref == 'refs/heads/main'
      run: |
        cd functions
        yarn deploy:prod
      env:
        FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

### Automated Testing

**Pre-Deployment Tests**:
```bash
# Add to deployment pipeline
yarn test:unit
yarn test:integration
yarn test:e2e
```

## Troubleshooting Deployment Issues

### Common Deployment Failures

**1. Authentication Errors**:
```bash
# Check Firebase CLI authentication
firebase login:list

# Re-authenticate if needed
firebase logout
firebase login
```

**2. Project Access Issues**:
```bash
# Verify project access
firebase projects:list

# Check current project
firebase use

# Switch to correct project
firebase use dev
```

**3. Environment File Issues**:
```bash
# Check if environment files exist
ls -la functions/.env.*

# Verify environment variables are loaded
node -e "require('dotenv').config({path: '.env.dev'}); console.log(process.env.PROJECT_ID)"
```

**4. TypeScript Compilation Errors**:
```bash
# Check TypeScript configuration
cat functions/tsconfig.json

# Compile with detailed output
cd functions && npx tsc --noEmit --listFiles
```

**5. Function Size Limits**:
```bash
# Check function size
cd functions
du -sh lib/
du -sh node_modules/

# Optimize if needed
yarn install --production
```

### Debug Commands

```bash
# Deploy with debug output
firebase deploy --only functions:locationsAPIV2 --debug

# Check function configuration
firebase functions:config:get

# View function source
firebase functions:log --only locationsAPIV2 --lines 1

# Test function locally before deployment
yarn debug:dev
```

## Performance Optimization

### Function Configuration Tuning

**Memory Allocation**:
```typescript
export const locationsAPIV2 = onRequest({
  memory: '256MiB',    // Increase to 512MiB if needed
  timeoutSeconds: 60,  // Adjust based on CSV processing time
  region: 'us-central1'
}, app);
```

**Cold Start Optimization**:
- Minimize dependencies
- Use lazy loading for heavy modules
- Optimize initialization code

### Deployment Size Optimization

```bash
# Remove development dependencies
yarn install --production

# Exclude unnecessary files
# Update firebase.json ignore patterns

# Optimize TypeScript compilation
# Use production tsconfig settings
```

## Maintenance Procedures

### Regular Maintenance Tasks

**Weekly**:
- Review function logs for errors
- Monitor performance metrics
- Check CSV data freshness

**Monthly**:
- Update dependencies
- Review security configurations
- Optimize function performance

**Quarterly**:
- Rotate service account keys
- Review access permissions
- Update documentation

### Data Updates

**CSV File Updates**:
```bash
# Upload new CSV file to Firebase Storage
gsutil cp jalisco_cp_geocoded.csv gs://job-bank-dev.appspot.com/location/
gsutil cp jalisco_cp_geocoded.csv gs://job-bank-qa.appspot.com/location/
gsutil cp jalisco_cp_geocoded.csv gs://job-bank-prod.appspot.com/location/

# No function redeployment needed - data loaded dynamically
```

**Dependency Updates**:
```bash
# Check for outdated packages
cd functions
yarn outdated

# Update packages
yarn upgrade

# Test after updates
yarn build
yarn test
```
