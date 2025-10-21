import * as admin from 'firebase-admin';
import { parse } from 'csv-parse';

// Get CSV data from Firebase Storage
const getCSVData = async (): Promise<any[]> => {
  try {
    const bucket = admin.storage().bucket('job-bank-dev.appspot.com');
    const file = bucket.file('location/jalisco_cp_geocoded.csv');
    
    const [buffer] = await file.download();
    const csvContent = buffer.toString('utf-8');
    
    return new Promise((resolve, reject) => {
      parse(csvContent, {
        columns: true,
        skip_empty_lines: true
      }, (err, records) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(records);
      });
    });
  } catch (error) {
    console.error('Error fetching CSV data:', error);
    return [];
  }
};

// Get unique municipalities from CSV
export const getMunicipalities = async (): Promise<string[]> => {
  const csvData = await getCSVData();
  const municipalitySet = new Set<string>();
  
  csvData.forEach(row => {
    if (row.municipality && row.municipality.trim()) {
      municipalitySet.add(row.municipality.trim());
    }
  });
  
  return Array.from(municipalitySet).sort();
};

// Search settlements based on search parameter
export const searchSettlements = async (searchParam: string): Promise<string[]> => {
  const csvData = await getCSVData();
  const searchLower = searchParam.toLowerCase().trim();
  const settlementSet = new Set<string>();
  
  csvData.forEach(row => {
    if (row.settlement && row.settlement.trim()) {
      const settlement = row.settlement.trim();
      if (settlement.toLowerCase().includes(searchLower)) {
        settlementSet.add(settlement);
      }
    }
  });
  
  return Array.from(settlementSet).sort();
};

// Check if postal code exists in CSV
export const searchPostalCode = async (postalCode: string): Promise<boolean> => {
  const csvData = await getCSVData();
  
  return csvData.some(row => 
    row.postalCode && row.postalCode.trim() === postalCode.trim()
  );
};

// Search location coordinates by municipality, neighborhood (settlement), and zipCode (postalCode)
export const searchLocationCoordinates = async (
  municipality?: string, 
  neighborhood?: string, 
  zipCode?: string
): Promise<{ lat: number; lng: number } | null> => {
  const csvData = await getCSVData();
  
  const match = csvData.find(row => {
    const municipalityMatch = !municipality || 
      (row.municipality && row.municipality.trim().toLowerCase() === municipality.toLowerCase().trim());
    
    const neighborhoodMatch = !neighborhood || 
      (row.settlement && row.settlement.trim().toLowerCase() === neighborhood.toLowerCase().trim());
    
    const zipCodeMatch = !zipCode || 
      (row.postalCode && row.postalCode.trim() === zipCode.trim());
    
    return municipalityMatch && neighborhoodMatch && zipCodeMatch;
  });
  
  if (match && match.lat && match.lon) {
    return {
      lat: parseFloat(match.lat),
      lng: parseFloat(match.lon)
    };
  }
  
  return null;
};
