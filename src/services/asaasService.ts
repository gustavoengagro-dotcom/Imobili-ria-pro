import axios from 'axios';
import { Client, Payment } from '../types';

const api = axios.create({
  baseURL: '/api/asaas',
});

export const asaasService = {
  async createCustomer(client: Client) {
    const data = {
      name: client.name,
      cpfCnpj: client.cpfCnpj.replace(/\D/g, ''),
      email: client.email,
      phone: client.phone.replace(/\D/g, ''),
      mobilePhone: client.phone.replace(/\D/g, ''),
      address: client.street,
      addressNumber: client.number,
      complement: client.complement,
      province: client.neighborhood,
      postalCode: client.zipCode?.replace(/\D/g, ''),
      externalReference: client.id,
      notificationDisabled: false,
    };
    const response = await api.post('/customers', data);
    return response.data;
  },

  async createPayment(payment: Payment, customerId: string) {
    const data = {
      customer: customerId,
      billingType: 'UNDEFINED', // Allows customer to choose between BOLETO, CREDIT_CARD, PIX
      value: payment.amount,
      dueDate: payment.dueDate,
      description: payment.description || (payment.type === 'aluguel' ? 'Aluguel Mensal' : 'Pagamento Extra'),
      externalReference: payment.id,
      postalService: false,
    };
    const response = await api.post('/payments', data);
    return response.data;
  },

  async getPayment(paymentId: string) {
    const response = await api.get(`/payments/${paymentId}`);
    return response.data;
  },

  async getBoletoCode(paymentId: string) {
    const response = await api.get(`/payments/${paymentId}/identificationField`);
    return response.data;
  },

  async getPixQrCode(paymentId: string) {
    const response = await api.get(`/payments/${paymentId}/pixQrCode`);
    return response.data;
  },

  async testConnection() {
    const response = await api.get('/test');
    return response.data;
  }
};
