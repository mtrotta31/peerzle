import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Community,
  AdminOverview,
  AdminMember,
  AdminAlert,
  getCommunity,
  getAdminOverview,
  getAdminMembers,
  getAdminAlerts,
  updateMemberRole,
} from '../services/api';

type TabType = 'overview' | 'members' | 'alerts';

export default function AdminDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

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
        } else if (activeTab === 'alerts' && alerts.length === 0) {
          const alertsData = await getAdminAlerts(slug!);
          setAlerts(alertsData);
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
      </header>

      {/* Tabs */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '8px', padding: '0 20px' }}>
          {(['overview', 'members', 'alerts'] as TabType[]).map((tab) => (
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
                textTransform: 'capitalize',
                transition: 'color 0.2s',
              }}
            >
              {tab}
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
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {alerts.length === 0 ? (
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#1E3A5F' }}>No safety alerts</h3>
                <p style={{ margin: 0, color: '#64748B' }}>
                  All conversations are proceeding safely.
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
        )}
      </div>
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
