import { NavLink, useLocation } from 'react-router-dom';

interface BottomNavProps {
  communitySlug: string;
  userRole: 'seeker' | 'helper' | 'both' | 'admin';
  accentColor?: string;
  needsCheckIn?: boolean;
  onCheckInComplete?: () => void;
}

// Inline SVG Icons (24x24 viewbox, filled when active)
const HomeIcon = ({ active }: { active: boolean }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    {!active && <polyline points="9 22 9 12 15 12 15 22" />}
  </svg>
);

const MessagesIcon = ({ active }: { active: boolean }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const CheckInIcon = ({ active }: { active: boolean }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const HelperIcon = ({ active }: { active: boolean }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const SettingsIcon = ({ active }: { active: boolean }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" fill={active ? 'white' : 'none'} />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default function BottomNav({ communitySlug, userRole, accentColor = '#2B7CF6', needsCheckIn = false }: BottomNavProps) {
  const location = useLocation();

  // Hide on chat pages
  if (location.pathname.startsWith('/chat/')) {
    return null;
  }

  // Hide on admin pages
  if (location.pathname.includes('/admin')) {
    return null;
  }

  // Hide on training pages
  if (location.pathname.includes('/training')) {
    return null;
  }

  // Hide on onboarding
  if (location.pathname.includes('/onboarding')) {
    return null;
  }

  const isHelper = userRole === 'helper' || userRole === 'both' || userRole === 'admin';

  // Define tabs based on role
  const tabs = [
    {
      path: `/community/${communitySlug}`,
      label: 'Home',
      Icon: HomeIcon,
      exact: true,
    },
    {
      path: `/community/${communitySlug}/messages`,
      label: 'Messages',
      Icon: MessagesIcon,
      exact: false,
    },
    {
      path: `/community/${communitySlug}/check-in`,
      label: 'Check-In',
      Icon: CheckInIcon,
      exact: false,
      showBadge: needsCheckIn,
    },
    ...(isHelper
      ? [
          {
            path: `/community/${communitySlug}/helper-dashboard`,
            label: 'Helper',
            Icon: HelperIcon,
            exact: false,
          },
        ]
      : []),
    {
      path: `/community/${communitySlug}/settings`,
      label: 'Settings',
      Icon: SettingsIcon,
      exact: false,
    },
  ];

  const isActive = (tabPath: string, exact: boolean) => {
    if (exact) {
      return location.pathname === tabPath;
    }
    // Special case: mood-history and mood-checkin should also highlight Check-In tab
    if (tabPath.endsWith('/check-in')) {
      if (location.pathname.includes('/mood-history') || location.pathname.includes('/mood-checkin') || location.pathname.includes('/check-in')) {
        return true;
      }
    }
    return location.pathname.startsWith(tabPath);
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTop: '1px solid #E2E8F0',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 1000,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: '60px',
        }}
      >
        {tabs.map((tab) => {
          const active = isActive(tab.path, tab.exact);
          const showBadge = 'showBadge' in tab && tab.showBadge;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                height: '100%',
                textDecoration: 'none',
                color: active ? accentColor : '#64748B',
                gap: '4px',
                minWidth: '64px',
                padding: '8px 0',
                WebkitTapHighlightColor: 'transparent',
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative' }}>
                <tab.Icon active={active} />
                {showBadge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-4px',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#EF4444',
                      borderRadius: '50%',
                      border: '2px solid white',
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: active ? 600 : 500,
                  lineHeight: 1,
                }}
              >
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
