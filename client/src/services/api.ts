import axios, { AxiosError } from 'axios';

// In production with same-origin deployment, VITE_API_URL should be empty string
// which means axios will use relative URLs (same origin)
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token expiration globally
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; code?: string }>) => {
    if (error.response?.status === 401) {
      const code = error.response.data?.code;
      // Clear token and redirect to login on expiration
      if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID') {
        localStorage.removeItem('token');
        // Dispatch custom event so AuthContext can react
        window.dispatchEvent(new CustomEvent('auth:session-expired', {
          detail: { reason: code === 'TOKEN_EXPIRED' ? 'Session expired' : 'Invalid session' }
        }));
      }
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  createdAt: string;
  isSuperAdmin?: boolean;
  needsProfileUpdate?: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export async function signup(
  email: string,
  password: string,
  acceptedTermsVersion: string,
  firstName: string,
  lastName: string
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/auth/signup', {
    email,
    password,
    acceptedTermsVersion,
    firstName,
    lastName,
  });
  return response.data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/auth/login', { email, password });
  return response.data;
}

export async function getCurrentUser(): Promise<User> {
  const response = await api.get<User>('/api/auth/me');
  return response.data;
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>('/api/auth/forgot-password', { email });
  return response.data;
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>('/api/auth/reset-password', { token, newPassword });
  return response.data;
}

// Legal types
export interface LegalContent {
  version: string;
  content: string;
}

export interface AcceptanceStatus {
  accepted: boolean;
  version: string | null;
  acceptedAt: string | null;
  currentVersion: string;
}

// Legal API
export async function getLegalTerms(): Promise<LegalContent> {
  const response = await api.get<LegalContent>('/api/legal/terms');
  return response.data;
}

export async function getLegalPrivacy(): Promise<LegalContent> {
  const response = await api.get<LegalContent>('/api/legal/privacy');
  return response.data;
}

export async function getAcceptanceStatus(): Promise<AcceptanceStatus> {
  const response = await api.get<AcceptanceStatus>('/api/legal/acceptance-status');
  return response.data;
}

export async function acceptTerms(version: string): Promise<{ success: boolean; version: string }> {
  const response = await api.post<{ success: boolean; version: string }>('/api/legal/accept', { version });
  return response.data;
}

// Community types
export interface CommunityConfig {
  branding: {
    primaryColor: string;
    secondaryColor: string;
  };
  terminology: {
    helper: string;
    seeker: string;
    conversation: string;
  };
  topics: string[];
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  config: CommunityConfig;
  verification_method: 'open' | 'invite_code' | 'email_domain';
  allowed_email_domains?: string[];
  is_public: boolean;
  helper_verification_required: boolean;
  created_at: string;
}

export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
}

export interface Membership {
  id: string;
  user_id: string;
  community_id: string;
  role: 'seeker' | 'helper' | 'both' | 'admin';
  is_verified_helper: boolean;
  training_completed: boolean;
  profile: Record<string, unknown>;
  topics: unknown[];
  is_available: boolean;
  created_at: string;
  community_name?: string;
  organization_id?: string | null;
  organization?: OrganizationInfo | null;
  display_name?: string | null;
}

// Community API
export async function getCommunities(): Promise<Community[]> {
  const response = await api.get<Community[]>('/api/communities');
  return response.data;
}

export async function getCommunity(slug: string): Promise<Community> {
  const response = await api.get<Community>(`/api/communities/${slug}`);
  return response.data;
}

export interface CommunityDetails {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  topics: string[];
  verification_method: 'open' | 'invite_code' | 'email_domain';
  is_public: boolean;
  member_count: number;
  organizations: { id: string; name: string; slug: string }[];
}

export async function getCommunityDetails(slug: string): Promise<CommunityDetails> {
  const response = await api.get<CommunityDetails>(`/api/communities/${slug}/details`);
  return response.data;
}

export interface JoinCommunityResponse {
  membership?: Membership;
  error?: string;
  reason?: 'invite_code_required' | 'invalid_code' | 'code_inactive' | 'code_expired' | 'code_max_uses' | 'email_domain_not_allowed' | 'no_domains_configured';
  allowedDomains?: string[];
}

export async function joinCommunity(slug: string, inviteCode?: string): Promise<Membership> {
  const response = await api.post<Membership>(`/api/communities/${slug}/join`, { inviteCode });
  return response.data;
}

// Invite Code types
export interface InviteCode {
  id: number;
  community_id: string;
  code: string;
  created_by: string;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  creator_email?: string;
  organization_id?: string | null;
  organization_name?: string | null;
  organization_slug?: string | null;
}

// Invite Code API
export async function getInviteCodes(communitySlug: string, organizationId?: string): Promise<InviteCode[]> {
  const params = organizationId ? `?organization_id=${organizationId}` : '';
  const response = await api.get<InviteCode[]>(`/api/communities/${communitySlug}/invite-codes${params}`);
  return response.data;
}

