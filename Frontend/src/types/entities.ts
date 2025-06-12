// src/types/entities.ts

// --- ENDPOINTS DISPONIBLES ---
export type Endpoint = 'users' | 'customers' | 'folders' | 'files' | 'order_status';

// --- OPERACIONES PARA CADA ENDPOINT ---
export interface EndpointsToOperations {
  users: () => Users[];
  customers: () => Customers[];
  folders: () => Folders[];
  files: () => Files[];
  order_status: () => OrderStatus[];
}

// --- USERS ---
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

// --- CUSTOMERS ---
export interface Customers {
  id: number;
	uuid: string; // <-- opcional, para mostrar el UUID del cliente
  name: string;
  email: string;
  address: string;
  phone: string;
  city: string;
  country: string;
  created_at: string;
  updated_at: string;
  folder_count?: number;
	status?: string; // <-- opcional, para mostrar el estado del cliente
}

// --- FOLDERS ---
export interface Folders {
  id: number;
  customer_id: number;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
	fileCount?: number; // <-- opcional, para mostrar el número de archivos en la carpeta
	customer_uuid?: string; // <-- opcional, para mostrar el UUID del cliente asociado a la carpeta
}

// --- FILES ---
export interface Files {
  id: number;
  customer_id: number;
  folder_id: number;
  name: string;
  path: string | null;
  eta: string | null;
  etd: string | null;
  was_sent: number | null;
  document_type: string | null;
  file_type: string | null;
  status_id: number;
  status_name?: string; // <-- importante para los JOINs cuando ya haces el LEFT JOIN con order_status
  created_at: string;
  updated_at: string;
}

// --- ORDER STATUS ---
export interface OrderStatus {
  id: number;
  name: string;
}
