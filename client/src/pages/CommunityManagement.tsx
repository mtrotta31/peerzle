import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  SuperAdminCommunity,
  CommunityTopic,
  Organization,
  InviteCode,
  getSuperAdminCommunity,
  getSuperAdminCommunityTopics,
  getSuperAdminCommunityOrganizations,
  updateCommunity,
  addCommunityTopic,
  updateCommunityTopic,
  deleteCommunityTopic,
  getInviteCodes,
  createInviteCode,
  updateInviteCode,
  createOrganization,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

type Tab = 'overview' | 'topics' | 'inviteCodes' | 'organizations' | 'settings';

export default function CommunityManagement() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [community, setCommunity] = useState<SuperAdminCommunity | null>(null);
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Topic editing
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');
  const [addingTopic, setAddingTopic] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [editTopicName, setEditTopicName] = useState('');
  const [editTopicDescription, setEditTopicDescription] = useState('');

  // Invite code creation
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);
  const [inviteCodeOrgId, setInviteCodeOrgId] = useState<string>('');
  const [inviteCodeMaxUses, setInviteCodeMaxUses] = useState<string>('');
  const [creatingInviteCode, setCreatingInviteCode] = useState(false);

  // Organization creation
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  // Settings editing
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editHelperTerm, setEditHelperTerm] = useState('');
  const [editSeekerTerm, setEditSeekerTerm] = useState('');
  const [editVerificationMethod, setEditVerificationMethod] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  // Redirect non-super-admins
  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      navigate('/');
    }
  }, [user, navigate]);

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      try {
        setLoading(true);
        const [communityData, topicsData, orgsData, codesData] = await Promise.all([
          getSuperAdminCommunity(slug),
          getSuperAdminCommunityTopics(slug),
          getSuperAdminCommunityOrganizations(slug),
          getInviteCodes(slug),
        ]);
        setCommunity(communityData);
        setTopics(topicsData);
        setOrganizations(orgsData);
        setInviteCodes(codesData);

        // Initialize settings form
        setEditName(communityData.name);
        setEditDescription(communityData.description || '');
        setEditHelperTerm(communityData.terminology?.helper || 'Peer Support Specialist');
        setEditSeekerTerm(communityData.terminology?.seeker || 'Member');
        setEditVerificationMethod(communityData.verificationMethod);
      } catch (err) {
        setError('Failed to load community');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (user?.isSuperAdmin) {
      loadData();
    }
  }, [slug, user]);

  const handleAddTopic = async () => {
    if (!slug || !newTopicName.trim()) return;
    setAddingTopic(true);
    try {
      const newTopic = await addCommunityTopic(slug, {
        name: newTopicName.trim(),
        description: newTopicDescription.trim() || undefined,
      });
      setTopics([...topics, newTopic]);
      setNewTopicName('');
      setNewTopicDescription('');
    } catch (err) {
      console.error(err);
    } finally {
      setAddingTopic(false);
    }
  };

  const handleUpdateTopic = async (topicId: number) => {
    if (!slug) return;
    try {
      const updated = await updateCommunityTopic(slug, topicId, {
        name: editTopicName,
        description: editTopicDescription || undefined,
      });
      setTopics(topics.map((t) => (t.id === topicId ? updated : t)));
      setEditingTopicId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTopic = async (topicId: number) => {
    if (!slug || !confirm('Are you sure you want to delete this topic?')) return;
    try {
      await deleteCommunityTopic(slug, topicId);
      setTopics(topics.filter((t) => t.id !== topicId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async () => {
    if (!slug) return;
    setSavingSettings(true);
    setSettingsMessage('');
    try {
      await updateCommunity(slug, {
        name: editName,
        description: editDescription,
        terminology: {
          helperTerm: editHelperTerm,
          seekerTerm: editSeekerTerm,
        },
        verificationMethod: editVerificationMethod,
      });
      setSettingsMessage('Settings saved successfully');
      if (community) {
        setCommunity({
          ...community,
          name: editName,
          description: editDescription,
          terminology: { helper: editHelperTerm, seeker: editSeekerTerm },
          verificationMethod: editVerificationMethod,
        });
      }
    } catch (err) {
      setSettingsMessage('Failed to save settings');
      console.error(err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateInviteCode = async () => {
    if (!slug) return;
    setCreatingInviteCode(true);
    try {
      const newCode = await createInviteCode(slug, {
        maxUses: inviteCodeMaxUses ? parseInt(inviteCodeMaxUses) : undefined,
        organizationId: inviteCodeOrgId || undefined,
      });
      setInviteCodes([newCode, ...inviteCodes]);
      setShowInviteCodeModal(false);
      setInviteCodeOrgId('');
      setInviteCodeMaxUses('');
    } catch (err) {
      console.error('Failed to create invite code:', err);
    } finally {
      setCreatingInviteCode(false);
    }
  };

  const handleToggleInviteCode = async (codeId: number, isActive: boolean) => {
    if (!slug) return;
    try {
      const updated = await updateInviteCode(slug, codeId, isActive);
      setInviteCodes(inviteCodes.map((c) => (c.id === codeId ? updated : c)));
    } catch (err) {
      console.error('Failed to update invite code:', err);
    }
  };

  const handleCreateOrganization = async () => {
    if (!slug || !newOrgName.trim()) return;
    setCreatingOrg(true);
    try {
      const newOrg = await createOrganization(slug, {
        name: newOrgName.trim(),
        primaryContactEmail: newOrgEmail.trim() || undefined,
      });
      setOrganizations([newOrg, ...organizations]);
      setShowCreateOrgModal(false);
      setNewOrgName('');
      setNewOrgEmail('');
    } catch (err) {
      console.error('Failed to create organization:', err);
    } finally {
      setCreatingOrg(false);
    }
  };

  const getCodeStatus = (code: InviteCode) => {
    if (!code.is_active) return { label: 'Inactive', color: '#94A3B8', bg: '#F1F5F9' };
    if (code.expires_at && new Date(code.expires_at) < new Date()) return { label: 'Expired', color: '#DC2626', bg: '#FEE2E2' };
    if (code.max_uses && code.current_uses >= code.max_uses) return { label: 'Used Up', color: '#D97706', bg: '#FEF3C7' };
    return { label: 'Active', color: '#16A34A', bg: '#DCFCE7' };
  };

  if (!user?.isSuperAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!community) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <p>Community not found</p>
        <Link to="/super-admin">Back to Admin</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #E2E8F0',
          padding: '16px 24px',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Link to="/super-admin" style={{ color: '#64748B', textDecoration: 'none', fontSize: '14px' }}>
              &#8592; Back to Admin
            </Link>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#1E3A5F' }}>
                {community.name}
              </h1>
              <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '14px' }}>
                /{community.slug}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '16px', color: '#64748B', fontSize: '14px' }}>
              <span><strong>{community.memberCount}</strong> members</span>
              <span><strong>{community.orgCount}</strong> orgs</span>
              <span><strong>{community.conversationCount}</strong> conversations</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {(['overview', 'topics', 'inviteCodes', 'organizations', 'settings'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                backgroundColor: activeTab === tab ? '#2B7CF6' : 'transparent',
                color: activeTab === tab ? 'white' : '#64748B',
                border: activeTab === tab ? 'none' : '1px solid #E2E8F0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              {tab === 'inviteCodes' ? 'Invite Codes' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ padding: '12px', backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: '8px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #E2E8F0' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>Community Overview</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
              <div>
                <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>Description</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '15px' }}>{community.description || 'No description'}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>Access Method</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '15px', textTransform: 'capitalize' }}>
                  {community.verificationMethod.replace('_', ' ')}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>Helper Term</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '15px' }}>{community.terminology?.helper || 'Peer Support Specialist'}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>Member Term</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '15px' }}>{community.terminology?.seeker || 'Member'}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>Created</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '15px' }}>{new Date(community.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Topics Tab */}
        {activeTab === 'topics' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #E2E8F0' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>Topics</h2>

            {/* Topic List */}
            <div style={{ marginBottom: '24px' }}>
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '8px',
                    marginBottom: '8px',
                  }}
                >
                  {editingTopicId === topic.id ? (
                    <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                      <input
                        type="text"
                        value={editTopicName}
                        onChange={(e) => setEditTopicName(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #E2E8F0',
                          borderRadius: '6px',
                          fontSize: '14px',
                        }}
                      />
                      <input
                        type="text"
                        value={editTopicDescription}
                        onChange={(e) => setEditTopicDescription(e.target.value)}
                        placeholder="Description"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #E2E8F0',
                          borderRadius: '6px',
                          fontSize: '14px',
                        }}
                      />
                      <button
                        onClick={() => handleUpdateTopic(topic.id)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#2B7CF6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingTopicId(null)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'transparent',
                          color: '#64748B',
                          border: '1px solid #E2E8F0',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span style={{ fontWeight: 500, fontSize: '14px' }}>{topic.name}</span>
                        {topic.description && (
                          <span style={{ color: '#64748B', fontSize: '13px', marginLeft: '8px' }}>
                            - {topic.description}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setEditingTopicId(topic.id);
                            setEditTopicName(topic.name);
                            setEditTopicDescription(topic.description || '');
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'transparent',
                            color: '#2B7CF6',
                            border: '1px solid #2B7CF6',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTopic(topic.id)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'transparent',
                            color: '#DC2626',
                            border: '1px solid #DC2626',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {topics.length === 0 && (
                <p style={{ color: '#64748B', textAlign: 'center', padding: '24px' }}>
                  No topics yet. Add one below.
                </p>
              )}
            </div>

            {/* Add Topic */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Add Topic</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="Topic name"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
                <input
                  type="text"
                  value={newTopicDescription}
                  onChange={(e) => setNewTopicDescription(e.target.value)}
                  placeholder="Description (optional)"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
                <button
                  onClick={handleAddTopic}
                  disabled={!newTopicName.trim() || addingTopic}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2B7CF6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    opacity: !newTopicName.trim() || addingTopic ? 0.5 : 1,
                  }}
                >
                  {addingTopic ? 'Adding...' : 'Add Topic'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invite Codes Tab */}
        {activeTab === 'inviteCodes' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Invite Codes</h2>
              <button
                onClick={() => setShowInviteCodeModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Generate Code
              </button>
            </div>

            {inviteCodes.length === 0 ? (
              <p style={{ color: '#64748B', textAlign: 'center', padding: '24px' }}>
                No invite codes yet. Generate one to invite members.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Code</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Organization</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Uses</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inviteCodes.map((code) => {
                      const status = getCodeStatus(code);
                      return (
                        <tr key={code.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: '14px', fontWeight: 600 }}>{code.code}</td>
                          <td style={{ padding: '12px 8px', fontSize: '14px', color: '#64748B' }}>
                            {code.organization_name || 'General'}
                          </td>
                          <td style={{ padding: '12px 8px', fontSize: '14px', color: '#64748B' }}>
                            {code.current_uses}{code.max_uses ? ` / ${code.max_uses}` : ''}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{ padding: '2px 8px', backgroundColor: status.bg, color: status.color, borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>
                              {status.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <button
                              onClick={() => handleToggleInviteCode(code.id, !code.is_active)}
                              style={{
                                padding: '4px 12px',
                                backgroundColor: 'transparent',
                                color: code.is_active ? '#DC2626' : '#16A34A',
                                border: `1px solid ${code.is_active ? '#DC2626' : '#16A34A'}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              {code.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Organizations Tab */}
        {activeTab === 'organizations' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Organizations</h2>
              <button
                onClick={() => setShowCreateOrgModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Create Organization
              </button>
            </div>

            {organizations.length === 0 ? (
              <p style={{ color: '#64748B', textAlign: 'center', padding: '24px' }}>
                No organizations yet. Create one to group members.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    onClick={() => navigate(`/community/${slug}/org/${org.slug}/admin`)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 500 }}>{org.name}</h3>
                      <span style={{ color: '#64748B', fontSize: '13px' }}>/{org.slug}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <span style={{ color: '#64748B', fontSize: '13px' }}>
                        {org.memberCount || 0} members
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          backgroundColor: org.isActive ? '#DCFCE7' : '#FEE2E2',
                          color: org.isActive ? '#16A34A' : '#DC2626',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        {org.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span style={{ color: '#64748B' }}>&#8594;</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #E2E8F0' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: 600 }}>Community Settings</h2>

            {settingsMessage && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: settingsMessage.includes('success') ? '#DCFCE7' : '#FEE2E2',
                  color: settingsMessage.includes('success') ? '#16A34A' : '#DC2626',
                  borderRadius: '8px',
                  marginBottom: '16px',
                }}
              >
                {settingsMessage}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Community Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Access Method
                </label>
                <select
                  value={editVerificationMethod}
                  onChange={(e) => setEditVerificationMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                  }}
                >
                  <option value="invite_code">Invite Code Only</option>
                  <option value="email_domain">Email Domain</option>
                  <option value="open">Open Access</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Helper Term
                </label>
                <input
                  type="text"
                  value={editHelperTerm}
                  onChange={(e) => setEditHelperTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Member Term
                </label>
                <input
                  type="text"
                  value={editSeekerTerm}
                  onChange={(e) => setEditSeekerTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  alignSelf: 'flex-start',
                  opacity: savingSettings ? 0.5 : 1,
                }}
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invite Code Modal */}
      {showInviteCodeModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowInviteCodeModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600 }}>Generate Invite Code</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Organization (optional)
              </label>
              <select
                value={inviteCodeOrgId}
                onChange={(e) => setInviteCodeOrgId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                }}
              >
                <option value="">General (no organization)</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Max Uses (optional)
              </label>
              <input
                type="number"
                value={inviteCodeMaxUses}
                onChange={(e) => setInviteCodeMaxUses(e.target.value)}
                placeholder="Unlimited"
                min="1"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowInviteCodeModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInviteCode}
                disabled={creatingInviteCode}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  opacity: creatingInviteCode ? 0.5 : 1,
                }}
              >
                {creatingInviteCode ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateOrgModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowCreateOrgModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600 }}>Create Organization</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Organization Name *
              </label>
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="e.g., City Fire Department"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                Contact Email (optional)
              </label>
              <input
                type="email"
                value={newOrgEmail}
                onChange={(e) => setNewOrgEmail(e.target.value)}
                placeholder="admin@organization.com"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateOrgModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrganization}
                disabled={!newOrgName.trim() || creatingOrg}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  opacity: !newOrgName.trim() || creatingOrg ? 0.5 : 1,
                }}
              >
                {creatingOrg ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
