const mongoose = require('mongoose');
const env = require('dotenv').config({ path: '.env.local' });
if (env.error) require('dotenv').config({ path: '.env' });

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/detectiq';

mongoose.connect(uri).then(async () => {
  console.log('Connected to DB');
  const db = mongoose.connection.db;
  const indicators = await db.collection('indicators').find({}).toArray();
  let updated = 0;
  for (const ind of indicators) {
    let threat = 'unknown';
    let sev = 'none';
    if (ind.intelligence && ind.intelligence.virustotal) {
       threat = ind.intelligence.virustotal.threat || 'unknown';
       sev = ind.intelligence.virustotal.severity || 'none';
    } else if (ind.intelligence && ind.intelligence.virusTotal) {
       threat = ind.intelligence.virusTotal.threat || 'unknown';
       sev = ind.intelligence.virusTotal.severity || 'none';
    }
    
    // Map flagged to malicious just in case
    if (threat === 'flagged') threat = 'malicious';
    
    if (ind.threatStatus !== threat || ind.severity !== sev) {
       await db.collection('indicators').updateOne({ _id: ind._id }, { $set: { threatStatus: threat, severity: sev } });
       updated++;
    }
  }
  console.log('Updated ' + updated + ' indicators');
  mongoose.disconnect();
}).catch(err => console.error(err));
