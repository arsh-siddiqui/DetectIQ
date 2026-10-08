import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  path.join(__dirname, 'manifest.test.js'),
  path.join(__dirname, 'api-unit.test.js'),
  path.join(__dirname, 'background-unit.test.js'),
  path.join(__dirname, 'popup-ui.test.js'),
  path.join(__dirname, 'alerts-and-overlays.test.js'),
  path.join(__dirname, 'rate-limiting.test.js'),
  path.join(__dirname, 'live-cloud-e2e.test.js'),
  path.join(__dirname, 'cloud-threat-matrix.test.js'),
  path.join(__dirname, 'homograph-and-qr.test.js'),
];

console.log('====================================================');
console.log('🛡️  DetectIQ Browser Extension Automated Test Runner');
console.log('====================================================\n');

run({ files: testFiles })
  .on('test:fail', () => {
    process.exitCode = 1;
  })
  .compose(spec)
  .pipe(process.stdout);
