import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  UserProfile,
  NotificationSettings,
  Community,
  getProfile,
  updateProfile,
  updateEmergencyContact,
  deleteEmergencyContact,
  changePassword,
  getNotificationSettings,
  updateNotificationSettings,
  testPushNotificationUser,
  getVapidPublicKey,
  subscribeToPushNotifications,
  getCommunities,
  getMembership,
  getCommunity,
} from '../services/api';
import { AxiosError } from 'axios';

const RELATIONSHIP_OPTIONS = [
  'Parent',
  'Spouse/Partner',
  'Sibling',
  'Friend',
  'Other',
];

type SectionKey = 'account' | 'profile' | 'notifications' | 'resources' | 'emergency' | 'privacy';

interface MembershipInfo {
  communitySlug: string;
  communityName: string;
  displayName: string | null;
  role: 'seeker' | 'helper' | 'both' | 'admin';
  topics: string[];
}

export default function SettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { logout, updateUserProfile } = useAuth();
  const navigate = useNavigate();

  // Community context (for community-scoped settings)
  const [community, setCommunity] = useState<Community | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Section collapse states
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(new Set(['account']));

  // Profile data
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Account section
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password section
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Profile section (membership info)
  const [memberships, setMemberships] = useState<MembershipInfo[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(false);

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationSuccess, setNotificationSuccess] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [pushTestResult, setPushTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  // Emergency contact
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [deletingContact, setDeletingContact] = useState(false);

  // Check push notification support
  useEffect(() => {
    const checkPushSupport = () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setPushSupported(supported);
      if (supported) {
        setPushPermission(Notification.permission);
      }
    };
    checkPushSupport();
  }, []);

  // Load profile and notification settings
  useEffect(() => {
    async function loadData() {
      try {
        const [profileData, notifSettings] = await Promise.all([
          getProfile(),
          getNotificationSettings(),
        ]);

        setProfile(profileData);
        setFirstName(profileData.firstName || '');
        setLastName(profileData.lastName || '');

        if (profileData.emergencyContact) {
          setContactName(profileData.emergencyContact.contactName);
          setContactPhone(profileData.emergencyContact.contactPhone);
          setRelationship(profileData.emergencyContact.relationship || '');
        }

        setNotificationSettings(notifSettings);

        // Load community if we're in community-scoped settings
        if (slug) {
          try {
            const communityData = await getCommunity(slug);
            setCommunity(communityData);
          } catch {
            // Community not found or not a member - that's okay
          }
        }
      } catch (err) {
        setError('Failed to load settings');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Load memberships when profile section is expanded
  useEffect(() => {
    if (expandedSections.has('profile') && memberships.length === 0 && !loadingMemberships) {
      loadMemberships();
    }
  }, [expandedSections, memberships.length, loadingMemberships]);

  const loadMemberships = async () => {
    setLoadingMemberships(true);
    try {
      const communities = await getCommunities();
      const membershipPromises = communities.map(async (community) => {
        try {
          const membership = await getMembership(community.slug);
          return {
            communitySlug: community.slug,
            communityName: community.name,
            displayName: membership.display_name || null,
            role: membership.role,
            topics: [], // Topics would require additional API call
          };
        } catch {
          return null;
        }
      });

      const results = await Promise.all(membershipPromises);
      const validMemberships = results.filter((m): m is NonNullable<typeof m> => m !== null);
      setMemberships(validMemberships);
    } catch (err) {
      console.error('Failed to load memberships:', err);
    } finally {
      setLoadingMemberships(false);
    }
  };

  const toggleSection = (section: SectionKey) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    setSavingProfile(true);
    setError('');
    setProfileSuccess(false);

    try {
      const updated = await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
      updateUserProfile(firstName.trim(), lastName.trim());
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setSavingPassword(true);

    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setPasswordError(axiosError.response?.data?.error || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleNotificationToggle = async (key: keyof NotificationSettings) => {
    if (!notificationSettings) return;

    const newValue = !notificationSettings[key];
    setSavingNotifications(true);
    setNotificationSuccess(false);

    try {
      const updated = await updateNotificationSettings({ [key]: newValue });
      setNotificationSettings(updated);
      setNotificationSuccess(true);
      setTimeout(() => setNotificationSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update notification settings:', err);
      setError('Failed to update notification settings');
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleEnablePush = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const vapidKey = await getVapidPublicKey();

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });

        const json = subscription.toJSON();
        await subscribeToPushNotifications(json.endpoint!, {
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
        });

        setPushTestResult({ success: true, message: 'Push notifications enabled!' });
        setTimeout(() => setPushTestResult(null), 3000);
      }
    } catch (err) {
      console.error('Failed to enable push notifications:', err);
      setPushTestResult({ success: false, message: 'Failed to enable push notifications' });
    }
  };

  const handleTestPush = async () => {
    setTestingPush(true);
    setPushTestResult(null);

    try {
      const result = await testPushNotificationUser();
      setPushTestResult(result);
      setTimeout(() => setPushTestResult(null), 5000);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setPushTestResult({
        success: false,
        message: axiosError.response?.data?.error || 'Failed to send test notification',
      });
    } finally {
      setTestingPush(false);
    }
  };

  const handleSaveContact = async (e: FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) {
      setError('Contact name and phone are required');
      return;
    }

    setSavingContact(true);
    setError('');
    setContactSuccess(false);

    try {
      const contact = await updateEmergencyContact({
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        relationship: relationship || undefined,
      });
      setProfile((prev) => (prev ? { ...prev, emergencyContact: contact } : prev));
      setContactSuccess(true);
      setTimeout(() => setContactSuccess(false), 3000);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to save emergency contact');
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!confirm('Are you sure you want to remove your emergency contact?')) return;

    setDeletingContact(true);
    setError('');

    try {
      await deleteEmergencyContact();
      setProfile((prev) => (prev ? { ...prev, emergencyContact: null } : prev));
      setContactName('');
      setContactPhone('');
      setRelationship('');
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to delete emergency contact');
    } finally {
      setDeletingContact(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    fontSize: '15px',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s',
  };

  const sectionStyle = {
    backgroundColor: 'white',
    borderRadius: '16px',
    marginBottom: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  };

  const sectionHeaderStyle = {
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none' as const,
  };

  const sectionContentStyle = {
    padding: '0 20px 20px',
  };

  const toggleStyle = (isOn: boolean) => ({
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    backgroundColor: isOn ? '#2B7CF6' : '#E2E8F0',
    position: 'relative' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  });

  const toggleKnobStyle = (isOn: boolean) => ({
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'white',
    position: 'absolute' as const,
    top: '2px',
    left: isOn ? '22px' : '2px',
    transition: 'left 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  });

  const formatRole = (role: string) => {
    const roles: Record<string, string> = {
      seeker: 'Support Seeker',
      helper: 'Peer Helper',
      both: 'Seeker & Helper',
      admin: 'Administrator',
    };
    return roles[role] || role;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748B' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #E2E8F0', padding: '16px 24px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/peerzle-icon.svg" alt="Peerzle" style={{ width: '32px', height: '32px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>Settings</h1>
              {community && (
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                  {community.name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              padding: '8px 12px',
              backgroundColor: 'white',
              color: '#64748B',
              border: '1px solid #E2E8F0',
              borderRadius: '24px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
            {error}
            <button
              onClick={() => setError('')}
              style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontWeight: 'bold' }}
            >
              x
            </button>
          </div>
        )}

        {/* Account Section */}
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle} onClick={() => toggleSection('account')}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#1E3A5F' }}>Account</h2>
            <span style={{ color: '#64748B', fontSize: '20px' }}>{expandedSections.has('account') ? '−' : '+'}</span>
          </div>
          {expandedSections.has('account') && (
            <div style={sectionContentStyle}>
              <form onSubmit={handleSaveProfile}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      maxLength={100}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      maxLength={100}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    style={{ ...inputStyle, backgroundColor: '#F8FAFC', color: '#64748B' }}
                  />
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Email cannot be changed</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#2B7CF6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '24px',
                      cursor: savingProfile ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      opacity: savingProfile ? 0.7 : 1,
                    }}
                  >
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                  {profileSuccess && (
                    <span style={{ color: '#16A34A', fontSize: '14px', fontWeight: 500 }}>Saved!</span>
                  )}
                </div>
              </form>

              {/* Change Password */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600, color: '#475569' }}>Change Password</h3>
                <form onSubmit={handleChangePassword}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  {passwordError && (
                    <p style={{ color: '#DC2626', fontSize: '14px', margin: '0 0 12px 0' }}>{passwordError}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="submit"
                      disabled={savingPassword}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: 'white',
                        color: '#2B7CF6',
                        border: '1px solid #2B7CF6',
                        borderRadius: '24px',
                        cursor: savingPassword ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 600,
                        opacity: savingPassword ? 0.7 : 1,
                      }}
                    >
                      {savingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                    {passwordSuccess && (
                      <span style={{ color: '#16A34A', fontSize: '14px', fontWeight: 500 }}>Password updated!</span>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>

        {/* Profile Section */}
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle} onClick={() => toggleSection('profile')}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#1E3A5F' }}>Profile</h2>
            <span style={{ color: '#64748B', fontSize: '20px' }}>{expandedSections.has('profile') ? '−' : '+'}</span>
          </div>
          {expandedSections.has('profile') && (
            <div style={sectionContentStyle}>
              {loadingMemberships ? (
                <p style={{ color: '#64748B', fontSize: '14px' }}>Loading community profiles...</p>
              ) : memberships.length === 0 ? (
                <p style={{ color: '#64748B', fontSize: '14px' }}>
                  You haven't joined any communities yet.{' '}
                  <Link to="/communities" style={{ color: '#2B7CF6' }}>Browse communities</Link>
                </p>
              ) : (
                <div>
                  <p style={{ color: '#64748B', fontSize: '14px', margin: '0 0 16px 0' }}>
                    Your display name and topics are set per community during onboarding.
                  </p>
                  {memberships.map((m) => (
                    <div
                      key={m.communitySlug}
                      style={{
                        padding: '16px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '12px',
                        marginBottom: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1E3A5F' }}>
                          {m.communityName}
                        </h4>
                        <span
                          style={{
                            fontSize: '12px',
                            padding: '4px 8px',
                            backgroundColor: '#E2E8F0',
                            borderRadius: '12px',
                            color: '#475569',
                          }}
                        >
                          {formatRole(m.role)}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#475569' }}>
                        <strong>Display Name:</strong> {m.displayName || 'Not set'}
                      </p>
                      <button
                        onClick={() => navigate(`/community/${m.communitySlug}/onboarding`)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'white',
                          color: '#2B7CF6',
                          border: '1px solid #E2E8F0',
                          borderRadius: '20px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 500,
                        }}
                      >
                        Update Profile
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Notifications Section */}
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle} onClick={() => toggleSection('notifications')}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#1E3A5F' }}>Notifications</h2>
            <span style={{ color: '#64748B', fontSize: '20px' }}>{expandedSections.has('notifications') ? '−' : '+'}</span>
          </div>
          {expandedSections.has('notifications') && (
            <div style={sectionContentStyle}>
              {notificationSettings && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1E3A5F' }}>Daily Mood Check-in</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                        Receive a daily reminder to check in on how you're feeling
                      </p>
                    </div>
                    <div
                      style={toggleStyle(notificationSettings.moodCheckinNotifications)}
                      onClick={() => !savingNotifications && handleNotificationToggle('moodCheckinNotifications')}
                    >
                      <div style={toggleKnobStyle(notificationSettings.moodCheckinNotifications)} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1E3A5F' }}>Helper Match Alerts</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                        Get notified when you're matched with a helper
                      </p>
                    </div>
                    <div
                      style={toggleStyle(notificationSettings.helperMatchNotifications)}
                      onClick={() => !savingNotifications && handleNotificationToggle('helperMatchNotifications')}
                    >
                      <div style={toggleKnobStyle(notificationSettings.helperMatchNotifications)} />
                    </div>
                  </div>

                  {notificationSuccess && (
                    <p style={{ color: '#16A34A', fontSize: '14px', margin: '0 0 16px 0' }}>Settings saved!</p>
                  )}
                </>
              )}

              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 500, color: '#1E3A5F' }}>
                  Push Notifications
                </p>
                {!pushSupported ? (
                  <p style={{ color: '#64748B', fontSize: '14px' }}>
                    Push notifications are not supported in this browser.
                  </p>
                ) : pushPermission === 'denied' ? (
                  <p style={{ color: '#DC2626', fontSize: '14px' }}>
                    Push notifications are blocked. Please enable them in your browser settings.
                  </p>
                ) : pushPermission === 'default' ? (
                  <button
                    onClick={handleEnablePush}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#2B7CF6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '24px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    Enable Push Notifications
                  </button>
                ) : (
                  <button
                    onClick={handleTestPush}
                    disabled={testingPush}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: 'white',
                      color: '#2B7CF6',
                      border: '1px solid #2B7CF6',
                      borderRadius: '24px',
                      cursor: testingPush ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      opacity: testingPush ? 0.7 : 1,
                    }}
                  >
                    {testingPush ? 'Sending...' : 'Send Test Notification'}
                  </button>
                )}
                {pushTestResult && (
                  <p style={{ color: pushTestResult.success ? '#16A34A' : '#DC2626', fontSize: '14px', marginTop: '12px' }}>
                    {pushTestResult.message}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Resources Section */}
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle} onClick={() => toggleSection('resources')}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#1E3A5F' }}>Resources</h2>
            <span style={{ color: '#64748B', fontSize: '20px' }}>{expandedSections.has('resources') ? '−' : '+'}</span>
          </div>
          {expandedSections.has('resources') && (
            <div style={sectionContentStyle}>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748B' }}>
                If you or someone you know is in crisis, these resources are available 24/7.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 988 Lifeline */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#EDF4FF',
                    borderRadius: '12px',
                    borderLeft: '4px solid #2B7CF6',
                  }}
                >
                  <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: '#1E3A5F', fontSize: '15px' }}>
                    988 Suicide & Crisis Lifeline
                  </p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#2B7CF6', fontWeight: 500 }}>
                    Call or text 988
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                    Free, confidential support 24/7
                  </p>
                </div>

                {/* Crisis Text Line */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '12px',
                  }}
                >
                  <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: '#1E3A5F', fontSize: '15px' }}>
                    Crisis Text Line
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>
                    Text HOME to 741741
                  </p>
                </div>

                {/* Veterans Crisis Line */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#F0FDF4',
                    borderRadius: '12px',
                    borderLeft: '4px solid #16A34A',
                  }}
                >
                  <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: '#1E3A5F', fontSize: '15px' }}>
                    Veterans Crisis Line
                  </p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#16A34A', fontWeight: 500 }}>
                    Call 988, Press 1
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                    Free, confidential support for Veterans 24/7
                  </p>
                </div>

                {/* Emergency */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#FEF2F2',
                    borderRadius: '12px',
                  }}
                >
                  <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: '#1E3A5F', fontSize: '15px' }}>
                    Emergency Services
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#DC2626', fontWeight: 500 }}>
                    Call 911
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Emergency Contact Section */}
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle} onClick={() => toggleSection('emergency')}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#1E3A5F' }}>Emergency Contact</h2>
            <span style={{ color: '#64748B', fontSize: '20px' }}>{expandedSections.has('emergency') ? '−' : '+'}</span>
          </div>
          {expandedSections.has('emergency') && (
            <div style={sectionContentStyle}>
              <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748B' }}>
                In case we're ever worried about you, is there someone we can reach?
              </p>

              <form onSubmit={handleSaveContact}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g., Mom, John Smith"
                    maxLength={200}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="e.g., (555) 123-4567"
                    maxLength={20}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                    Relationship
                  </label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">Select relationship (optional)</option>
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="submit"
                    disabled={savingContact || !contactName.trim() || !contactPhone.trim()}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#2B7CF6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '24px',
                      cursor: savingContact || !contactName.trim() || !contactPhone.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      opacity: savingContact || !contactName.trim() || !contactPhone.trim() ? 0.5 : 1,
                    }}
                  >
                    {savingContact ? 'Saving...' : profile?.emergencyContact ? 'Update Contact' : 'Save Contact'}
                  </button>
                  {profile?.emergencyContact && (
                    <button
                      type="button"
                      onClick={handleDeleteContact}
                      disabled={deletingContact}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: 'white',
                        color: '#DC2626',
                        border: '1px solid #FCA5A5',
                        borderRadius: '24px',
                        cursor: deletingContact ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        opacity: deletingContact ? 0.7 : 1,
                      }}
                    >
                      {deletingContact ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                  {contactSuccess && (
                    <span style={{ color: '#16A34A', fontSize: '14px', fontWeight: 500 }}>Saved!</span>
                  )}
                </div>
              </form>
            </div>
          )}
        </section>

        {/* Privacy Section */}
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle} onClick={() => toggleSection('privacy')}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#1E3A5F' }}>Privacy</h2>
            <span style={{ color: '#64748B', fontSize: '20px' }}>{expandedSections.has('privacy') ? '−' : '+'}</span>
          </div>
          {expandedSections.has('privacy') && (
            <div style={sectionContentStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Link
                  to="/terms"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    color: '#1E3A5F',
                    fontSize: '15px',
                  }}
                >
                  <span>Terms of Service</span>
                  <span style={{ color: '#64748B' }}>&rarr;</span>
                </Link>
                <Link
                  to="/privacy"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    color: '#1E3A5F',
                    fontSize: '15px',
                  }}
                >
                  <span>Privacy Policy</span>
                  <span style={{ color: '#64748B' }}>&rarr;</span>
                </Link>
                {memberships.length > 0 && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#64748B' }}>
                    View past conversations in your{' '}
                    <Link to={`/community/${memberships[0].communitySlug}/messages`} style={{ color: '#2B7CF6' }}>
                      Messages
                    </Link>
                    .
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <Link
            to="/communities"
            style={{ color: '#2B7CF6', fontSize: '14px', textDecoration: 'none' }}
          >
            &larr; Back to Communities
          </Link>
        </div>
      </main>
    </div>
  );
}
