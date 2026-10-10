import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, ArrowRight, Check, X, BookOpen, Lightbulb, Sparkles, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { getVulnerabilityBySlug } from "../../services/vulnerabilityService";
import { submitAssessment } from "../../services/progressService";
import { evaluateQuizAnswer } from "../../data/vulnerabilityQuizData";

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
  const [showReview, setShowReview] = useState(true);

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

  const selectedOptionId = currentQuestion ? answers[currentQuestion._id] : null;
  const isAnswered = !!selectedOptionId;
  const currentEvaluation = isAnswered && currentQuestion 
    ? evaluateQuizAnswer(currentQuestion, selectedOptionId, slug) 
    : null;

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
    setShowReview(true);
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
                  <button 
                    onClick={resetAssessment}
                    className="bg-background border border-border text-primary px-8 py-3.5 rounded-xl font-bold hover:bg-secondary transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> Retry Assessment
                  </button>
                  <button 
                    onClick={() => navigate("/learning/progress")}
                    className={`px-8 py-3.5 rounded-xl font-bold shadow-soft hover:-translate-y-0.5 transition-all text-white ${
                      result.passed ? 'bg-success hover:bg-success/90' : 'bg-accent-blue hover:bg-accent-blue/90'
                    }`}
                  >
                    View Progress Profile
                  </button>
                </div>

                {/* Full Assessment Breakdown & Learning Review */}
                <div className="w-full mt-10 pt-8 border-t border-border/80 text-left">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-accent-blue" />
                      Question-by-Question Review
                    </h3>
                    <button
                      onClick={() => setShowReview(!showReview)}
                      className="text-xs font-bold text-accent-blue hover:text-accent-blue/80 flex items-center gap-1 transition-colors"
                    >
                      {showReview ? (
                        <>Hide Details <ChevronUp className="w-4 h-4" /></>
                      ) : (
                        <>Show Details <ChevronDown className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>

                  {showReview && (
                    <div className="space-y-4">
                      {assessment.map((q, idx) => {
                        const userOptId = answers[q._id];
                        const userOpt = q.options.find(o => o._id === userOptId);
                        const qEval = evaluateQuizAnswer(q, userOptId, slug);

                        return (
                          <div 
                            key={q._id || idx}
                            className={`p-5 rounded-2xl border transition-all ${
                              qEval.isCorrect
                                ? 'bg-emerald-950/20 border-emerald-500/30'
                                : 'bg-rose-950/20 border-rose-500/30'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                qEval.isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                              }`}>
                                {qEval.isCorrect ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                                    Question {idx + 1}
                                  </span>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    qEval.isCorrect 
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                  }`}>
                                    {qEval.isCorrect ? 'Correct' : 'Incorrect'}
                                  </span>
                                </div>

                                <p className="text-sm font-bold text-primary">
                                  {q.question}
                                </p>

                                <div className="text-xs space-y-1 pt-1">
                                  <div className="text-secondary font-medium">
                                    <span className="text-muted mr-1.5">Your answer:</span>
                                    <span className={qEval.isCorrect ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                      {userOpt?.text || "None selected"}
                                    </span>
                                  </div>

                                  {!qEval.isCorrect && qEval.correctOptionText && (
                                    <div className="text-emerald-400 font-medium">
                                      <span className="text-muted mr-1.5">Correct answer:</span>
                                      <span className="font-bold">{qEval.correctOptionText}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="text-xs text-slate-300 dark:text-slate-300 pt-2 border-t border-border/50 leading-relaxed font-medium">
                                  <span className="font-bold text-primary mr-1">Explanation:</span>
                                  {qEval.explanation}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Active Question Card */
            <div className="bg-card rounded-[2rem] border border-border p-8 md:p-12 shadow-elevated relative">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-accent-blue uppercase tracking-wider bg-accent-blue/10 px-3 py-1 rounded-lg border border-accent-blue/20">
                  Question {currentQuestionIndex + 1} of {assessment.length}
                </span>
                {isAnswered && (
                  <span className={`text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 ${
                    currentEvaluation?.isCorrect 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {currentEvaluation?.isCorrect ? (
                      <><Check className="w-3.5 h-3.5" /> Correct</>
                    ) : (
                      <><X className="w-3.5 h-3.5" /> Incorrect</>
                    )}
                  </span>
                )}
              </div>

              <h3 className="text-2xl md:text-3xl font-extrabold text-primary mb-8 leading-tight">
                {currentQuestion.question}
              </h3>
              
              <div className="space-y-3.5 mb-8">
                {currentQuestion.options.map(opt => {
                  const isSelected = selectedOptionId === opt._id;
                  const isCorrectOption = isAnswered && currentEvaluation?.correctOptionId === opt._id;

                  let borderClass = "border-border bg-background hover:border-accent-blue/40";
                  let circleClass = "border-muted bg-transparent";
                  let badge = null;

                  if (isAnswered) {
                    if (isSelected && currentEvaluation?.isCorrect) {
                      borderClass = "border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]";
                      circleClass = "border-emerald-500 bg-emerald-500 text-white";
                      badge = (
                        <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-3 py-1 rounded-full flex-shrink-0">
                          <Check className="w-3.5 h-3.5" /> Correct
                        </span>
                      );
                    } else if (isSelected && !currentEvaluation?.isCorrect) {
                      borderClass = "border-rose-500 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.15)]";
                      circleClass = "border-rose-500 bg-rose-500 text-white";
                      badge = (
                        <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-950/70 border border-rose-500/30 px-3 py-1 rounded-full flex-shrink-0">
                          <X className="w-3.5 h-3.5" /> Your Answer
                        </span>
                      );
                    } else if (isCorrectOption) {
                      borderClass = "border-emerald-500/80 bg-emerald-500/10 border-dashed shadow-[0_0_15px_rgba(16,185,129,0.1)]";
                      circleClass = "border-emerald-500 bg-emerald-500/20 text-emerald-400";
                      badge = (
                        <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-500/40 px-3 py-1 rounded-full flex-shrink-0">
                          <Sparkles className="w-3 h-3 text-emerald-400" /> Correct Answer
                        </span>
                      );
                    } else {
                      borderClass = "border-border/60 bg-background/50 opacity-40";
                    }
                  }

                  return (
                    <div 
                      key={opt._id} 
                      onClick={() => !isAnswered && handleSelect(opt._id)}
                      className={`flex items-center p-5 rounded-2xl border-2 transition-all select-none ${
                        !isAnswered ? 'cursor-pointer hover:border-accent-blue/50 hover:bg-secondary/20' : 'cursor-default'
                      } ${borderClass}`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 flex-shrink-0 transition-all ${circleClass}`}>
                        {isAnswered && isSelected && currentEvaluation?.isCorrect && <Check className="w-3.5 h-3.5 text-white" />}
                        {isAnswered && isSelected && !currentEvaluation?.isCorrect && <X className="w-3.5 h-3.5 text-white" />}
                        {isAnswered && isCorrectOption && !isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        {!isAnswered && isSelected && <div className="w-2 h-2 rounded-full bg-accent-blue" />}
                      </div>
                      <span className={`text-base pr-3 leading-snug font-medium ${
                        isSelected ? 'text-primary font-bold' : isCorrectOption ? 'text-emerald-300 font-bold' : 'text-secondary'
                      }`}>
                        {opt.text}
                      </span>
                      {badge}
                    </div>
                  );
                })}
              </div>

              {/* Instant Explanation Feedback Panel */}
              {isAnswered && currentEvaluation && (
                <div className={`mb-8 p-6 rounded-2xl border transition-all animate-in fade-in slide-in-from-top-3 duration-300 ${
                  currentEvaluation.isCorrect 
                    ? 'bg-emerald-950/30 border-emerald-500/30 shadow-[0_4px_25px_rgba(16,185,129,0.12)]' 
                    : 'bg-rose-950/30 border-rose-500/30 shadow-[0_4px_25px_rgba(244,63,94,0.12)]'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner ${
                      currentEvaluation.isCorrect 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}>
                      {currentEvaluation.isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </div>
                    
                    <div className="flex-1 space-y-2.5 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className={`text-base font-extrabold flex items-center gap-2 ${
                          currentEvaluation.isCorrect ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {currentEvaluation.isCorrect ? 'Correct! Excellent understanding.' : 'Incorrect Selection'}
                        </h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-background/80 text-secondary border border-border">
                          Vulnerability Concept
                        </span>
                      </div>

                      {!currentEvaluation.isCorrect && currentEvaluation.correctOptionText && (
                        <div className="p-3.5 rounded-xl bg-background/90 border border-emerald-500/40 shadow-sm">
                          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                            Correct Answer:
                          </span>
                          <span className="text-primary font-bold text-sm block">
                            {currentEvaluation.correctOptionText}
                          </span>
                        </div>
                      )}

                      <div className="text-sm text-slate-300 dark:text-slate-200 leading-relaxed font-medium pt-1">
                        <span className="font-bold text-primary mr-1.5">Why:</span>
                        {currentEvaluation.explanation}
                      </div>

                      {!currentEvaluation.isCorrect && currentEvaluation.incorrectFeedback && (
                        <div className="text-xs text-rose-300/90 leading-relaxed pt-2 border-t border-rose-500/20">
                          <span className="font-bold text-rose-200 mr-1.5">Key takeaway:</span>
                          {currentEvaluation.incorrectFeedback}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
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
                  disabled={!isAnswered || submitting}
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
