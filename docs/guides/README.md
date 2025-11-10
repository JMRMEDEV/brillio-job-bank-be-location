# Implementation Guides

Comprehensive guides for implementing and working with the Location Service.

## Available Guides

| Guide | Description | Audience |
|-------|-------------|----------|
| [CSV Processing](./csv-processing.md) | Data pipeline and CSV handling | Developers, Data Engineers |
| [Geocoding](./geocoding.md) | SEPOMEX integration and geocoding | Data Engineers, DevOps |
| [Authentication](./authentication.md) | Anonymous and role-based access | Developers, Security |
| [Performance](./performance.md) | Optimization and monitoring | Developers, DevOps |
| [Potential Issues](./potential-issues.md) | Preventive measures and solutions | All Users |

## Quick Reference

### For Developers
- **Getting Started**: [Development Setup](../development/README.md)
- **API Integration**: [API Reference](../api/README.md)
- **Authentication**: [Authentication Guide](./authentication.md)

### For Data Engineers
- **Data Pipeline**: [CSV Processing Guide](./csv-processing.md)
- **Geocoding**: [SEPOMEX Integration](./geocoding.md)
- **Performance**: [Optimization Guide](./performance.md)

### For DevOps
- **Deployment**: [Deployment Guide](../deployment/README.md)
- **Monitoring**: [Performance Guide](./performance.md)
- **Troubleshooting**: [Potential Issues](./potential-issues.md)

## Implementation Patterns

### 1. Anonymous Access Pattern

The Location Service implements a unique anonymous access pattern that allows both authenticated and unauthenticated users to access all endpoints.

```typescript
// Middleware allows both anonymous and authenticated access
app.get('/municipalities', 
  allowAnonymousOrRoles(['contractor', 'admin', 'superadmin', 'owner']),
  async (req, res) => {
    // Implementation accessible to all users
  }
);
```

**Use Cases**:
- Public location lookup for registration forms
- Guest user access to location data
- Integration with external systems without authentication

### 2. CSV-Based Data Architecture

The service uses a CSV-based data architecture for simplicity and performance:

```typescript
// Real-time CSV processing without persistent caching
async function loadCsvData(): Promise<LocationRecord[]> {
  const bucket = admin.storage().bucket();
  const file = bucket.file('location/jalisco_cp_geocoded.csv');
  
  const [buffer] = await file.download();
  const csvContent = buffer.toString('utf-8');
  
  return parseCSV(csvContent);
}
```

**Benefits**:
- Simple data updates (replace CSV file)
- No database maintenance required
- Stateless function design
- Easy data versioning

### 3. Multi-Environment Configuration

Environment-specific configuration using dotenv pattern:

```typescript
// Load environment-specific configuration
const nodeEnv = process.env.NODE_ENV || 'dev';
const envFile = `.env.${nodeEnv}`;

dotenv.config({ path: envFile });

export const config = {
  firebase: {
    projectId: process.env.PROJECT_ID,
    // ... other config
  }
};
```

**Environments**:
- **Development**: Feature development and testing
- **QA**: Integration testing and validation
- **Production**: Live user traffic

### 4. Validation-First Design

All endpoints use Joi schema validation before processing:

```typescript
// Input validation middleware
app.get('/settlements/search',
  validateQuery(searchQuerySchema),
  async (req, res) => {
    // Validated input guaranteed
    const query = req.query.query as string;
    // ... implementation
  }
);
```

**Validation Benefits**:
- Consistent error messages
- Input sanitization
- Type safety
- API documentation through schemas

## Integration Examples

### Frontend Integration

**React Component Example**:
```typescript
import { useState, useEffect } from 'react';

interface LocationService {
  getMunicipalities(): Promise<string[]>;
  searchSettlements(query: string): Promise<string[]>;
  checkPostalCode(code: string): Promise<boolean>;
}

const LocationSelector: React.FC = () => {
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [settlements, setSettlements] = useState<string[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState('');
  
  useEffect(() => {
    // Load municipalities on component mount
    locationService.getMunicipalities()
      .then(setMunicipalities)
      .catch(console.error);
  }, []);
  
  const handleSettlementSearch = async (query: string) => {
    if (query.length >= 3) {
      const results = await locationService.searchSettlements(query);
      setSettlements(results);
    }
  };
  
  return (
    <div>
      <select 
        value={selectedMunicipality}
        onChange={(e) => setSelectedMunicipality(e.target.value)}
      >
        <option value="">Select Municipality</option>
        {municipalities.map(municipality => (
          <option key={municipality} value={municipality}>
            {municipality}
          </option>
        ))}
      </select>
      
      <input
        type="text"
        placeholder="Search settlements..."
        onChange={(e) => handleSettlementSearch(e.target.value)}
      />
      
      <ul>
        {settlements.map(settlement => (
          <li key={settlement}>{settlement}</li>
        ))}
      </ul>
    </div>
  );
};
```

