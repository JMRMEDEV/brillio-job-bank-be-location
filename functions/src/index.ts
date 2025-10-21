import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import express, { Request, Response } from 'express';

import { getMunicipalities, searchSettlements, searchPostalCode, searchLocationCoordinates } from './helpers/csv-helpers';
import { allowAnonymousOrRoles, validateQuery } from './middleware';
import { searchQuerySchema, postalCodeSchema, locationSearchSchema } from './validators/location.validators';

// Create Express app with cors
const app = express();
app.use(cors());
app.use(express.json());

// GET - Get municipalities from CSV (anonymous + all roles)
app.get('/municipalities', 
  allowAnonymousOrRoles(['contractor', 'admin', 'superadmin', 'owner']),
  async (req: Request, res: Response) => {
    try {
      const municipalities = await getMunicipalities();
      
      res.status(200).json({
        municipalities,
        count: municipalities.length
      });
    } catch (error) {
      console.error('Error fetching municipalities:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET - Search settlements from CSV (anonymous + all roles)
app.get('/settlements/search', 
  allowAnonymousOrRoles(['contractor', 'admin', 'superadmin', 'owner']),
  validateQuery(searchQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const searchParam = req.query.query as string;
      const settlements = await searchSettlements(searchParam);
      
      res.status(200).json({
        settlements,
        count: settlements.length,
        searchParam
      });
    } catch (error) {
      console.error('Error searching settlements:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET - Check if postal code exists (anonymous + all roles)
app.get('/postalcode/check', 
  allowAnonymousOrRoles(['contractor', 'admin', 'superadmin', 'owner']),
  validateQuery(postalCodeSchema),
  async (req: Request, res: Response) => {
    try {
      const postalCode = req.query.postalCode as string;
      const exists = await searchPostalCode(postalCode);
      
      res.status(200).json({
        postalCode,
        exists
      });
    } catch (error) {
      console.error('Error checking postal code:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET - Search location coordinates (anonymous + all roles)
app.get('/location/coordinates', 
  allowAnonymousOrRoles(['contractor', 'admin', 'superadmin', 'owner']),
  validateQuery(locationSearchSchema),
  async (req: Request, res: Response) => {
    try {
      const municipality = req.query.municipality as string;
      const neighborhood = req.query.neighborhood as string;
      const zipCode = req.query.zipCode as string;
      
      const coordinates = await searchLocationCoordinates(municipality, neighborhood, zipCode);
      
      if (coordinates) {
        res.status(200).json({
          municipality,
          neighborhood,
          zipCode,
          coordinates
        });
      } else {
        res.status(404).json({
          error: 'Location not found',
          municipality,
          neighborhood,
          zipCode
        });
      }
    } catch (error) {
      console.error('Error searching location coordinates:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Export the Firebase Function
export const locationsAPIV2 = onRequest({
  cors: true,
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 60
}, app);
