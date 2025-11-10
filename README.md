# Location Service

Firebase Cloud Functions microservice providing location data for Jalisco, Mexico as part of the Service Club ecosystem.

## 📚 Documentation

Complete documentation: **[docs/](./docs/)**

### Quick Links
| Section | Description |
|---------|-------------|
| [📖 Documentation Hub](./docs/) | Complete documentation index |
| [🏗️ Architecture](./docs/architecture/) | System design and patterns |
| [🔌 API Reference](./docs/api/) | Endpoint documentation |
| [💻 Development](./docs/development/) | Setup and development guide |
| [🚀 Deployment](./docs/deployment/) | Deployment procedures |
| [📋 Guides](./docs/guides/) | Implementation guides |

## 🚀 Quick Start

```bash
# Install dependencies
cd functions && yarn install

# Configure environment
cp .env.template .env.dev
# Fill in Firebase credentials

# Start development server
yarn debug:dev

# Deploy to development
yarn deploy:dev
```

## 🌍 Service URLs

| Environment | URL |
|-------------|-----|
| **Development** | `https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2` |
| **QA** | `https://us-central1-job-bank-qa.cloudfunctions.net/locationsAPIV2` |
| **Production** | `https://us-central1-job-bank-prod.cloudfunctions.net/locationsAPIV2` |

## 🔧 Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Firebase Functions v2 + Express.js
- **Language**: TypeScript 5.4.2
- **Data Source**: CSV files in Firebase Storage
- **Validation**: Joi schemas
- **Package Manager**: Yarn 4.10.1

## 📊 API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/municipalities` | GET | Get all municipalities in Jalisco |
| `/settlements/search` | GET | Search settlements by name |
| `/zipCode/check` | GET | Validate postal codes |
| `/location/coordinates` | GET | Get GPS coordinates |

**Authentication**: Anonymous access + optional Firebase ID tokens

## 🎯 Key Features

- **Anonymous Access**: All endpoints accessible without authentication
- **CSV Data Source**: Reads from Jalisco postal code database
- **Multi-Environment**: Dev, QA, and Production configurations
- **TypeScript**: Full type safety with strict compilation
- **Joi Validation**: Comprehensive input validation
- **CORS Enabled**: Cross-origin resource sharing support

## 📈 Project Status

- **Version**: 1.0.0
- **Status**: ✅ Production Ready
- **Coverage**: 125 municipalities, 15,000+ postal codes
- **Data Source**: SEPOMEX Jalisco geocoded database

## 🔗 Service Club Ecosystem

This service is part of the larger Service Club platform:

- **Authentication Service**: User management and roles
- **User Management Service**: Contractor and admin operations  
- **Posts Service**: Content management
- **Storage Service**: File upload and management

## 📞 Support

- **Documentation**: [docs/](./docs/)
- **API Reference**: [docs/api/](./docs/api/)
- **Potential Issues**: [docs/guides/potential-issues.md](./docs/guides/potential-issues.md)
- **Development Guide**: [docs/development/](./docs/development/)
