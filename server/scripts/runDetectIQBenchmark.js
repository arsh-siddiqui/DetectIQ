/**
 * runDetectIQBenchmark.js — Automated Paper Benchmark inside DetectIQ Project.
 *
 * Runs 500-email evaluation (250 Safe, 250 Phishing) directly through DetectIQ's
 * actual trained ML engine + FAISS RAG + Groq LLM pipeline.
 * Replicates Table III protocol from Al Barwani et al. (Jan 2026).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('='.repeat(76));
console.log(' DETECTIQ FULL-STACK BACKEND PROJECT BENCHMARK');
console.log(' Evaluating DetectIQ Pipeline (Groq LLM + FAISS RAG + ML Classifier)');
console.log('='.repeat(76));

const PYTHON_ENV = path.join(__dirname, '../../ml/.venv/Scripts/python.exe');
const EVAL_SCRIPT = path.join(__dirname, '../../ml/evaluate_rag_vs_norag.py');
const REPORT_JSON = path.join(__dirname, '../../ml/reports/rag_vs_norag_benchmark_500.json');

console.log('\n[1/4] Running DetectIQ 500-Email Benchmark Pipeline...');

try {
  const output = execSync(`"${PYTHON_ENV}" "${EVAL_SCRIPT}"`, { encoding: 'utf-8' });
  console.log(output);

  if (fs.existsSync(REPORT_JSON)) {
    const reportData = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf-8'));

    const projectReportPath = path.join(__dirname, '../reports/detectiq_project_benchmark.json');
    const projectReportDir = path.dirname(projectReportPath);
    if (!fs.existsSync(projectReportDir)) {
      fs.mkdirSync(projectReportDir, { recursive: true });
    }

    fs.writeFileSync(projectReportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n[SUCCESS] Project benchmark complete. Official report generated at:\n  ${projectReportPath}`);
  }
} catch (err) {
  console.error('[ERROR] Failed to run DetectIQ benchmark:', err.message);
  process.exit(1);
}
