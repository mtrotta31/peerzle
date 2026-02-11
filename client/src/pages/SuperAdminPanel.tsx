import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlatformOverview,
  SuperAdminCommunity,
  SuperAdminOrganization,
  WebhookConfig,
  WebhookDelivery,
  getSuperAdminOverview,
  getSuperAdminCommunities,
  getSuperAdminOrganizations,
  createCommunity,
  CreateCommunityData,
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookDeliveries,
  getWebhookCommunities,
  getWebhookOrganizations,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

// Topic templates
const TOPIC_TEMPLATES = {
  first_responders: [
    { name: 'Critical Incident Stress', description: 'Processing traumatic calls and events' },
    { name: 'PTSD & Trauma', description: 'Managing post-traumatic stress symptoms' },
    { name: 'Work-Life Balance', description: 'Balancing demanding work with personal life' },
    { name: 'Relationship Challenges', description: 'Navigating relationships affected by the job' },
    { name: 'Substance Use', description: 'Coping with or recovering from substance use' },
    { name: 'LODD Grief', description: 'Processing line-of-duty death grief' },
    { name: 'Career Transition', description: 'Retiring or changing careers' },
    { name: 'General Support', description: 'Any topic not listed above' },
  ],
  healthcare: [
    { name: 'Burnout', description: 'Managing exhaustion and disengagement' },
    { name: 'Compassion Fatigue', description: 'When caring takes its toll' },
    { name: 'Moral Injury', description: 'Processing ethical conflicts at work' },
    { name: 'Work-Life Balance', description: 'Finding time for yourself' },
    { name: 'Patient Loss & Grief', description: 'Coping with patient deaths' },
    { name: 'Substance Use', description: 'Coping with or recovering from substance use' },
    { name: 'Career Transition', description: 'Changing roles or leaving healthcare' },
    { name: 'General Support', description: 'Any topic not listed above' },
  ],
  veterans: [
    { name: 'Combat Stress', description: 'Processing combat experiences' },
    { name: 'Transition to Civilian Life', description: 'Adjusting after service' },
    { name: 'PTSD & Trauma', description: 'Managing post-traumatic stress symptoms' },
    { name: 'Relationship Challenges', description: 'Navigating relationships' },
    { name: 'Substance Use', description: 'Coping with or recovering from substance use' },
    { name: 'Career & Education', description: 'Finding purpose after service' },
    { name: 'Grief & Loss', description: 'Processing loss of fellow service members' },
    { name: 'General Support', description: 'Any topic not listed above' },
  ],
  education: [
    { name: 'Academic Pressure', description: 'Managing coursework and expectations' },
    { name: 'Belonging & Community', description: 'Finding your place' },
    { name: 'Burnout', description: 'Feeling overwhelmed and exhausted' },
    { name: 'Family Pressure', description: 'Navigating family expectations' },
    { name: 'Financial Stress', description: 'Managing money concerns' },
    { name: 'Homesickness', description: 'Missing home and family' },
    { name: 'Loneliness', description: 'Feeling isolated or disconnected' },
    { name: 'Relationship Stress', description: 'Navigating friendships and romance' },
    { name: 'Social Anxiety', description: 'Difficulty in social situations' },
    { name: 'General Support', description: 'Any topic not listed above' },
  ],
  employee_wellness: [
    { name: 'Burnout', description: 'Managing exhaustion and disengagement at work' },
    { name: 'Work-Life Balance', description: 'Balancing professional and personal demands' },
    { name: 'Workplace Conflict', description: 'Navigating difficult coworker or team dynamics' },
    { name: 'Career Anxiety', description: 'Worries about job security or advancement' },
    { name: 'Imposter Syndrome', description: 'Feeling like you don\'t belong or aren\'t qualified' },
    { name: 'Financial Stress', description: 'Managing money and compensation concerns' },
    { name: 'Manager Challenges', description: 'Dealing with difficult leadership or feedback' },
    { name: 'General Support', description: 'Any topic not listed above' },
  ],
};

type Tab = 'communities' | 'organizations' | 'webhooks';
type CreateStep = 1 | 2 | 3 | 4;
type EventType = 'crisis_alert' | 'high_severity_alert' | 'user_report';

