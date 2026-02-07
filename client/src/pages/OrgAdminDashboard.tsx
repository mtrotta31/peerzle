import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Community,
  Organization,
  OrganizationMember,
  AdminAlert,
  UserReport,
  getCommunity,
  getOrganization,
  getOrganizationMembers,
  createOrgInviteCode,
  getInviteCodes,
  updateOrganization,
  getAdminAlerts,
  getReports,
  InviteCode,
} from '../services/api';

type TabType = 'members' | 'inviteCodes' | 'alerts' | 'reports' | 'settings';

export default function OrgAdminDashboard() {
  const { slug, orgSlug } = useParams<{ slug: string; orgSlug: string }>();
  const [community, setCommunity] = useState<Community | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('members');
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingCode, setCreatingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [matchWithinOrgOnly, setMatchWithinOrgOnly] = useState(true);
  const [allowCrossOrgMatching, setAllowCrossOrgMatching] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!slug || !orgSlug) return;

      try {
        const [communityData, orgData] = await Promise.all([
          getCommunity(slug),
          getOrganization(slug, orgSlug),
        ]);
        setCommunity(communityData);
        setOrganization(orgData);

        // Initialize settings state
        if (orgData.settings) {
          setMatchWithinOrgOnly(orgData.settings.match_within_org_only);
          setAllowCrossOrgMatching(orgData.settings.allow_cross_org_matching);
        }

        // Load members immediately
        const membersData = await getOrganizationMembers(slug, orgSlug);
        setMembers(membersData);
      } catch (err) {
        console.error('Failed to load org admin dashboard:', err);
        setError('Failed to load dashboard. You may not have admin access to this organization.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug, orgSlug]);

  // Load invite codes when tab changes
  useEffect(() => {
    if (!slug || isLoading || !organization) return;

    async function loadTabData() {
      try {
        if (activeTab === 'inviteCodes' && inviteCodes.length === 0 && organization) {
          // Filter invite codes to only this organization
          const orgCodes = await getInviteCodes(slug!, organization.id);
          setInviteCodes(orgCodes);
        } else if (activeTab === 'alerts' && alerts.length === 0 && organization) {
          const orgAlerts = await getAdminAlerts(slug!, organization.id);
          setAlerts(orgAlerts);
        } else if (activeTab === 'reports' && reports.length === 0 && organization) {
          const orgReports = await getReports(slug!, organization.id);
          setReports(orgReports);
        }
      } catch (err) {
        console.error('Failed to load tab data:', err);
      }
    }

    loadTabData();
  }, [activeTab, slug, isLoading, inviteCodes.length, alerts.length, reports.length, organization]);

  const handleCreateCode = async () => {
    if (!slug || !orgSlug || creatingCode || !organization) return;

    setCreatingCode(true);
    try {
      await createOrgInviteCode(slug, orgSlug);
      // Refresh the codes list (filtered to this org)
      const orgCodes = await getInviteCodes(slug, organization.id);
      setInviteCodes(orgCodes);
    } catch (err) {
      console.error('Failed to create invite code:', err);
      alert('Failed to create invite code');
    } finally {
      setCreatingCode(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleSaveSettings = async () => {
    if (!slug || !orgSlug || savingSettings) return;

    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const updated = await updateOrganization(slug, orgSlug, {
        settings: {
          match_within_org_only: matchWithinOrgOnly,
          allow_cross_org_matching: allowCrossOrgMatching,
        },
      });
      setOrganization(updated);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'admin':
        return { backgroundColor: '#FEF3C7', color: '#92400E' };
      case 'helper':
      case 'both':
        return { backgroundColor: '#E9E0FF', color: '#7C5CFC' };
      default:
        return { backgroundColor: '#F1F5F9', color: '#64748B' };
    }
  };

  const getCodeStatus = (code: InviteCode) => {
    if (!code.is_active) return { label: 'Inactive', color: '#94A3B8' };
    if (code.expires_at && new Date(code.expires_at) < new Date()) return { label: 'Expired', color: '#DC2626' };
    if (code.max_uses !== null && code.current_uses >= code.max_uses) return { label: 'Max Uses', color: '#F59E0B' };
    return { label: 'Active', color: '#16A34A' };
  };

  if (isLoading) {
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

  if (error || !community || !organization) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: '#DC2626' }}>{error || 'Something went wrong'}</p>
        <Link to={`/community/${slug}`} style={{ color: '#2B7CF6' }}>Back to Dashboard</Link>
      </div>
    );
  }

  const tabLabels: Record<TabType, string> = {
    members: 'Members',
    inviteCodes: 'Invite Codes',
    alerts: 'Alerts',
    reports: 'Reports',
    settings: 'Settings',
  };

  const activeHelpers = members.filter((m) => m.isAvailable && (m.role === 'helper' || m.role === 'both' || m.role === 'admin')).length;
  const totalHelpers = members.filter((m) => m.role === 'helper' || m.role === 'both' || m.role === 'admin').length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #E2E8F0',
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/peerzle-icon.svg"
              alt="Peerzle"
              style={{ width: '32px', height: '32px' }}
            />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
                {organization.name}
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                {community.name} &middot; Organization Admin
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Link
              to={`/community/${slug}/admin/stats?organization_id=${organization.id}`}
              style={{
                color: 'white',
                textDecoration: 'none',
                padding: '8px 16px',
                backgroundColor: '#2B7CF6',
                border: 'none',
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#1E6AD9';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#2B7CF6';
              }}
            >
              Platform Stats
            </Link>
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

      {/* Stats Cards */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 20px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Total Members" value={members.length} />
          <StatCard label="Total Helpers" value={totalHelpers} />
          <StatCard label="Active Helpers" value={activeHelpers} color="#16A34A" />
          <StatCard label="Conversations" value={organization.conversationCount || 0} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '8px', padding: '0 20px' }}>
          {(['members', 'inviteCodes', 'alerts', 'reports', 'settings'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '16px 24px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #2B7CF6' : '2px solid transparent',
                color: activeTab === tab ? '#2B7CF6' : '#64748B',
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'color 0.2s',
              }}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 20px' }}>
        {/* Members Tab */}
        {activeTab === 'members' && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC' }}>
                    <th style={thStyle}>Member</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Available</th>
                    <th style={thStyle}>Joined</th>
                    <th style={thStyle}>As Seeker</th>
                    <th style={thStyle}>As Helper</th>
                    <th style={thStyle}>Avg Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, index) => (
                    <tr
                      key={member.id}
                      style={{
                        backgroundColor: index % 2 === 0 ? 'white' : '#F8FAFC',
                        borderTop: '1px solid #E2E8F0',
                      }}
                    >
                      <td style={tdStyle}>
                        <div>
                          <div style={{ fontWeight: 500, color: '#1E3A5F' }}>
                            {member.displayName || 'Anonymous'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B' }}>
                            {member.email}
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            ...getRoleBadgeStyle(member.role),
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                          }}
                        >
                          {member.role === 'seeker' ? 'Member' : member.role}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: member.isAvailable ? '#16A34A' : '#94A3B8' }}>
                          {member.isAvailable ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: '#64748B' }}>
                        {formatDate(member.joinedAt)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {member.seekerConversations}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {member.helperConversations}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {member.avgHelperRating ? member.avgHelperRating.toFixed(1) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {members.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                No members in this organization yet.
              </div>
            )}
          </div>
        )}

        {/* Invite Codes Tab */}
        {activeTab === 'inviteCodes' && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1E3A5F' }}>
                Organization Invite Codes
              </h3>
              <button
                onClick={handleCreateCode}
                disabled={creatingCode}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: creatingCode ? 'not-allowed' : 'pointer',
                  opacity: creatingCode ? 0.7 : 1,
                }}
              >
                {creatingCode ? 'Creating...' : 'Generate Code'}
              </button>
            </div>
            <p style={{ margin: 0, padding: '12px 20px', fontSize: '14px', color: '#64748B', backgroundColor: '#F8FAFC' }}>
              Members who join using these codes will automatically be added to {organization.name}.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC' }}>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Uses</th>
                    <th style={thStyle}>Max Uses</th>
                    <th style={thStyle}>Expires</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Created</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inviteCodes.map((code, index) => {
                    const status = getCodeStatus(code);
                    return (
                      <tr
                        key={code.id}
                        style={{
                          backgroundColor: index % 2 === 0 ? 'white' : '#F8FAFC',
                          borderTop: '1px solid #E2E8F0',
                        }}
                      >
                        <td style={tdStyle}>
                          <code style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '14px', color: '#1E3A5F' }}>
                            {code.code}
                          </code>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{code.current_uses}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#64748B' }}>
                          {code.max_uses ?? '\u221E'}
                        </td>
                        <td style={{ ...tdStyle, color: '#64748B' }}>
                          {code.expires_at ? formatDate(code.expires_at) : 'Never'}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: status.color, fontWeight: 500, fontSize: '13px' }}>
                            {status.label}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: '#64748B' }}>{formatDate(code.created_at)}</td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => handleCopyCode(code.code)}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: copiedCode === code.code ? '#DCFCE7' : 'white',
                              color: copiedCode === code.code ? '#16A34A' : '#64748B',
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 500,
                            }}
                          >
                            {copiedCode === code.code ? 'Copied!' : 'Copy'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {inviteCodes.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                No invite codes yet. Generate one to invite members to this organization.
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            {alerts.length === 0 ? (
              <div style={{ padding: '48px 32px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#16A34A' }}>
                  No safety alerts — all clear
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
                  No concerning messages have been flagged for {organization.name}.
                </p>
              </div>
            ) : (
              <div>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1E3A5F' }}>
                    Safety Alerts ({alerts.length})
                  </h3>
                </div>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {alerts.map((alert) => {
                    const severityColors: Record<string, { bg: string; text: string }> = {
                      critical: { bg: '#FEE2E2', text: '#DC2626' },
                      high: { bg: '#FEF3C7', text: '#D97706' },
                      moderate: { bg: '#FEF9C3', text: '#CA8A04' },
                      low: { bg: '#F1F5F9', text: '#64748B' },
                    };
                    const colors = severityColors[alert.severity] || severityColors.low;

                    return (
                      <div
                        key={alert.id}
                        style={{
                          padding: '16px 20px',
                          borderBottom: '1px solid #F1F5F9',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: colors.bg,
                            color: colors.text,
                            textTransform: 'capitalize',
                            flexShrink: 0,
                          }}
                        >
                          {alert.riskLevel || alert.severity}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {alert.excerpt && (
                            <p
                              style={{
                                margin: '0 0 4px',
                                fontSize: '14px',
                                color: '#1E3A5F',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              "{alert.excerpt}"
                            </p>
                          )}
                          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                            {new Date(alert.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <Link
                          to={`/chat/${alert.conversationId}`}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#F8FAFC',
                            color: '#64748B',
                            textDecoration: 'none',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 500,
                            flexShrink: 0,
                          }}
                        >
                          View
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            {reports.length === 0 ? (
              <div style={{ padding: '48px 32px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#16A34A' }}>
                  No reports filed
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
                  No reports have been submitted involving members of {organization.name}.
                </p>
              </div>
            ) : (
              <div>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1E3A5F' }}>
                    User Reports ({reports.length})
                  </h3>
                </div>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {reports.map((report) => {
                    const statusColors: Record<string, { bg: string; text: string }> = {
                      pending: { bg: '#FEF3C7', text: '#D97706' },
                      reviewed: { bg: '#DCFCE7', text: '#16A34A' },
                      dismissed: { bg: '#F1F5F9', text: '#64748B' },
                    };
                    const colors = statusColors[report.status] || statusColors.pending;

                    const categoryLabels: Record<string, string> = {
                      inappropriate_behavior: 'Inappropriate Behavior',
                      harmful_content: 'Harmful Content',
                      spam: 'Spam',
                      crisis_concerns: 'Crisis Concerns',
                      other: 'Other',
                    };

                    return (
                      <div
                        key={report.id}
                        style={{
                          padding: '16px 20px',
                          borderBottom: '1px solid #F1F5F9',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span
                              style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                              }}
                            >
                              {categoryLabels[report.category] || report.category}
                            </span>
                            <span
                              style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 500,
                                backgroundColor: colors.bg,
                                color: colors.text,
                                textTransform: 'capitalize',
                              }}
                            >
                              {report.status}
                            </span>
                          </div>
                          <Link
                            to={`/chat/${report.conversationId}`}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#F8FAFC',
                              color: '#64748B',
                              textDecoration: 'none',
                              borderRadius: '16px',
                              fontSize: '12px',
                              fontWeight: 500,
                            }}
                          >
                            View Chat
                          </Link>
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 500, color: '#1E3A5F' }}>{report.reporterEmail}</span>
                          {' reported '}
                          <span style={{ fontWeight: 500, color: '#1E3A5F' }}>{report.reportedEmail}</span>
                        </div>
                        {report.description && (
                          <p
                            style={{
                              margin: '8px 0 0',
                              fontSize: '13px',
                              color: '#475569',
                              fontStyle: 'italic',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            "{report.description}"
                          </p>
                        )}
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                          {new Date(report.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {report.reviewedAt && (
                            <span>
                              {' · Reviewed by '}{report.reviewerEmail}
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
              Matching Settings
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#64748B' }}>
              Control how members of this organization are matched with helpers.
            </p>

            {/* Match within org only */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '16px',
                backgroundColor: '#F8FAFC',
                borderRadius: '12px',
                marginBottom: '12px',
              }}
            >
              <div style={{ flex: 1, marginRight: '16px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 500, color: '#1E3A5F' }}>
                  Match within organization only
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                  Members will only be matched with helpers from their own organization
                </p>
              </div>
              <div
                onClick={() => setMatchWithinOrgOnly(!matchWithinOrgOnly)}
                style={{
                  width: '52px',
                  height: '28px',
                  backgroundColor: matchWithinOrgOnly ? '#16A34A' : '#CBD5E1',
                  borderRadius: '14px',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: matchWithinOrgOnly ? '26px' : '2px',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </div>
            </div>

            {/* Allow cross-org matching */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '16px',
                backgroundColor: '#F8FAFC',
                borderRadius: '12px',
                marginBottom: '24px',
                opacity: matchWithinOrgOnly ? 1 : 0.5,
                pointerEvents: matchWithinOrgOnly ? 'auto' : 'none',
              }}
            >
              <div style={{ flex: 1, marginRight: '16px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 500, color: '#1E3A5F' }}>
                  Allow cross-organization matching
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                  If no helpers are available in the organization, expand search to the broader community
                </p>
              </div>
              <div
                onClick={() => matchWithinOrgOnly && setAllowCrossOrgMatching(!allowCrossOrgMatching)}
                style={{
                  width: '52px',
                  height: '28px',
                  backgroundColor: allowCrossOrgMatching ? '#16A34A' : '#CBD5E1',
                  borderRadius: '14px',
                  position: 'relative',
                  cursor: matchWithinOrgOnly ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.2s',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: allowCrossOrgMatching ? '26px' : '2px',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </div>
            </div>

            {/* Save button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: savingSettings ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  opacity: savingSettings ? 0.7 : 1,
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => {
                  if (!savingSettings) {
                    e.currentTarget.style.backgroundColor = '#1E6AD9';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#2B7CF6';
                }}
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
              {settingsSaved && (
                <span style={{ fontSize: '14px', color: '#16A34A', fontWeight: 500 }}>
                  Settings saved!
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 500, color: '#64748B' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '32px', fontWeight: 600, color: color || '#1E3A5F' }}>
        {value}
      </p>
    </div>
  );
}

// Table styles
const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 600,
  color: '#64748B',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '14px',
  color: '#1E3A5F',
};
