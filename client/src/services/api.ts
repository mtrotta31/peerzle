import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export async function signup(email: string, password: string, acceptedTermsVersion: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/auth/signup', { email, password, acceptedTermsVersion });
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
}

// Invite Code API
export async function getInviteCodes(communitySlug: string): Promise<InviteCode[]> {
  const response = await api.get<InviteCode[]>(`/api/communities/${communitySlug}/invite-codes`);
  return response.data;
}

export async function createInviteCode(
  communitySlug: string,
  options?: { maxUses?: number; expiresInDays?: number }
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
  community_slug?: string;
  community_name?: string;
  messages?: Message[];
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
  seeker_email: string;
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
  other_user_email: string | null;
  rating: number | null;
  felt_heard: boolean | null;
  would_recommend: boolean | null;
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

export interface HelperDashboardStats {
  totalSessions: number;
  activeSessions: number;
  averageRating: number | null;
  totalRatings: number;
  feltHeardPercent: number | null;
  wouldRecommendPercent: number | null;
  totalHelpTime: number;
  recentSessions: RecentHelperSession[];
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
  createdAt: string;
}

// Admin API
export async function getAdminOverview(communitySlug: string): Promise<AdminOverview> {
  const response = await api.get<AdminOverview>(`/api/admin/${communitySlug}/overview`);
  return response.data;
}

export async function getAdminMembers(communitySlug: string): Promise<AdminMember[]> {
  const response = await api.get<AdminMember[]>(`/api/admin/${communitySlug}/members`);
  return response.data;
}

export async function getAdminAlerts(communitySlug: string): Promise<AdminAlert[]> {
  const response = await api.get<AdminAlert[]>(`/api/admin/${communitySlug}/alerts`);
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

export default api;
