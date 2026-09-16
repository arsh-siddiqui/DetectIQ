import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Target, Loader2, BookOpen, AlertCircle } from "lucide-react";
import { getAllProgress } from "../../services/progressService";
import { useAppData } from "../../context/AppDataContext";
import Button from "../../components/ui/Button";

export default function MyProgress() {
  const { user } = useAppData();
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const progData = await getAllProgress();
        setProgress(progData || []);
      } catch (err) {
        setError("Failed to load progress.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-accent-blue animate-spin" />
      </div>
    );
  }

  const progressList = progress.map(p => {
    const vuln = p.vulnerability || {};
    return {
      ...p,
      title: typeof vuln === 'object' ? vuln.title : 'Unknown Module',
      slug: typeof vuln === 'object' ? vuln.slug : null,
      category: typeof vuln === 'object' ? vuln.category : null,
    };
  });

  const modulesCompleted = progressList.filter(p => p.status === 'completed').length;
  const avgScore = progressList.length > 0 
    ? Math.round(progressList.reduce((acc, p) => acc + (p.assessmentScore || 0), 0) / progressList.length)
    : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent-blue/10 text-accent-blue mb-4 shadow-soft border border-accent-blue/20">
            <Target className="w-6 h-6" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-primary mb-3">
            My Learning Progress
          </h1>
          <p className="text-secondary font-medium max-w-2xl">
            Track your vulnerability assessments, review completed modules, and measure your growing expertise.
          </p>
        </div>
        <Link to="/vulnerabilities">
          <button className="bg-accent-blue text-white px-6 py-3 rounded-xl font-bold shadow-soft hover:-translate-y-0.5 hover:bg-accent-blue/90 transition-all text-sm inline-flex items-center justify-center gap-2 w-full md:w-auto">
            <BookOpen className="w-4 h-4"/> Browse Curriculum
          </button>
        </Link>
      </header>

      {error && (
        <div className="bg-danger/10 text-danger p-4 rounded-xl text-sm mb-6 flex items-center gap-2 border border-danger/20">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-3xl border border-border shadow-elevated p-6 relative overflow-hidden flex items-center justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-blue/5 rounded-full blur-[40px] pointer-events-none" />
          <div className="relative z-10">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">Modules Mastered</span>
            <div className="text-4xl font-black text-primary">{modulesCompleted}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-background border border-border flex items-center justify-center relative z-10">
            <BookOpen className="w-6 h-6 text-accent-blue" />
          </div>
        </div>
        <div className="bg-card rounded-3xl border border-border shadow-elevated p-6 relative overflow-hidden flex items-center justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full blur-[40px] pointer-events-none" />
          <div className="relative z-10">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">Avg. Assessment Score</span>
            <div className="text-4xl font-black text-success">{avgScore}%</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-background border border-border flex items-center justify-center relative z-10">
            <Target className="w-6 h-6 text-success" />
          </div>
        </div>
      </div>

      {progressList.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-3xl shadow-elevated mt-8">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-10 h-10 text-muted" />
          </div>
          <h3 className="text-xl font-bold text-primary mb-2">No progress yet</h3>
          <p className="text-sm text-secondary font-medium mb-8 max-w-md mx-auto">Start a vulnerability module to track your learning journey and improve your security skills.</p>
          <Link to="/vulnerabilities">
            <button className="bg-accent-blue text-white px-8 py-3.5 rounded-xl font-bold shadow-soft hover:-translate-y-0.5 transition-all inline-flex items-center justify-center">
              Start Learning
            </button>
          </Link>
        </div>
      ) : (
        <div className="bg-card rounded-3xl border border-border shadow-elevated overflow-hidden mt-8">
          <div className="p-6 md:p-8 border-b border-border">
            <h2 className="text-xl font-bold text-primary">Detailed Course Progress</h2>
          </div>
          <div className="divide-y divide-border">
            {progressList.map(item => {
              const isCompleted = item.status === 'completed';
              return (
                <div key={item._id} className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-background/50 transition-colors group">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border shadow-sm ${
                        isCompleted ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                      {item.category && (
                        <span className="text-[10px] font-bold text-muted bg-secondary px-2.5 py-1 rounded-md uppercase tracking-wider">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-primary mb-2 group-hover:text-accent-blue transition-colors">{item.title}</h3>
                    <div className="flex items-center gap-4 text-xs font-medium text-secondary">
                      <span className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.theoryCompleted ? 'bg-success' : 'bg-warning'}`} />
                        Theory {item.theoryCompleted ? 'Done' : 'Pending'}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span>{item.attempts} Attempts</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Assessment Score</div>
                      <div className={`text-2xl font-black ${item.assessmentScore >= 70 ? 'text-success' : 'text-danger'}`}>
                        {item.assessmentScore}%
                      </div>
                    </div>
                    
                    {item.slug && (
                      <Link to={`/vulnerabilities/${item.slug}`}>
                        <button className="bg-background border border-border text-primary px-5 py-2.5 rounded-xl font-bold hover:bg-secondary transition-colors text-sm w-full sm:w-auto shadow-sm">
                          {isCompleted ? 'Review' : 'Continue'}
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
