import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { setAuthToken, type LoginResponse } from "@/lib/api";

interface AuthState {
  token: string | null;
  user: LoginResponse["user"] | null;
}

interface AuthContextValue extends AuthState {
  login: (data: LoginResponse) => void;
  logout: () => void;
}

const STORAGE_KEY = "backoffice_auth_state";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window === "undefined") {
      return { token: null, user: null };
    }

    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    if (!fromStorage) {
      return { token: null, user: null };
    }

    try {
      const parsed = JSON.parse(fromStorage) as AuthState;
      if (parsed.token) {
        setAuthToken(parsed.token);
      }
      return parsed;
    } catch (_error) {
      return { token: null, user: null };
    }
  });

  useEffect(() => {
    if (state.token) {
      setAuthToken(state.token);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      setAuthToken(null);
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [state]);

  const login = useCallback((data: LoginResponse) => {
    setAuthToken(data.token);
    setState({ token: data.token, user: data.user });
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setState({ token: null, user: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}
