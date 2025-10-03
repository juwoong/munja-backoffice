import axios from "axios";

type Nullable<T> = T | null;

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

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

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
  };
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
