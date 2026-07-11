// src/services/tracking.service.ts
import { createHash } from 'crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export interface NormalizedLeadData {
  rawEmail: string;
  rawPhone: string;
  hashedEmail: string;
  hashedPhone: string;
  fbc: string | null;
  gclid: string | null;
}

export class LeadTrackingService {
  /**
   * Normalizes strings and computes immutable cryptographic SHA-256 signatures
   */
  public hashValue(value: string): string {
    return createHash('sha256')
      .update(value.trim().toLowerCase())
      .digest('hex');
  }

  /**
   * Normalizes input phone metrics into clean E.164 structural definitions
   */
  public normalizePhone(phone: string, defaultCountry: string = 'KE'): string {
    const parsed = parsePhoneNumberFromString(phone, defaultCountry);
    if (!parsed || !parsed.isValid()) {
      // Fallback normalization logic if strict parsing fails
      const digits = phone.replace(/\D/g, '');
      if (!digits) {
        return '';
      }
      if (digits.startsWith('0')) {
        return `+254${digits.slice(1)}`;
      }
      if (digits.startsWith('254')) {
        return `+${digits}`;
      }
      return `+${digits}`;
    }
    return parsed.format('E.164');
  }

  /**
   * Processes raw tracking context into standard, cryptographically secure attribution payloads
   */
  public processInboundLeadIdentity(
    email: string,
    phone: string,
    fbc: string | null,
    gclid: string | null
  ): NormalizedLeadData {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = this.normalizePhone(phone);

    return {
      rawEmail: cleanEmail,
      rawPhone: cleanPhone,
      hashedEmail: this.hashValue(cleanEmail),
      hashedPhone: this.hashValue(cleanPhone),
      fbc: fbc ? fbc.trim() : null,
      gclid: gclid ? gclid.trim() : null,
    };
  }
}