### Backend Integration

**Express.js Middleware Example**:
```typescript
import axios from 'axios';

interface LocationValidationMiddleware {
  (req: Request, res: Response, next: NextFunction): Promise<void>;
}

const validateLocation: LocationValidationMiddleware = async (req, res, next) => {
  const { municipality, neighborhood, zipCode } = req.body;
  
  if (!municipality || !neighborhood || !zipCode) {
    return next(); // Skip validation if location data not provided
  }
  
  try {
    const response = await axios.get(
      `${LOCATION_SERVICE_URL}/location/coordinates`,
      {
        params: { municipality, neighborhood, zipCode }
      }
    );
    
    if (response.status === 200) {
      // Location is valid, add coordinates to request
      req.body.coordinates = response.data.coordinates;
      next();
    } else {
      res.status(400).json({ error: 'Invalid location' });
    }
  } catch (error) {
    if (error.response?.status === 404) {
      res.status(400).json({ error: 'Location not found' });
    } else {
      next(error);
    }
  }
};

// Use in route
app.post('/contractors', validateLocation, createContractorHandler);
```

### Mobile App Integration

**React Native Example**:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

class LocationService {
  private baseUrl: string;
  private cache: Map<string, any> = new Map();
  
  constructor(environment: 'dev' | 'qa' | 'prod' = 'prod') {
    this.baseUrl = `https://us-central1-job-bank-${environment}.cloudfunctions.net/locationsAPIV2`;
  }
  
  async getMunicipalities(): Promise<string[]> {
    const cacheKey = 'municipalities';
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // Check AsyncStorage
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      this.cache.set(cacheKey, data);
      return data;
    }
    
    // Fetch from API
    const response = await fetch(`${this.baseUrl}/municipalities`);
    const data = await response.json();
    
