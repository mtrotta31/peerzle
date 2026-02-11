import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  UserProfile,
  getProfile,
  updateProfile,
  updateEmergencyContact,
  deleteEmergencyContact,
} from '../services/api';
import { AxiosError } from 'axios';

const RELATIONSHIP_OPTIONS = [
  'Parent',
  'Spouse/Partner',
  'Sibling',
  'Friend',
  'Other',
];

export default function ProfilePage() {
  const { logout, updateUserProfile } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Personal info form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Emergency contact form
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [deletingContact, setDeletingContact] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getProfile();
        setProfile(data);
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        if (data.emergencyContact) {
          setContactName(data.emergencyContact.contactName);
          setContactPhone(data.emergencyContact.contactPhone);
          setRelationship(data.emergencyContact.relationship || '');
        }
      } catch (err) {
        setError('Failed to load profile');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

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
            <Link to="/communities">
              <img src="/peerzle-icon.svg" alt="Peerzle" style={{ width: '32px', height: '32px' }} />
            </Link>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>Profile Settings</h1>
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
          </div>
        )}

        {/* Personal Info Section */}
        <section style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '17px', fontWeight: 600, color: '#1E3A5F' }}>Personal Information</h2>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
        </section>

        {/* Emergency Contact Section */}
        <section style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 600, color: '#1E3A5F' }}>Emergency Contact</h2>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
        </section>

        {/* Back link */}
        <div style={{ textAlign: 'center' }}>
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
