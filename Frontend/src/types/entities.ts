// types/entities.ts

export type Endpoint = 'users';

export interface EndpointsToOperations {
  users: () => Users[];
}

export interface Users {
  id: number;
  email: string;
  password: string;
  role_id: number;
  twoFASecret: string;
  twoFAEnabled: number;
  full_name: string;
  phone: string;
  country: string;
  city: string;
  created_at: string;
  updated_at: string;
}
