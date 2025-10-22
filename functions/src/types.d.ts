// CSV row structure from Jalisco postal code data
export interface ILocationCSV {
  postalCode: string;
  settlement: string;
  municipality: string;
  state: string;
  lat: string;
  lon: string;
}

// API Response interfaces
export interface IMunicipalitiesResponse {
  municipalities: string[];
  count: number;
}

export interface ISettlementSearchResponse {
  settlements: string[];
  count: number;
  searchParam: string;
}

export interface IPostalCodeCheckResponse {
  zipCode: string;
  exists: boolean;
}

export interface ILocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface ILocationCoordinatesResponse {
  municipality?: string;
  neighborhood?: string;
  zipCode?: string;
  coordinates: ILocationCoordinates;
}

// Express middleware types
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
