// src/types/entities.ts

// --- ENDPOINTS DISPONIBLES ---
export type Endpoint = 'users' | 'customers' | 'folders' | 'files' | 'order_status';

// --- OPERACIONES PARA CADA ENDPOINT ---
export interface EndpointsToOperations {
	orders: () => Orders[];
  users: () => Users[];
  customers: () => Customers[];
  folders: () => Folders[];
  files: () => Files[];
  order_status: () => OrderStatus[];
}

// --- ORDERS ---
export interface Orders {
  id: number;
  rut: string;
  oc: string;
  pc: string;
  path: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_uuid: string;
  files_count: number;
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
  avatar?: string | null;
  phone: string;
  country: string;
  city: string;
  created_at: string;
  updated_at: string;
}

// --- CUSTOMERS ---
export interface Customers {
  id: number;
  uuid: string;
  rut: string;
  name: string;
  email?: string;
  address: string;
  address_alt?: string;
  phone: string;
  fax?: string;
  mobile?: string;
  contact_name?: string;
  contact_secondary?: string;
  city: string;
  country: string;
  created_at: string;
  updated_at: string;
  order_count?: number;
  status?: string;
}

// --- FOLDERS ---
export interface Folders {
  id: number;
  customer_id: number;
  name: string;
  path: string;
  pc: string;
  oc: string;
  factura: number;
  fec_factura: string;
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
	is_visible_to_client: boolean;
}

// --- ORDER STATUS ---
export interface OrderStatus {
  id: number;
  name: string;
}
