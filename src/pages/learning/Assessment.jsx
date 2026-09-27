import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { getVulnerabilityBySlug } from "../../services/vulnerabilityService";
import { submitAssessment } from "../../services/progressService";

/**
 * Assessment Page Component
 * Renders vulnerability quiz questions, tracks user answers, and displays scoring results.
 */
export default function Assessment() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [vuln, setVuln] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  // Load vulnerability quiz data
  useEffect(() => {
    async function load() {
      try {
        const data = await getVulnerabilityBySlug(slug);
        setVuln(data);
      } catch (err) {
        navigate("/vulnerabilities");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, navigate]);

  const assessment = vuln?.assessment || [];
  const currentQuestion = assessment[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === assessment.length - 1;

  // Option selection handler
  const handleSelect = (optionId) => {
    if (result) return;
    setAnswers(prev => ({ ...prev, [currentQuestion._id]: optionId }));
  };

  // Next/Submit question handler
  const handleNext = () => {
    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  // Previous question handler
  const handlePrev = () => {
    setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
  };

  // Submit assessment payload
  const handleSubmit = async () => {
    const formattedAnswers = Object.keys(answers).map(qId => ({
      questionId: qId,
      selectedOptionId: answers[qId]
    }));
    
    setSubmitting(true);
    try {
      const res = await submitAssessment(vuln._id, formattedAnswers);
      setResult(res);
    } catch (err) {
      alert("Failed to submit assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset quiz state
  const resetAssessment = () => {
    setResult(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-12 h-12 text-accent-blue animate-spin" /></div>;
  if (!vuln || assessment.length === 0) return null;

  const progressPercentage = ((currentQuestionIndex) / assessment.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Assessment Header */}
      <div className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/vulnerabilities/${slug}`)} className="text-muted hover:text-primary transition-colors text-sm font-bold flex items-center gap-2">
              <ArrowRight className="w-4 h-4 rotate-180" /> Exit Assessment
            </button>
            <div className="h-6 w-px bg-border hidden sm:block"></div>
            <span className="text-sm font-bold text-primary hidden sm:block truncate max-w-[300px]">{vuln.title}</span>
          </div>
          
          {!result && (
            <div className="text-xs font-bold text-secondary uppercase tracking-wider">
              Question {currentQuestionIndex + 1} of {assessment.length}
            </div>
          )}
        </div>
        
        {/* Step Progress Bar */}
        {!result && (
          <div className="h-1 bg-background w-full">
            <div 
              className="h-full bg-accent-blue transition-all duration-500 ease-out" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-8 animate-in fade-in duration-500">
        <div className="w-full max-w-3xl">
          
          {result ? (
            /* Quiz Score Summary */
            <div className={`relative bg-card rounded-[2rem] border overflow-hidden p-10 md:p-14 text-center shadow-[0_20px_40px_-15px_rgba(0,0,0,0.2)] transition-all ${
              result.passed ? 'border-success/30' : 'border-danger/30'
            }`}>
              <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full blur-[100px] pointer-events-none opacity-20 ${
                result.passed ? 'bg-success' : 'bg-danger'
              }`} />
              
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner ${
                  result.passed ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                }`}>
                  {result.passed ? (
                    <CheckCircle2 className="w-12 h-12" />
                  ) : (
                    <XCircle className="w-12 h-12" />
                  )}
                </div>
                
                <h2 className={`text-3xl md:text-4xl font-extrabold mb-3 ${result.passed ? 'text-success' : 'text-danger'}`}>
                  {result.passed ? 'Assessment Passed!' : 'Assessment Failed'}
                </h2>
                
                <div className="flex items-center gap-4 my-6 bg-background border border-border px-8 py-4 rounded-2xl">
                  <div className="text-sm font-bold text-secondary uppercase tracking-wider">Final Score</div>
                  <div className={`text-4xl font-black ${result.passed ? 'text-success' : 'text-danger'}`}>{result.score}%</div>
                </div>
                
                <p className="text-base text-secondary mb-10 max-w-md mx-auto font-medium leading-relaxed">
                  {result.passed 
                    ? `Excellent work. You have mastered the core concepts of ${vuln.title} and improved your Security Profile.` 
                    : `You didn't meet the passing threshold. Review the theory materials and try again when you feel ready.`}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  {!result.passed && (
                    <button 
                      onClick={resetAssessment}
                      className="bg-background border border-border text-primary px-8 py-3.5 rounded-xl font-bold hover:bg-secondary transition-colors"
                    >
                      Retry Assessment
                    </button>
                  )}
                  <button 
                    onClick={() => navigate("/learning/progress")}
                    className={`px-8 py-3.5 rounded-xl font-bold shadow-soft hover:-translate-y-0.5 transition-all text-white ${
                      result.passed ? 'bg-success hover:bg-success/90' : 'bg-accent-blue hover:bg-accent-blue/90'
                    }`}
                  >
                    View Progress Profile
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Active Question Card */
            <div className="bg-card rounded-[2rem] border border-border p-8 md:p-12 shadow-elevated relative">
              <h3 className="text-2xl md:text-3xl font-extrabold text-primary mb-10 leading-tight">
                {currentQuestion.question}
              </h3>
              
              <div className="space-y-4 mb-12">
                {currentQuestion.options.map(opt => {
                  const isSelected = answers[currentQuestion._id] === opt._id;
                  return (
                    <label 
                      key={opt._id} 
                      className={`flex items-center p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-accent-blue bg-accent-blue/5 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                          : 'border-border bg-background hover:border-accent-blue/40'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 flex-shrink-0 transition-colors ${
                        isSelected ? 'border-accent-blue bg-accent-blue' : 'border-muted bg-transparent'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <input 
                        type="radio" 
                        name={currentQuestion._id} 
                        className="hidden"
                        checked={isSelected}
                        onChange={() => handleSelect(opt._id)}
                      />
                      <span className={`text-base font-medium ${isSelected ? 'text-primary font-bold' : 'text-secondary'}`}>
                        {opt.text}
                      </span>
                    </label>
                  );
                })}
              </div>
              
              <div className="flex items-center justify-between pt-6 border-t border-border">
                <button 
                  onClick={handlePrev} 
                  disabled={currentQuestionIndex === 0 || submitting}
                  className="px-6 py-3 text-sm font-bold text-secondary hover:text-primary disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                
                <button 
                  onClick={handleNext} 
                  disabled={!answers[currentQuestion._id] || submitting}
                  className="bg-accent-blue text-white px-8 py-3.5 rounded-xl font-bold shadow-soft hover:bg-accent-blue/90 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isLastQuestion ? (
                    'Submit Assessment'
                  ) : (
                    <>Next Question <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
