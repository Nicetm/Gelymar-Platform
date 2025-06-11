// types/entities.ts

export type Endpoint = 'customers';

export interface EndpointsToOperations {
  customers: () => Customer[];
}

export interface Customer {
  id: number;
  name: string;
  uuid: string;
  email: string;
}
