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

export default api;
