import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Mail, Lock, User, GraduationCap, Briefcase, Building2, CheckCircle2 } from "lucide-react";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import PasswordStrengthMeter from "../components/ui/PasswordStrengthMeter";
import { useFormValidation, validateEmail, validatePassword } from "../hooks/useFormValidation";
import { useAppData } from "../context/AppDataContext";
import { useToast } from "../context/ToastContext";

const roles = [
  { id: "Student", label: "Student", icon: GraduationCap },
  { id: "Professional", label: "Professional", icon: Briefcase },
  { id: "Business", label: "Business", icon: Building2 },
];

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAppData();
  const { toast } = useToast();
  const [role, setRole] = useState("Student");
  const [loading, setLoading] = useState(false);

  const { values, setValue, handleBlur, validateAll, errorFor } = useFormValidation(
    { name: "", email: "", password: "", confirmPassword: "" },
    {
      name: (v) => (!v ? "Full name is required" : ""),
      email: validateEmail,
      password: (v) => validatePassword(v, { min: 8 }),
      confirmPassword: (v) => (v !== values.password ? "Passwords don't match" : ""),
    }
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAll()) {
      toast("Please fix the errors below.", "warning");
      return;
    }

    setLoading(true);
    const result = await register({
      name: values.name,
      email: values.email,
      password: values.password,
      accountRole: role,
    });
    setLoading(false);

    if (result.ok) {
      toast("Welcome to DetectIQ!", "success");
      navigate("/dashboard");
      return;
    }

    toast(result.message || "Registration failed", "warning");
  };

  return (
    <div className="min-h-screen bg-background text-primary flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-y-auto">
      
      {/* Ambient Lighting */}
      <div className="absolute top-10 left-10 w-[500px] h-[500px] bg-accent-blue/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-accent-violet/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-5xl my-auto grid lg:grid-cols-12 bg-card rounded-3xl shadow-elevated overflow-hidden relative z-10">
        
        {/* Left 45% Visual Panel */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-gradient-to-br from-[#050B16] via-[#081120] to-[#0D1728] p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-accent-blue/10 via-transparent to-accent-violet/10 pointer-events-none" />
          
          <Link to="/" className="flex items-center gap-2.5 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent-blue to-accent-violet flex items-center justify-center text-white shadow-soft">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-heading font-black text-xl text-white tracking-tight">DetectIQ</span>
          </Link>

          <div className="relative z-10 my-auto py-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-violet/10 text-accent-violet text-xs font-bold uppercase tracking-wider mb-6">
              <span className="w-2 h-2 rounded-full bg-accent-violet animate-pulse" /> Start Free
            </div>
            <h2 className="text-3xl font-heading font-extrabold text-white tracking-tight mb-4 leading-tight">
              Join the next generation of threat intelligence.
            </h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
              AI detection models, personalized RAG baselines, and vulnerability assessments in one workspace.
            </p>

            <div className="space-y-3.5">
              {[
                "Instant multi-channel analysis",
                "Personalized email pattern learning",
                "Bite-sized security lessons & assessments",
                "Full security profile tracking"
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-3 text-xs font-medium text-slate-300">
                  <div className="w-4 h-4 rounded-full bg-accent-violet/20 text-accent-violet flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-3 h-3" />
                  </div>
                  {text}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 text-xs font-medium text-slate-500">
            © 2026 DetectIQ Inc. All rights reserved.
          </div>
        </div>

        {/* Right 55% Form Panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-center bg-card"
        >
          <div className="max-w-md mx-auto w-full">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-primary tracking-tight mb-1.5">Create your account</h1>
              <p className="text-xs sm:text-sm text-secondary font-medium">Join DetectIQ in less than a minute</p>
            </div>

            <a
              href={`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/auth/google`}
              className="w-full flex items-center justify-center gap-3 bg-card border border-border hover:bg-secondary/10 text-primary py-3.5 rounded-xl font-bold shadow-sm transition-all text-sm mb-6"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </a>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-border"></div>
              <div className="text-xs font-bold text-muted uppercase tracking-wider">or</div>
              <div className="flex-1 h-px bg-border"></div>
            </div>

            <AnimatePresence mode="wait">
                <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
                  <Input
                    label="Full Name"
                    icon={User}
                    placeholder="Jordan Lee"
                    value={values.name}
                    onChange={(e) => setValue("name", e.target.value)}
                    onBlur={() => handleBlur("name")}
                    error={errorFor("name")}
                  />

                  <Input
                    label="Email Address"
                    type="email"
                    icon={Mail}
                    placeholder="you@example.com"
                    value={values.email}
                    onChange={(e) => setValue("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    error={errorFor("email")}
                  />

                  <div>
                    <Input
                      label="Password"
                      type="password"
                      icon={Lock}
                      placeholder="At least 8 characters"
                      value={values.password}
                      onChange={(e) => setValue("password", e.target.value)}
                      onBlur={() => handleBlur("password")}
                      error={errorFor("password")}
                    />
                    <div className="pt-1"><PasswordStrengthMeter password={values.password} /></div>
                  </div>

                  <Input
                    label="Confirm Password"
                    type="password"
                    icon={Lock}
                    placeholder="Re-enter your password"
                    value={values.confirmPassword}
                    onChange={(e) => setValue("confirmPassword", e.target.value)}
                    onBlur={() => handleBlur("confirmPassword")}
                    error={errorFor("confirmPassword")}
                  />

                  <div className="pt-1">
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">Account Role</label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {roles.map((r) => (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => setRole(r.id)}
                          className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                            role === r.id
                              ? "bg-accent-blue/10 text-accent-blue border border-accent-blue/30"
                              : "bg-secondary/50 text-secondary hover:text-primary hover:bg-secondary"
                          }`}
                        >
                          <r.icon className="w-4 h-4" />
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full mt-4 bg-gradient-to-r from-accent-blue to-accent-violet hover:opacity-95 text-white py-3.5 rounded-xl font-bold shadow-soft transition-all text-sm disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? "Creating Account..." : "Create Free Account"}
                  </button>
                </form>
            </AnimatePresence>

            <div className="pt-6 text-center">
              <p className="text-xs text-secondary font-medium">
                Already have an account?{" "}
                <Link to="/login" className="text-accent-blue font-bold hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
