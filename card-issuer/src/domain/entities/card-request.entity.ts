export interface Customer {
  documentType: 'DNI';
  documentNumber: string;
  fullName: string;
  age: number;
  email: string;
}

export interface Product {
  type: 'VISA';
  currency: 'PEN' | 'USD';
}

export interface CardRequestEntity {
  requestId: string;
  customer: Customer;
  product: Product;
  forceError?: boolean | undefined;
  status: 'PENDING' | 'ISSUED' | 'FAILED';
  createdAt: Date;
}
