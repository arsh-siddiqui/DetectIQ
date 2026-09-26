import { useState, useEffect } from "react";
import { User, LogOut, Loader2, Save, Shield, Key, Smartphone, Bell, Activity, CheckCircle2, AlertCircle } from "lucide-react";
import { useAppData } from "../context/AppDataContext";
import { updateProfileRemote, changePasswordRemote } from "../services/userService";
import { getScanHistory } from "../services/detectionService";
import Button from "../components/ui/Button";

export default function Profile() {
  const { user, updateUser, logout } = useAppData();
  
  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: user?.name || "", email: user?.email || "" });
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState(false);
  
  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  
  // Notification State
  const [emailAlerts, setEmailAlerts] = useState(user?.preferences?.emailAlerts ?? true);
  const [securitySummaries, setSecuritySummaries] = useState(user?.preferences?.weeklySummary ?? false);
  const [prefsLoading, setPrefsLoading] = useState(false);

  const [recentScans, setRecentScans] = useState([]);

  useEffect(() => {
    getScanHistory().then(scans => {
      setRecentScans((scans || []).slice(0, 3));
    }).catch(() => setRecentScans([]));
  }, []);
  

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const handleSave = async () => {
    setEditError("");
    setEditSuccess(false);
    
    if (!formData.name.trim()) {
      setEditError("Name cannot be empty.");
      return;
    }
    
    setIsSaving(true);
    try {
      const updatedUser = await updateProfileRemote(formData);
      updateUser(updatedUser);
      setIsEditing(false);
      setEditSuccess(true);
      setTimeout(() => setEditSuccess(false), 3000);
    } catch (error) {
      setEditError(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);
    
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      setPasswordError("Current and new passwords are required.");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    
    setPasswordLoading(true);
    try {
      await changePasswordRemote({ 
        currentPassword: passwordData.currentPassword, 
        newPassword: passwordData.newPassword 
      });
      setPasswordSuccess(true);
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setIsChangingPassword(false);
      // Update local user state for timestamp if needed
      updateUser({ ...user, lastPasswordChange: new Date().toISOString() });
    } catch (error) {
      setPasswordError(error.response?.data?.message || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const togglePreference = async (type) => {
    if (prefsLoading) return;
    setPrefsLoading(true);
    
    try {
      const newEmailAlerts = type === 'emailAlerts' ? !emailAlerts : emailAlerts;
      const newWeeklySummary = type === 'weeklySummary' ? !securitySummaries : securitySummaries;
      
      const updatedUser = await updateProfileRemote({
        preferences: {
          emailAlerts: newEmailAlerts,
          weeklySummary: newWeeklySummary
        }
      });
      
      updateUser(updatedUser);
      if (type === 'emailAlerts') setEmailAlerts(newEmailAlerts);
      if (type === 'weeklySummary') setSecuritySummaries(newWeeklySummary);
      
    } catch (error) {
      console.error("Failed to update preferences", error);
    } finally {
      setPrefsLoading(false);
    }
  };

  const calculateDaysAgo = (dateString) => {
    if (!dateString) return null;
    const days = Math.floor((new Date() - new Date(dateString)) / (1000 * 60 * 60 * 24));
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  };

  if (!user) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="flex items-center gap-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[1.25rem] bg-accent-blue/10 text-accent-blue shadow-sm border border-accent-blue/20">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-heading font-black text-primary tracking-tight mb-2">Account Settings</h1>
            <p className="text-secondary font-medium text-lg">Manage your personal information, security preferences, and active sessions.</p>
          </div>
        </div>
        <button 
          className="bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white px-6 py-3 rounded-xl font-bold shadow-sm hover:-translate-y-0.5 hover:shadow-card transition-all text-sm inline-flex items-center justify-center gap-2" 
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" /> Log Out
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col: Avatar & Level */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-card rounded-[2rem] p-8 sm:p-10 border border-border shadow-elevated flex flex-col items-center text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-accent-blue/10 to-transparent pointer-events-none" />
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-accent-blue/20 rounded-full blur-[60px] pointer-events-none group-hover:bg-accent-blue/30 transition-colors duration-700" />
            
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-white flex items-center justify-center text-5xl font-heading font-black mb-6 shadow-soft relative z-10 border-[6px] border-card ring-4 ring-background">
              {user.avatar}
            </div>
            <h2 className="text-3xl font-heading font-black text-primary relative z-10 mb-2">{user.name}</h2>
            
            <div className="w-full mt-10 pt-8 border-t border-border relative z-10">
              <div className="text-xs font-medium text-secondary flex justify-between items-center bg-background border border-border p-5 rounded-2xl shadow-sm">
                <span>Member since</span>
                <span className="text-primary font-bold">{user.memberSince || new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-[2rem] p-8 sm:p-10 border border-border shadow-elevated">
            <h3 className="text-2xl font-heading font-extrabold text-primary flex items-center gap-3 mb-8">
              <Activity className="w-6 h-6 text-accent-blue" /> Recent Activity
            </h3>
            <div className="space-y-6">
              {recentScans.length > 0 ? recentScans.map(scan => (
                <div key={scan._id} className="flex gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                    scan.riskLevel === 'high' || scan.riskLevel === 'critical' ? 'bg-danger/10 text-danger' :
                    scan.riskLevel === 'medium' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                  }`}>
                    <Shield className="w-6 h-6" />
                  </div>
                  <div className="pt-0.5">
                    <div className="text-sm font-bold text-primary mb-1 truncate max-w-[200px]">{scan.target}</div>
                    <div className="text-xs text-secondary font-medium capitalize">{scan.scanType} Scan • {scan.riskLevel} Risk</div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted mt-2">
                      {new Date(scan.createdAt).toLocaleDateString()} at {new Date(scan.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-secondary font-medium">No recent activity found.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Details */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Personal Info */}
          <div className="bg-card rounded-[2rem] p-8 sm:p-10 border border-border shadow-elevated relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8 relative z-10">
              <h3 className="text-2xl font-heading font-extrabold text-primary flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-accent-blue/10 text-accent-blue flex items-center justify-center shadow-sm">
                  <User className="w-6 h-6" />
                </div>
                Personal Information
              </h3>
              {!isEditing && (
                <button 
                  className="bg-background border border-border text-primary px-6 py-3 rounded-xl font-bold hover:bg-secondary transition-colors text-sm shadow-sm"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
              <div>
                <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">Full Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-5 py-4 text-sm font-bold text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 transition-all shadow-inner"
                  />
                ) : (
                  <div className="text-sm font-bold text-primary bg-background px-5 py-4 rounded-xl border border-border shadow-sm">{user.name}</div>
                )}
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">Email Address</label>
                <div className="text-sm font-bold text-primary bg-background px-5 py-4 rounded-xl border border-border shadow-sm opacity-70 cursor-not-allowed">{user.email}</div>
              </div>
            </div>

            {isEditing && (
              <div className="flex flex-col gap-4 mt-10 pt-8 border-t border-border relative z-10">
                {editError && (
                  <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {editError}
                  </div>
                )}
                {editSuccess && (
                  <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Profile updated successfully
                  </div>
                )}
                <div className="flex justify-end gap-4">
                  <button 
                    className="bg-background border border-border text-primary px-8 py-3.5 rounded-xl font-bold hover:bg-secondary transition-colors text-sm shadow-sm"
                    onClick={() => { setIsEditing(false); setFormData({ name: user.name, email: user.email }); setEditError(""); }}
                  >
                    Cancel
                  </button>
                  <button 
                    className="bg-gradient-to-r from-accent-blue to-accent-violet text-white px-8 py-3.5 rounded-xl font-bold shadow-soft hover:opacity-95 hover:-translate-y-0.5 transition-all text-sm inline-flex items-center gap-2 disabled:opacity-50"
                    onClick={handleSave} 
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Account Security */}
          <div className="bg-card rounded-[2rem] p-8 sm:p-10 border border-border shadow-elevated relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-warning/5 rounded-full blur-[80px] pointer-events-none" />
            <h3 className="text-2xl font-heading font-extrabold text-primary flex items-center gap-4 mb-8 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-warning/10 text-warning flex items-center justify-center shadow-sm">
                <Shield className="w-6 h-6" />
              </div>
              Account Security
            </h3>
            
            <div className="space-y-4 relative z-10">
              <div className="flex flex-col gap-6 p-6 bg-background rounded-2xl border border-border shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <div className="font-bold text-primary mb-1.5 flex items-center gap-2 text-base">
                      <Key className="w-4 h-4 text-secondary" /> Password
                    </div>
                    <div className="text-sm text-secondary font-medium">
                      {user.lastPasswordChange ? `Last changed ${calculateDaysAgo(user.lastPasswordChange)}` : "Password change history unavailable"}
                    </div>
                  </div>
                  {!isChangingPassword && (
                    <button 
                      onClick={() => setIsChangingPassword(true)}
                      className="bg-card border border-border text-primary px-6 py-3 rounded-xl font-bold hover:bg-secondary transition-colors text-sm shadow-sm"
                    >
                      Change Password
                    </button>
                  )}
                </div>

                {isChangingPassword && (
                  <form onSubmit={handlePasswordChange} className="mt-4 pt-6 border-t border-border space-y-4">
                    {passwordError && (
                      <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> {passwordError}
                      </div>
                    )}
                    {passwordSuccess && (
                      <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Password updated successfully
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">Current Password</label>
                        <input
                          type="password"
                          required
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-5 py-3 text-sm font-bold text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 transition-all shadow-inner"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">New Password</label>
                        <input
                          type="password"
                          required
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-5 py-3 text-sm font-bold text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 transition-all shadow-inner"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">Confirm New Password</label>
                        <input
                          type="password"
                          required
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-5 py-3 text-sm font-bold text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 transition-all shadow-inner"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-4">
                      <button 
                        type="button"
                        className="bg-background border border-border text-primary px-6 py-2.5 rounded-xl font-bold hover:bg-secondary transition-colors text-sm shadow-sm"
                        onClick={() => { setIsChangingPassword(false); setPasswordError(""); setPasswordSuccess(false); }}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={passwordLoading}
                        className="bg-accent-blue text-white px-6 py-2.5 rounded-xl font-bold shadow-soft hover:-translate-y-0.5 transition-all text-sm inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Update Password
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="flex flex-col gap-4 mt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 bg-background rounded-2xl border border-border shadow-sm">
                  <div>
                    <div className="font-bold text-primary mb-1.5 text-base flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Google
                      {(user.authProvider === 'google' || user.authProvider === 'linked') ? (
                        <span className="text-[10px] uppercase font-bold bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-md ml-3 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Connected</span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded-md ml-3">Not Connected</span>
                      )}
                    </div>
                    <div className="text-sm text-secondary font-medium">Use your Google account to sign in securely.</div>
                  </div>
                  {!(user.authProvider === 'google' || user.authProvider === 'linked') && (
                    <a href={`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/auth/google`} className="bg-card border border-border text-primary hover:bg-secondary/20 px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-colors flex items-center justify-center">
                      Connect Google
                    </a>
                  )}
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
