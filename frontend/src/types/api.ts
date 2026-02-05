/** API response types. */

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthGoogleResponse {
  access_token: string;
  user: User;
}

export interface AuthRefreshResponse {
  access_token: string;
}

export interface AuthMeResponse {
  user: User;
}
