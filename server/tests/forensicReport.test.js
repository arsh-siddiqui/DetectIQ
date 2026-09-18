const { generateReport, deriveLimitations } = require('../services/reports/forensicReportService');
const mongoose = require('mongoose');
const ForensicReport = require('../models/ForensicReport');

vi.mock('../services/ai/copilotService', () => ({
  askCopilot: vi.fn()
}));

const { askCopilot } = require('../services/ai/copilotService');

describe('forensicReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a deterministic report without AI if AI fails', async () => {
    askCopilot.mockRejectedValue(new Error('AI failed'));

    // Mock ForensicReport.create to just return the payload
    ForensicReport.create = vi.fn().mockImplementation((data) => data);

    const user = { _id: new mongoose.Types.ObjectId() };
    const investigation = { _id: new mongoose.Types.ObjectId(), sourceType: 'pasted_email', headers: {} };
    const scan = { classification: 'phishing', riskLevel: 'high' };

    const report = await generateReport(user, investigation, scan, [], [], {});
    
    expect(report.aiStatus).toBe('failed');
    expect(report.deterministicSummary.verdict.classification).toBe('phishing');
    expect(report.limitations).toContain('Full SMTP routing information was unavailable because this investigation was created from pasted content.');
    expect(report.status).toBe('generated');
    expect(ForensicReport.create).toHaveBeenCalled();
  });

  it('should include AI findings if AI succeeds', async () => {
    askCopilot.mockResolvedValue({
      summary: 'AI Summary',
      keyFindings: []
    });

    ForensicReport.create = vi.fn().mockImplementation((data) => data);

    const user = { _id: new mongoose.Types.ObjectId() };
    const investigation = { _id: new mongoose.Types.ObjectId(), headers: {} };
    const scan = {};

    const report = await generateReport(user, investigation, scan, [], [], {});
    
    expect(report.aiStatus).toBe('available');
    expect(report.aiFindings.summary).toBe('AI Summary');
  });

  it('should derive limitations correctly', () => {
    const lims = deriveLimitations({ sourceType: 'eml_upload' }, {}, []);
    expect(lims).toContain('Approximate IP location was unavailable or no public IPs were found.');
    expect(lims).toContain('VirusTotal intelligence was unavailable or not configured.');
  });
});