export async function createInviteCode(
  communitySlug: string,
  options?: { maxUses?: number; expiresInDays?: number; organizationId?: string }
): Promise<InviteCode> {
  const response = await api.post<InviteCode>(`/api/communities/${communitySlug}/invite-codes`, options || {});
  return response.data;
}

export async function updateInviteCode(
  communitySlug: string,
  codeId: number,
  isActive: boolean
): Promise<InviteCode> {
  const response = await api.put<InviteCode>(`/api/communities/${communitySlug}/invite-codes/${codeId}`, { isActive });
  return response.data;
}

// Organization types
export interface OrganizationSettings {
  match_within_org_only: boolean;
  allow_cross_org_matching: boolean;
}

export interface Organization {
  id: string;
  communityId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryContactEmail: string | null;
  settings: OrganizationSettings;
  isActive: boolean;
  createdAt: string;
  memberCount?: number;
  helperCount?: number;
  activeHelperCount?: number;
  inviteCodeCount?: number;
  conversationCount?: number;
}

export interface OrganizationMember {
  id: string;
  email: string;
  role: string;
  isAvailable: boolean;
  isVerifiedHelper: boolean;
  displayName: string | null;
  joinedAt: string;
  seekerConversations: number;
  helperConversations: number;
  avgHelperRating: number | null;
}

export interface OrgInviteCode {
  id: number;
  code: string;
  organizationId: string;
  maxUses: number | null;
  currentUses: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

// Organization API
export async function getOrganizations(communitySlug: string): Promise<Organization[]> {
  const response = await api.get<Organization[]>(`/api/organizations/${communitySlug}`);
  return response.data;
}

export async function createOrganization(
  communitySlug: string,
  data: { name: string; slug?: string; primaryContactEmail?: string; settings?: Partial<OrganizationSettings> }
): Promise<Organization> {
  const response = await api.post<Organization>(`/api/organizations/${communitySlug}`, data);
  return response.data;
}

export async function getOrganization(communitySlug: string, orgSlug: string): Promise<Organization> {
  const response = await api.get<Organization>(`/api/organizations/${communitySlug}/${orgSlug}`);
  return response.data;
}

export async function updateOrganization(
  communitySlug: string,
  orgSlug: string,
  data: Partial<{ name: string; primaryContactEmail: string; settings: OrganizationSettings; logoUrl: string; isActive: boolean }>
): Promise<Organization> {
  const response = await api.put<Organization>(`/api/organizations/${communitySlug}/${orgSlug}`, data);
  return response.data;
}

export async function getOrganizationMembers(communitySlug: string, orgSlug: string): Promise<OrganizationMember[]> {
  const response = await api.get<OrganizationMember[]>(`/api/organizations/${communitySlug}/${orgSlug}/members`);
  return response.data;
}

export async function createOrgInviteCode(
  communitySlug: string,
  orgSlug: string,
  options?: { maxUses?: number; expiresInDays?: number }
): Promise<OrgInviteCode> {
  const response = await api.post<OrgInviteCode>(`/api/organizations/${communitySlug}/${orgSlug}/invite-codes`, options || {});
  return response.data;
}

// Helper Verification types
export interface VerificationRequest {
  id: number;
  membershipId: string;
  communityId: string;
  userId: string;
  userEmail?: string;
  qualifications: string;
  status: 'pending' | 'approved' | 'denied';
  reviewedBy: string | null;
  reviewerEmail?: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

// Helper Verification API
export async function getMyVerificationRequest(communitySlug: string): Promise<VerificationRequest | null> {
  const response = await api.get<VerificationRequest | null>(`/api/communities/${communitySlug}/verification-request`);
  return response.data;
}

export async function submitVerificationRequest(
  communitySlug: string,
  qualifications: string
): Promise<VerificationRequest> {
  const response = await api.post<VerificationRequest>(`/api/communities/${communitySlug}/verification-request`, {
    qualifications,
  });
  return response.data;
}

export async function getVerificationRequests(communitySlug: string): Promise<VerificationRequest[]> {
  const response = await api.get<VerificationRequest[]>(`/api/communities/${communitySlug}/verification-requests`);
  return response.data;
}

export async function reviewVerificationRequest(
  communitySlug: string,
  requestId: number,
  status: 'approved' | 'denied',
  reviewNotes?: string
): Promise<VerificationRequest> {
  const response = await api.put<VerificationRequest>(
    `/api/communities/${communitySlug}/verification-requests/${requestId}`,
    { status, reviewNotes }
  );
  return response.data;
}

export async function getMembership(slug: string): Promise<Membership> {
  const response = await api.get<Membership>(`/api/communities/${slug}/membership`);
  return response.data;
}

// Conversation types
export interface Message {
  id: string;
  conversation_id: string;
  sender_membership_id: string | null;
  content: string;
  created_at: string;
  moderation_result: { sender?: string } | null;
  sender_email: string | null;
}

export interface ConnectionData {
  match_score: number | null;
  seeker_display_name: string | null;
  helper_display_name: string | null;
  helper_is_verified: boolean;
  shared_topics: string[];
  same_org?: boolean;
  org_name?: string;
}

export interface Conversation {
  id: string;
  community_id: string;
  seeker_membership_id: string;
  helper_membership_id: string | null;
  topic: string | null;
  status: 'matching' | 'active' | 'ended';
  started_at: string;
  ended_at: string | null;
  seeker_rating: number | null;
  helper_rating: number | null;
  safety_flags: unknown[];
  match_score?: number | null;
  seeker_pre_mood?: number | null;
  seeker_post_mood?: number | null;
  helper_compliment_badges?: string[] | null;
  conversation_saved_by?: string[] | null;
  mood_change?: number | null;
  community_slug?: string;
  community_name?: string;
  messages?: Message[];
  connection_data?: ConnectionData | null;
  // Added for MessagesPage
  last_message?: string | null;
  last_message_at?: string | null;
  peer_display_name?: string | null;
  user_role?: 'seeker' | 'helper';
  // Demo community flag
  is_demo?: boolean;
}

// Conversation API
export async function startConversation(communitySlug: string, topic: string): Promise<Conversation> {
  const response = await api.post<Conversation>('/api/conversations/start', { communitySlug, topic });
  return response.data;
}

export async function getConversation(id: string): Promise<Conversation> {
  const response = await api.get<Conversation>(`/api/conversations/${id}`);
  return response.data;
}

export async function getActiveConversations(): Promise<Conversation[]> {
  const response = await api.get<Conversation[]>('/api/conversations/active');
  return response.data;
}

export async function endConversation(id: string): Promise<Conversation> {
  const response = await api.post<Conversation>(`/api/conversations/${id}/end`);
  return response.data;
}

export async function setPreMood(conversationId: string, mood: number): Promise<Conversation> {
  const response = await api.put<Conversation>(`/api/conversations/${conversationId}/pre-mood`, { mood });
  return response.data;
}

export async function setPostMood(conversationId: string, mood: number, badges?: string[]): Promise<Conversation> {
  const response = await api.put<Conversation>(`/api/conversations/${conversationId}/post-mood`, { mood, badges });
  return response.data;
}

export async function saveConversation(conversationId: string): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean }>(`/api/conversations/${conversationId}/save`);
  return response.data;
}

