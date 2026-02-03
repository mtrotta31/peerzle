import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  TrainingStatus,
  TrainingModule,
  TrainingCompletionResult,
  getTrainingStatus,
  getTrainingModule,
  completeTrainingModule,
} from '../services/api';

type ViewState = 'overview' | 'lesson' | 'quiz' | 'results';

export default function HelperTraining() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [currentModule, setCurrentModule] = useState<TrainingModule | null>(null);
  const [viewState, setViewState] = useState<ViewState>('overview');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<TrainingCompletionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStatus() {
      if (!slug) return;

      try {
        const data = await getTrainingStatus(slug);
        setStatus(data);
      } catch (err) {
        console.error('Failed to load training status:', err);
        setError('Failed to load training. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadStatus();
  }, [slug]);

  const handleStartModule = async (moduleNumber: number) => {
    if (!slug) return;

    setIsLoading(true);
    try {
      const module = await getTrainingModule(slug, moduleNumber);
      setCurrentModule(module);
      setViewState('lesson');
      setCurrentQuestionIndex(0);
      setAnswers([]);
      setQuizResult(null);
    } catch (err) {
      console.error('Failed to load module:', err);
      setError('Failed to load module. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartQuiz = () => {
    setViewState('quiz');
    setCurrentQuestionIndex(0);
    setAnswers([]);
  };

  const handleSelectAnswer = (answerIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < 3) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!slug || !currentModule || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await completeTrainingModule(slug, currentModule.moduleNumber, answers);
      setQuizResult(result);
      setViewState('results');

      // Refresh status if passed
      if (result.passed) {
        const newStatus = await getTrainingStatus(slug);
        setStatus(newStatus);
      }
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      setError('Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetake = () => {
    setViewState('lesson');
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setQuizResult(null);
  };

  const handleBackToOverview = () => {
    setViewState('overview');
    setCurrentModule(null);
    setQuizResult(null);
  };

  const handleContinueToDashboard = () => {
    navigate(`/community/${slug}`);
  };

  if (isLoading && !currentModule) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: '#64748B' }}>Loading...</p>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: '#DC2626' }}>{error}</p>
        <Link to={`/community/${slug}`} style={{ color: '#2B7CF6' }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // Module lesson view
  if (viewState === 'lesson' && currentModule) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
        <header
          style={{
            backgroundColor: 'white',
            borderBottom: '1px solid #E2E8F0',
            padding: '16px 24px',
          }}
        >
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <button
              onClick={handleBackToOverview}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                fontSize: '14px',
                padding: 0,
                marginBottom: '8px',
              }}
            >
              &larr; Back to Modules
            </button>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
              Module {currentModule.moduleNumber}: {currentModule.title}
            </h1>
          </div>
        </header>

        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <div
              style={{
                fontSize: '16px',
                lineHeight: '1.7',
                color: '#1E3A5F',
              }}
              dangerouslySetInnerHTML={{
                __html: currentModule.lessonContent
                  .replace(/^## (.+)$/gm, '<h2 style="font-size: 24px; font-weight: 600; margin: 32px 0 16px; color: #1E3A5F;">$1</h2>')
                  .replace(/^### (.+)$/gm, '<h3 style="font-size: 18px; font-weight: 600; margin: 24px 0 12px; color: #1E3A5F;">$1</h3>')
                  .replace(/\*\*(.+?)\*\*/g, '<strong style="color: #2B7CF6;">$1</strong>')
                  .replace(/^- (.+)$/gm, '<li style="margin: 8px 0; padding-left: 8px;">$1</li>')
                  .replace(/(<li.*<\/li>\n?)+/g, '<ul style="margin: 16px 0; padding-left: 20px;">$&</ul>')
                  .replace(/\n\n/g, '</p><p style="margin: 16px 0;">')
              }}
            />

            <div style={{ marginTop: '32px', textAlign: 'center' }}>
              <button
                onClick={handleStartQuiz}
                style={{
                  padding: '14px 32px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '16px',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#1E6AD9';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#2B7CF6';
                }}
              >
                Start Knowledge Check
              </button>
              <p style={{ marginTop: '12px', fontSize: '14px', color: '#64748B' }}>
                You'll need to answer 3 of 4 questions correctly to pass
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Quiz view
  if (viewState === 'quiz' && currentModule) {
    const question = currentModule.questions[currentQuestionIndex];
    const selectedAnswer = answers[currentQuestionIndex];
    const allAnswered = answers.length === 4 && answers.every((a) => a !== undefined);

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
        <header
          style={{
            backgroundColor: 'white',
            borderBottom: '1px solid #E2E8F0',
            padding: '16px 24px',
          }}
        >
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
                  Knowledge Check
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748B' }}>
                  Module {currentModule.moduleNumber}: {currentModule.title}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor:
                        answers[i] !== undefined
                          ? '#2B7CF6'
                          : i === currentQuestionIndex
                          ? '#EDF4FF'
                          : '#F1F5F9',
                      color: answers[i] !== undefined ? 'white' : '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: i === currentQuestionIndex ? '2px solid #2B7CF6' : 'none',
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <p style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 500, color: '#1E3A5F' }}>
              {question.question}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(index)}
                  style={{
                    padding: '16px 20px',
                    backgroundColor: selectedAnswer === index ? '#EDF4FF' : 'white',
                    border: `2px solid ${selectedAnswer === index ? '#2B7CF6' : '#E2E8F0'}`,
                    borderRadius: '12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '15px',
                    color: '#1E3A5F',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    if (selectedAnswer !== index) {
                      e.currentTarget.style.borderColor = '#2B7CF6';
                      e.currentTarget.style.backgroundColor = '#F8FAFC';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedAnswer !== index) {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: `2px solid ${selectedAnswer === index ? '#2B7CF6' : '#CBD5E1'}`,
                        backgroundColor: selectedAnswer === index ? '#2B7CF6' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {selectedAnswer === index && (
                        <span style={{ color: 'white', fontSize: '14px' }}>✓</span>
                      )}
                    </div>
                    {option}
                  </div>
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '32px',
                paddingTop: '24px',
                borderTop: '1px solid #E2E8F0',
              }}
            >
              <button
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: currentQuestionIndex === 0 ? '#CBD5E1' : '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '24px',
                  cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Previous
              </button>

              {currentQuestionIndex < 3 ? (
                <button
                  onClick={handleNextQuestion}
                  disabled={selectedAnswer === undefined}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: selectedAnswer !== undefined ? '#2B7CF6' : '#E2E8F0',
                    color: selectedAnswer !== undefined ? 'white' : '#94A3B8',
                    border: 'none',
                    borderRadius: '24px',
                    cursor: selectedAnswer !== undefined ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'background-color 0.2s',
                  }}
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={!allAnswered || isSubmitting}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: allAnswered && !isSubmitting ? '#16A34A' : '#E2E8F0',
                    color: allAnswered && !isSubmitting ? 'white' : '#94A3B8',
                    border: 'none',
                    borderRadius: '24px',
                    cursor: allAnswered && !isSubmitting ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'background-color 0.2s',
                  }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Answers'}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Results view
  if (viewState === 'results' && quizResult && currentModule) {
    const passed = quizResult.passed;

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
        <header
          style={{
            backgroundColor: 'white',
            borderBottom: '1px solid #E2E8F0',
            padding: '16px 24px',
          }}
        >
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
              Quiz Results
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748B' }}>
              Module {currentModule.moduleNumber}: {currentModule.title}
            </p>
          </div>
        </header>

        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
          {/* Score Card */}
          <div
            style={{
              backgroundColor: passed ? '#ECFDF5' : '#FEF2F2',
              borderRadius: '16px',
              padding: '32px',
              textAlign: 'center',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                fontSize: '64px',
                marginBottom: '16px',
              }}
            >
              {passed ? '🎉' : '📚'}
            </div>
            <h2
              style={{
                margin: '0 0 8px',
                fontSize: '24px',
                fontWeight: 600,
                color: passed ? '#16A34A' : '#DC2626',
              }}
            >
              {passed ? 'Module Complete!' : 'Not Quite'}
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '18px', color: '#1E3A5F' }}>
              You scored <strong>{quizResult.score}%</strong> ({quizResult.results.filter(r => r.isCorrect).length} of 4 correct)
            </p>
            {!passed && (
              <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
                You need {quizResult.passingScore}% to pass. Review the lesson and try again.
              </p>
            )}
            {passed && quizResult.allModulesComplete && (
              <div
                style={{
                  marginTop: '24px',
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                }}
              >
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#16A34A' }}>
                  🎊 Congratulations! You've completed all training modules!
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748B' }}>
                  You're now ready to start helping others.
                </p>
              </div>
            )}
          </div>

          {/* Results Detail */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: '#1E3A5F' }}>
              Your Answers
            </h3>
            {quizResult.results.map((result, index) => (
              <div
                key={index}
                style={{
                  padding: '16px',
                  backgroundColor: result.isCorrect ? '#F0FDF4' : '#FEF2F2',
                  borderRadius: '12px',
                  marginBottom: index < 3 ? '12px' : 0,
                  borderLeft: `4px solid ${result.isCorrect ? '#16A34A' : '#DC2626'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>{result.isCorrect ? '✓' : '✗'}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 500, color: '#1E3A5F' }}>
                      {result.question}
                    </p>
                    <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#64748B' }}>
                      Your answer: <span style={{ color: result.isCorrect ? '#16A34A' : '#DC2626' }}>
                        {currentModule.questions[index].options[result.selectedAnswer]}
                      </span>
                    </p>
                    {!result.isCorrect && (
                      <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
                        Correct answer: <span style={{ color: '#16A34A' }}>
                          {currentModule.questions[index].options[result.correctAnswer]}
                        </span>
                      </p>
                    )}
                    <p
                      style={{
                        margin: '12px 0 0',
                        padding: '12px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#64748B',
                        fontStyle: 'italic',
                      }}
                    >
                      {result.explanation}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '24px' }}>
            {!passed && (
              <button
                onClick={handleRetake}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 600,
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#1E6AD9';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#2B7CF6';
                }}
              >
                Review Lesson & Retry
              </button>
            )}
            <button
              onClick={quizResult.allModulesComplete ? handleContinueToDashboard : handleBackToOverview}
              style={{
                padding: '12px 24px',
                backgroundColor: passed ? '#16A34A' : 'white',
                color: passed ? 'white' : '#64748B',
                border: passed ? 'none' : '1px solid #E2E8F0',
                borderRadius: '24px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              {quizResult.allModulesComplete
                ? 'Go to Dashboard'
                : passed
                ? 'Continue to Next Module'
                : 'Back to Modules'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Overview view (default)
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      <header
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #E2E8F0',
          padding: '16px 24px',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src="/peerzle-icon.svg"
                alt="Peerzle"
                style={{ width: '32px', height: '32px' }}
              />
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
                Helper Training
              </h1>
            </div>
            <Link
              to={`/community/${slug}`}
              style={{
                color: '#64748B',
                textDecoration: 'none',
                padding: '8px 16px',
                backgroundColor: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#2B7CF6';
                e.currentTarget.style.color = '#2B7CF6';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.color = '#64748B';
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
        {/* Progress Overview */}
        <div
          style={{
            backgroundColor: status?.trainingCompleted ? '#ECFDF5' : '#EDF4FF',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          {status?.trainingCompleted ? (
            <>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
              <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600, color: '#16A34A' }}>
                Training Complete!
              </h2>
              <p style={{ margin: 0, color: '#64748B' }}>
                You've completed all training modules and are ready to help others.
              </p>
            </>
          ) : (
            <>
              <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
                Complete Your Training
              </h2>
              <p style={{ margin: '0 0 16px', color: '#64748B' }}>
                Finish all 3 modules to start helping others in the community.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                {[1, 2, 3].map((num) => {
                  const module = status?.modules.find((m) => m.moduleNumber === num);
                  return (
                    <div
                      key={num}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: module?.isCompleted ? '#16A34A' : '#E2E8F0',
                        color: module?.isCompleted ? 'white' : '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                      }}
                    >
                      {module?.isCompleted ? '✓' : num}
                    </div>
                  );
                })}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: '14px', color: '#64748B' }}>
                {status?.completedCount || 0} of {status?.totalModules || 3} modules completed
              </p>
            </>
          )}
        </div>

        {/* Module Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {status?.modules.map((module) => (
            <div
              key={module.moduleNumber}
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                borderLeft: `4px solid ${module.isCompleted ? '#16A34A' : '#E2E8F0'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: module.isCompleted ? '#16A34A' : '#EDF4FF',
                        color: module.isCompleted ? 'white' : '#2B7CF6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '14px',
                      }}
                    >
                      {module.isCompleted ? '✓' : module.moduleNumber}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
                      {module.title}
                    </h3>
                  </div>
                  <p style={{ margin: '0 0 16px', color: '#64748B', paddingLeft: '44px' }}>
                    {module.description}
                  </p>
                  {module.isCompleted && (
                    <p style={{ margin: 0, fontSize: '13px', color: '#16A34A', paddingLeft: '44px' }}>
                      Completed with {module.score}% on{' '}
                      {new Date(module.completedAt!).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleStartModule(module.moduleNumber)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: module.isCompleted ? 'white' : '#2B7CF6',
                    color: module.isCompleted ? '#64748B' : 'white',
                    border: module.isCompleted ? '1px solid #E2E8F0' : 'none',
                    borderRadius: '24px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    if (module.isCompleted) {
                      e.currentTarget.style.borderColor = '#2B7CF6';
                      e.currentTarget.style.color = '#2B7CF6';
                    } else {
                      e.currentTarget.style.backgroundColor = '#1E6AD9';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (module.isCompleted) {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.color = '#64748B';
                    } else {
                      e.currentTarget.style.backgroundColor = '#2B7CF6';
                    }
                  }}
                >
                  {module.isCompleted ? 'Review' : 'Start'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
