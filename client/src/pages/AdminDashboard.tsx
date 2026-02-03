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
        return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'helper':
        return { backgroundColor: '#d1fae5', color: '#065f46' };
      default:
        return { backgroundColor: '#e5e7eb', color: '#374151' };
    }
  };

  const getSeverityBadgeStyle = (severity: string, riskLevel: string) => {
    const level = riskLevel || severity;
    if (level === 'critical' || level === 'crisis') {
      return { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' };
    }
    if (level === 'high' || level === 'moderate_concern') {
      return { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde047' };
    }
    return { backgroundColor: '#e5e7eb', color: '#374151', borderColor: '#d1d5db' };
  };

  if (isLoading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (error || !community) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: 'red' }}>{error || 'Something went wrong'}</p>
        <Link to={`/community/${slug}`}>Back to Dashboard</Link>
      </div>
    );
  }

  const { branding } = community.config;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div
        style={{
          backgroundColor: branding.primaryColor,
          color: 'white',
          padding: '20px',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
              <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '14px' }}>
                {community.name}
              </p>
            </div>
            <Link
              to={`/community/${slug}`}
              style={{
                color: 'white',
                textDecoration: 'none',
                padding: '8px 16px',
                border: '1px solid white',
                borderRadius: '4px',
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '8px', padding: '0 20px' }}>
          {(['overview', 'members', 'alerts'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '16px 24px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? `2px solid ${branding.primaryColor}` : '2px solid transparent',
                color: activeTab === tab ? branding.primaryColor : '#6b7280',
                fontWeight: activeTab === tab ? 600 : 400,
                cursor: 'pointer',
                fontSize: '15px',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
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
            <StatCard icon="🟢" label="Active Now" value={overview.activeConversations} color="#059669" />
            <StatCard
              icon="⭐"
              label="Average Rating"
              value={overview.averageRating ? overview.averageRating.toFixed(1) : 'N/A'}
            />
            <StatCard icon="⚠️" label="Safety Alerts" value={overview.totalAlerts} />
            <StatCard icon="🚨" label="Crisis Alerts" value={overview.crisisAlerts} color="#dc2626" />
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
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
                  {members.map((member) => (
                    <tr key={member.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={tdStyle}>{member.email}</td>
                      <td style={tdStyle}>
                        <select
                          value={member.role === 'seeker' || member.role === 'both' ? 'member' : member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          disabled={updatingRole === member.id}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #d1d5db',
                            backgroundColor: 'white',
                            fontSize: '13px',
                            cursor: updatingRole === member.id ? 'not-allowed' : 'pointer',
                            ...getRoleBadgeStyle(member.role),
                          }}
                        >
                          <option value="member">Member</option>
                          <option value="helper">Helper</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td style={tdStyle}>
                        {member.isAvailable ? (
                          <span style={{ color: '#059669' }}>Yes</span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>No</span>
                        )}
                      </td>
                      <td style={tdStyle}>{formatDate(member.joinedAt)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{member.seekerConversations}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{member.helperConversations}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {member.avgHelperRating ? member.avgHelperRating.toFixed(1) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {members.length === 0 && (
              <p style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
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
                  borderRadius: '8px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>No safety alerts</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>
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
                      borderRadius: '8px',
                      padding: '16px 20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      borderLeft: `4px solid ${badgeStyle.borderColor}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              ...badgeStyle,
                            }}
                          >
                            {alert.riskLevel || alert.severity}
                          </span>
                          <span style={{ fontSize: '13px', color: '#6b7280' }}>
                            {formatDateTime(alert.createdAt)}
                          </span>
                        </div>
                        {alert.flags.length > 0 && (
                          <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>
                            <strong>Flags:</strong> {alert.flags.join(', ')}
                          </p>
                        )}
                        {alert.suggestedAction && (
                          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                            <strong>Suggested:</strong> {alert.suggestedAction}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => navigate(`/chat/${alert.conversationId}`)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
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
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span style={{ fontSize: '24px' }}>{icon}</span>
        <span style={{ fontSize: '14px', color: '#6b7280' }}>{label}</span>
      </div>
      <p style={{ margin: 0, fontSize: '32px', fontWeight: 600, color: color || '#1f2937' }}>
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
  color: '#6b7280',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '14px',
  color: '#1f2937',
};
