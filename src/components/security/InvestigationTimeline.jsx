import React from 'react';
import { Mail, Network, ShieldAlert, Cpu } from 'lucide-react';
import { format } from 'date-fns';

const EVENT_ICONS = {
  email_date: <Mail size={16} className="text-blue-400" />,
  received_hop: <Network size={16} className="text-emerald-400" />,
  investigation_created: <ShieldAlert size={16} className="text-purple-400" />,
  enrichment_completed: <Cpu size={16} className="text-amber-400" />,
  default: <div className="w-4 h-4 rounded-full bg-slate-600" />
};

const InvestigationTimeline = ({ timeline }) => {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="p-8 text-center text-muted border border-border rounded-lg bg-card">
        No timeline events available for this investigation.
      </div>
    );
  }

  return (
    <div className="relative p-6 border border-border rounded-lg bg-card">
      <div className="absolute left-10 top-8 bottom-8 w-px bg-border"></div>
      
      <div className="space-y-6">
        {timeline.map((event, index) => {
          const isLast = index === timeline.length - 1;
          
          return (
            <div key={index} className="relative flex items-start group">
              <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-border bg-card flex items-center justify-center z-10 mr-4 group-hover:border-primary transition-colors">
                {EVENT_ICONS[event.type] || EVENT_ICONS.default}
              </div>
              
              <div className="flex-grow pt-1 pb-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-1">
                  <h4 className="text-sm font-medium text-primary">{event.title}</h4>
                  <time className="text-xs text-secondary whitespace-nowrap mt-1 sm:mt-0">
                    {format(new Date(event.timestamp), 'MMM d, yyyy HH:mm:ss')}
                  </time>
                </div>
                
                <p className="text-sm text-muted overflow-wrap-anywhere">{event.description}</p>
                
                {event.source && (
                  <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-secondary text-secondary border border-border overflow-wrap-anywhere">
                    {event.source}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InvestigationTimeline;
