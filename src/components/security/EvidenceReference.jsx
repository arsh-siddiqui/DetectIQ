import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { resolveEvidenceTab, formatEvidenceLabel, isValidEvidenceId } from '../../utils/evidenceResolution';

export default function EvidenceReference({ investigationId, evidenceId, label, onClickOverride }) {
  const navigate = useNavigate();

  if (!isValidEvidenceId(evidenceId)) {
    // If not a recognized ID, fallback to basic text render
    return <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">{label || evidenceId}</span>;
  }

  const defaultLabel = formatEvidenceLabel(evidenceId);
  const displayLabel = label || defaultLabel;

  const handleClick = (e) => {
    e.preventDefault();
    if (onClickOverride) {
      onClickOverride(evidenceId);
      return;
    }

    const tab = resolveEvidenceTab(evidenceId);
    
    // Construct target route
    let route = `/security/investigations/${investigationId}`;
    if (tab) {
      route += `/${tab}`;
    }
    
    // Append query parameter with URL-safe encoding
    route += `?evidence=${encodeURIComponent(evidenceId)}`;

    // Navigate (React Router handles browser history and components)
    navigate(route);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title="View this evidence"
      className="text-[11px] font-medium text-accent-violet bg-accent-violet/10 hover:bg-accent-violet/20 hover:border-accent-violet/40 focus:outline-none focus:ring-2 focus:ring-accent-violet/50 px-2 py-0.5 rounded border border-accent-violet/20 transition-all flex items-center gap-1 cursor-pointer select-none"
    >
      <FileText size={11} />
      {displayLabel}
    </button>
  );
}
