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

export async function signup(email: string, password: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/auth/signup', { email, password });
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
  verification_method: string;
  helper_verification_required: boolean;
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  community_id: string;
  role: 'seeker' | 'helper' | 'both';
  is_verified_helper: boolean;
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

export async function joinCommunity(slug: string): Promise<Membership> {
  const response = await api.post<Membership>(`/api/communities/${slug}/join`);
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

export default api;
