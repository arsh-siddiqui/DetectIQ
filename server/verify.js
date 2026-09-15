'use strict';
require('dotenv').config();
const { checkVirusTotalIP, checkVirusTotalDomain, checkVirusTotalURL, checkVirusTotalHash } = require('./services/threatIntel/virusTotalService');
const { checkAbuseIpDbIP } = require('./services/threatIntel/abuseIpDbService');
const { checkUrlhausURL } = require('./services/threatIntel/urlhausService');
const { checkOtxIndicator } = require('./services/threatIntel/otxService');
const { lookupIP } = require('./services/intelligence/geolocationProvider');

async function run() {
  console.log('--- LIVE PROVIDER VERIFICATION ---');

  // Test IP: 8.8.8.8
  console.log('\n[IP: 8.8.8.8]');
  try {
    const vtIP = await checkVirusTotalIP('8.8.8.8');
    console.log('VirusTotal IP:', vtIP.status === 'error' ? 'Failure' : 'Success');
  } catch (e) { console.log('VirusTotal IP: Failure', e.message); }

  try {
    const abIP = await checkAbuseIpDbIP('8.8.8.8');
    console.log('AbuseIPDB IP:', abIP.status === 'error' ? 'Failure' : 'Success');
  } catch (e) { console.log('AbuseIPDB IP: Failure', e.message); }

  try {
    const otxIP = await checkOtxIndicator('ip', '8.8.8.8');
    console.log('OTX IP:', otxIP.status === 'error' ? 'Failure' : 'Success');
  } catch (e) { console.log('OTX IP: Failure', e.message); }
  
  try {
    const geoIP = await lookupIP('8.8.8.8');
    console.log('Geolocation IP:', geoIP ? 'Success' : 'Failure');
  } catch (e) { console.log('Geolocation IP: Failure', e.message); }


  // Test Domain: example.com
  console.log('\n[Domain: example.com]');
  try {
    const vtDom = await checkVirusTotalDomain('example.com');
    console.log('VirusTotal Domain:', vtDom.status === 'error' ? 'Failure' : 'Success');
  } catch (e) { console.log('VirusTotal Domain: Failure', e.message); }

  try {
    const otxDom = await checkOtxIndicator('domain', 'example.com');
    console.log('OTX Domain:', otxDom.status === 'error' ? 'Failure' : 'Success');
  } catch (e) { console.log('OTX Domain: Failure', e.message); }

  // Test URL: http://example.com
  console.log('\n[URL: http://example.com]');
  try {
    const vtUrl = await checkVirusTotalURL('http://example.com');
    console.log('VirusTotal URL:', vtUrl.status === 'error' ? 'Failure' : 'Success');
  } catch (e) { console.log('VirusTotal URL: Failure', e.message); }

  try {
    const uhUrl = await checkUrlhausURL('http://example.com');
    console.log('URLhaus URL:', uhUrl.status === 'error' ? 'Failure' : 'Success');
  } catch (e) { console.log('URLhaus URL: Failure', e.message); }

  try {
    const otxUrl = await checkOtxIndicator('url', 'http://example.com');
    console.log('OTX URL:', otxUrl.status === 'error' ? 'Failure' : 'Success');
  } catch (e) { console.log('OTX URL: Failure', e.message); }

  // Test Hash: 44d88612fea8a8f36de82e1278abb02f
  console.log('\n[Hash: 44d88612fea8a8f36de82e1278abb02f]');
  try {
    const vtHash = await checkVirusTotalHash('44d88612fea8a8f36de82e1278abb02f');
    console.log('VirusTotal Hash:', vtHash.status === 'error' ? 'Failure' : 'Success');
  } catch (e) { console.log('VirusTotal Hash: Failure', e.message); }

  try {
    const otxHash = await checkOtxIndicator('hash', '44d88612fea8a8f36de82e1278abb02f');
    console.log('OTX Hash:', otxHash.status === 'error' ? 'Failure' : 'Success');
  } catch (e) { console.log('OTX Hash: Failure', e.message); }

}

run().catch(console.error);
