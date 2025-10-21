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
