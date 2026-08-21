export interface SmsSendRequest {
  phoneNumbers: string[];
  message: string;
  senderId: string;
}

export interface DuplicateRecord {
  number: string;
  repeats: string;
}

export interface SmsSendResponse {
  requestId: string;
  accepted: number;
  rejected: string[];
  duplicates: DuplicateRecord[];
}