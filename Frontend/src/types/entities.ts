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
  order_id: number;
  files_count: number;
  factura?: string | null;
  fecha_factura?: string | null;
  fecha?: string | null;
  fecha_etd?: string | null;
  fecha_eta?: string | null;
  currency?: string | null;
  medio_envio_factura?: string | null;
  medio_envio_ov?: string | null;
}

// --- USERS ---
export interface Users {
  id: number;
  rut: string;
  email?: string | null;
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
  created_at: string;
  updated_at: string;
	fileCount?: number; // <-- opcional, para mostrar el número de archivos en la carpeta
	customer_uuid?: string; // <-- opcional, para mostrar el UUID del cliente asociado a la carpeta
  fecha?: string | null;
  currency?: string | null;
  medio_envio?: string | null;
  medio_envio_factura?: string | null;
  medio_envio_ov?: string | null;
  fecha_factura?: string | null;
}

// --- FILES ---
export interface Files {
  id: number;
  customer_id: number;
  folder_id: number;
  name: string;
  path: string | null;
  was_sent: number | null;
  document_type: string | null;
  file_type: string | null;
  status_id: number;
  status_name?: string; // <-- importante para los JOINs cuando ya haces el LEFT JOIN con order_status
  created_at: string;
  updated_at: string;
	is_visible_to_client: boolean;
  pc?: string;
  oc?: string;
}

// --- ORDER STATUS ---
export interface OrderStatus {
  id: number;
  name: string;
}

// --- ORDER DETAIL ---
export interface OrderDetail {
  id: number;
  order_id: number;
  incoterm?: string | null;
  direccion_destino?: string | null;
  puerto_destino?: string | null;
  u_observaciones?: string | null;
  fecha_eta?: string | null;
  fecha_etd?: string | null;
  certificados?: string | null;
  pymnt_group?: string | null;
  fec_deseada_dep_planta?: string | null;
  fec_deseada_cliente?: string | null;
  fec_real_dep_planta?: string | null;
  fec_original_cliente?: string | null;
  u_reserva?: string | null;
  folio_gd?: string | null;
  motivo_retraso?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Campos adicionales de la tabla orders
  pc?: string | null;
  oc?: string | null;
}