export async function startPeerBotEarly(conversationId: string): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean }>(`/api/conversations/${conversationId}/start-peerbot`);
  return response.data;
}

// Message API
export async function sendMessage(conversationId: string, content: string): Promise<Message> {
  const response = await api.post<Message>('/api/messages', { conversationId, content });
  return response.data;
}

// Helper API
export async function toggleAvailability(communitySlug: string, isAvailable: boolean): Promise<Membership> {
  const response = await api.put<Membership>(`/api/communities/${communitySlug}/availability`, { isAvailable });
  return response.data;
}

export interface PendingConversation extends Conversation {
  seeker_name: string;
  match_score?: number;
  same_org?: boolean;
  org_name?: string | null;
}

export async function getPendingConversations(): Promise<PendingConversation[]> {
  const response = await api.get<PendingConversation[]>('/api/helpers/pending');
  return response.data;
}

export async function acceptConversation(conversationId: string): Promise<Conversation> {
  const response = await api.post<Conversation>(`/api/helpers/accept/${conversationId}`);
  return response.data;
}

// Rating types
export interface Rating {
  id: string;
  conversation_id: string;
  membership_id: string;
  role: 'seeker' | 'helper';
  rating: number;
  felt_heard: boolean | null;
  would_recommend: boolean | null;
  feedback_text: string | null;
  created_at: string;
}

export interface SubmitRatingData {
  conversationId: string;
  rating: number;
  role: 'seeker' | 'helper';
  feltHeard?: boolean;
  wouldRecommend?: boolean;
  feedbackText?: string;
}

// Rating API
export async function submitRating(data: SubmitRatingData): Promise<Rating> {
  const response = await api.post<Rating>('/api/ratings', data);
  return response.data;
}

export async function getRating(conversationId: string): Promise<Rating> {
  const response = await api.get<Rating>(`/api/ratings/${conversationId}`);
  return response.data;
}

// History types
export interface HistoryConversation {
  id: string;
  topic: string | null;
  started_at: string;
  ended_at: string | null;
  role: 'seeker' | 'helper';
  other_user_display_name: string | null;
  rating: number | null;
  felt_heard: boolean | null;
  would_recommend: boolean | null;
  seeker_pre_mood: number | null;
  seeker_post_mood: number | null;
  helper_compliment_badges: string[] | null;
  is_saved: boolean;
}

// History API
export async function getSessionHistory(communitySlug: string): Promise<HistoryConversation[]> {
  const response = await api.get<HistoryConversation[]>(`/api/history/${communitySlug}`);
  return response.data;
}

// Helper Dashboard types
export interface RecentHelperSession {
  id: string;
  topic: string | null;
  ended_at: string;
  seeker_rating: number | null;
}

export interface BadgeCount {
  badge: string;
  count: number;
}

