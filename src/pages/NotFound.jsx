import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldAlert, ArrowLeft, Home, ScanLine, Compass } from "lucide-react";
import { useAppData } from "../context/AppDataContext";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

export default function NotFound() {
  const { isAuthenticated } = useAppData();
  const navigate = useNavigate();

  return (
    <div className="bg-background min-h-screen text-primary selection:bg-accent-blue/30 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-6 py-20 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-blue/10 rounded-full blur-[100px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-xl w-full text-center relative z-10"
        >
          {/* Glowing Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-danger/10 border border-danger/30 text-danger text-xs font-mono font-bold tracking-wider uppercase mb-6 shadow-sm">
            <ShieldAlert className="w-4 h-4" /> 404 // ACCESS POINT UNREACHABLE
          </div>

          <h1 className="text-4xl sm:text-6xl font-heading font-black text-primary tracking-tight mb-4">
            Sector Not Found
          </h1>

          <p className="text-base sm:text-lg text-secondary font-medium leading-relaxed mb-8 max-w-md mx-auto">
            The destination you requested does not exist, has expired, or has been moved outside the perimeter.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-6 py-3.5 bg-card border border-border hover:border-accent-blue text-primary font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go Back</span>
            </button>

            <Link
              to={isAuthenticated ? "/dashboard" : "/"}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-accent-blue to-accent-violet hover:opacity-95 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-soft transition-all"
            >
              <Home className="w-4 h-4" />
              <span>{isAuthenticated ? "SOC Dashboard" : "Return Home"}</span>
            </Link>

            <Link
              to={isAuthenticated ? "/detection/scanner" : "/#investigate"}
              className="w-full sm:w-auto px-6 py-3.5 bg-secondary/30 hover:bg-secondary/50 text-secondary hover:text-primary font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <ScanLine className="w-4 h-4" />
              <span>Threat Scanner</span>
            </Link>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