export default function SuperAdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('communities');
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [communities, setCommunities] = useState<SuperAdminCommunity[]>([]);
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create community modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<CreateStep>(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdCommunity, setCreatedCommunity] = useState<SuperAdminCommunity | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTopics, setFormTopics] = useState<{ name: string; description: string }[]>([]);
  const [formVerificationMethod, setFormVerificationMethod] = useState<'invite_code' | 'email_domain' | 'open'>('invite_code');
  const [formHelperTerm, setFormHelperTerm] = useState('Peer Support Specialist');
  const [formSeekerTerm, setFormSeekerTerm] = useState('Member');
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');

  // Webhook state
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [webhookCommunities, setWebhookCommunities] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [webhookOrganizations, setWebhookOrganizations] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookError, setWebhookError] = useState('');
  const [createdSecretKey, setCreatedSecretKey] = useState<string | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Webhook form state
  const [webhookCommunityId, setWebhookCommunityId] = useState('');
  const [webhookOrgId, setWebhookOrgId] = useState<string>('');
  const [webhookEventType, setWebhookEventType] = useState<EventType>('crisis_alert');
  const [webhookEndpointUrl, setWebhookEndpointUrl] = useState('');
  const [webhookIncludePii, setWebhookIncludePii] = useState(false);
  const [webhookIsActive, setWebhookIsActive] = useState(true);

  // Delivery log state
  const [showDeliveryLog, setShowDeliveryLog] = useState(false);
  const [selectedWebhookForLog, setSelectedWebhookForLog] = useState<WebhookConfig | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [deliveryTotalPages, setDeliveryTotalPages] = useState(1);

  // Redirect non-super-admins
  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      navigate('/');
    }
  }, [user, navigate]);

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [overviewData, communitiesData, orgsData, webhooksData, webhookCommunitiesData] = await Promise.all([
          getSuperAdminOverview(),
          getSuperAdminCommunities(),
          getSuperAdminOrganizations(),
          getWebhooks(),
          getWebhookCommunities(),
        ]);
        setOverview(overviewData);
        setCommunities(communitiesData);
        setOrganizations(orgsData);
        setWebhooks(webhooksData);
        setWebhookCommunities(webhookCommunitiesData);
      } catch (err) {
        setError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (user?.isSuperAdmin) {
      loadData();
    }
  }, [user]);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormName(name);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setFormSlug(slug);
  };

  const handleApplyTemplate = (templateKey: keyof typeof TOPIC_TEMPLATES) => {
    setFormTopics(TOPIC_TEMPLATES[templateKey].map(t => ({ ...t })));
  };

  const handleAddTopic = () => {
    if (!newTopicName.trim()) return;
    setFormTopics([...formTopics, { name: newTopicName.trim(), description: newTopicDescription.trim() }]);
    setNewTopicName('');
    setNewTopicDescription('');
  };

  const handleRemoveTopic = (index: number) => {
    setFormTopics(formTopics.filter((_, i) => i !== index));
  };

  const handleMoveTopic = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formTopics.length) return;
    const newTopics = [...formTopics];
    [newTopics[index], newTopics[newIndex]] = [newTopics[newIndex], newTopics[index]];
    setFormTopics(newTopics);
  };

  const handleCreateCommunity = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const data: CreateCommunityData = {
        name: formName,
        slug: formSlug,
        description: formDescription || undefined,
        topics: formTopics,
        verificationMethod: formVerificationMethod,
        terminology: {
          helperTerm: formHelperTerm,
          seekerTerm: formSeekerTerm,
        },
      };
      const newCommunity = await createCommunity(data);
      setCreatedCommunity(newCommunity);
      setCommunities([newCommunity, ...communities]);
      setCreateStep(4);
    } catch (err) {
      setCreateError('Failed to create community');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const resetCreateModal = () => {
    setShowCreateModal(false);
    setCreateStep(1);
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormTopics([]);
    setFormVerificationMethod('invite_code');
    setFormHelperTerm('Peer Support Specialist');
    setFormSeekerTerm('Member');
    setNewTopicName('');
    setNewTopicDescription('');
    setCreateError('');
    setCreatedCommunity(null);
  };

  // Webhook handlers
  const loadOrganizationsForCommunity = async (communityId: string) => {
    if (!communityId) {
      setWebhookOrganizations([]);
      return;
    }
    try {
      const orgs = await getWebhookOrganizations(communityId);
      setWebhookOrganizations(orgs);
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setWebhookOrganizations([]);
    }
  };

  const openWebhookModal = (webhook?: WebhookConfig) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setWebhookCommunityId(webhook.communityId);
      setWebhookOrgId(webhook.organizationId || '');
      setWebhookEventType(webhook.eventType);
      setWebhookEndpointUrl(webhook.endpointUrl);
      setWebhookIncludePii(webhook.includePii);
      setWebhookIsActive(webhook.isActive);
      loadOrganizationsForCommunity(webhook.communityId);
    } else {
      setEditingWebhook(null);
      setWebhookCommunityId('');
      setWebhookOrgId('');
      setWebhookEventType('crisis_alert');
      setWebhookEndpointUrl('');
      setWebhookIncludePii(false);
      setWebhookIsActive(true);
      setWebhookOrganizations([]);
    }
    setWebhookError('');
    setCreatedSecretKey(null);
    setShowWebhookModal(true);
  };

  const closeWebhookModal = () => {
    setShowWebhookModal(false);
    setEditingWebhook(null);
    setCreatedSecretKey(null);
    setWebhookError('');
  };

  const handleSaveWebhook = async () => {
    if (!webhookCommunityId || !webhookEndpointUrl) {
      setWebhookError('Community and Endpoint URL are required');
      return;
    }

    try {
      new URL(webhookEndpointUrl);
    } catch {
      setWebhookError('Invalid endpoint URL');
      return;
    }

    setWebhookSaving(true);
    setWebhookError('');

    try {
      if (editingWebhook) {
        const updated = await updateWebhook(editingWebhook.id, {
          event_type: webhookEventType,
          endpoint_url: webhookEndpointUrl,
          is_active: webhookIsActive,
          include_pii: webhookIncludePii,
          organization_id: webhookOrgId || null,
        });
        setWebhooks(webhooks.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
        closeWebhookModal();
      } else {
        const created = await createWebhook({
          community_id: webhookCommunityId,
          organization_id: webhookOrgId || null,
          event_type: webhookEventType,
          endpoint_url: webhookEndpointUrl,
          include_pii: webhookIncludePii,
        });
        setWebhooks([created, ...webhooks]);
        setCreatedSecretKey(created.secretKey || null);
      }
    } catch (err) {
      setWebhookError('Failed to save webhook');
      console.error(err);
    } finally {
      setWebhookSaving(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      await deleteWebhook(id);
      setWebhooks(webhooks.filter((w) => w.id !== id));
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    }
  };

  const handleTestWebhook = async (id: string) => {
    setTestingWebhookId(id);
    setTestResult(null);
    try {
      const result = await testWebhook(id);
      setTestResult({ id, success: result.success, message: result.success ? 'Test successful!' : result.error || 'Test failed' });
    } catch (err) {
      setTestResult({ id, success: false, message: 'Test request failed' });
    } finally {
      setTestingWebhookId(null);
    }
  };

  const openDeliveryLog = async (webhook: WebhookConfig) => {
    setSelectedWebhookForLog(webhook);
    setDeliveryPage(1);
    setShowDeliveryLog(true);
    await loadDeliveries(webhook.id, 1);
  };

  const loadDeliveries = async (webhookId: string, page: number) => {
    setDeliveriesLoading(true);
    try {
      const result = await getWebhookDeliveries(webhookId, page);
      setDeliveries(result.deliveries);
      setDeliveryTotalPages(result.pagination.totalPages);
      setDeliveryPage(result.pagination.page);
    } catch (err) {
      console.error('Failed to load deliveries:', err);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'crisis_alert': return 'Crisis Alert';
      case 'high_severity_alert': return 'High Severity Alert';
      case 'user_report': return 'User Report';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return { bg: '#DCFCE7', color: '#16A34A' };
      case 'failed': return { bg: '#FEE2E2', color: '#DC2626' };
      case 'retrying': return { bg: '#FEF3C7', color: '#D97706' };
      case 'pending': return { bg: '#E0E7FF', color: '#4F46E5' };
      default: return { bg: '#F1F5F9', color: '#64748B' };
    }
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
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/peerzle-icon.svg" alt="Peerzle" style={{ height: '32px' }} />
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
              Peerzle Admin
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#64748B', fontSize: '14px' }}>{user.email}</span>
            <button
              onClick={logout}
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
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Overview Stats */}
      {overview && (
        <div style={{ backgroundColor: 'white', borderBottom: '1px solid #E2E8F0', padding: '24px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '24px',
              }}
            >
              <StatCard label="Communities" value={overview.totalCommunities} />
              <StatCard label="Organizations" value={overview.totalOrganizations} />
              <StatCard label="Users" value={overview.totalUsers} />
              <StatCard label="Conversations" value={overview.totalConversations} />
              <StatCard label="This Week" value={overview.conversationsThisWeek} />
              <StatCard label="Active Communities" value={overview.activeCommunities} />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <TabButton active={activeTab === 'communities'} onClick={() => setActiveTab('communities')}>
            Communities
          </TabButton>
          <TabButton active={activeTab === 'organizations'} onClick={() => setActiveTab('organizations')}>
            Organizations
          </TabButton>
          <TabButton active={activeTab === 'webhooks'} onClick={() => setActiveTab('webhooks')}>
            Webhooks
          </TabButton>
        </div>

        {error && (
          <div style={{ padding: '12px', backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: '8px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Communities Tab */}
        {activeTab === 'communities' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>All Communities</h2>
              <button
                onClick={() => setShowCreateModal(true)}
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
                + Create Community
              </button>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              {communities.map((community) => (
                <div
                  key={community.id}
                  onClick={() => navigate(`/super-admin/community/${community.slug}`)}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #E2E8F0',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#1E3A5F' }}>
                        {community.name}
                      </h3>
                      <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>/{community.slug}</p>
                    </div>
                    <span
                      style={{
                        padding: '4px 8px',
                        backgroundColor: community.isPublic ? '#DCFCE7' : '#FEF3C7',
                        color: community.isPublic ? '#16A34A' : '#D97706',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      {community.verificationMethod === 'invite_code' ? 'Invite Only' : community.verificationMethod}
                    </span>
                  </div>
                  {community.description && (
                    <p style={{ margin: '12px 0 0 0', color: '#64748B', fontSize: '14px' }}>
                      {community.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '24px', marginTop: '16px' }}>
                    <span style={{ color: '#64748B', fontSize: '13px' }}>
                      <strong>{community.memberCount}</strong> members
                    </span>
                    <span style={{ color: '#64748B', fontSize: '13px' }}>
                      <strong>{community.orgCount}</strong> orgs
                    </span>
                    <span style={{ color: '#64748B', fontSize: '13px' }}>
                      <strong>{community.conversationCount}</strong> conversations
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Organizations Tab */}
        {activeTab === 'organizations' && (
          <div>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>All Organizations</h2>

            {/* Group by community */}
            {Array.from(new Set(organizations.map((o) => o.communitySlug))).map((communitySlug) => {
              const communityOrgs = organizations.filter((o) => o.communitySlug === communitySlug);
              const communityName = communityOrgs[0]?.communityName || communitySlug;

              return (
                <div key={communitySlug} style={{ marginBottom: '24px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {communityName}
                  </h3>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {communityOrgs.map((org) => (
                      <div
                        key={org.id}
                        onClick={() => navigate(`/community/${org.communitySlug}/org/${org.slug}`)}
                        style={{
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          padding: '16px',
                          border: '1px solid #E2E8F0',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 500 }}>{org.name}</h4>
                          <span style={{ color: '#64748B', fontSize: '13px' }}>/{org.slug}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                          <span style={{ color: '#64748B', fontSize: '13px' }}>
                            {org.memberCount} members
                          </span>
                          <span style={{ color: '#64748B', fontSize: '13px' }}>
                            {org.conversationCount} conversations
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
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {organizations.length === 0 && (
              <p style={{ color: '#64748B', textAlign: 'center', padding: '48px' }}>
                No organizations yet
              </p>
            )}
          </div>
        )}

        {/* Webhooks Tab */}
        {activeTab === 'webhooks' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Webhook Configurations</h2>
              <button
                onClick={() => openWebhookModal()}
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
                + Create Webhook
              </button>
            </div>

            {/* Webhooks list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1E3A5F' }}>
                          {webhook.communityName}
                        </h3>
                        {webhook.organizationName && (
                          <span style={{ color: '#64748B', fontSize: '13px' }}>
                            / {webhook.organizationName}
                          </span>
                        )}
                        <span
                          style={{
                            padding: '2px 8px',
                            backgroundColor: webhook.isActive ? '#DCFCE7' : '#FEE2E2',
                            color: webhook.isActive ? '#16A34A' : '#DC2626',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 500,
                          }}
                        >
                          {webhook.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            backgroundColor: '#EDF4FF',
                            color: '#2B7CF6',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 500,
                          }}
                        >
                          {getEventTypeLabel(webhook.eventType)}
                        </span>
                        {webhook.includePii && (
                          <span
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#FEF3C7',
                              color: '#D97706',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 500,
                            }}
                          >
                            Includes PII
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, color: '#64748B', fontSize: '13px', wordBreak: 'break-all' }}>
                        {webhook.endpointUrl}
                      </p>
                      {webhook.lastDeliveryStatus && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>Last delivery:</span>
                          <span
                            style={{
                              padding: '2px 6px',
                              backgroundColor: getStatusColor(webhook.lastDeliveryStatus).bg,
                              color: getStatusColor(webhook.lastDeliveryStatus).color,
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 500,
                            }}
                          >
                            {webhook.lastDeliveryStatus}
                          </span>
                          {webhook.lastDeliveryAt && (
                            <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                              {new Date(webhook.lastDeliveryAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                      <button
                        onClick={() => handleTestWebhook(webhook.id)}
                        disabled={testingWebhookId === webhook.id}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#F1F5F9',
                          color: '#475569',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: testingWebhookId === webhook.id ? 'wait' : 'pointer',
                          fontSize: '13px',
                        }}
                      >
                        {testingWebhookId === webhook.id ? 'Testing...' : 'Test'}
                      </button>
                      <button
                        onClick={() => openDeliveryLog(webhook)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#F1F5F9',
                          color: '#475569',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                        }}
                      >
                        Logs
                      </button>
                      <button
                        onClick={() => openWebhookModal(webhook)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#F1F5F9',
                          color: '#475569',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteWebhook(webhook.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {testResult?.id === webhook.id && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '8px 12px',
                        backgroundColor: testResult.success ? '#DCFCE7' : '#FEE2E2',
                        color: testResult.success ? '#16A34A' : '#DC2626',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>
              ))}

              {webhooks.length === 0 && (
                <p style={{ color: '#64748B', textAlign: 'center', padding: '48px' }}>
                  No webhooks configured yet
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Community Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => resetCreateModal()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Create Community</h2>
                <button
                  onClick={() => resetCreateModal()}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#64748B' }}
                >
                  &times;
                </button>
              </div>
              {createStep < 4 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        height: '4px',
                        borderRadius: '2px',
                        backgroundColor: createStep >= step ? '#2B7CF6' : '#E2E8F0',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px' }}>
              {createError && (
                <div style={{ padding: '12px', backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: '8px', marginBottom: '16px' }}>
                  {createError}
                </div>
              )}

              {/* Step 1: Basics */}
              {createStep === 1 && (
                <div>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>Basic Information</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                        Community Name *
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="e.g., Metro Fire Department"
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
                        Slug *
                      </label>
                      <input
                        type="text"
                        value={formSlug}
                        onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="metro-fire-dept"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          fontSize: '14px',
                        }}
                      />
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                        URL: peerzle.com/community/{formSlug || 'your-slug'}
                      </p>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                        Description
                      </label>
                      <textarea
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="A brief description of this community..."
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
                  </div>
                </div>
              )}

              {/* Step 2: Topics */}
              {createStep === 2 && (
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 500 }}>Topics</h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748B' }}>
                    What topics can members discuss? Start with a template or add your own.
                  </p>

                  {/* Templates */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    <TemplateButton onClick={() => handleApplyTemplate('first_responders')}>First Responders</TemplateButton>
                    <TemplateButton onClick={() => handleApplyTemplate('healthcare')}>Healthcare</TemplateButton>
                    <TemplateButton onClick={() => handleApplyTemplate('veterans')}>Veterans</TemplateButton>
                    <TemplateButton onClick={() => handleApplyTemplate('education')}>Education</TemplateButton>
                    <TemplateButton onClick={() => handleApplyTemplate('employee_wellness')}>Employee Wellness</TemplateButton>
                    <TemplateButton onClick={() => setFormTopics([])}>Start Blank</TemplateButton>
                  </div>

                  {/* Topic List */}
                  <div style={{ marginBottom: '16px' }}>
                    {formTopics.map((topic, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 12px',
                          backgroundColor: '#F8FAFC',
                          borderRadius: '6px',
                          marginBottom: '8px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 500, fontSize: '14px' }}>{topic.name}</span>
                          {topic.description && (
                            <span style={{ color: '#64748B', fontSize: '13px', marginLeft: '8px' }}>
                              - {topic.description}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleMoveTopic(index, 'up')}
                          disabled={index === 0}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: index === 0 ? 0.3 : 1 }}
                        >
                          &#9650;
                        </button>
                        <button
                          onClick={() => handleMoveTopic(index, 'down')}
                          disabled={index === formTopics.length - 1}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: index === formTopics.length - 1 ? 0.3 : 1 }}
                        >
                          &#9660;
                        </button>
                        <button
                          onClick={() => handleRemoveTopic(index)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Topic */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      placeholder="Topic name"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTopic()}
                    />
                    <input
                      type="text"
                      value={newTopicDescription}
                      onChange={(e) => setNewTopicDescription(e.target.value)}
                      placeholder="Description (optional)"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTopic()}
                    />
                    <button
                      onClick={handleAddTopic}
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
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Settings */}
              {createStep === 3 && (
                <div>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>Settings</h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                        Access Method
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(['invite_code', 'email_domain', 'open'] as const).map((method) => (
                          <label
                            key={method}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '12px',
                              backgroundColor: formVerificationMethod === method ? '#EDF4FF' : '#F8FAFC',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              border: formVerificationMethod === method ? '1px solid #2B7CF6' : '1px solid transparent',
                            }}
                          >
                            <input
                              type="radio"
                              name="verificationMethod"
                              checked={formVerificationMethod === method}
                              onChange={() => setFormVerificationMethod(method)}
                            />
                            <div>
                              <span style={{ fontWeight: 500, fontSize: '14px' }}>
                                {method === 'invite_code' && 'Invite Code Only'}
                                {method === 'email_domain' && 'Email Domain'}
                                {method === 'open' && 'Open Access'}
                              </span>
                              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                                {method === 'invite_code' && 'Members need an invite code to join'}
                                {method === 'email_domain' && 'Members must have a specific email domain'}
                                {method === 'open' && 'Anyone can join (not recommended)'}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                        Helper Term
                      </label>
                      <input
                        type="text"
                        value={formHelperTerm}
                        onChange={(e) => setFormHelperTerm(e.target.value)}
                        placeholder="Peer Support Specialist"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          fontSize: '14px',
                        }}
                      />
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                        What to call helpers in this community
                      </p>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                        Member Term
                      </label>
                      <input
                        type="text"
                        value={formSeekerTerm}
                        onChange={(e) => setFormSeekerTerm(e.target.value)}
                        placeholder="Member"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          fontSize: '14px',
                        }}
                      />
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                        What to call seekers/members in this community
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Success */}
              {createStep === 4 && createdCommunity && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: '#DCFCE7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                      fontSize: '32px',
                    }}
                  >
                    &#10003;
                  </div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>Community Created!</h3>
                  <p style={{ margin: '0 0 24px 0', color: '#64748B' }}>
                    <strong>{createdCommunity.name}</strong> is ready to go.
                  </p>

                  {createdCommunity.initialInviteCode && (
                    <div
                      style={{
                        backgroundColor: '#F8FAFC',
                        padding: '16px',
                        borderRadius: '8px',
                        marginBottom: '24px',
                      }}
                    >
                      <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B' }}>
                        Initial Invite Code:
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '24px',
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          letterSpacing: '2px',
                        }}
                      >
                        {createdCommunity.initialInviteCode}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      resetCreateModal();
                      navigate(`/super-admin/community/${createdCommunity.slug}`);
                    }}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#2B7CF6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    Manage Community
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {createStep < 4 && (
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <button
                  onClick={() => (createStep > 1 ? setCreateStep((createStep - 1) as CreateStep) : resetCreateModal())}
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
                  {createStep === 1 ? 'Cancel' : 'Back'}
                </button>
                <button
                  onClick={() => {
                    if (createStep === 3) {
                      handleCreateCommunity();
                    } else {
                      setCreateStep((createStep + 1) as CreateStep);
                    }
                  }}
                  disabled={(createStep === 1 && (!formName || !formSlug)) || creating}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2B7CF6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    opacity: (createStep === 1 && (!formName || !formSlug)) || creating ? 0.5 : 1,
                  }}
                >
                  {creating ? 'Creating...' : createStep === 3 ? 'Create Community' : 'Next'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Webhook Create/Edit Modal */}
      {showWebhookModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => closeWebhookModal()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                  {createdSecretKey ? 'Webhook Created' : editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
                </h2>
                <button
                  onClick={() => closeWebhookModal()}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#64748B' }}
                >
                  &times;
                </button>
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              {webhookError && (
                <div style={{ padding: '12px', backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: '8px', marginBottom: '16px' }}>
                  {webhookError}
                </div>
              )}

              {createdSecretKey ? (
                <div>
                  <div style={{ padding: '16px', backgroundColor: '#FEF3C7', borderRadius: '8px', marginBottom: '16px' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#92400E' }}>
                      Important: Copy your secret key now!
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#92400E' }}>
                      This key will only be shown once. Use it to verify webhook signatures.
                    </p>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                      Secret Key
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={createdSecretKey}
                        readOnly
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          backgroundColor: '#F8FAFC',
                        }}
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdSecretKey);
                        }}
                        style={{
                          padding: '10px 16px',
                          backgroundColor: '#2B7CF6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => closeWebhookModal()}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#2B7CF6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                      Community *
                    </label>
                    <select
                      value={webhookCommunityId}
                      onChange={(e) => {
                        setWebhookCommunityId(e.target.value);
                        setWebhookOrgId('');
                        loadOrganizationsForCommunity(e.target.value);
                      }}
                      disabled={!!editingWebhook}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: editingWebhook ? '#F8FAFC' : 'white',
                      }}
                    >
                      <option value="">Select a community</option>
                      {webhookCommunities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                      Organization (optional)
                    </label>
                    <select
                      value={webhookOrgId}
                      onChange={(e) => setWebhookOrgId(e.target.value)}
                      disabled={!webhookCommunityId}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">All organizations (community-wide)</option>
                      {webhookOrganizations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                      Leave empty to trigger for any organization in this community
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                      Event Type *
                    </label>
                    <select
                      value={webhookEventType}
                      onChange={(e) => setWebhookEventType(e.target.value as EventType)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="crisis_alert">Crisis Alert (Critical Severity)</option>
                      <option value="high_severity_alert">High Severity Alert</option>
                      <option value="user_report">User Report</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                      Endpoint URL *
                    </label>
                    <input
                      type="url"
                      value={webhookEndpointUrl}
                      onChange={(e) => setWebhookEndpointUrl(e.target.value)}
                      placeholder="https://your-service.com/webhook"
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
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '12px',
                        backgroundColor: '#FEF3C7',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={webhookIncludePii}
                        onChange={(e) => setWebhookIncludePii(e.target.checked)}
                        style={{ marginTop: '2px' }}
                      />
                      <div>
                        <span style={{ fontWeight: 500, fontSize: '14px', color: '#92400E' }}>
                          Include PII (user name & email)
                        </span>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#92400E' }}>
                          When enabled, webhook payloads will include the user's email and name for crisis response.
                        </p>
                      </div>
                    </label>
                  </div>

                  {editingWebhook && (
                    <div>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px',
                          backgroundColor: '#F8FAFC',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={webhookIsActive}
                          onChange={(e) => setWebhookIsActive(e.target.checked)}
                        />
                        <span style={{ fontWeight: 500, fontSize: '14px' }}>
                          Webhook is active
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!createdSecretKey && (
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                }}
              >
                <button
                  onClick={() => closeWebhookModal()}
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
                  onClick={handleSaveWebhook}
                  disabled={webhookSaving || !webhookCommunityId || !webhookEndpointUrl}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2B7CF6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    opacity: webhookSaving || !webhookCommunityId || !webhookEndpointUrl ? 0.5 : 1,
                  }}
                >
                  {webhookSaving ? 'Saving...' : editingWebhook ? 'Save Changes' : 'Create Webhook'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delivery Log Modal */}
      {showDeliveryLog && selectedWebhookForLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowDeliveryLog(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Delivery Log</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                    {selectedWebhookForLog.endpointUrl}
                  </p>
                </div>
                <button
                  onClick={() => setShowDeliveryLog(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#64748B' }}
                >
                  &times;
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
              {deliveriesLoading ? (
                <p style={{ textAlign: 'center', color: '#64748B', padding: '24px' }}>Loading...</p>
              ) : deliveries.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748B', padding: '24px' }}>No delivery attempts yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {deliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      style={{
                        padding: '16px',
                        backgroundColor: delivery.status === 'failed' ? '#FEF2F2' : '#F8FAFC',
                        borderRadius: '8px',
                        border: `1px solid ${delivery.status === 'failed' ? '#FECACA' : '#E2E8F0'}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              backgroundColor: getStatusColor(delivery.status).bg,
                              color: getStatusColor(delivery.status).color,
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 500,
                            }}
                          >
                            {delivery.status}
                          </span>
                          <span style={{ fontSize: '13px', color: '#64748B' }}>
                            {getEventTypeLabel(delivery.eventType)}
                          </span>
                          <span style={{ fontSize: '13px', color: '#94A3B8' }}>
                            Attempt {delivery.attemptNumber}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                          {new Date(delivery.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {delivery.responseStatus && (
                        <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>
                          <strong>Response:</strong> HTTP {delivery.responseStatus}
                        </p>
                      )}

                      {delivery.errorMessage && (
                        <p style={{ margin: 0, fontSize: '13px', color: '#DC2626' }}>
                          <strong>Error:</strong> {delivery.errorMessage}
                        </p>
                      )}

                      {delivery.deliveredAt && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                          Delivered at: {new Date(delivery.deliveredAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {deliveryTotalPages > 1 && (
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <button
                  onClick={() => loadDeliveries(selectedWebhookForLog.id, deliveryPage - 1)}
                  disabled={deliveryPage <= 1}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'white',
                    color: '#64748B',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    cursor: deliveryPage <= 1 ? 'not-allowed' : 'pointer',
                    opacity: deliveryPage <= 1 ? 0.5 : 1,
                  }}
                >
                  Previous
                </button>
                <span style={{ padding: '8px 16px', color: '#64748B', fontSize: '14px' }}>
                  Page {deliveryPage} of {deliveryTotalPages}
                </span>
                <button
                  onClick={() => loadDeliveries(selectedWebhookForLog.id, deliveryPage + 1)}
                  disabled={deliveryPage >= deliveryTotalPages}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'white',
                    color: '#64748B',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    cursor: deliveryPage >= deliveryTotalPages ? 'not-allowed' : 'pointer',
                    opacity: deliveryPage >= deliveryTotalPages ? 0.5 : 1,
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '28px', fontWeight: 600, color: '#1E3A5F' }}>{value}</p>
      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>{label}</p>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        backgroundColor: active ? '#2B7CF6' : 'transparent',
        color: active ? 'white' : '#64748B',
        border: active ? 'none' : '1px solid #E2E8F0',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

function TemplateButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        backgroundColor: '#F1F5F9',
        color: '#475569',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
      }}
    >
      {children}
    </button>
  );
}
