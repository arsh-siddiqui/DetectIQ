const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const uri = process.env.MONGO_URI;

mongoose.connect(uri).then(async () => {
  const db = mongoose.connection.db;
  
  // Find indicators that have any geolocation
  const withGeo = await db.collection('indicators').find({ 
    geolocation: { $exists: true, $ne: null } 
  }).limit(5).toArray();

  console.log('Indicators with geolocation:', withGeo.length);
  withGeo.forEach((ind, i) => {
    console.log(`--- Indicator ${i+1} ---`);
    console.log('  value:', ind.value, '| type:', ind.type, '| threatStatus:', ind.threatStatus);
    console.log('  geolocation:', JSON.stringify(ind.geolocation));
    if (ind.intelligence && typeof ind.intelligence === 'object') {
      const keys = Object.keys(ind.intelligence);
      console.log('  intelligence keys:', keys);
      if (ind.intelligence.virustotal) {
        console.log('  VT threat:', ind.intelligence.virustotal.threat, '| status:', ind.intelligence.virustotal.status);
      }
    }
  });
  
  // Count how many have lat/lng
  const geoWithCoords = await db.collection('indicators').find({ 
    'geolocation.latitude': { $exists: true }
  }).countDocuments();
  const geoWithLat = await db.collection('indicators').find({ 
    'geolocation.lat': { $exists: true }
  }).countDocuments();
  console.log('\nWith geolocation.latitude field:', geoWithCoords);
  console.log('With geolocation.lat field:', geoWithLat);
  
  mongoose.disconnect();
}).catch(e => console.error(e));
