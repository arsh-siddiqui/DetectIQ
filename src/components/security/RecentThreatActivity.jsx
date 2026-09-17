import { formatDistanceToNow, format } from "date-fns";
import { Shield, ShieldAlert, Activity, FileSearch } from "lucide-react";
import { Link } from "react-router-dom";

export default function RecentThreatActivity({ activities, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse p-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 bg-secondary rounded-xl border border-border"></div>
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted py-10 px-4 text-center">
        <Activity className="w-8 h-8 mb-3 opacity-50" />
        <p className="text-sm">No recent threat activity.</p>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'malicious':
      case 'failed':
        return 'bg-red-500';
      case 'suspicious':
        return 'bg-orange-500';
      case 'clean':
      case 'completed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getIcon = (entityType) => {
    return entityType === 'investigation' ? <FileSearch size={14} className="text-white" /> : <Shield size={14} className="text-white" />;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-card/50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-primary flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-blue" />
          Recent Threat Activity
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
        {activities.map((activity, idx) => {
          const isInvestigation = activity.entityType === 'investigation';
          const linkPath = isInvestigation 
            ? `/security/investigations/${activity.id}` 
            : `/security/indicators/${activity.id}`;
            
          return (
            <Link 
              key={`${activity.id}-${idx}`}
              to={linkPath}
              className="group block bg-card hover:bg-secondary border border-border rounded-xl p-3 transition-all duration-200"
            >
              <div className="flex gap-3">
                <div className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${getStatusColor(activity.status)} shadow-sm`}>
                  {getIcon(activity.entityType)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-primary line-clamp-2 break-words" title={activity.title}>
                      {activity.title}
                    </p>
                    <span className="text-[10px] font-medium text-muted flex-shrink-0 whitespace-nowrap">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                    <span className="text-secondary font-medium capitalize">
                      {activity.status}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border"></span>
                    <span className="text-muted capitalize">
                      {activity.type}
                    </span>
                    {activity.country && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-border"></span>
                        <span className="text-muted truncate max-w-[100px]">
                          {activity.country}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
