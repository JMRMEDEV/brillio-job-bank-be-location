# Location Service Documentation

Complete documentation for the Service Club Location Service - a Firebase Cloud Functions microservice providing location data for Jalisco, Mexico.

## 📚 Documentation Sections

| Section | Description | Status |
|---------|-------------|---------|
| [Architecture](./architecture/) | System design and patterns | ✅ Complete |
| [API Reference](./api/) | Endpoint documentation | ✅ Complete |
| [Development](./development/) | Setup and development guide | ✅ Complete |
| [Deployment](./deployment/) | Deployment procedures | ✅ Complete |
| [Guides](./guides/) | Implementation guides | ✅ Complete |

## 🚀 Quick Navigation

### For Developers
- **Getting Started**: [Development Setup](./development/README.md)
- **API Usage**: [API Reference](./api/README.md)
- **Architecture**: [System Design](./architecture/README.md)

### For DevOps
- **Deployment**: [Deployment Guide](./deployment/README.md)
- **Environment Config**: [Multi-Environment Setup](./deployment/environments.md)

### For Data Management
- **CSV Processing**: [Data Pipeline Guide](./guides/csv-processing.md)
- **Geocoding**: [SEPOMEX Integration](./guides/geocoding.md)

## 📋 Service Overview

The Location Service provides location data for Jalisco, Mexico through a Firebase Cloud Functions API. It processes SEPOMEX postal code data and provides endpoints for:

- **Municipality Lookup**: Get all municipalities in Jalisco
- **Settlement Search**: Search neighborhoods/settlements by name
- **Postal Code Validation**: Check if postal codes exist
- **Coordinate Lookup**: Get GPS coordinates for specific locations

## 🔧 Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Firebase Functions v2 + Express.js
- **Language**: TypeScript
- **Data Source**: CSV files in Firebase Storage
- **Validation**: Joi schemas
- **Build Tool**: TypeScript Compiler
- **Package Manager**: Yarn 4.10.1

## 🌍 Service Environments

| Environment | Firebase Project | Function URL |
|-------------|------------------|--------------|
| Development | `job-bank-dev` | `https://us-central1-job-bank-dev.cloudfunctions.net/locationsAPIV2` |
| QA | `job-bank-qa` | `https://us-central1-job-bank-qa.cloudfunctions.net/locationsAPIV2` |
| Production | `job-bank-prod` | `https://us-central1-job-bank-prod.cloudfunctions.net/locationsAPIV2` |

## 📊 Project Status

- **Version**: 1.0.0
- **Status**: Production Ready
- **Last Updated**: November 2025
- **Maintenance**: Active

## 🔗 Related Services

This service is part of the larger Service Club ecosystem:

- **Authentication Service**: User management and role-based access
- **User Management Service**: Contractor and admin operations
- **Posts Service**: Content management
- **Storage Service**: File upload and management

## 📞 Support

For technical support or questions:
- Review the [API Documentation](./api/README.md)
- Check [Potential Issues](./guides/potential-issues.md)
- Consult [Development Guide](./development/README.md)