export interface HelperDashboardStats {
  totalSessions: number;
  activeSessions: number;
  averageRating: number | null;
  totalRatings: number;
  feltHeardPercent: number | null;
  wouldRecommendPercent: number | null;
  totalHelpTime: number;
  recentSessions: RecentHelperSession[];
  averageMoodImprovement: number | null;
  badgeCounts: BadgeCount[];
  responseStreak: number;
}

// Helper Dashboard API
export async function getHelperDashboard(communitySlug: string): Promise<HelperDashboardStats> {
  const response = await api.get<HelperDashboardStats>(`/api/dashboard/${communitySlug}/helper`);
  return response.data;
}

// Facilitator types
export interface FacilitatorResponse {
  suggestions: string[];
  tip: string;
}

export interface FacilitatorMessage {
  content: string;
  sender_role: 'seeker' | 'helper' | 'peerbot';
}

// Facilitator API
export async function getFacilitatorSuggestions(
  conversationId: string,
  recentMessages: FacilitatorMessage[]
): Promise<FacilitatorResponse> {
  const response = await api.post<FacilitatorResponse>('/api/facilitator/suggestions', {
    conversationId,
    recentMessages,
  });
  return response.data;
}

// Admin types
export interface AdminOverview {
  totalMembers: number;
  totalConversations: number;
  activeConversations: number;
  endedConversations: number;
  averageRating: number | null;
  totalAlerts: number;
  crisisAlerts: number;
}

export interface AdminStatsUsage {
  totalConversations: number;
  activeHelpers: number;
  totalHelpers: number;
  totalMembers: number;
  conversationsThisWeek: number;
  conversationsThisMonth: number;
  avgConversationDurationMinutes: number | null;
  conversationsWithHumanHelper: number;
  conversationsPeerbotOnly: number;
}

export interface AdminStatsOutcomes {
  avgMoodImprovement: number | null;
  pctMoodImproved: number;
  pctFeltHeard: number;
  avgRating: number | null;
  totalRatedConversations: number;
  pctWouldRecommend: number | null;
}

export interface AdminStatsSafety {
  totalAlerts: number;
  alertsThisMonth: number;
  alertsBySeverity: Record<string, number>;
  totalReports: number;
  reportsThisMonth: number;
}

export interface AdminStatsTopTopic {
  topic: string;
  conversationCount: number;
}

export interface AdminStatsEngagement {
  avgConversationsPerUser: number | null;
  repeatUsers: number;
  pctRepeatUsers: number;
  uniqueSeekers: number;
}

export interface AdminStatsOrgBreakdown {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  conversationCount: number;
  avgMoodImprovement: number | null;
}

export interface AdminStats {
  firstConversationDate: string | null;
  organizationId: string | null;
  usage: AdminStatsUsage;
  outcomes: AdminStatsOutcomes;
  safety: AdminStatsSafety;
  topTopics: AdminStatsTopTopic[];
  engagement: AdminStatsEngagement;
  organizationBreakdown?: AdminStatsOrgBreakdown[];
}

export interface AdminMember {
  id: string;
  email: string;
  role: string;
  isAvailable: boolean;
  joinedAt: string;
  seekerConversations: number;
  helperConversations: number;
  avgHelperRating: number | null;
}

export interface AdminAlert {
  id: string;
  conversationId: string;
  severity: string;
  riskLevel: string;
  flags: string[];
  suggestedAction: string;
  excerpt?: string;
  createdAt: string;
  // User identity for admin safety context
  userRealName?: string | null;
  userDisplayName?: string | null;
  userEmail?: string;
}

// Admin API
export async function getAdminOverview(communitySlug: string): Promise<AdminOverview> {
  const response = await api.get<AdminOverview>(`/api/admin/${communitySlug}/overview`);
  return response.data;
}

export async function getAdminStats(communitySlug: string, organizationId?: string): Promise<AdminStats> {
  const params = organizationId ? { organization_id: organizationId } : {};
  const response = await api.get<AdminStats>(`/api/admin/stats/${communitySlug}`, { params });
  return response.data;
}

export async function getAdminMembers(communitySlug: string): Promise<AdminMember[]> {
  const response = await api.get<AdminMember[]>(`/api/admin/${communitySlug}/members`);
  return response.data;
}

export async function getAdminAlerts(communitySlug: string, organizationId?: string): Promise<AdminAlert[]> {
  const params = organizationId ? `?organization_id=${organizationId}` : '';
  const response = await api.get<AdminAlert[]>(`/api/admin/${communitySlug}/alerts${params}`);
  return response.data;
}

export async function updateMemberRole(
  communitySlug: string,
  membershipId: string,
  role: string
): Promise<{ success: boolean; role: string }> {
  const response = await api.put<{ success: boolean; role: string }>(
    `/api/admin/${communitySlug}/members/${membershipId}/role`,
    { role }
  );
  return response.data;
}

// Training types
export interface TrainingModuleOverview {
  moduleNumber: number;
  title: string;
  description: string;
  isCompleted: boolean;
  completedAt: string | null;
  score: number | null;
}

