export interface CardRequestedEvent {
  id: number;
  source: string;
  type: string;
  time: string;
  data: {
    requestId: string;
    customer: {
      documentType: 'DNI';
      documentNumber: string;
      fullName: string;
      age: number;
      email: string;
    };
    product: {
      type: 'VISA';
      currency: 'PEN' | 'USD';
    };
    forceError?: boolean;
    retryCount: number;
    status: string;
  };
}
