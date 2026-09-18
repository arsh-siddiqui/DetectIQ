export function resolveEvidenceTab(evidenceId) {
  if (!evidenceId || typeof evidenceId !== 'string') return null;
  
  if (evidenceId === 'E_VERDICT' || evidenceId === 'E_AUTH' || evidenceId === 'E_EMAIL_ID') {
    return ''; // Overview Tab (index route)
  }
  
  if (evidenceId === 'E_ROUTE' || evidenceId.startsWith('E_IND_') || evidenceId.startsWith('E_ATT_')) {
    return 'evidence'; // Evidence Tab
  }
  
  return null; // Unknown evidence ID
}

export function formatEvidenceLabel(id) {
  if (!id || typeof id !== 'string') return '';
  if (id === 'E_VERDICT') return 'Evidence · Detection Verdict';
  if (id === 'E_AUTH') return 'Evidence · Authentication';
  if (id === 'E_ROUTE') return 'Evidence · Routing';
  if (id === 'E_EMAIL_ID') return 'Evidence · Email Identity';
  if (id.startsWith('E_IND_')) {
    const num = id.split('_')[2];
    return `Evidence · Indicator ${num}`;
  }
  if (id.startsWith('E_ATT_')) {
    const num = id.split('_')[2];
    return `Evidence · Attachment ${num}`;
  }
  return `Evidence · ${id.replace(/^E_/, '')}`;
}

export function isValidEvidenceId(id) {
  return resolveEvidenceTab(id) !== null;
}