export interface TrainingStatus {
  trainingCompleted: boolean;
  modules: TrainingModuleOverview[];
  totalModules: number;
  completedCount: number;
}

export interface TrainingQuestion {
  id: number;
  question: string;
  options: string[];
}

export interface TrainingModule {
  moduleNumber: number;
  title: string;
  description: string;
  lessonContent: string;
  questions: TrainingQuestion[];
  isCompleted: boolean;
  score: number | null;
  completedAt: string | null;
  passingScore: number;
}

export interface QuizResult {
  questionId: number;
  question: string;
  selectedAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  explanation: string;
}

export interface TrainingCompletionResult {
  passed: boolean;
  score: number;
  passingScore: number;
  results: QuizResult[];
  allModulesComplete?: boolean;
  message?: string;
}

// Training API
export async function getTrainingStatus(communitySlug: string): Promise<TrainingStatus> {
  const response = await api.get<TrainingStatus>(`/api/training/${communitySlug}/status`);
  return response.data;
}

export async function getTrainingModule(communitySlug: string, moduleNumber: number): Promise<TrainingModule> {
  const response = await api.get<TrainingModule>(`/api/training/${communitySlug}/module/${moduleNumber}`);
  return response.data;
}

export async function completeTrainingModule(
  communitySlug: string,
  moduleNumber: number,
  answers: number[]
): Promise<TrainingCompletionResult> {
  const response = await api.post<TrainingCompletionResult>(
    `/api/training/${communitySlug}/module/${moduleNumber}/complete`,
    { answers }
  );
  return response.data;
}

// Onboarding types
export interface OnboardingStatus {
  onboardingCompleted: boolean;
  displayName: string | null;
}

export interface TopicRating {
  topic: string;
  historyRating: number;
  knowledgeRating: number;
  copingRating: number;
}

export interface OnboardingData {
  displayName: string;
  topics: TopicRating[];
  demographics?: Record<string, unknown>;
  role: 'seeker' | 'both';
}

export interface OnboardingResult {
  success: boolean;
  displayName: string;
  topicsCount: number;
  role: string;
}

// Onboarding API
export async function getOnboardingStatus(communitySlug: string): Promise<OnboardingStatus> {
  const response = await api.get<OnboardingStatus>(`/api/onboarding/${communitySlug}/status`);
  return response.data;
}

export async function getCommunityTopics(communitySlug: string): Promise<string[]> {
  const response = await api.get<{ topics: string[] }>(`/api/onboarding/${communitySlug}/topics`);
  return response.data.topics;
}

export async function generateDisplayName(communitySlug: string): Promise<string> {
  const response = await api.post<{ displayName: string }>(`/api/onboarding/${communitySlug}/generate-name`);
  return response.data.displayName;
}

export async function completeOnboarding(
  communitySlug: string,
  data: OnboardingData
): Promise<OnboardingResult> {
  const response = await api.post<OnboardingResult>(`/api/onboarding/${communitySlug}/complete`, data);
  return response.data;
}

// Report types
export interface UserReport {
  id: number;
  conversationId: string;
  reporterEmail: string;
  reportedEmail: string;
  category: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'dismissed';
  adminNotes: string | null;
  reviewerEmail: string | null;
  reviewedAt: string | null;
  createdAt: string;
  conversationTopic: string | null;
}

export interface SubmitReportResponse {
  id: number;
  conversationId: string;
  category: string;
  description: string | null;
  status: string;
  createdAt: string;
}

// Report API
export async function submitReport(
  conversationId: string,
  category: string,
  description?: string
): Promise<SubmitReportResponse> {
  const response = await api.post<SubmitReportResponse>(`/api/reports/${conversationId}`, { category, description });
  return response.data;
}

export async function getReports(communitySlug: string, organizationId?: string): Promise<UserReport[]> {
  const params = organizationId ? `?organization_id=${organizationId}` : '';
  const response = await api.get<UserReport[]>(`/api/reports/${communitySlug}/list${params}`);
  return response.data;
}

export async function updateReport(
  communitySlug: string,
  reportId: number,
  status: 'reviewed' | 'dismissed',
  adminNotes?: string
): Promise<{ id: number; status: string; adminNotes: string | null; reviewedAt: string }> {
  const response = await api.put<{ id: number; status: string; adminNotes: string | null; reviewedAt: string }>(
    `/api/reports/${communitySlug}/${reportId}`,
    { status, adminNotes }
  );
  return response.data;
}

// Suggestions types
export interface SuggestionsMessage {
  role: 'seeker' | 'helper' | 'peerbot';
  content: string;
}

// Suggestions API
export async function generateSuggestions(
  conversationId: string,
  recentMessages: SuggestionsMessage[],
  mode: 'helper' | 'seeker'
): Promise<{ suggestions: string[] }> {
  const response = await api.post<{ suggestions: string[] }>('/api/suggestions/generate', {
    conversation_id: conversationId,
    recent_messages: recentMessages,
    mode,
  });
  return response.data;
}

