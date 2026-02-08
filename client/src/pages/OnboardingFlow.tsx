import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCommunity,
  getCommunityTopics,
  generateDisplayName,
  completeOnboarding,
  getMembership,
  TopicRating,
  Community,
  Membership,
} from '../services/api';

type OnboardingStep = 'welcome' | 'topics' | 'ratings' | 'identity' | 'review';

export default function OnboardingFlow() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // State
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flow state
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [welcomeScreen, setWelcomeScreen] = useState(0);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);

  // User selections
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicRatings, setTopicRatings] = useState<Record<string, TopicRating>>({});
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'seeker' | 'both'>('seeker');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load community, topics, and membership
  useEffect(() => {
    if (!slug) return;

    Promise.all([getCommunity(slug), getCommunityTopics(slug), generateDisplayName(slug), getMembership(slug)])
      .then(([communityData, topics, name, membershipData]) => {
        setCommunity(communityData);
        setAvailableTopics(topics);
        setDisplayName(name);
        setMembership(membershipData);
      })
      .catch(() => {
        setError('Failed to load onboarding data');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [slug]);

  // Initialize ratings when topics change
  useEffect(() => {
    const newRatings: Record<string, TopicRating> = {};
    selectedTopics.forEach((topic) => {
      if (!topicRatings[topic]) {
        newRatings[topic] = {
          topic,
          historyRating: 5,
          knowledgeRating: 5,
          copingRating: 5,
        };
      } else {
        newRatings[topic] = topicRatings[topic];
      }
    });
    setTopicRatings(newRatings);
  }, [selectedTopics]);

  const handleRegenerateName = async () => {
    if (!slug) return;
    try {
      const name = await generateDisplayName(slug);
      setDisplayName(name);
    } catch {
      // Ignore error, keep current name
    }
  };

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleRatingChange = (topic: string, field: keyof TopicRating, value: number) => {
    setTopicRatings((prev) => ({
      ...prev,
      [topic]: {
        ...prev[topic],
        [field]: value,
      },
    }));
  };

  const handleComplete = async () => {
    if (!slug) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await completeOnboarding(slug, {
        displayName,
        topics: Object.values(topicRatings),
        role,
      });
      navigate(`/community/${slug}`);
    } catch {
      setError('Failed to complete onboarding. Please try again.');
      setIsSubmitting(false);
    }
  };

  const goToStep = (step: OnboardingStep) => {
    if (step === 'ratings') {
      setCurrentTopicIndex(0);
    }
    setCurrentStep(step);
  };

  const getStepNumber = (): number => {
    const steps: OnboardingStep[] = ['welcome', 'topics', 'ratings', 'identity', 'review'];
    return steps.indexOf(currentStep) + 1;
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748B' }}>Loading...</div>
      </div>
    );
  }

  if (error && !community) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#DC2626' }}>{error}</div>
      </div>
    );
  }

  // Common styles
  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '20px',
    padding: '40px',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '14px 32px',
    backgroundColor: '#2B7CF6',
    color: 'white',
    border: 'none',
    borderRadius: '24px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'white',
    color: '#2B7CF6',
    border: '2px solid #2B7CF6',
  };

  // Progress indicator
  const renderProgress = () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
      {[1, 2, 3, 4, 5].map((step) => {
        const isActive = step === getStepNumber();
        const isCompleted = step < getStepNumber();
        return (
          <div
            key={step}
            style={{
              width: isActive ? '24px' : '8px',
              height: isActive ? '10px' : '8px',
              borderRadius: isActive ? '5px' : '50%',
              backgroundColor: isActive ? '#2563EB' : isCompleted ? '#2563EB' : '#D1D5DB',
              transition: 'all 0.3s ease',
            }}
          />
        );
      })}
    </div>
  );

  // STEP 1: Welcome
  const renderWelcome = () => {
    const orgName = membership?.organization?.name;
    const screens = [
      {
        title: `Welcome to ${community?.name || 'Peerzle'}`,
        subtitle: orgName ? `You've been invited by ${orgName}` : null,
        text: 'Peerzle connects you with peers who share similar experiences for anonymous, supportive conversations.',
        icon: '👋',
      },
      {
        title: 'How it works',
        subtitle: null,
        text: 'Select topics you\'ve experienced, get matched with someone who understands, and chat anonymously.',
        icon: '💬',
      },
      {
        title: 'Your safety matters',
        subtitle: null,
        text: 'All conversations are monitored for safety. Crisis resources are always available. Everything is anonymous.',
        icon: '🛡️',
      },
    ];

    const screen = screens[welcomeScreen];

    return (
      <div style={cardStyle}>
        {renderProgress()}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>{screen.icon}</div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1E3A5F', marginBottom: screen.subtitle ? '8px' : '16px' }}>
            {screen.title}
          </h1>
          {screen.subtitle && (
            <p style={{ fontSize: '15px', color: '#2B7CF6', fontWeight: 500, marginBottom: '16px' }}>
              {screen.subtitle}
            </p>
          )}
          <p style={{ fontSize: '16px', color: '#64748B', lineHeight: '1.6', marginBottom: '32px' }}>
            {screen.text}
          </p>
          <button
            onClick={() => {
              if (welcomeScreen < 2) {
                setWelcomeScreen(welcomeScreen + 1);
              } else {
                goToStep('topics');
              }
            }}
            style={buttonStyle}
          >
            {welcomeScreen < 2 ? 'Next' : 'Get Started'}
          </button>
        </div>
      </div>
    );
  };

  // STEP 2: Topic Selection
  const renderTopics = () => (
    <div style={cardStyle}>
      {renderProgress()}
      <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#1E3A5F', marginBottom: '8px', textAlign: 'center' }}>
        Select Your Topics
      </h2>
      <p style={{ color: '#64748B', marginBottom: '24px', textAlign: 'center' }}>
        Choose experiences you've been through or are currently dealing with
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
        {availableTopics.map((topic) => {
          const isSelected = selectedTopics.includes(topic);
          return (
            <button
              key={topic}
              onClick={() => handleTopicToggle(topic)}
              style={{
                padding: '10px 18px',
                borderRadius: '20px',
                border: isSelected ? '2px solid #2B7CF6' : '2px solid #E2E8F0',
                backgroundColor: isSelected ? '#EDF4FF' : 'white',
                color: isSelected ? '#2B7CF6' : '#475569',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {topic}
            </button>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginBottom: '24px', color: '#64748B', fontSize: '14px' }}>
        {selectedTopics.length} topic{selectedTopics.length !== 1 ? 's' : ''} selected
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={() => goToStep('welcome')} style={secondaryButtonStyle}>
          Back
        </button>
        <button
          onClick={() => goToStep('ratings')}
          disabled={selectedTopics.length === 0}
          style={{
            ...buttonStyle,
            opacity: selectedTopics.length === 0 ? 0.5 : 1,
            cursor: selectedTopics.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Next
        </button>
      </div>
    </div>
  );

  // STEP 3: Self-Ratings
  const renderRatings = () => {
    const currentTopic = selectedTopics[currentTopicIndex];
    const rating = topicRatings[currentTopic];

    if (!rating) return null;

    const sliderStyle: React.CSSProperties = {
      width: '100%',
      height: '8px',
      borderRadius: '4px',
      appearance: 'none' as const,
      background: `linear-gradient(to right, #2B7CF6 0%, #2B7CF6 ${((rating.historyRating - 1) / 9) * 100}%, #E2E8F0 ${((rating.historyRating - 1) / 9) * 100}%, #E2E8F0 100%)`,
      cursor: 'pointer',
    };

    const renderSlider = (
      label: string,
      description: string,
      field: 'historyRating' | 'knowledgeRating' | 'copingRating',
      lowLabel: string,
      highLabel: string
    ) => (
      <div style={{ marginBottom: '28px' }}>
        <div style={{ marginBottom: '8px' }}>
          <span style={{ fontWeight: 600, color: '#1E3A5F' }}>{label}</span>
          <span style={{ color: '#64748B', fontSize: '14px', marginLeft: '8px' }}>{description}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', minWidth: '50px', textAlign: 'right' }}>{lowLabel}</span>
          <input
            type="range"
            min="1"
            max="10"
            value={rating[field]}
            onChange={(e) => handleRatingChange(currentTopic, field, parseInt(e.target.value))}
            style={{
              ...sliderStyle,
              background: `linear-gradient(to right, #2B7CF6 0%, #2B7CF6 ${((rating[field] - 1) / 9) * 100}%, #E2E8F0 ${((rating[field] - 1) / 9) * 100}%, #E2E8F0 100%)`,
            }}
          />
          <span style={{ fontSize: '11px', color: '#94A3B8', minWidth: '50px' }}>{highLabel}</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '20px', fontWeight: 600, color: '#2B7CF6' }}>
          {rating[field]}
        </div>
      </div>
    );

    return (
      <div style={cardStyle}>
        {renderProgress()}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '14px', color: '#64748B' }}>
            Topic {currentTopicIndex + 1} of {selectedTopics.length}
          </span>
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 600, color: '#1E3A5F', marginBottom: '32px', textAlign: 'center' }}>
          {currentTopic}
        </h2>

        {renderSlider('Experience', 'How frequently have you experienced this?', 'historyRating', 'Rarely', 'Often')}
        {renderSlider('Knowledge', 'How much do you know about this topic?', 'knowledgeRating', 'Low', 'High')}
        {renderSlider('Coping', 'How well do you manage this?', 'copingRating', 'Struggling', 'Well')}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
          <button
            onClick={() => {
              if (currentTopicIndex > 0) {
                setCurrentTopicIndex(currentTopicIndex - 1);
              } else {
                goToStep('topics');
              }
            }}
            style={secondaryButtonStyle}
          >
            Back
          </button>
          <button
            onClick={() => {
              if (currentTopicIndex < selectedTopics.length - 1) {
                setCurrentTopicIndex(currentTopicIndex + 1);
              } else {
                goToStep('identity');
              }
            }}
            style={buttonStyle}
          >
            {currentTopicIndex < selectedTopics.length - 1 ? 'Next Topic' : 'Continue'}
          </button>
        </div>
      </div>
    );
  };

  // STEP 4: Identity
  const renderIdentity = () => (
    <div style={cardStyle}>
      {renderProgress()}
      <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#1E3A5F', marginBottom: '8px', textAlign: 'center' }}>
        Your Identity
      </h2>
      <p style={{ color: '#64748B', marginBottom: '32px', textAlign: 'center' }}>
        Choose how you'll appear in conversations
      </p>

      {/* Display Name */}
      <div style={{ marginBottom: '32px' }}>
        <label style={{ display: 'block', fontWeight: 600, color: '#1E3A5F', marginBottom: '8px' }}>
          Anonymous Display Name
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            backgroundColor: '#F8FAFC',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
          }}
        >
          <span style={{ fontSize: '20px', fontWeight: 600, color: '#1E3A5F', flex: 1 }}>{displayName}</span>
          <button
            onClick={handleRegenerateName}
            style={{
              padding: '8px 16px',
              backgroundColor: '#EDF4FF',
              color: '#2B7CF6',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Regenerate
          </button>
        </div>
        <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '8px' }}>
          This is how you'll appear to others in conversations
        </p>
      </div>

      {/* Role Selection */}
      <div style={{ marginBottom: '32px' }}>
        <label style={{ display: 'block', fontWeight: 600, color: '#1E3A5F', marginBottom: '12px' }}>
          How do you want to use Peerzle?
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => setRole('seeker')}
            style={{
              padding: '16px 20px',
              backgroundColor: role === 'seeker' ? '#EDF4FF' : 'white',
              border: role === 'seeker' ? '2px solid #2B7CF6' : '2px solid #E2E8F0',
              borderRadius: '12px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 600, color: '#1E3A5F', marginBottom: '4px' }}>
              I'm looking for support
            </div>
            <div style={{ fontSize: '14px', color: '#64748B' }}>
              Connect with peers who understand what you're going through
            </div>
          </button>
          <button
            onClick={() => setRole('both')}
            style={{
              padding: '16px 20px',
              backgroundColor: role === 'both' ? '#EDF4FF' : 'white',
              border: role === 'both' ? '2px solid #2B7CF6' : '2px solid #E2E8F0',
              borderRadius: '12px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 600, color: '#1E3A5F', marginBottom: '4px' }}>
              I want to give AND receive support
            </div>
            <div style={{ fontSize: '14px', color: '#64748B' }}>
              Help others while also getting support when you need it
            </div>
            {role === 'both' && (
              <div
                style={{
                  fontSize: '13px',
                  color: '#F59E0B',
                  marginTop: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#FFFBEB',
                  borderRadius: '8px',
                }}
              >
                Note: Helper training is required before you can support others
              </div>
            )}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={() => goToStep('ratings')} style={secondaryButtonStyle}>
          Back
        </button>
        <button onClick={() => goToStep('review')} style={buttonStyle}>
          Review
        </button>
      </div>
    </div>
  );

  // STEP 5: Review
  const renderReview = () => (
    <div style={{ ...cardStyle, maxWidth: '700px' }}>
      {renderProgress()}
      <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#1E3A5F', marginBottom: '8px', textAlign: 'center' }}>
        Review Your Profile
      </h2>
      <p style={{ color: '#64748B', marginBottom: '32px', textAlign: 'center' }}>
        Make sure everything looks good
      </p>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#FEF2F2',
            color: '#DC2626',
            borderRadius: '8px',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {/* Display Name */}
      <div
        style={{
          padding: '20px',
          backgroundColor: '#F8FAFC',
          borderRadius: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '4px' }}>Display Name</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>{displayName}</div>
          </div>
          <button
            onClick={() => goToStep('identity')}
            style={{ color: '#2B7CF6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >
            Edit
          </button>
        </div>
      </div>

      {/* Role */}
      <div
        style={{
          padding: '20px',
          backgroundColor: '#F8FAFC',
          borderRadius: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '4px' }}>Role</div>
            <div style={{ fontSize: '16px', fontWeight: 500, color: '#1E3A5F' }}>
              {role === 'seeker' ? 'Looking for support' : 'Giving and receiving support'}
            </div>
          </div>
          <button
            onClick={() => goToStep('identity')}
            style={{ color: '#2B7CF6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >
            Edit
          </button>
        </div>
      </div>

      {/* Topics */}
      <div
        style={{
          padding: '20px',
          backgroundColor: '#F8FAFC',
          borderRadius: '12px',
          marginBottom: '32px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', color: '#64748B' }}>Selected Topics ({selectedTopics.length})</div>
          <button
            onClick={() => goToStep('topics')}
            style={{ color: '#2B7CF6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >
            Edit
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {selectedTopics.map((topic) => (
            <span
              key={topic}
              style={{
                padding: '6px 12px',
                backgroundColor: '#EDF4FF',
                color: '#2B7CF6',
                borderRadius: '16px',
                fontSize: '14px',
              }}
            >
              {topic}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={() => goToStep('identity')} style={secondaryButtonStyle}>
          Back
        </button>
        <button
          onClick={handleComplete}
          disabled={isSubmitting}
          style={{
            ...buttonStyle,
            backgroundColor: '#10B981',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? 'Saving...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
      }}
    >
      {currentStep === 'welcome' && renderWelcome()}
      {currentStep === 'topics' && renderTopics()}
      {currentStep === 'ratings' && renderRatings()}
      {currentStep === 'identity' && renderIdentity()}
      {currentStep === 'review' && renderReview()}
    </div>
  );
}
