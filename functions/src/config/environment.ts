import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as admin from 'firebase-admin';

// Load environment-specific .env file based on NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'dev';
const envFile = `.env.${nodeEnv}`;

// Try multiple path resolutions for different execution contexts
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
    // Continue to next path
  }
}

if (!envLoaded) {
  console.warn(`Could not load ${envFile} from any path`);
}

interface EnvironmentConfig {
  nodeEnv: string;
  environment: string;
  firebase: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
    storagePath: string;
  };
}

const getEnvironmentConfig = (): EnvironmentConfig => {
  const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    environment: nodeEnv.toUpperCase(),
    firebase: {
      projectId: process.env.PROJECT_ID || '',
      privateKey: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
      clientEmail: process.env.CLIENT_EMAIL || '',
      storagePath: process.env.STORAGE_PATH || '',
    },
  };

  // Validate required fields
  if (!config.firebase.projectId) {
    throw new Error('Missing PROJECT_ID environment variable');
  }
  if (!config.firebase.privateKey) {
    throw new Error('Missing PRIVATE_KEY environment variable');
  }
  if (!config.firebase.clientEmail) {
    throw new Error('Missing CLIENT_EMAIL environment variable');
  }

  return config;
};

export const config = getEnvironmentConfig();

// Initialize Firebase Admin
export const adminApp = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: config.firebase.projectId,
    privateKey: config.firebase.privateKey,
    clientEmail: config.firebase.clientEmail,
  }),
});

// Initialize Firebase Auth instance
export const auth = admin.auth();