export async function generateCoachingTip(
  conversationId: string,
  recentMessages: SuggestionsMessage[]
): Promise<{ tip: string }> {
  const response = await api.post<{ tip: string }>('/api/suggestions/generate', {
    conversation_id: conversationId,
    recent_messages: recentMessages,
    mode: 'coaching',
  });
  return response.data;
}

// Push notification API
export async function subscribeToPushNotifications(
  endpoint: string,
  keys: { p256dh: string; auth: string }
): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean }>('/api/push/subscribe', { endpoint, keys });
  return response.data;
}

export async function unsubscribeFromPushNotifications(endpoint: string): Promise<{ success: boolean }> {
  const response = await api.delete<{ success: boolean }>('/api/push/unsubscribe', {
    data: { endpoint },
  });
  return response.data;
}

export async function getVapidPublicKey(): Promise<string> {
  const response = await api.get<{ publicKey: string }>('/api/push/vapid-public-key');
  return response.data.publicKey;
}

export async function testPushNotification(): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>('/api/push/test');
  return response.data;
}

// ============================================================================
// SUPER ADMIN API
// ============================================================================

// Platform overview
export interface PlatformOverview {
  totalCommunities: number;
  totalOrganizations: number;
  totalUsers: number;
  totalConversations: number;
  conversationsThisWeek: number;
  conversationsThisMonth: number;
  activeCommunities: number;
}

export async function getSuperAdminOverview(): Promise<PlatformOverview> {
  const response = await api.get<PlatformOverview>('/api/super-admin/overview');
  return response.data;
}

// Community types
export interface SuperAdminCommunity {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  verificationMethod: string;
  isPublic: boolean;
  branding: { primaryColor?: string; secondaryColor?: string };
  terminology: { helper?: string; seeker?: string };
  createdAt: string;
  memberCount: number;
  orgCount: number;
  conversationCount: number;
  initialInviteCode?: string;
}

export interface CreateCommunityData {
  name: string;
  slug: string;
  description?: string;
  topics: { name: string; description?: string }[];
  verificationMethod: 'invite_code' | 'email_domain' | 'open';
  branding?: { primaryColor?: string; secondaryColor?: string };
  terminology?: { helperTerm?: string; seekerTerm?: string };
}

export interface CommunityTopic {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
}

// Community API
export async function getSuperAdminCommunities(): Promise<SuperAdminCommunity[]> {
  const response = await api.get<SuperAdminCommunity[]>('/api/super-admin/communities');
  return response.data;
}

export async function getSuperAdminCommunity(slug: string): Promise<SuperAdminCommunity> {
  const response = await api.get<SuperAdminCommunity>(`/api/super-admin/communities/${slug}`);
  return response.data;
}

export async function createCommunity(data: CreateCommunityData): Promise<SuperAdminCommunity> {
  const response = await api.post<SuperAdminCommunity>('/api/super-admin/communities', data);
  return response.data;
}

export async function updateCommunity(
  slug: string,
  data: Partial<{
    name: string;
    description: string;
    branding: { primaryColor?: string; secondaryColor?: string };
    terminology: { helperTerm?: string; seekerTerm?: string };
    verificationMethod: string;
  }>
): Promise<{ success: boolean }> {
  const response = await api.put<{ success: boolean }>(`/api/super-admin/communities/${slug}`, data);
  return response.data;
}

// Topic API (Super Admin)
export async function getSuperAdminCommunityTopics(slug: string): Promise<CommunityTopic[]> {
  const response = await api.get<CommunityTopic[]>(`/api/super-admin/communities/${slug}/topics`);
  return response.data;
}

export async function addCommunityTopic(
  slug: string,
  data: { name: string; description?: string }
): Promise<CommunityTopic> {
  const response = await api.post<CommunityTopic>(`/api/super-admin/communities/${slug}/topics`, data);
  return response.data;
}

export async function updateCommunityTopic(
  slug: string,
  topicId: number,
  data: { name?: string; description?: string; sortOrder?: number }
): Promise<CommunityTopic> {
  const response = await api.put<CommunityTopic>(`/api/super-admin/communities/${slug}/topics/${topicId}`, data);
  return response.data;
}

export async function deleteCommunityTopic(slug: string, topicId: number): Promise<{ success: boolean }> {
  const response = await api.delete<{ success: boolean }>(`/api/super-admin/communities/${slug}/topics/${topicId}`);
  return response.data;
}

// Organizations API (Super Admin)
export async function getSuperAdminCommunityOrganizations(slug: string): Promise<Organization[]> {
  const response = await api.get<Organization[]>(`/api/super-admin/communities/${slug}/organizations`);
  return response.data;
}

// Organization types for super admin
export interface SuperAdminOrganization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  communityId: string;
  communityName: string;
  communitySlug: string;
  memberCount: number;
  conversationCount: number;
}

export async function getSuperAdminOrganizations(): Promise<SuperAdminOrganization[]> {
  const response = await api.get<SuperAdminOrganization[]>('/api/super-admin/organizations');
  return response.data;
}

