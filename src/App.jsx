import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppDataProvider, useAppData } from "./context/AppDataContext";
import { ToastProvider } from "./context/ToastContext";
import ScrollToTop from "./components/ScrollToTop";
import Landing from "./pages/Landing";

// Core App Layout
import AppLayout from "./components/layout/AppLayout";
import { Loader2, ShieldCheck } from "lucide-react";

// Lazy-loaded auth & core pages
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

// Lazy-loaded Detection Pages
const Scan = lazy(() => import("./pages/detection/Scan"));
const ScanHistory = lazy(() => import("./pages/detection/ScanHistory"));
const ScanResult = lazy(() => import("./pages/detection/ScanResult"));
const MyEmailPatterns = lazy(() => import("./pages/detection/MyEmailPatterns"));

// Lazy-loaded Security Operations Pages
const InvestigationList = lazy(() => import("./pages/security/InvestigationList"));
const InvestigationDetail = lazy(() => import("./pages/security/InvestigationDetail"));
const IndicatorList = lazy(() => import("./pages/security/IndicatorList"));
const IndicatorDetail = lazy(() => import("./pages/security/IndicatorDetail"));
const ThreatIntelligence = lazy(() => import("./pages/security/ThreatIntelligence"));
const DomainLookalike = lazy(() => import("./pages/security/DomainLookalike"));

// Lazy-loaded Learning & Vulnerability Center Pages
const VulnerabilityList = lazy(() => import("./pages/learning/VulnerabilityList"));
const VulnerabilityDetail = lazy(() => import("./pages/learning/VulnerabilityDetail"));
const Assessment = lazy(() => import("./pages/learning/Assessment"));
const MyProgress = lazy(() => import("./pages/learning/MyProgress"));

// Lazy-loaded Public Standalone Pages
const Features = lazy(() => import("./pages/public/Features"));
const About = lazy(() => import("./pages/public/About"));
const Solutions = lazy(() => import("./pages/public/Solutions"));
const Resources = lazy(() => import("./pages/public/Resources"));
const NotFound = lazy(() => import("./pages/NotFound"));

/**
 * Branded Page Loading Fallback
 */
function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-accent-blue to-accent-violet flex items-center justify-center shadow-glow animate-pulse">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <Loader2 className="w-16 h-16 text-accent-blue/30 animate-spin absolute" />
      </div>
      <span className="mt-4 text-xs font-mono font-bold uppercase tracking-widest text-muted animate-pulse">
        DetectIQ Security Engine Initializing...
      </span>
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated } = useAppData();
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function RequireAdmin({ children }) {
  const { user, isAuthenticated } = useAppData();
  if (!isAuthenticated || !user?.isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Wrapper for pages that require the standard app layout with sidebar/navbar
function AppLayoutWrapper({ children }) {
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { isInitializing } = useAppData();

  if (isInitializing) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public & Marketing Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/features" element={<Features />} />
        <Route path="/about" element={<About />} />
        <Route path="/solutions" element={<Solutions />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/investigate" element={<Navigate to="/#investigate" replace />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected App Routes */}
        <Route path="/dashboard" element={<RequireAuth><AppLayoutWrapper><Dashboard /></AppLayoutWrapper></RequireAuth>} />
        
        {/* Detection Suite */}
        <Route path="/detection/scanner" element={<RequireAuth><AppLayoutWrapper><Scan /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/detection/email" element={<Navigate to="/detection/scanner?mode=email" replace />} />
        <Route path="/detection/url" element={<Navigate to="/detection/scanner?mode=url" replace />} />
        <Route path="/detection/history" element={<RequireAuth><AppLayoutWrapper><ScanHistory /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/detection/result/:id" element={<RequireAuth><AppLayoutWrapper><ScanResult /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/detection/email-context" element={<RequireAuth><AppLayoutWrapper><MyEmailPatterns /></AppLayoutWrapper></RequireAuth>} />
        
        {/* Security Operations */}
        <Route path="/security/profile" element={<Navigate to="/learning/progress" replace />} />
        <Route path="/security/investigations" element={<RequireAuth><AppLayoutWrapper><InvestigationList /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/security/investigations/:id/*" element={<RequireAuth><AppLayoutWrapper><InvestigationDetail /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/security/indicators" element={<RequireAuth><AppLayoutWrapper><IndicatorList /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/security/indicators/:id" element={<RequireAuth><AppLayoutWrapper><IndicatorDetail /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/security/threat-intelligence" element={<RequireAuth><AppLayoutWrapper><ThreatIntelligence /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/security/lookalike-generator" element={<RequireAuth><AppLayoutWrapper><DomainLookalike /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/security/typosquatting" element={<Navigate to="/security/lookalike-generator" replace />} />

        {/* Learning Center */}
        <Route path="/vulnerabilities" element={<RequireAuth><AppLayoutWrapper><VulnerabilityList /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/vulnerabilities/:slug" element={<RequireAuth><AppLayoutWrapper><VulnerabilityDetail /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/vulnerabilities/:slug/assessment" element={<RequireAuth><AppLayoutWrapper><Assessment /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/learning/progress" element={<RequireAuth><AppLayoutWrapper><MyProgress /></AppLayoutWrapper></RequireAuth>} />
        
        <Route path="/assistant" element={<Navigate to="/security/investigations" replace />} />
        
        {/* User Account & Admin */}
        <Route path="/profile" element={<RequireAuth><AppLayoutWrapper><Profile /></AppLayoutWrapper></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><AppLayoutWrapper><AdminDashboard /></AppLayoutWrapper></RequireAdmin>} />
        
        {/* 404 Dedicated Not Found Page */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <ToastProvider>
        <BrowserRouter>
          <ScrollToTop />
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AppDataProvider>
  );
}
