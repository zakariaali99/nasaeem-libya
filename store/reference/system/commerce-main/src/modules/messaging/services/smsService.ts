import { IMessagingService } from '../types/messagingService';
import { SmsSendRequest, SmsSendResponse } from '../types/messagingTypes';

export class MarsolSmsService implements IMessagingService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.MARSOL_API_KEY!;
    this.baseUrl = baseUrl ?? process.env.MARSOL_BASE_URL ?? 'https://api.marsol.ly';
    if (!this.apiKey) {
      throw new Error('MARSOL_API_KEY is not defined');
    }
  }

  async sendSms(request: SmsSendRequest): Promise<SmsSendResponse> {
    const res = await fetch(`${this.baseUrl}/public/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': this.apiKey,
      },
      body: JSON.stringify(request),
    });

    if (res.status !== 201 && !res.ok) {
      const errorText = await res.text();
      throw new Error(`MarsolSmsService: failed to send SMS, status ${res.status} - ${errorText}`);
    }

    const responseBody = (await res.json()) as SmsSendResponse;
    return responseBody;
  }
}

// Export a default instance for convenience
export const smsService = new MarsolSmsService();