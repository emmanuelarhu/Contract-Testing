// This is the REAL code in our USSD Flow Engine that calls Payment Service.
// In production it hits the real payment service. In tests, Pact intercepts it.

import axios from 'axios';

export interface PaymentMethod {
  id: string;
  type: string;      // e.g. "MOMO", "CARD"
  provider: string;  // e.g. "MTN", "Vodafone"
  isDefault: boolean;
}

export class PaymentClient {
  constructor(private baseUrl: string) {}

  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    const response = await axios.get(`${this.baseUrl}/payment-methods/${userId}`);
    return response.data;
  }
}
