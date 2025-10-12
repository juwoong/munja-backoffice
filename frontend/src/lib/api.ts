import axios from "axios";

type Nullable<T> = T | null;

// Runtime config support for Docker deployment
declare global {
  interface Window {
    __RUNTIME_CONFIG__?: {
      VITE_API_URL: string;
    };
  }
}

const API_BASE_URL =
  window.__RUNTIME_CONFIG__?.VITE_API_URL ??
  import.meta.env.VITE_API_URL ??
  "http://localhost:4000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false
});

export function setAuthToken(token: Nullable<string>) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  email: string;
  password: string;
}

export interface SignupResponse {
  id: string;
  email: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    status?: string;
  };
}

export interface ValidatorReward {
  id: string;
  operatorAddress: string;
  epoch: number;
  rewardAmount: string;
  claimed: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function signup(payload: SignupPayload) {
  const response = await api.post<SignupResponse>("/auth/register", payload);
  return response.data;
}

export async function login(payload: LoginPayload) {
  const response = await api.post<LoginResponse>("/auth/login", payload);
  return response.data;
}

export async function fetchRewards() {
  const response = await api.get<ValidatorReward[]>("/rewards");
  return response.data;
}

export interface RefreshRewardsResponse {
  status: "new-reward" | "no-change" | "skipped" | "initialized";
  timestamp: string;
  updatedClaimedCount: number;
  newReward?: {
    epoch: number;
    amount: string;
  };
  reason?: "poll-in-progress";
  message?: string;
  error?: string;
}

export async function refreshRewards() {
  const response = await api.post<RefreshRewardsResponse>("/rewards/refresh", {});
  return response.data;
}

export interface EventsResponse {
  data: Array<{
    id: string;
    address: string;
    blockNumber: string;
    transactionHash: string;
    logIndex: number;
    data: string;
    topics: string[];
    createdAt: string;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface MitosisPriceResponse {
  price: number;
  currency: string;
}

export async function fetchMitosisPrice() {
  const response = await api.get<MitosisPriceResponse>("/price/mitosis");
  return response.data;
}

// Reward Actions API
export interface RewardAction {
  id: string;
  actionType: "RESTAKING" | "SELL";
  amount: string;
  averagePrice?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RewardActionSummary {
  totalRestaking: string;
  totalSellAmount: string;
  totalSellRevenue: number;
  availableBalance: string;
}

export interface CreateRewardActionPayload {
  actionType: "RESTAKING" | "SELL";
  amount: string;
  averagePrice?: number;
  note?: string;
}

export async function fetchRewardActions() {
  const response = await api.get<RewardAction[]>("/reward-actions");
  return response.data;
}

export async function fetchRewardActionsSummary() {
  const response = await api.get<RewardActionSummary>("/reward-actions/summary");
  return response.data;
}

export async function createRewardAction(payload: CreateRewardActionPayload) {
  const response = await api.post<RewardAction>("/reward-actions", payload);
  return response.data;
}

export async function deleteRewardAction(id: string) {
  await api.delete(`/reward-actions/${id}`);
}
