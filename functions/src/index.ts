import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import express, { Request, Response } from 'express';

import { getMunicipalities } from './helpers/csv-helpers';
import { allowAnonymousOrRoles } from './middleware';

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

// Export the Firebase Function
export const locationsAPIV2 = onRequest({
  cors: true,
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 60
}, app);
