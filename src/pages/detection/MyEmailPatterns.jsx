import { useState, useEffect } from "react";
import { FileSearch, Trash2, ShieldCheck, Loader2, Plus, AlertCircle, Info } from "lucide-react";
import { getEmailHistory, deleteEmailHistory, addEmailHistory } from "../../services/emailHistoryService";
import Button from "../../components/ui/Button";

export default function MyEmailPatterns() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadEmails();
  }, []);

  async function loadEmails() {
    try {
      setLoading(true);
      const data = await getEmailHistory();
      setEmails(data || []);
    } catch (err) {
      setError("Failed to load historical emails.");
    } finally {
      setLoading(false);
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      await addEmailHistory({
        sender: "unknown@example.com",
        recipient: "me@example.com",
        subject: "Saved Email Pattern",
        body: newEmail,
        isLegitimate: true
      });
      setNewEmail("");
      loadEmails();
    } catch (err) {
      setError("Failed to add email pattern.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteEmailHistory(id);
      loadEmails();
    } catch (err) {
      setError("Failed to delete email pattern.");
    }
  };

  const readyEmbeddings = emails.length; // Mock representation

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="w-full space-y-6">
          <header className="mb-8">
            <h1 className="text-3xl font-extrabold text-primary mb-2 flex items-center gap-3">
              <FileSearch className="w-8 h-8 text-accent-blue" />
              My Email Patterns
            </h1>
            <p className="text-secondary font-medium max-w-3xl">
              Manage your legitimate email baseline. DetectIQ uses Retrieval-Augmented Generation (RAG) to compare new scans against these patterns, dramatically reducing false positives for your unique communication style.
            </p>
          </header>

          {error && (
            <div className="bg-danger/10 text-danger p-4 rounded-xl text-sm mb-6 flex items-center gap-2 border border-danger/20">
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column - Context & Stats */}
            <div className="lg:col-span-4">
              <div className="bg-card rounded-3xl border border-border shadow-elevated p-6 md:p-8 overflow-hidden relative h-full flex flex-col">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent-blue/10 rounded-full blur-[40px] pointer-events-none" />
                <div className="w-10 h-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center mb-6 relative z-10 flex-shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-primary mb-3 relative z-10">How it works</h2>
                <p className="text-sm font-medium text-secondary leading-relaxed mb-6 relative z-10 flex-1">
                  By securely saving examples of safe emails, DetectIQ's ML model learns what your normal traffic looks like. It extracts writing style, common senders, and formatting.
                </p>
                <div className="space-y-4 relative z-10 mt-auto">
                  <div className="bg-background border border-border p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Stored Patterns</div>
                      <div className="text-2xl font-black text-primary">{emails.length}</div>
                    </div>
                    <ShieldCheck className="w-6 h-6 text-success" />
                  </div>
                  <div className="bg-background border border-border p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Active Embeddings</div>
                      <div className="text-2xl font-black text-accent-blue">{readyEmbeddings}</div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Management */}
            <div className="lg:col-span-8">
              {/* Add Pattern Form */}
              <form onSubmit={handleAdd} className="bg-card rounded-3xl border border-border shadow-elevated p-6 md:p-8 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-2 flex-shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h2 className="text-lg font-bold text-primary">Add Legitimate Email</h2>
                </div>
                <p className="text-sm text-secondary font-medium mb-4 flex-shrink-0">Paste the body of a known safe email below to add it to your baseline.</p>
                
                <textarea
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={adding}
                  placeholder="Paste email content here..."
                  className="w-full flex-1 bg-background border border-border rounded-2xl p-5 text-sm font-medium text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all resize-none min-h-[140px]"
                />
                
                <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 flex-shrink-0">
                  <button 
                    type="button" 
                    onClick={() => loadEmails()} 
                    disabled={loading}
                    className="bg-background border border-border text-primary px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-secondary transition-all text-sm"
                  >
                    Refresh Patterns
                  </button>
                  <button 
                    type="submit" 
                    disabled={adding || !newEmail.trim()}
                    className="bg-accent-blue text-white px-8 py-3 rounded-xl font-bold shadow-soft hover:-translate-y-0.5 hover:bg-accent-blue/90 transition-all text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Add to Baseline
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Pattern List - Full Width */}
          <div className="bg-card rounded-3xl border border-border shadow-elevated p-6 md:p-8">
            <h2 className="text-lg font-bold text-primary mb-6">Saved Patterns</h2>
            
            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent-blue animate-spin" />
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-12 bg-background border border-border rounded-2xl">
                <ShieldCheck className="w-12 h-12 text-muted mx-auto mb-4" />
                <h3 className="text-base font-bold text-primary mb-1">No patterns saved</h3>
                <p className="text-sm text-secondary">Add your first legitimate email above.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {emails.map((email) => (
                  <div key={email._id} className="bg-background p-5 rounded-2xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-accent-blue/30 transition-all group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-primary mb-1 truncate">{email.subject}</div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-success bg-success/10 px-2 py-0.5 rounded border border-success/20">Embedded</span>
                        <span className="text-xs font-medium text-secondary">Body hidden for privacy</span>
                        <span className="text-xs font-semibold text-muted ml-auto sm:ml-0">
                          {new Date(email.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(email._id)}
                      className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors flex-shrink-0 self-end sm:self-auto opacity-100 sm:opacity-0 group-hover:opacity-100"
                      title="Delete Pattern"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
