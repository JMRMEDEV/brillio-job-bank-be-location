export interface ILocationCSV {
  postalCode: string;
  settlement: string;
  settlementType: string;
  municipality: string;
  state: string;
  city: string;
  postalCodeAlt: string;
  stateCode: string;
  officeCode: string;
  postalCodeKey: string;
  settlementTypeCode: string;
  municipalityCode: string;
  settlementIdCpcons: string;
  zone: string;
  cityCode: string;
  lat: number;
  lon: number;
  geocodeSource: string;
  geocodeNote: string;
  confidence: string;
  missReason: string;
  precision: number;
}

export interface ILocation {
  id: string;
  name: string;
  country: string;
  state?: string;
  city?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  timezone?: string;
  created: number;
  updated: number;
}

export interface ILocationPayload extends Omit<ILocation, 'id' | 'created' | 'updated'> {}

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        role: string;
        email?: string;
      };
    }
  }
}
