export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'client';
  role_id: number;
  avatar?: string;
  phone: string;
  country: string;
  city: string;
  twoFAEnabled: boolean;
  change_pw: number;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  otp?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  message: string;
  requires2FA?: boolean;
  qr?: string;
}

export interface TwoFACredentials {
  username: string;
  password: string;
  otp: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  login2FA: (credentials: TwoFACredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}
