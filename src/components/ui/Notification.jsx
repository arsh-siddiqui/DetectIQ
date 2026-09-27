import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, AlertOctagon, X } from "lucide-react";

/**
 * Icons mapping per toast type
 */
const icons = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  danger: AlertOctagon,
  error: AlertOctagon
};

/**
 * Left border accent colors per toast type
 */
const tones = {
  success: "border-l-success text-success",
  warning: "border-l-warning text-warning",
  info: "border-l-accent-blue text-accent-blue",
  danger: "border-l-danger text-danger",
  error: "border-l-danger text-danger"
};

/**
 * Notification Toast Component
 * Renders floating notification toasts compatible with light & dark mode.
 */
export default function Notification({ notifications = [], onDismiss }) {
  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 w-80 max-w-[90vw]">
      <AnimatePresence>
        {notifications.map((n) => {
          const Icon = icons[n.type] || Info;
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`bg-card text-primary dark:bg-slate-900 dark:text-slate-100 rounded-2xl shadow-elevated border-l-4 border border-border ${tones[n.type] || tones.info} p-4 flex items-start gap-3`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${tones[n.type] || tones.info}`} />
              <div className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{n.message}</div>
              <button onClick={() => onDismiss(n.id)} className="text-muted hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