    // Cache results
    this.cache.set(cacheKey, data.municipalities);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(data.municipalities));
    
    return data.municipalities;
  }
  
  async searchSettlements(query: string): Promise<string[]> {
    // Don't cache search results due to variability
    const response = await fetch(
      `${this.baseUrl}/settlements/search?query=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    return data.settlements;
  }
}
```

## Best Practices

### 1. Error Handling

**Graceful Degradation**:
```typescript
const LocationSelector: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleLocationSearch = async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const results = await locationService.searchSettlements(query);
      setSettlements(results);
    } catch (err) {
      setError('Failed to search locations. Please try again.');
      console.error('Location search error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Searching...</div>}
      {/* ... rest of component */}
    </div>
  );
};
```

### 2. Performance Optimization

**Debounced Search**:
```typescript
import { useMemo } from 'react';
import { debounce } from 'lodash';

const LocationSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  
  const debouncedSearch = useMemo(
    () => debounce(async (searchQuery: string) => {
      if (searchQuery.length >= 3) {
        const settlements = await locationService.searchSettlements(searchQuery);
        setResults(settlements);
      }
    }, 300),
    []
  );
  
  useEffect(() => {
    debouncedSearch(query);
    return () => debouncedSearch.cancel();
  }, [query, debouncedSearch]);
  
  return (
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search settlements..."
    />
  );
};
```

### 3. Caching Strategy

**Client-Side Caching**:
```typescript
class CachedLocationService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTimeout;
  }
  
  async getMunicipalities(): Promise<string[]> {
    const cacheKey = 'municipalities';
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data;
    }
    
    const response = await fetch(`${this.baseUrl}/municipalities`);
    const data = await response.json();
    
    this.cache.set(cacheKey, {
      data: data.municipalities,
      timestamp: Date.now()
    });
    
    return data.municipalities;
  }
}
```

### 4. Type Safety

**TypeScript Interfaces**:
```typescript
interface Municipality {
  name: string;
  code?: string;
}

interface Settlement {
  name: string;
  municipality: string;
  postalCode: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationResponse {
  municipality: string;
  neighborhood: string;
  zipCode: string;
  coordinates: Coordinates;
}

interface LocationService {
  getMunicipalities(): Promise<Municipality[]>;
  searchSettlements(query: string): Promise<Settlement[]>;
  checkPostalCode(code: string): Promise<boolean>;
  getCoordinates(
    municipality: string,
    neighborhood: string,
    zipCode: string
  ): Promise<LocationResponse | null>;
}
```

## Testing Strategies

### Unit Testing

**Service Testing**:
```typescript
import { LocationService } from './location.service';

describe('LocationService', () => {
  let service: LocationService;
  
  beforeEach(() => {
    service = new LocationService('dev');
  });
  
  it('should fetch municipalities', async () => {
    const municipalities = await service.getMunicipalities();
    expect(municipalities).toBeInstanceOf(Array);
    expect(municipalities.length).toBeGreaterThan(0);
    expect(municipalities).toContain('Guadalajara');
  });
  
  it('should search settlements', async () => {
    const settlements = await service.searchSettlements('centro');
    expect(settlements).toBeInstanceOf(Array);
    expect(settlements.some(s => s.toLowerCase().includes('centro'))).toBe(true);
  });
  
  it('should validate postal codes', async () => {
    const exists = await service.checkPostalCode('44100');
    expect(typeof exists).toBe('boolean');
  });
});
```

### Integration Testing

**API Testing**:
```typescript
import axios from 'axios';

describe('Location API Integration', () => {
  const baseUrl = 'https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2';
  
  it('should return municipalities', async () => {
    const response = await axios.get(`${baseUrl}/municipalities`);
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('municipalities');
    expect(response.data).toHaveProperty('count');
    expect(response.data.municipalities).toBeInstanceOf(Array);
  });
  
  it('should handle validation errors', async () => {
    try {
      await axios.get(`${baseUrl}/settlements/search?query=ab`);
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data).toHaveProperty('error');
      expect(error.response.data).toHaveProperty('details');
    }
  });
});
```

### End-to-End Testing

**User Flow Testing**:
```typescript
import { test, expect } from '@playwright/test';

test('location selection flow', async ({ page }) => {
  await page.goto('/registration');
  
  // Select municipality
  await page.selectOption('#municipality', 'Guadalajara');
  
  // Search for settlement
  await page.fill('#settlement-search', 'centro');
  await page.waitForSelector('.settlement-results');
  
  // Select settlement
  await page.click('.settlement-results li:first-child');
  
  // Enter postal code
  await page.fill('#postal-code', '44100');
  
  // Verify coordinates are populated
  const coordinates = await page.textContent('#coordinates');
  expect(coordinates).toContain('20.67');
  expect(coordinates).toContain('-103.35');
});
```

## Security Considerations

### Input Validation

**Client-Side Validation**:
```typescript
const validateLocationInput = (input: string): boolean => {
  // Prevent XSS attacks
  const sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Check length limits
  if (sanitized.length > 100) return false;
  
  // Allow only alphanumeric and common punctuation
  const allowedPattern = /^[a-zA-Z0-9\s\-\.áéíóúñüÁÉÍÓÚÑÜ]+$/;
  return allowedPattern.test(sanitized);
};
```

### Rate Limiting

**Client-Side Rate Limiting**:
```typescript
class RateLimitedLocationService {
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private requestDelay = 100; // 100ms between requests
  
  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      await request();
      await new Promise(resolve => setTimeout(resolve, this.requestDelay));
    }
    
    this.isProcessing = false;
  }
  
  async searchSettlements(query: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const response = await fetch(`${this.baseUrl}/settlements/search?query=${query}`);
          const data = await response.json();
          resolve(data.settlements);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }
}
```

## Monitoring and Analytics

### Performance Monitoring

**Client-Side Performance Tracking**:
```typescript
class MonitoredLocationService {
  private analytics: Analytics;
  
  async getMunicipalities(): Promise<string[]> {
    const startTime = performance.now();
    
    try {
      const municipalities = await this.fetchMunicipalities();
      
      // Track successful request
      this.analytics.track('location_service_request', {
        endpoint: 'municipalities',
        duration: performance.now() - startTime,
        success: true,
        count: municipalities.length
      });
      
      return municipalities;
    } catch (error) {
      // Track failed request
      this.analytics.track('location_service_request', {
        endpoint: 'municipalities',
        duration: performance.now() - startTime,
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }
}
```

### Usage Analytics

**Track User Interactions**:
```typescript
const LocationAnalytics = {
  trackMunicipalitySelection: (municipality: string) => {
    analytics.track('municipality_selected', { municipality });
  },
  
  trackSettlementSearch: (query: string, resultCount: number) => {
    analytics.track('settlement_search', { 
      query_length: query.length,
      result_count: resultCount
    });
  },
  
  trackLocationValidation: (isValid: boolean, municipality: string) => {
    analytics.track('location_validation', {
      is_valid: isValid,
      municipality
    });
  }
};
```
