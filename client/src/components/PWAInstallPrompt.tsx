import { useState, useEffect } from 'react';

interface PWAInstallPromptProps {
  isIOS: boolean;
  canUseNativePrompt: boolean;
  onDismiss: () => void;
  onNativeInstall: () => Promise<void>;
}

// Safari Share icon
const ShareIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#2B7CF6"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

// Add to Home Screen icon (plus in square)
const AddIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#2B7CF6"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

// Home screen icon
const HomeIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#2B7CF6"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const steps = [
  {
    icon: <ShareIcon />,
    title: 'Tap the Share button',
    description: 'Look for the share icon at the bottom of Safari.',
  },
  {
    icon: <AddIcon />,
    title: 'Tap "Add to Home Screen"',
    description: 'Scroll down in the share menu to find this option.',
  },
  {
    icon: <HomeIcon />,
    title: 'Tap "Add"',
    description: 'Peerzle will appear on your home screen.',
  },
];

export default function PWAInstallPrompt({
  isIOS,
  canUseNativePrompt,
  onDismiss,
  onNativeInstall,
}: PWAInstallPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300); // Wait for animation
  };

  const handleInstall = async () => {
    setIsInstalling(true);
    await onNativeInstall();
    setIsInstalling(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1001,
        transition: 'background-color 0.3s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          backgroundColor: 'white',
          borderRadius: '24px 24px 0 0',
          padding: '16px 24px',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 30px rgba(0, 0, 0, 0.15)',
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: '36px',
            height: '4px',
            backgroundColor: '#E2E8F0',
            borderRadius: '2px',
            margin: '0 auto 20px',
          }}
        />

        {/* Header */}
        <h2
          style={{
            margin: '0 0 8px 0',
            fontSize: '22px',
            fontWeight: 600,
            color: '#1E3A5F',
            textAlign: 'center',
          }}
        >
          Install Peerzle
        </h2>
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: '#64748B',
            textAlign: 'center',
          }}
        >
          Add Peerzle to your home screen for the best experience.
        </p>

        {/* iOS Instructions */}
        {isIOS && !canUseNativePrompt && (
          <div style={{ marginBottom: '24px' }}>
            {steps.map((step, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '12px 16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  marginBottom: index < steps.length - 1 ? '8px' : '0',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#EDF4FF',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {step.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#1E3A5F',
                      marginBottom: '2px',
                    }}
                  >
                    {step.title}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#64748B',
                      lineHeight: 1.4,
                    }}
                  >
                    {step.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Android/Chrome Native Prompt */}
        {canUseNativePrompt && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#2B7CF6',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: isInstalling ? 'not-allowed' : 'pointer',
                opacity: isInstalling ? 0.7 : 1,
                transition: 'background-color 0.2s',
                marginBottom: '12px',
              }}
              onMouseOver={(e) => {
                if (!isInstalling) {
                  e.currentTarget.style.backgroundColor = '#1E6AD9';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#2B7CF6';
              }}
            >
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
            <button
              onClick={handleDismiss}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                color: '#64748B',
                border: 'none',
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Not now
            </button>
          </div>
        )}

        {/* iOS Dismiss Button */}
        {isIOS && !canUseNativePrompt && (
          <button
            onClick={handleDismiss}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#2B7CF6',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1E6AD9';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2B7CF6';
            }}
          >
            Got it
          </button>
        )}

        {/* Android without native prompt - show instructions too */}
        {!isIOS && !canUseNativePrompt && (
          <button
            onClick={handleDismiss}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#2B7CF6',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1E6AD9';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2B7CF6';
            }}
          >
            Got it
          </button>
        )}
      </div>
    </div>
  );
}
