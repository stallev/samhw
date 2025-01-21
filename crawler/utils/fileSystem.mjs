import fs from 'fs';
import path from 'path';

export function saveDataToLocalJson(data, type, location, customName = '') {
  try {
    const responsesDir = path.join(__dirname, '..', 'responses');
    if (!fs.existsSync(responsesDir)) {
      fs.mkdirSync(responsesDir);
    }

    const timestamp = Date.now();
    const filename = customName 
      ? `${location}_${customName}.json`
      : `${location}_${type}_${timestamp}.json`;
    
    const filepath = path.join(responsesDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    
    console.log(`Data saved to: ${filename}`);
    
    return filepath;
  } catch (error) {
    console.error('Error saving data to JSON file:', error);
    throw error;
  }
}
