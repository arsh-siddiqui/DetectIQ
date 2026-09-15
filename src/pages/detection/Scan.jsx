import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Globe, MessageSquare, QrCode, Image as ImageLucide, ShieldAlert, Loader2, ScanSearch, UploadCloud, ShieldCheck, Lock, FileText, Upload } from "lucide-react";
import Button from "../../components/ui/Button";
import { submitScan, submitEml } from "../../services/detectionService";
import jsQR from "jsqr";
import Tesseract from "tesseract.js";
import { motion, AnimatePresence } from "framer-motion";

export default function Scan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const validModes = ["email", "url", "message", "qr", "screenshot"];
  const urlMode = searchParams.get("mode");
  const initialMode = validModes.includes(urlMode) ? urlMode : "email";
  
  const [scanType, setScanType] = useState(initialMode);
  
  // States for different inputs
  const [content, setContent] = useState("");
  const [emailInputMode, setEmailInputMode] = useState("paste"); // paste or upload
  
  // Email optional fields
  const [emailSender, setEmailSender] = useState("");
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSubject, setEmailSubject] = useState("");

  
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");
  const [fileStatus, setFileStatus] = useState("");
  const fileInputRef = useRef(null);
  
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (validModes.includes(mode) && mode !== scanType) {
      setScanType(mode);
      setContent("");
      setError("");
      setFileStatus("");
    }
  }, [searchParams]);

  const handleTabChange = (mode) => {
    setScanType(mode);
    setSearchParams({ mode });
    setContent("");
    setError("");
    setFileStatus("");
  };

  const handleScan = async (e) => {
    if (e) e.preventDefault();
    
    if (!content.trim() && !(scanType === 'email' && emailInputMode === 'upload')) {
      setError("Please enter content to scan.");
      return;
    }
    
    setError("");
    setIsScanning(true);

    try {
      let actualScanType = scanType;
      if (actualScanType === "qr" || actualScanType === "screenshot") {
         actualScanType = "message"; 
      }

      let result;
      
      if (scanType === 'email' && emailInputMode === 'paste') {
        // Send structured object for pasted email
        const emailObj = {
          sourceType: 'pasted_email',
          sender: emailSender,
          recipient: emailRecipient,
          subject: emailSubject,
          body: content
        };
        result = await submitScan(emailObj, actualScanType);
      } else {
        result = await submitScan(content, actualScanType);
      }

      if (result.scanId) {
        navigate(`/detection/result/${result.scanId}`);
      } else {
        navigate('/detection/history');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to analyze content. Please try again.");
      setIsScanning(false);
    }
  };

  const processEmlFile = async (file) => {
    setError("");
    setFileStatus("Processing .eml file forensics...");
    setIsScanning(true);
    
    try {
      const result = await submitEml(file);
      if (result.scanId) {
        navigate(`/detection/result/${result.scanId}`);
      } else {
        navigate('/detection/history');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to analyze .eml file.");
      setFileStatus("");
      setIsScanning(false);
    }
  };

  const processImageFile = async (file) => {
    setError("");
    setFileStatus("Processing image...");
    setIsScanning(true);

    try {
      const imageUrl = URL.createObjectURL(file);
      if (scanType === "qr") {
        await processQR(imageUrl);
      } else if (scanType === "screenshot") {
        await processScreenshot(imageUrl);
      }
      URL.revokeObjectURL(imageUrl);
    } catch (err) {
      setError(err.message || "Failed to process image.");
      setFileStatus("");
      setIsScanning(false);
    }
  };

  const processQR = (imageUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 1000;
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = width * ratio;
          height = height * ratio;
        }
        
        const BORDER = 40;
        const canvas = document.createElement("canvas");
        canvas.width = width + (BORDER * 2);
        canvas.height = height + (BORDER * 2);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        
        // Fill white background to fix transparent PNG QR codes and add a quiet zone
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, BORDER, BORDER, width, height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          const MAX_QR_LENGTH = 10000;
          if (code.data.length > MAX_QR_LENGTH) {
            reject(new Error(`QR payload is too large. Max length is ${MAX_QR_LENGTH} characters.`));
            return;
          }
          routePayload(code.data, "qr");
          resolve();
        } else {
          reject(new Error("No QR code found. Please try a clearer image."));
        }
      };
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = imageUrl;
    });
  };

  const processScreenshot = async (imageUrl) => {
    try {
      setFileStatus("Extracting text via OCR...");
      const result = await Tesseract.recognize(imageUrl, 'eng');
      const text = result.data.text.trim();
      
      if (!text) {
        throw new Error("Text could not be read clearly. Try a clearer screenshot.");
      }
      
      const MAX_OCR_LENGTH = 10000;
      if (text.length > MAX_OCR_LENGTH) {
        throw new Error(`Extracted text is too large. Max length is ${MAX_OCR_LENGTH} characters.`);
      }
      
      routePayload(text, "screenshot");
    } catch (err) {
      if (err.message && err.message.includes("could not be read clearly")) {
        throw err;
      }
      throw new Error(err.message || "OCR failed. Please try again.");
    }
  };

  const routePayload = async (payload, sourceMode) => {
    let targetMode = "message";
    if (payload.match(/^https?:\/\//i)) {
      targetMode = "url";
    } else if (payload.match(/^(mailto:|From:|Subject:|To:)/i) || (payload.includes("From:") && payload.includes("Subject:"))) {
      targetMode = "email";
    } else if (payload.match(/^(sms:|tel:)/i)) {
      targetMode = "message";
      payload = payload.replace(/^(sms:|tel:)[^?]*\??/i, ''); 
    }

    setContent(payload);
    setFileStatus(`Decoded as ${targetMode.toUpperCase()}. Analyzing...`);
    
    try {
      const result = await submitScan(payload, targetMode, sourceMode);
      if (result.scanId) {
        navigate(`/detection/result/${result.scanId}`);
      } else {
        navigate('/detection/history');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to analyze content.");
      setIsScanning(false);
      setFileStatus("");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError("File exceeds 10MB limit.");
      // Reset input so they can try again
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    if (scanType === 'email') {
      if (file.name.toLowerCase().endsWith('.eml')) {
        processEmlFile(file);
      } else {
        setError("Please upload a valid .eml file.");
      }
    } else {
      processImageFile(file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError("File exceeds 10MB limit.");
      return;
    }
    
    if (scanType === 'email') {
      if (file.name.toLowerCase().endsWith('.eml')) {
        processEmlFile(file);
      } else {
        setError("Please upload a valid .eml file.");
      }
    } else if (file.type.startsWith("image/")) {
      processImageFile(file);
    } else {
      setError("Please upload a valid image file.");
    }
  };

  // Removed emailBody alias for unified content handling

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8"
    >
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-blue/10 text-accent-blue text-xs font-bold uppercase tracking-wider mb-4 border border-accent-blue/20">
          <ScanSearch className="w-3.5 h-3.5" /> Threat Detection Engine
        </div>
        <h1 className="text-3xl sm:text-4xl font-heading font-black text-primary mb-3 tracking-tight">DetectIQ Scanner</h1>
        <p className="text-base text-secondary font-medium">Analyze suspicious emails, URLs, messages, QR codes, and screenshots in real-time with AI-powered detection.</p>
      </div>

      <div className="bg-card rounded-3xl shadow-elevated border border-border relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent-blue/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-violet/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 p-6 sm:p-10">
          {/* Tab Selector */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 hide-scrollbar">
            {[
              { id: 'email', label: 'Email', icon: Mail },
              { id: 'url', label: 'URL', icon: Globe },
              { id: 'message', label: 'Message', icon: MessageSquare },
              { id: 'qr', label: 'QR Code', icon: QrCode },
              { id: 'screenshot', label: 'Screenshot', icon: ImageLucide },
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => handleTabChange(mode.id)}
                className={`flex-1 min-w-[120px] flex flex-col items-center justify-center gap-2 p-3 rounded-2xl text-sm font-bold transition-all ${
                  scanType === mode.id
                    ? 'bg-gradient-to-br from-accent-blue to-accent-violet text-white shadow-soft'
                    : 'bg-background border border-border text-secondary hover:text-primary hover:bg-secondary/50'
                }`}
              >
                <mode.icon className={`w-5 h-5 ${scanType === mode.id ? 'text-white' : 'text-muted group-hover:text-primary'}`} />
                {mode.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={scanType}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-background rounded-2xl border border-border p-6 sm:p-8"
            >
              
              {/* Informational Notice */}
              <div className="bg-card border border-border rounded-xl p-4 mb-8 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center flex-shrink-0 text-accent-blue">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 mt-0.5">
                  <p className="text-sm font-bold text-primary mb-1 capitalize">{scanType} Analysis Active</p>
                  <p className="text-xs font-medium text-secondary leading-relaxed">
                    {scanType === 'email' && "Utilizing Personalized Pattern Comparison (RAG) and ML Text Classification to identify sophisticated phishing attempts."}
                    {scanType === 'url' && "Cross-referencing Threat Intelligence databases and heuristic safety analysis."}
                    {scanType === 'message' && "Applying advanced Text Analysis and Threat Intelligence to smishing and chat threats."}
                    {scanType === 'qr' && "Locally decoding QR payloads to route through standard analysis pipelines safely."}
                    {scanType === 'screenshot' && "Extracting text locally via OCR for analysis. No visual data leaves your device."}
                  </p>
                </div>
              </div>
              
              {scanType === 'email' && (
                <div className="flex gap-4 mb-6 border-b border-border">
                  <button
                    onClick={() => setEmailInputMode('paste')}
                    className={`pb-2 px-1 text-sm font-bold transition-all border-b-2 ${
                      emailInputMode === 'paste' ? 'border-accent-blue text-accent-blue' : 'border-transparent text-muted hover:text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2"><FileText className="w-4 h-4"/> Paste Content</div>
                  </button>
                  <button
                    onClick={() => setEmailInputMode('upload')}
                    className={`pb-2 px-1 text-sm font-bold transition-all border-b-2 ${
                      emailInputMode === 'upload' ? 'border-accent-blue text-accent-blue' : 'border-transparent text-muted hover:text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2"><Upload className="w-4 h-4"/> Upload .eml</div>
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-danger/10 text-danger border border-danger/20 p-4 rounded-xl text-sm font-bold mb-8 flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0" /> {error}
                </div>
              )}

              {fileStatus && !error && (
                <div className="bg-secondary/50 text-primary font-bold p-4 rounded-xl text-sm mb-8 flex items-center gap-3 border border-border">
                  <Loader2 className="w-5 h-5 animate-spin text-accent-blue" /> {fileStatus}
                </div>
              )}

              {/* Form Areas */}
              {(scanType === 'qr' || scanType === 'screenshot') ? (
                <div 
                  className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    dragActive ? 'border-accent-blue bg-accent-blue/5 scale-[1.02]' : 'border-border bg-card hover:bg-secondary/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-20 h-20 rounded-2xl bg-secondary/80 flex items-center justify-center mb-6 shadow-sm">
                    {scanType === 'qr' ? <QrCode className="w-10 h-10 text-primary" /> : <UploadCloud className="w-10 h-10 text-primary" />}
                  </div>
                  <h3 className="text-xl font-heading font-extrabold text-primary mb-2">Drop {scanType === 'qr' ? 'QR image' : 'screenshot'} here</h3>
                  <p className="text-sm font-medium text-secondary mb-8">or click to browse from your device</p>
                  
                  <div className="flex gap-2 text-xs font-bold text-muted mb-8 uppercase tracking-wider">
                    <span className="px-3 py-1.5 bg-background border border-border rounded-lg">PNG</span>
                    <span className="px-3 py-1.5 bg-background border border-border rounded-lg">JPG</span>
                    <span className="px-3 py-1.5 bg-background border border-border rounded-lg">WEBP</span>
                  </div>

                  <Button variant="secondary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} disabled={isScanning}>
                    Select File
                  </Button>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    disabled={isScanning}
                  />
                </div>
              ) : scanType === 'email' && emailInputMode === 'upload' ? (
                <div 
                  className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    dragActive ? 'border-accent-blue bg-accent-blue/5 scale-[1.02]' : 'border-border bg-card hover:bg-secondary/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-20 h-20 rounded-2xl bg-secondary/80 flex items-center justify-center mb-6 shadow-sm">
                    <Mail className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-heading font-extrabold text-primary mb-2">Drop .eml file here</h3>
                  <p className="text-sm font-medium text-secondary mb-8">or click to browse from your device</p>
                  
                  <div className="flex gap-2 text-xs font-bold text-muted mb-8 uppercase tracking-wider">
                    <span className="px-3 py-1.5 bg-background border border-border rounded-lg">.EML</span>
                  </div>

                  <Button variant="secondary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} disabled={isScanning}>
                    Select File
                  </Button>
                  <input 
                    type="file" 
                    accept=".eml" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    disabled={isScanning}
                  />
                </div>
              ) : (
                <form onSubmit={handleScan} className="space-y-6">
                  


                  {scanType === 'url' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-secondary uppercase tracking-wider">Target URL</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Globe className="w-5 h-5 text-muted" />
                        </div>
                        <input 
                          type="url"
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder="https://suspicious-link.com/login"
                          disabled={isScanning}
                          className="w-full bg-card border border-border rounded-xl pl-12 pr-4 py-4 text-base font-medium text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  )}

                  {(scanType === 'email' || scanType === 'message') && (
                    <div className="space-y-4">
                      {scanType === 'email' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider">Sender (Optional)</label>
                            <input 
                              type="text"
                              value={emailSender}
                              onChange={(e) => setEmailSender(e.target.value)}
                              disabled={isScanning}
                              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-medium text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all shadow-sm"
                              placeholder="e.g. support@paypal.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider">Recipient (Optional)</label>
                            <input 
                              type="text"
                              value={emailRecipient}
                              onChange={(e) => setEmailRecipient(e.target.value)}
                              disabled={isScanning}
                              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-medium text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all shadow-sm"
                              placeholder="e.g. you@example.com"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider">Subject (Optional)</label>
                            <input 
                              type="text"
                              value={emailSubject}
                              onChange={(e) => setEmailSubject(e.target.value)}
                              disabled={isScanning}
                              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-medium text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all shadow-sm"
                              placeholder="e.g. Account Alert"
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider">{scanType === 'email' ? 'Message Body (Required)' : 'Message Text (Required)'}</label>
                        <textarea
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          disabled={isScanning}
                          className="w-full h-48 bg-card border border-border rounded-xl p-5 text-sm font-medium text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all resize-y shadow-sm"
                          placeholder={scanType === 'email' ? 'Paste the suspicious email body here...' : 'Paste the suspicious SMS, WhatsApp, or chat message here...'}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 mt-8 border-t border-border">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 text-xs font-bold text-muted">
                      <span className="flex items-center gap-2"><div className="w-6 h-6 rounded-md bg-accent-blue/10 flex items-center justify-center"><Lock className="w-3.5 h-3.5 text-accent-blue"/></div> End-to-End Secure</span>
                      <span className="flex items-center gap-2"><div className="w-6 h-6 rounded-md bg-accent-violet/10 flex items-center justify-center"><ShieldCheck className="w-3.5 h-3.5 text-accent-violet"/></div> Privacy Preserved</span>
                    </div>
                    
                    <button 
                      type="submit" 
                      disabled={isScanning || !content.trim()}
                      className="w-full sm:w-auto bg-gradient-to-r from-accent-blue to-accent-violet text-white px-10 py-4 rounded-xl font-bold text-sm shadow-soft hover:opacity-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isScanning ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing Content...</>
                      ) : (
                        'Analyze with DetectIQ'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