// ============================================================================
// WEBHOOKS API
// ============================================================================

export interface WebhookConfig {
  id: string;
  communityId: string;
  communityName?: string;
  organizationId: string | null;
  organizationName?: string | null;
  eventType: 'crisis_alert' | 'high_severity_alert' | 'user_report';
  endpointUrl: string;
  secretKey?: string; // Only returned on creation
  isActive: boolean;
  includePii: boolean;
  createdAt: string;
  updatedAt?: string;
  lastDeliveryStatus?: string | null;
  lastDeliveryAt?: string | null;
}

export interface WebhookDelivery {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  responseBody: string | null;
  attemptNumber: number;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  errorMessage: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface WebhookDeliveriesResponse {
  deliveries: WebhookDelivery[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface CreateWebhookData {
  community_id: string;
  organization_id?: string | null;
  event_type: 'crisis_alert' | 'high_severity_alert' | 'user_report';
  endpoint_url: string;
  include_pii?: boolean;
}

export interface UpdateWebhookData {
  event_type?: 'crisis_alert' | 'high_severity_alert' | 'user_report';
  endpoint_url?: string;
  is_active?: boolean;
  include_pii?: boolean;
  organization_id?: string | null;
}

export async function getWebhooks(communityId?: string): Promise<WebhookConfig[]> {
  const params = communityId ? `?community_id=${communityId}` : '';
  const response = await api.get<WebhookConfig[]>(`/api/webhooks${params}`);
  return response.data;
}

export async function createWebhook(data: CreateWebhookData): Promise<WebhookConfig> {
  const response = await api.post<WebhookConfig>('/api/webhooks', data);
  return response.data;
}

export async function updateWebhook(id: string, data: UpdateWebhookData): Promise<WebhookConfig> {
  const response = await api.put<WebhookConfig>(`/api/webhooks/${id}`, data);
  return response.data;
}

export async function deleteWebhook(id: string): Promise<{ success: boolean }> {
  const response = await api.delete<{ success: boolean }>(`/api/webhooks/${id}`);
  return response.data;
}

export async function testWebhook(id: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const response = await api.post<{ success: boolean; statusCode?: number; error?: string }>(`/api/webhooks/${id}/test`);
  return response.data;
}

export async function getWebhookDeliveries(id: string, page: number = 1, limit: number = 20): Promise<WebhookDeliveriesResponse> {
  const response = await api.get<WebhookDeliveriesResponse>(`/api/webhooks/${id}/deliveries?page=${page}&limit=${limit}`);
  return response.data;
}

export async function getWebhookCommunities(): Promise<{ id: string; name: string; slug: string }[]> {
  const response = await api.get<{ id: string; name: string; slug: string }[]>('/api/webhooks/communities');
  return response.data;
}

export async function getWebhookOrganizations(communityId: string): Promise<{ id: string; name: string; slug: string }[]> {
  const response = await api.get<{ id: string; name: string; slug: string }[]>(`/api/webhooks/organizations/${communityId}`);
  return response.data;
}

// ============================================================================
// PROFILE API
// ============================================================================

export interface EmergencyContact {
  id: string;
  contactName: string;
  contactPhone: string;
  relationship: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  emergencyContact: EmergencyContact | null;
}

export async function getProfile(): Promise<UserProfile> {
  const response = await api.get<UserProfile>('/api/profile');
  return response.data;
}

export async function updateProfile(data: { firstName?: string; lastName?: string }): Promise<UserProfile> {
  const response = await api.put<UserProfile>('/api/profile', data);
  return response.data;
}

export async function getEmergencyContact(): Promise<EmergencyContact | null> {
  const response = await api.get<EmergencyContact | null>('/api/profile/emergency-contact');
  return response.data;
}

export async function updateEmergencyContact(data: {
  contactName: string;
  contactPhone: string;
  relationship?: string;
}): Promise<EmergencyContact> {
  const response = await api.put<EmergencyContact>('/api/profile/emergency-contact', data);
  return response.data;
}

export async function deleteEmergencyContact(): Promise<{ success: boolean }> {
  const response = await api.delete<{ success: boolean }>('/api/profile/emergency-contact');
  return response.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const response = await api.put<{ message: string }>('/api/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return response.data;
}

// ============================================================================
// NOTIFICATION SETTINGS API
// ============================================================================

export interface NotificationSettings {
  moodCheckinNotifications: boolean;
  helperMatchNotifications: boolean;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const response = await api.get<NotificationSettings>('/api/settings/notifications');
  return response.data;
}

export async function updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
  const response = await api.put<NotificationSettings>('/api/settings/notifications', settings);
  return response.data;
}

export async function testPushNotificationUser(): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>('/api/push/test-user');
  return response.data;
}

// ============================================================================
// MEMBERSHIP PROFILE API (for display name, topics, role)
// ============================================================================

export interface MembershipProfile {
  id: string;
  displayName: string | null;
  role: 'seeker' | 'helper' | 'both' | 'admin';
  topics: { topic: string; historyRating: number; knowledgeRating: number; copingRating: number }[];
  communityName: string;
  communitySlug: string;
}

export async function getMembershipProfile(communitySlug: string): Promise<MembershipProfile> {
  // Get membership data from the communities endpoint
  const membershipResponse = await api.get<Membership>(`/api/communities/${communitySlug}/membership`);
  const membership = membershipResponse.data;

  // Get topics from user_experience_topics if available
  const topicsResponse = await api.get<{ topics: { topic: string; history_rating: number; knowledge_rating: number; coping_rating: number }[] }>(
    `/api/profile/membership/${communitySlug}/topics`
  ).catch(() => ({ data: { topics: [] } }));

  return {
    id: membership.id,
    displayName: membership.display_name || null,
    role: membership.role,
    topics: topicsResponse.data.topics.map(t => ({
      topic: t.topic,
      historyRating: t.history_rating,
      knowledgeRating: t.knowledge_rating,
      copingRating: t.coping_rating,
    })),
    communityName: membership.community_name || '',
    communitySlug: communitySlug,
  };
}

// ============================================================================
// MOOD CHECK-IN API
// ============================================================================

export interface MoodCheckIn {
  id: string;
  mood_score: number;
  source: 'standalone' | 'conversation';
  note: string | null;
  created_at: string;
}

export interface MoodCheckInResponse {
  id: string;
  mood_score: number;
  created_at: string;
  streak: number;
}

export interface MoodStreakResponse {
  current_streak: number;
  longest_streak: number;
  checked_in_today: boolean;
}

export interface TodayCheckInResponse {
  checked_in: boolean;
  check_in?: MoodCheckIn;
}

export interface MoodHistoryResponse {
  checkins: MoodCheckIn[];
  period_days: number;
}

export async function submitMoodCheckIn(
  communityId: string,
  moodScore: number,
  note?: string
): Promise<MoodCheckInResponse> {
  const response = await api.post<MoodCheckInResponse>('/api/mood-checkins', {
    community_id: communityId,
    mood_score: moodScore,
    note: note || null,
  });
  return response.data;
}

export async function getMoodHistory(communityId: string, days: number = 30): Promise<MoodHistoryResponse> {
  const response = await api.get<MoodHistoryResponse>(
    `/api/mood-checkins/me?community_id=${communityId}&days=${days}`
  );
  return response.data;
}

export async function getMoodStreak(communityId: string): Promise<MoodStreakResponse> {
  const response = await api.get<MoodStreakResponse>(
    `/api/mood-checkins/streak?community_id=${communityId}`
  );
  return response.data;
}

export async function getTodayCheckIn(communityId: string): Promise<TodayCheckInResponse> {
  const response = await api.get<TodayCheckInResponse>(
    `/api/mood-checkins/today?community_id=${communityId}`
  );
  return response.data;
}

// ============================================================================
// ADMIN MOOD TRENDS API
// ============================================================================

export interface MoodTrendsSummary {
  avg_mood_current: number | null;
  avg_mood_previous: number | null;
  trend: 'improving' | 'declining' | 'stable';
  total_checkins: number;
  participation_rate: number;
  critical_alerts: number;
}

export interface MoodTrendsDailyAverage {
  date: string;
  avg_mood: number;
  checkin_count: number;
}

export interface MoodTrendsDistribution {
  much_worse: number;
  slightly_down: number;
  neutral: number;
  okay: number;
  good: number;
}

export interface MoodTrendsTopicCorrelation {
  topic: string;
  avg_mood: number;
  volume: number;
}

export interface MoodTrendsResponse {
  privacy_limited: boolean;
  message?: string;
  summary: MoodTrendsSummary;
  daily_averages: MoodTrendsDailyAverage[];
  distribution: MoodTrendsDistribution;
  topic_correlation: MoodTrendsTopicCorrelation[];
}

export interface MoodAlert {
  display_name: string;
  alert_type: 'consecutive_low' | 'significant_decline' | 'disengagement';
  message: string;
  days?: number;
  decline?: number;
  days_inactive?: number;
}

export interface MoodAlertsResponse {
  privacy_limited: boolean;
  alerts: MoodAlert[];
}

// Placeholder API functions - will be wired to real endpoints when backend is ready
export async function getAdminMoodTrends(
  communitySlug: string,
  period: '7d' | '30d' | '90d',
  organizationId?: string
): Promise<MoodTrendsResponse> {
  const params = new URLSearchParams({ period });
  if (organizationId) params.append('organization_id', organizationId);
  const response = await api.get<MoodTrendsResponse>(
    `/api/admin/mood-trends/${communitySlug}?${params.toString()}`
  );
  return response.data;
}

export async function getAdminMoodAlerts(
  communitySlug: string,
  organizationId?: string
): Promise<MoodAlertsResponse> {
  const params = organizationId ? `?organization_id=${organizationId}` : '';
  const response = await api.get<MoodAlertsResponse>(
    `/api/admin/mood-alerts/${communitySlug}${params}`
  );
  return response.data;
}

export default api;
