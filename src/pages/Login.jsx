import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Mail, Lock, ArrowRight } from "lucide-react";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useFormValidation, validateEmail, validatePassword } from "../hooks/useFormValidation";
import { useToast } from "../context/ToastContext";
import { useAppData } from "../context/AppDataContext";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAppData();
  const [loading, setLoading] = useState(false);

  const { values, setValue, handleBlur, validateAll, errorFor } = useFormValidation(
    { email: "", password: "" },
    { email: validateEmail, password: (v) => validatePassword(v, { min: 6 }) }
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAll()) {
      toast("Please fix the errors below.", "warning");
      return;
    }

    setLoading(true);
    const result = await login(values.email, values.password);
    setLoading(false);

    if (result.ok || result.offline) {
      toast("Welcome back! Logging you in...", "success");
      navigate("/dashboard");
      return;
    }

    toast(result.message, "warning");
  };

  return (
    <div className="min-h-screen bg-background text-primary flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      
      {/* Ambient Lighting */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-accent-blue/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-accent-violet/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-5xl min-h-[640px] grid lg:grid-cols-12 bg-card rounded-3xl shadow-elevated overflow-hidden relative z-10">
        
        {/* Left 45% Visual Panel */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-gradient-to-br from-[#050B16] via-[#081120] to-[#0D1728] p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-accent-blue/10 via-transparent to-accent-violet/10 pointer-events-none" />
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent-blue to-accent-violet flex items-center justify-center text-white shadow-soft">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-heading font-black text-xl text-white tracking-tight">DetectIQ</span>
          </Link>

          {/* Statement & Highlights */}
          <div className="relative z-10 my-auto py-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 text-accent-blue text-xs font-bold uppercase tracking-wider mb-6">
              <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" /> Security Portal
            </div>
            <h2 className="text-3xl font-heading font-extrabold text-white tracking-tight mb-4 leading-tight">
              Real-time threat detection & intelligence.
            </h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
              Protecting your digital assets across emails, URLs, messages, and QR payloads.
            </p>

            <div className="space-y-4">
              {[
                "Multi-Channel AI Classifiers",
                "Personalized Safe Baselines (RAG)",
                "Global Threat Intel Cross-Check",
                "Interactive Vulnerability Learning"
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-accent-blue/20 text-accent-blue flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
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
          className="lg:col-span-7 p-6 sm:p-12 lg:p-14 flex flex-col justify-center bg-card"
        >
          <div className="max-w-md mx-auto w-full">
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-primary tracking-tight mb-2">Welcome Back</h1>
              <p className="text-sm text-secondary font-medium">Sign in to your DetectIQ dashboard</p>
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

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <Input
                  label="Email Address"
                  type="email"
                  icon={Mail}
                  placeholder="name@company.com"
                  value={values.email}
                  onChange={(e) => setValue("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                  error={errorFor("email")}
                />
              </div>

              <div>
                <Input
                  label="Password"
                  type="password"
                  icon={Lock}
                  placeholder="••••••••"
                  value={values.password}
                  onChange={(e) => setValue("password", e.target.value)}
                  onBlur={() => handleBlur("password")}
                  error={errorFor("password")}
                />
              </div>

              <div className="flex justify-end text-xs pt-1">
                <button
                  type="button"
                  onClick={() => toast("Password reset instructions sent if email exists.", "info")}
                  className="text-accent-blue font-bold hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button 
                type="submit" 
                className="w-full mt-2 bg-gradient-to-r from-accent-blue to-accent-violet hover:opacity-95 text-white py-3.5 rounded-xl font-bold shadow-soft transition-all text-sm disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in to Dashboard"}
              </button>
            </form>

            <div className="pt-8 text-center">
              <p className="text-xs text-secondary font-medium">
                Don't have an account yet?{" "}
                <Link to="/register" className="text-accent-blue font-bold hover:underline">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
