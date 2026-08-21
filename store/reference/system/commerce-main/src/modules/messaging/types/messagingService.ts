import { SmsSendRequest, SmsSendResponse } from './messagingTypes';

/**
 * Interface for messaging services (e.g., SMS, WhatsApp) to implement.
 */
export interface IMessagingService {
  sendSms(request: SmsSendRequest): Promise<SmsSendResponse>;
}
