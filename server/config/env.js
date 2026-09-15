require('dotenv').config();

/**
 * Central place all environment variables are read from.
 * Every other file imports from here instead of calling process.env directly,
 * so defaults and validation only live in one place.
 */
const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/detectiq',

  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_COOKIE_NAME: 'detectiq_token',

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  ADMIN_SEED_EMAIL: process.env.ADMIN_SEED_EMAIL || 'admin@detectiq.app',
  ADMIN_SEED_PASSWORD: process.env.ADMIN_SEED_PASSWORD || 'ChangeMe123!',

  // ---------------------------------------------------------------------------
  // Threat Intelligence
  // ---------------------------------------------------------------------------

  /** PhishDestroy API URL */
  PHISHDESTROY_API_URL: process.env.PHISHDESTROY_API_URL || 'https://api.destroy.tools',

  /** Timeout for PhishDestroy API calls (ms) */
  PHISHDESTROY_TIMEOUT_MS: process.env.PHISHDESTROY_TIMEOUT_MS || '4000',

  /** Threat intel cache TTL in hours */
  THREAT_INTEL_CACHE_TTL: process.env.THREAT_INTEL_CACHE_TTL || '6',

  /** VirusTotal API Key */
  VIRUSTOTAL_API_KEY: process.env.VIRUSTOTAL_API_KEY || '',

  /** Timeout for VirusTotal API calls (ms) */
  VIRUSTOTAL_TIMEOUT_MS: process.env.VIRUSTOTAL_TIMEOUT_MS || '4000',

  /** AbuseIPDB API Key */
  ABUSEIPDB_API_KEY: process.env.ABUSEIPDB_API_KEY || '',

  /** Timeout for AbuseIPDB API calls (ms) */
  ABUSEIPDB_TIMEOUT_MS: process.env.ABUSEIPDB_TIMEOUT_MS || '4000',

  /** URLhaus API Key */
  URLHAUS_API_KEY: process.env.URLHAUS_API_KEY || '',

  /** Timeout for URLhaus API calls (ms) */
  URLHAUS_TIMEOUT_MS: process.env.URLHAUS_TIMEOUT_MS || '4000',

  /** AlienVault OTX API Key */
  OTX_API_KEY: process.env.OTX_API_KEY || '',

  /** Timeout for OTX API calls (ms) */
  OTX_TIMEOUT_MS: process.env.OTX_TIMEOUT_MS || '5000',

  // ---------------------------------------------------------------------------
  // ML Inference Service
  // ---------------------------------------------------------------------------

  /** Base URL of the Python FastAPI ML service */
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://localhost:8001',

  /** Timeout for ML service calls (ms) */
  ML_SERVICE_TIMEOUT_MS: process.env.ML_SERVICE_TIMEOUT_MS || '3000',

  /** Secret token for authenticating Node->Python API calls */
  ML_INTERNAL_TOKEN: process.env.ML_INTERNAL_TOKEN || 'dev-internal-token-change-me',

  // ---------------------------------------------------------------------------
  // Groq AI
  // ---------------------------------------------------------------------------

  /** Groq API key — obtain from console.groq.com */
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',

  /** Groq model to use — e.g. 'llama-3.1-8b-instant', 'mixtral-8x7b-32768' */
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',

  /** Timeout for Groq API calls (ms) */
  GROQ_TIMEOUT_MS: process.env.GROQ_TIMEOUT_MS || '7000',

  // ---------------------------------------------------------------------------
  // Phase 2: Threat Enrichment / Geolocation
  // ---------------------------------------------------------------------------

  /** Timeout for IP geolocation provider calls (ms) */
  GEOLOCATION_TIMEOUT_MS: process.env.GEOLOCATION_TIMEOUT_MS || '4000',

  /** Maximum number of indicators to enrich per scan (prevents abuse) */
  MAX_INTELLIGENCE_INDICATORS_PER_SCAN: process.env.MAX_INTELLIGENCE_INDICATORS_PER_SCAN || '20',
};

const isProd = env.NODE_ENV === 'production';

if (isProd && env.JWT_SECRET === 'dev-only-insecure-secret-change-me') {
  // eslint-disable-next-line no-console
  console.warn(
    '[detectiq] WARNING: JWT_SECRET is using the insecure development default in production. ' +
      'Set a real JWT_SECRET in your environment before deploying.'
  );
}

module.exports = env;
