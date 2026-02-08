import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Community,
  AdminOverview,
  AdminMember,
  AdminAlert,
  InviteCode,
  VerificationRequest,
  UserReport,
  Organization,
  getCommunity,
  getAdminOverview,
  getAdminMembers,
  getAdminAlerts,
  updateMemberRole,
  getInviteCodes,
  createInviteCode,
  updateInviteCode,
  getVerificationRequests,
  reviewVerificationRequest,
  getReports,
  updateReport,
  getOrganizations,
  createOrganization,
} from '../services/api';

type TabType = 'overview' | 'members' | 'verifications' | 'alerts' | 'inviteCodes' | 'organizations';

export default function AdminDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [creatingCode, setCreatingCode] = useState(false);
  const [togglingCode, setTogglingCode] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [reviewingRequest, setReviewingRequest] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [reports, setReports] = useState<UserReport[]>([]);
  const [updatingReport, setUpdatingReport] = useState<number | null>(null);
  const [reportNotes, setReportNotes] = useState<Record<number, string>>({});
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgContact, setNewOrgContact] = useState('');
  const [newOrgMatchWithinOnly, setNewOrgMatchWithinOnly] = useState(true);
  const [newOrgAllowCrossOrg, setNewOrgAllowCrossOrg] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);
  const [selectedCodeOrgId, setSelectedCodeOrgId] = useState<string | null>(null);

  // Confirmation modal state
  const [roleChangeConfirm, setRoleChangeConfirm] = useState<{ membershipId: string; newRole: string; email: string } | null>(null);
  const [deactivateCodeConfirm, setDeactivateCodeConfirm] = useState<{ codeId: number; code: string } | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        const [communityData, overviewData] = await Promise.all([
          getCommunity(slug),
          getAdminOverview(slug),
        ]);
        setCommunity(communityData);
        setOverview(overviewData);
      } catch (err) {
        console.error('Failed to load admin dashboard:', err);
        setError('Failed to load dashboard. You may not have admin access.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug]);

  // Load tab-specific data when tab changes
  useEffect(() => {
    if (!slug || isLoading) return;

    async function loadTabData() {
      try {
        if (activeTab === 'members' && members.length === 0) {
          const membersData = await getAdminMembers(slug!);
          setMembers(membersData);
        } else if (activeTab === 'alerts' && alerts.length === 0 && reports.length === 0) {
          const [alertsData, reportsData] = await Promise.all([
            getAdminAlerts(slug!),
            getReports(slug!),
          ]);
          setAlerts(alertsData);
          setReports(reportsData);
        } else if (activeTab === 'inviteCodes') {
          if (inviteCodes.length === 0) {
            const codesData = await getInviteCodes(slug!);
            setInviteCodes(codesData);
          }
          // Also load organizations for the invite code picker
          if (organizations.length === 0) {
            const orgsData = await getOrganizations(slug!);
            setOrganizations(orgsData);
          }
        } else if (activeTab === 'verifications' && verificationRequests.length === 0) {
          const requestsData = await getVerificationRequests(slug!);
          setVerificationRequests(requestsData);
        } else if (activeTab === 'organizations' && organizations.length === 0) {
          const orgsData = await getOrganizations(slug!);
          setOrganizations(orgsData);
        }
      } catch (err) {
        console.error('Failed to load tab data:', err);
      }
    }

    loadTabData();
  }, [activeTab, slug, isLoading]);

  const handleRoleChange = async (membershipId: string, newRole: string) => {
    if (!slug) return;

    setUpdatingRole(membershipId);
    try {
      await updateMemberRole(slug, membershipId, newRole);
      // Update local state
      setMembers((prev) =>
        prev.map((m) => (m.id === membershipId ? { ...m, role: newRole === 'member' ? 'seeker' : newRole } : m))
      );
    } catch (err) {
      console.error('Failed to update role:', err);
      alert('Failed to update role. You cannot demote yourself.');
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleCreateCode = async (organizationId?: string | null) => {
    if (!slug || creatingCode) return;

    setCreatingCode(true);
    try {
      await createInviteCode(slug, {
        organizationId: organizationId || undefined,
      });
      // Re-fetch the full list to get joined organization_name
      const codesData = await getInviteCodes(slug);
      setInviteCodes(codesData);
      setShowInviteCodeModal(false);
      setSelectedCodeOrgId(null);
    } catch (err) {
      console.error('Failed to create invite code:', err);
      alert('Failed to create invite code');
    } finally {
      setCreatingCode(false);
    }
  };

  const handleToggleCode = async (codeId: number, isActive: boolean) => {
    if (!slug || togglingCode !== null) return;

    setTogglingCode(codeId);
    try {
      const updatedCode = await updateInviteCode(slug, codeId, isActive);
      setInviteCodes((prev) =>
        prev.map((c) => (c.id === codeId ? updatedCode : c))
      );
    } catch (err) {
      console.error('Failed to update invite code:', err);
      alert('Failed to update invite code');
    } finally {
      setTogglingCode(null);
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

  const handleReviewRequest = async (requestId: number, status: 'approved' | 'denied') => {
    if (!slug || reviewingRequest !== null) return;

    setReviewingRequest(requestId);
    try {
      const updated = await reviewVerificationRequest(slug, requestId, status, reviewNotes[requestId]);
      setVerificationRequests((prev) =>
        prev.map((r) => (r.id === requestId ? updated : r))
      );
      // Clear the notes for this request
      setReviewNotes((prev) => {
        const newNotes = { ...prev };
        delete newNotes[requestId];
        return newNotes;
      });
    } catch (err) {
      console.error('Failed to review request:', err);
      alert('Failed to review verification request');
    } finally {
      setReviewingRequest(null);
    }
  };

  const handleReportAction = async (reportId: number, status: 'reviewed' | 'dismissed') => {
    if (!slug || updatingReport !== null) return;

    setUpdatingReport(reportId);
    try {
      const updated = await updateReport(slug, reportId, status, reportNotes[reportId]);
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, status: updated.status as 'reviewed' | 'dismissed', adminNotes: updated.adminNotes, reviewedAt: updated.reviewedAt }
            : r
        )
      );
      setReportNotes((prev) => {
        const newNotes = { ...prev };
        delete newNotes[reportId];
        return newNotes;
      });
    } catch (err) {
      console.error('Failed to update report:', err);
      alert('Failed to update report');
    } finally {
      setUpdatingReport(null);
    }
  };

  const handleCreateOrg = async () => {
    if (!slug || creatingOrg || !newOrgName.trim()) return;

    setCreatingOrg(true);
    try {
      const newOrg = await createOrganization(slug, {
        name: newOrgName.trim(),
        primaryContactEmail: newOrgContact.trim() || undefined,
        settings: {
          match_within_org_only: newOrgMatchWithinOnly,
          allow_cross_org_matching: newOrgAllowCrossOrg,
        },
      });
      setOrganizations((prev) => [newOrg, ...prev]);
      setShowOrgModal(false);
      setNewOrgName('');
      setNewOrgContact('');
      setNewOrgMatchWithinOnly(true);
      setNewOrgAllowCrossOrg(false);
    } catch (err) {
      console.error('Failed to create organization:', err);
      alert('Failed to create organization');
    } finally {
      setCreatingOrg(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      inappropriate_behavior: 'Inappropriate Behavior',
      harmful_content: 'Harmful Content',
      spam: 'Spam',
      crisis_concerns: 'Crisis Concerns',
      other: 'Other',
    };
    return labels[category] || category;
  };

  const getReportStatusStyle = (status: string) => {
    if (status === 'reviewed') return { backgroundColor: '#DCFCE7', color: '#16A34A' };
    if (status === 'dismissed') return { backgroundColor: '#F1F5F9', color: '#64748B' };
    return { backgroundColor: '#FEF3C7', color: '#92400E' };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'admin':
        return { backgroundColor: '#FEF3C7', color: '#92400E' };
      case 'helper':
        return { backgroundColor: '#E9E0FF', color: '#7C5CFC' };
      default:
        return { backgroundColor: '#F1F5F9', color: '#64748B' };
    }
  };

  const getSeverityBadgeStyle = (severity: string, riskLevel: string) => {
    const level = riskLevel || severity;
    if (level === 'critical' || level === 'crisis') {
      return { backgroundColor: '#FEF2F2', color: '#DC2626', borderColor: '#DC2626' };
    }
    if (level === 'high' || level === 'moderate_concern') {
      return { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#F59E0B' };
    }
    return { backgroundColor: '#DCFCE7', color: '#16A34A', borderColor: '#16A34A' };
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

  if (error || !community) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: '#DC2626' }}>{error || 'Something went wrong'}</p>
        <Link to={`/community/${slug}`} style={{ color: '#2B7CF6' }}>Back to Dashboard</Link>
      </div>
    );
  }

  const tabLabels: Record<TabType, string> = {
    overview: 'Overview',
    members: 'Members',
    verifications: 'Verifications',
    alerts: 'Alerts',
    inviteCodes: 'Invite Codes',
    organizations: 'Organizations',
  };

  const pendingVerifications = verificationRequests.filter((r) => r.status === 'pending').length;
  const pendingReports = reports.filter((r) => r.status === 'pending').length;

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
                Admin Dashboard
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                {community.name}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Link
              to={`/community/${slug}/admin/stats`}
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
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

      {/* Tabs */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '8px', padding: '0 20px' }}>
          {(['overview', 'members', 'organizations', 'verifications', 'alerts', 'inviteCodes'] as TabType[]).map((tab) => (
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
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {tabLabels[tab]}
              {tab === 'verifications' && pendingVerifications > 0 && (
                <span
                  style={{
                    backgroundColor: '#F59E0B',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '10px',
                    minWidth: '18px',
                    textAlign: 'center',
                  }}
                >
                  {pendingVerifications}
                </span>
              )}
              {tab === 'alerts' && pendingReports > 0 && (
                <span
                  style={{
                    backgroundColor: '#DC2626',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '10px',
                    minWidth: '18px',
                    textAlign: 'center',
                  }}
                >
                  {pendingReports}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 20px' }}>
        {/* Overview Tab */}
        {activeTab === 'overview' && overview && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
            }}
          >
            <StatCard icon="👥" label="Total Members" value={overview.totalMembers} />
            <StatCard icon="💬" label="Total Conversations" value={overview.totalConversations} />
            <StatCard icon="🟢" label="Active Now" value={overview.activeConversations} color="#16A34A" />
            <StatCard
              icon="⭐"
              label="Average Rating"
              value={overview.averageRating ? overview.averageRating.toFixed(1) : 'N/A'}
            />
            <StatCard icon="⚠️" label="Safety Alerts" value={overview.totalAlerts} />
            <StatCard icon="🚨" label="Crisis Alerts" value={overview.crisisAlerts} color="#DC2626" />
          </div>
        )}

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
                    <th style={thStyle}>Email</th>
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
                      <td style={{ ...tdStyle, color: '#64748B' }}>{member.email}</td>
                      <td style={tdStyle}>
                        <select
                          value={member.role === 'seeker' || member.role === 'both' ? 'member' : member.role}
                          onChange={(e) => {
                            const newRole = e.target.value;
                            const currentRole = member.role === 'seeker' || member.role === 'both' ? 'member' : member.role;
                            if (newRole !== currentRole) {
                              setRoleChangeConfirm({ membershipId: member.id, newRole, email: member.email });
                            }
                          }}
                          disabled={updatingRole === member.id}
                          style={{
                            ...getRoleBadgeStyle(member.role),
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0',
                            fontSize: '13px',
                            cursor: updatingRole === member.id ? 'not-allowed' : 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          <option value="member">Member</option>
                          <option value="helper">Helper</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td style={tdStyle}>
                        {member.isAvailable ? (
                          <span style={{ color: '#16A34A', fontWeight: 500 }}>Yes</span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>No</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: '#64748B' }}>{formatDate(member.joinedAt)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{member.seekerConversations}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{member.helperConversations}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: '#64748B' }}>
                        {member.avgHelperRating ? member.avgHelperRating.toFixed(1) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {members.length === 0 && (
              <p style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                No members found
              </p>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* User Reports Section */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600, color: '#1E3A5F' }}>
                User Reports
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reports.length === 0 ? (
                  <div
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '16px',
                      padding: '32px 24px',
                      textAlign: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}
                  >
                    <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>
                      No user reports have been submitted.
                    </p>
                  </div>
                ) : (
                  reports.map((report) => {
                    const statusStyle = getReportStatusStyle(report.status);
                    const isPending = report.status === 'pending';
                    return (
                      <div
                        key={report.id}
                        style={{
                          backgroundColor: 'white',
                          borderRadius: '16px',
                          padding: '16px 20px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          borderLeft: `4px solid ${isPending ? '#DC2626' : statusStyle.color}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  backgroundColor: '#FEF2F2',
                                  color: '#DC2626',
                                }}
                              >
                                {getCategoryLabel(report.category)}
                              </span>
                              <span
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  textTransform: 'capitalize',
                                  ...statusStyle,
                                }}
                              >
                                {report.status}
                              </span>
                              <span style={{ fontSize: '13px', color: '#64748B' }}>
                                {formatDateTime(report.createdAt)}
                              </span>
                            </div>
                            <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#1E3A5F' }}>
                              <strong>Reported:</strong> {report.reportedEmail}
                            </p>
                            <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748B' }}>
                              <strong>By:</strong> {report.reporterEmail}
                            </p>
                            {report.conversationTopic && (
                              <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748B' }}>
                                <strong>Topic:</strong> {report.conversationTopic}
                              </p>
                            )}
                            {report.description && (
                              <div
                                style={{
                                  backgroundColor: '#F8FAFC',
                                  borderRadius: '10px',
                                  padding: '10px 14px',
                                  marginTop: '8px',
                                }}
                              >
                                <p style={{ margin: 0, fontSize: '13px', color: '#1E3A5F', whiteSpace: 'pre-wrap' }}>
                                  {report.description}
                                </p>
                              </div>
                            )}

                            {/* Admin notes for reviewed/dismissed */}
                            {!isPending && report.adminNotes && (
                              <div
                                style={{
                                  backgroundColor: statusStyle.backgroundColor,
                                  borderRadius: '10px',
                                  padding: '10px 14px',
                                  marginTop: '8px',
                                }}
                              >
                                <p style={{ margin: 0, fontSize: '13px', color: statusStyle.color }}>
                                  <strong>Admin notes:</strong> {report.adminNotes}
                                </p>
                                {report.reviewerEmail && (
                                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                                    Reviewed by {report.reviewerEmail} on {formatDate(report.reviewedAt || '')}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Action area for pending reports */}
                            {isPending && (
                              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <input
                                  type="text"
                                  placeholder="Add admin notes (optional)..."
                                  value={reportNotes[report.id] || ''}
                                  onChange={(e) =>
                                    setReportNotes((prev) => ({ ...prev, [report.id]: e.target.value }))
                                  }
                                  style={{
                                    padding: '10px 14px',
                                    border: '1px solid #E2E8F0',
                                    borderRadius: '10px',
                                    fontSize: '14px',
                                    outline: 'none',
                                  }}
                                  onFocus={(e) => { e.currentTarget.style.borderColor = '#2B7CF6'; }}
                                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
                                />
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => handleReportAction(report.id, 'dismissed')}
                                    disabled={updatingReport === report.id}
                                    style={{
                                      padding: '8px 16px',
                                      backgroundColor: 'white',
                                      color: '#64748B',
                                      border: '1px solid #E2E8F0',
                                      borderRadius: '24px',
                                      cursor: updatingReport === report.id ? 'not-allowed' : 'pointer',
                                      fontWeight: 500,
                                      fontSize: '13px',
                                      opacity: updatingReport === report.id ? 0.6 : 1,
                                      transition: 'all 0.2s',
                                    }}
                                    onMouseOver={(e) => {
                                      if (updatingReport !== report.id) {
                                        e.currentTarget.style.borderColor = '#94A3B8';
                                      }
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.borderColor = '#E2E8F0';
                                    }}
                                  >
                                    Dismiss
                                  </button>
                                  <button
                                    onClick={() => handleReportAction(report.id, 'reviewed')}
                                    disabled={updatingReport === report.id}
                                    style={{
                                      padding: '8px 16px',
                                      backgroundColor: '#2B7CF6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '24px',
                                      cursor: updatingReport === report.id ? 'not-allowed' : 'pointer',
                                      fontWeight: 600,
                                      fontSize: '13px',
                                      opacity: updatingReport === report.id ? 0.6 : 1,
                                      transition: 'background-color 0.2s',
                                    }}
                                    onMouseOver={(e) => {
                                      if (updatingReport !== report.id) {
                                        e.currentTarget.style.backgroundColor = '#1E6AD9';
                                      }
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.backgroundColor = '#2B7CF6';
                                    }}
                                  >
                                    {updatingReport === report.id ? 'Processing...' : 'Mark Reviewed'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => navigate(`/chat/${report.conversationId}`)}
                            style={{
                              padding: '6px 14px',
                              backgroundColor: 'white',
                              color: '#2B7CF6',
                              border: '1px solid #2B7CF6',
                              borderRadius: '16px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s',
                              marginLeft: '12px',
                              flexShrink: 0,
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#2B7CF6';
                              e.currentTarget.style.color = 'white';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.color = '#2B7CF6';
                            }}
                          >
                            View Conversation
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Safety Alerts Section */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600, color: '#1E3A5F' }}>
                Safety Alerts
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {alerts.length === 0 ? (
                  <div
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '16px',
                      padding: '32px 24px',
                      textAlign: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}
                  >
                    <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>
                      No safety alerts. All conversations are proceeding safely.
                    </p>
                  </div>
                ) : (
                  alerts.map((alert) => {
                    const badgeStyle = getSeverityBadgeStyle(alert.severity, alert.riskLevel);
                    return (
                      <div
                        key={alert.id}
                        style={{
                          backgroundColor: 'white',
                          borderRadius: '16px',
                          padding: '16px 20px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          borderLeft: `4px solid ${badgeStyle.borderColor}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                              <span
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  backgroundColor: badgeStyle.backgroundColor,
                                  color: badgeStyle.color,
                                }}
                              >
                                {alert.riskLevel || alert.severity}
                              </span>
                              <span style={{ fontSize: '13px', color: '#64748B' }}>
                                {formatDateTime(alert.createdAt)}
                              </span>
                            </div>
                            {alert.flags.length > 0 && (
                              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1E3A5F' }}>
                                <strong>Flags:</strong> {alert.flags.join(', ')}
                              </p>
                            )}
                            {alert.suggestedAction && (
                              <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                                <strong>Suggested:</strong> {alert.suggestedAction}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => navigate(`/chat/${alert.conversationId}`)}
                            style={{
                              padding: '6px 14px',
                              backgroundColor: 'white',
                              color: '#2B7CF6',
                              border: '1px solid #2B7CF6',
                              borderRadius: '16px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s',
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#2B7CF6';
                              e.currentTarget.style.color = 'white';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.color = '#2B7CF6';
                            }}
                          >
                            View Conversation
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Verifications Tab */}
        {activeTab === 'verifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {verificationRequests.length === 0 ? (
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#1E3A5F' }}>No verification requests</h3>
                <p style={{ margin: 0, color: '#64748B' }}>
                  Helper verification requests will appear here.
                </p>
              </div>
            ) : (
              verificationRequests.map((request) => {
                const isPending = request.status === 'pending';
                const statusColor =
                  request.status === 'approved'
                    ? '#16A34A'
                    : request.status === 'denied'
                    ? '#DC2626'
                    : '#F59E0B';
                const statusBg =
                  request.status === 'approved'
                    ? '#DCFCE7'
                    : request.status === 'denied'
                    ? '#FEF2F2'
                    : '#FEF3C7';

                return (
                  <div
                    key={request.id}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '16px',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      borderLeft: `4px solid ${statusColor}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: '#1E3A5F' }}>
                            {request.userEmail}
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: statusBg,
                              color: statusColor,
                              textTransform: 'capitalize',
                            }}
                          >
                            {request.status}
                          </span>
                        </div>
                        <span style={{ fontSize: '13px', color: '#64748B' }}>
                          Submitted {formatDate(request.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: isPending ? '16px' : '0',
                      }}
                    >
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                        Qualifications
                      </p>
                      <p style={{ margin: 0, fontSize: '14px', color: '#1E3A5F', whiteSpace: 'pre-wrap' }}>
                        {request.qualifications}
                      </p>
                    </div>

                    {!isPending && request.reviewNotes && (
                      <div
                        style={{
                          backgroundColor: statusBg,
                          borderRadius: '12px',
                          padding: '12px 16px',
                          marginTop: '12px',
                        }}
                      >
                        <p style={{ margin: 0, fontSize: '13px', color: statusColor }}>
                          <strong>Review notes:</strong> {request.reviewNotes}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                          Reviewed by {request.reviewerEmail} on {formatDate(request.reviewedAt || '')}
                        </p>
                      </div>
                    )}

                    {isPending && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                          type="text"
                          placeholder="Add review notes (optional)..."
                          value={reviewNotes[request.id] || ''}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({ ...prev, [request.id]: e.target.value }))
                          }
                          style={{
                            padding: '10px 14px',
                            border: '1px solid #E2E8F0',
                            borderRadius: '10px',
                            fontSize: '14px',
                            outline: 'none',
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#2B7CF6';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#E2E8F0';
                          }}
                        />
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleReviewRequest(request.id, 'denied')}
                            disabled={reviewingRequest === request.id}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: 'white',
                              color: '#DC2626',
                              border: '1px solid #DC2626',
                              borderRadius: '24px',
                              cursor: reviewingRequest === request.id ? 'not-allowed' : 'pointer',
                              fontWeight: 500,
                              fontSize: '14px',
                              opacity: reviewingRequest === request.id ? 0.6 : 1,
                              transition: 'all 0.2s',
                            }}
                            onMouseOver={(e) => {
                              if (reviewingRequest !== request.id) {
                                e.currentTarget.style.backgroundColor = '#FEF2F2';
                              }
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = 'white';
                            }}
                          >
                            Deny
                          </button>
                          <button
                            onClick={() => handleReviewRequest(request.id, 'approved')}
                            disabled={reviewingRequest === request.id}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: '#16A34A',
                              color: 'white',
                              border: 'none',
                              borderRadius: '24px',
                              cursor: reviewingRequest === request.id ? 'not-allowed' : 'pointer',
                              fontWeight: 600,
                              fontSize: '14px',
                              opacity: reviewingRequest === request.id ? 0.6 : 1,
                              transition: 'background-color 0.2s',
                            }}
                            onMouseOver={(e) => {
                              if (reviewingRequest !== request.id) {
                                e.currentTarget.style.backgroundColor = '#15803D';
                              }
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = '#16A34A';
                            }}
                          >
                            {reviewingRequest === request.id ? 'Processing...' : 'Approve'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Invite Codes Tab */}
        {activeTab === 'inviteCodes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header with Generate Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
                  Invite Codes
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748B' }}>
                  Generate and manage invite codes for new members
                </p>
              </div>
              <button
                onClick={() => setShowInviteCodeModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '14px',
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
                Generate New Code
              </button>
            </div>

            {/* Codes Table */}
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}
            >
              {inviteCodes.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔑</div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#1E3A5F' }}>No invite codes yet</h3>
                  <p style={{ margin: 0, color: '#64748B' }}>
                    Generate your first invite code to start inviting members.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC' }}>
                        <th style={thStyle}>Code</th>
                        <th style={thStyle}>Organization</th>
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
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '15px',
                                  fontWeight: 600,
                                  color: '#1E3A5F',
                                  letterSpacing: '1px',
                                }}
                              >
                                {code.code}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              {code.organization_name ? (
                                <span style={{ fontSize: '13px', color: '#1E3A5F' }}>
                                  {code.organization_name}
                                </span>
                              ) : (
                                <span style={{ fontSize: '13px', color: '#94A3B8', fontStyle: 'italic' }}>
                                  Community-wide
                                </span>
                              )}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{code.current_uses}</td>
                            <td style={{ ...tdStyle, textAlign: 'center', color: '#64748B' }}>
                              {code.max_uses ?? '∞'}
                            </td>
                            <td style={{ ...tdStyle, color: '#64748B' }}>
                              {code.expires_at ? formatDate(code.expires_at) : 'Never'}
                            </td>
                            <td style={tdStyle}>
                              <span
                                style={{
                                  color: status.color,
                                  fontWeight: 500,
                                  fontSize: '13px',
                                }}
                              >
                                {status.label}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, color: '#64748B' }}>{formatDate(code.created_at)}</td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', gap: '8px' }}>
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
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  {copiedCode === code.code ? 'Copied!' : 'Copy'}
                                </button>
                                <button
                                  onClick={() => {
                                    if (code.is_active) {
                                      // Show confirmation for deactivation
                                      setDeactivateCodeConfirm({ codeId: code.id, code: code.code });
                                    } else {
                                      // Activate directly (not destructive)
                                      handleToggleCode(code.id, true);
                                    }
                                  }}
                                  disabled={togglingCode === code.id}
                                  style={{
                                    padding: '4px 10px',
                                    backgroundColor: code.is_active ? '#FEF2F2' : '#DCFCE7',
                                    color: code.is_active ? '#DC2626' : '#16A34A',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: togglingCode === code.id ? 'not-allowed' : 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    opacity: togglingCode === code.id ? 0.7 : 1,
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  {code.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Generate Invite Code Modal */}
            {showInviteCodeModal && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '20px',
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowInviteCodeModal(false);
                    setSelectedCodeOrgId(null);
                  }
                }}
              >
                <div
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    maxWidth: '450px',
                    width: '100%',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  }}
                >
                  <h2 style={{ margin: '0 0 8px 0', color: '#1E3A5F', fontSize: '20px' }}>
                    Generate Invite Code
                  </h2>
                  <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '14px' }}>
                    Choose which organization this invite code will assign new members to.
                  </p>

                  <div style={{ marginBottom: '20px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#64748B',
                        marginBottom: '8px',
                      }}
                    >
                      Organization
                    </label>
                    <select
                      value={selectedCodeOrgId || ''}
                      onChange={(e) => setSelectedCodeOrgId(e.target.value || null)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        fontSize: '14px',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="">Community-wide (no organization)</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                      {selectedCodeOrgId
                        ? 'Members who join using this code will be assigned to the selected organization.'
                        : 'Members who join using this code will not be assigned to any organization.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      onClick={() => {
                        setShowInviteCodeModal(false);
                        setSelectedCodeOrgId(null);
                      }}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: 'white',
                        color: '#64748B',
                        border: '1px solid #E2E8F0',
                        borderRadius: '24px',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '14px',
                        transition: 'all 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleCreateCode(selectedCodeOrgId)}
                      disabled={creatingCode}
                      style={{
                        padding: '10px 24px',
                        backgroundColor: '#2B7CF6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '24px',
                        cursor: creatingCode ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        fontSize: '14px',
                        opacity: creatingCode ? 0.6 : 1,
                        transition: 'background-color 0.2s',
                      }}
                      onMouseOver={(e) => {
                        if (!creatingCode) {
                          e.currentTarget.style.backgroundColor = '#1E6AD9';
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#2B7CF6';
                      }}
                    >
                      {creatingCode ? 'Generating...' : 'Generate Code'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Organizations Tab */}
        {activeTab === 'organizations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header with Create Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
                  Organizations
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748B' }}>
                  Manage organizations within this community
                </p>
              </div>
              <button
                onClick={() => setShowOrgModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '14px',
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
                Add Organization
              </button>
            </div>

            {/* Organizations Grid */}
            {organizations.length === 0 ? (
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#1E3A5F' }}>No organizations yet</h3>
                <p style={{ margin: 0, color: '#64748B' }}>
                  Organizations allow you to group members and track metrics separately.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '16px',
                }}
              >
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '16px',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      border: '1px solid #E2E8F0',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => navigate(`/community/${slug}/org/${org.slug}/admin`)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = '#2B7CF6';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(43, 124, 246, 0.15)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: '#1E3A5F' }}>
                          {org.name}
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                          {org.slug}
                        </p>
                      </div>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 500,
                          backgroundColor: org.isActive ? '#DCFCE7' : '#F1F5F9',
                          color: org.isActive ? '#16A34A' : '#64748B',
                        }}
                      >
                        {org.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {org.primaryContactEmail && (
                      <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#64748B' }}>
                        Contact: {org.primaryContactEmail}
                      </p>
                    )}
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                        Click to manage
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create Organization Modal */}
            {showOrgModal && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '20px',
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowOrgModal(false);
                  }
                }}
              >
                <div
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    maxWidth: '450px',
                    width: '100%',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  }}
                >
                  <h2 style={{ margin: '0 0 8px 0', color: '#1E3A5F', fontSize: '20px' }}>
                    Add Organization
                  </h2>
                  <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '14px' }}>
                    Create a new organization within this community.
                  </p>

                  <div style={{ marginBottom: '16px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#64748B',
                        marginBottom: '6px',
                      }}
                    >
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="e.g., Cincinnati IAFF Local 48"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#2B7CF6';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#E2E8F0';
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#64748B',
                        marginBottom: '6px',
                      }}
                    >
                      Primary Contact Email
                    </label>
                    <input
                      type="email"
                      value={newOrgContact}
                      onChange={(e) => setNewOrgContact(e.target.value)}
                      placeholder="admin@organization.com"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#2B7CF6';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#E2E8F0';
                      }}
                    />
                  </div>

                  {/* Matching Settings */}
                  <div
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '20px',
                    }}
                  >
                    <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#1E3A5F' }}>
                      Matching Settings
                    </p>

                    {/* Match within org only */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '12px',
                      }}
                    >
                      <div style={{ flex: 1, marginRight: '12px' }}>
                        <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 500, color: '#1E3A5F' }}>
                          Match within organization only
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                          Members will only be matched with helpers from their own organization
                        </p>
                      </div>
                      <div
                        onClick={() => setNewOrgMatchWithinOnly(!newOrgMatchWithinOnly)}
                        style={{
                          width: '44px',
                          height: '24px',
                          backgroundColor: newOrgMatchWithinOnly ? '#16A34A' : '#CBD5E1',
                          borderRadius: '12px',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '2px',
                            left: newOrgMatchWithinOnly ? '22px' : '2px',
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }}
                        />
                      </div>
                    </div>

                    {/* Allow cross-org matching (only when match within org is ON) */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        opacity: newOrgMatchWithinOnly ? 1 : 0.5,
                        pointerEvents: newOrgMatchWithinOnly ? 'auto' : 'none',
                      }}
                    >
                      <div style={{ flex: 1, marginRight: '12px' }}>
                        <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 500, color: '#1E3A5F' }}>
                          Allow cross-organization matching
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                          If no helpers are available in the organization, expand search to the broader community
                        </p>
                      </div>
                      <div
                        onClick={() => newOrgMatchWithinOnly && setNewOrgAllowCrossOrg(!newOrgAllowCrossOrg)}
                        style={{
                          width: '44px',
                          height: '24px',
                          backgroundColor: newOrgAllowCrossOrg ? '#16A34A' : '#CBD5E1',
                          borderRadius: '12px',
                          position: 'relative',
                          cursor: newOrgMatchWithinOnly ? 'pointer' : 'not-allowed',
                          transition: 'background-color 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '2px',
                            left: newOrgAllowCrossOrg ? '22px' : '2px',
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      onClick={() => {
                        setShowOrgModal(false);
                        setNewOrgName('');
                        setNewOrgContact('');
                        setNewOrgMatchWithinOnly(true);
                        setNewOrgAllowCrossOrg(false);
                      }}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: 'white',
                        color: '#64748B',
                        border: '1px solid #E2E8F0',
                        borderRadius: '24px',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '14px',
                        transition: 'all 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateOrg}
                      disabled={creatingOrg || !newOrgName.trim()}
                      style={{
                        padding: '10px 24px',
                        backgroundColor: '#2B7CF6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '24px',
                        cursor: creatingOrg || !newOrgName.trim() ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        fontSize: '14px',
                        opacity: creatingOrg || !newOrgName.trim() ? 0.6 : 1,
                        transition: 'background-color 0.2s',
                      }}
                      onMouseOver={(e) => {
                        if (!creatingOrg && newOrgName.trim()) {
                          e.currentTarget.style.backgroundColor = '#1E6AD9';
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#2B7CF6';
                      }}
                    >
                      {creatingOrg ? 'Creating...' : 'Create Organization'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Role Change Confirmation Modal */}
      {roleChangeConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setRoleChangeConfirm(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
              Confirm Role Change
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748B' }}>
              Are you sure you want to change <strong>{roleChangeConfirm.email}</strong>'s role to{' '}
              <strong>{roleChangeConfirm.newRole === 'member' ? 'Member' : roleChangeConfirm.newRole.charAt(0).toUpperCase() + roleChangeConfirm.newRole.slice(1)}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setRoleChangeConfirm(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleRoleChange(roleChangeConfirm.membershipId, roleChangeConfirm.newRole);
                  setRoleChangeConfirm(null);
                }}
                disabled={updatingRole === roleChangeConfirm.membershipId}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  opacity: updatingRole === roleChangeConfirm.membershipId ? 0.6 : 1,
                }}
              >
                {updatingRole === roleChangeConfirm.membershipId ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Code Confirmation Modal */}
      {deactivateCodeConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setDeactivateCodeConfirm(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600, color: '#DC2626' }}>
              Deactivate Invite Code
            </h3>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B' }}>
              Are you sure you want to deactivate this invite code?
            </p>
            <p
              style={{
                margin: '0 0 20px 0',
                fontSize: '18px',
                fontWeight: 600,
                fontFamily: 'monospace',
                letterSpacing: '1px',
                color: '#1E3A5F',
                backgroundColor: '#F8FAFC',
                padding: '12px',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              {deactivateCodeConfirm.code}
            </p>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94A3B8' }}>
              New members will no longer be able to use this code to join.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setDeactivateCodeConfirm(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleToggleCode(deactivateCodeConfirm.codeId, false);
                  setDeactivateCodeConfirm(null);
                }}
                disabled={togglingCode === deactivateCodeConfirm.codeId}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#DC2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  opacity: togglingCode === deactivateCodeConfirm.codeId ? 0.6 : 1,
                }}
              >
                {togglingCode === deactivateCodeConfirm.codeId ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span style={{ fontSize: '24px' }}>{icon}</span>
        <span style={{ fontSize: '14px', color: '#64748B' }}>{label}</span>
      </div>
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
