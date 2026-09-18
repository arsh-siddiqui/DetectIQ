import { resolveEvidenceTab, formatEvidenceLabel, isValidEvidenceId } from './evidenceResolution';

describe('evidenceResolution', () => {
  describe('resolveEvidenceTab', () => {
    it('1. resolves Detection Verdict link to Overview Tab', () => {
      expect(resolveEvidenceTab('E_VERDICT')).toBe('');
    });
    
    it('3. resolves Authentication evidence link to Overview Tab', () => {
      expect(resolveEvidenceTab('E_AUTH')).toBe('');
      expect(resolveEvidenceTab('E_EMAIL_ID')).toBe('');
    });

    it('2. resolves Indicator evidence link to Evidence Tab', () => {
      expect(resolveEvidenceTab('E_IND_1')).toBe('evidence');
      expect(resolveEvidenceTab('E_IND_192.168.1.1')).toBe('evidence');
    });
    
    it('4. resolves URL evidence link', () => {
      expect(resolveEvidenceTab('E_IND_4')).toBe('evidence');
    });

    it('5. resolves Domain evidence link', () => {
      expect(resolveEvidenceTab('E_IND_example.com')).toBe('evidence');
    });

    it('6. resolves IP evidence link', () => {
      expect(resolveEvidenceTab('E_IND_8.8.8.8')).toBe('evidence');
    });

    it('resolves Attachment evidence link to Evidence Tab', () => {
      expect(resolveEvidenceTab('E_ATT_1')).toBe('evidence');
    });
    
    it('resolves Routing evidence link to Evidence Tab', () => {
      expect(resolveEvidenceTab('E_ROUTE')).toBe('evidence');
    });

    it('7. handles Missing evidence ID gracefully', () => {
      expect(resolveEvidenceTab(null)).toBeNull();
      expect(resolveEvidenceTab('')).toBeNull();
      expect(resolveEvidenceTab('UNKNOWN_ID')).toBeNull();
    });
  });

  describe('isValidEvidenceId', () => {
    it('validates correct IDs', () => {
      expect(isValidEvidenceId('E_VERDICT')).toBe(true);
      expect(isValidEvidenceId('E_IND_3')).toBe(true);
    });

    it('invalidates unknown IDs', () => {
      expect(isValidEvidenceId('FAKE_EVIDENCE')).toBe(false);
      expect(isValidEvidenceId(null)).toBe(false);
    });
  });

  describe('formatEvidenceLabel', () => {
    it('formats E_VERDICT correctly', () => {
      expect(formatEvidenceLabel('E_VERDICT')).toBe('Evidence · Detection Verdict');
    });

    it('formats indicators correctly', () => {
      expect(formatEvidenceLabel('E_IND_4')).toBe('Evidence · Indicator 4');
    });

    it('formats attachments correctly', () => {
      expect(formatEvidenceLabel('E_ATT_2')).toBe('Evidence · Attachment 2');
    });
    
    it('13. maintains cross-tab consistency by generating uniform labels', () => {
      expect(formatEvidenceLabel('E_ROUTE')).toBe('Evidence · Routing');
      expect(formatEvidenceLabel('E_AUTH')).toBe('Evidence · Authentication');
    });
  });
});
