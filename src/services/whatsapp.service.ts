// src/services/whatsapp.service.ts
import { supabase } from './supabase.service';

export interface WhatsAppDisseminateParams {
  property_db_id: number;
  property_unique_id: string;
  gcs_url: string; // Migrated from s3_url to gcs_url
  target_phone_numbers: string[];
}

class WhatsAppService {
  private readonly PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  private readonly ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  private readonly GRAPH_API_URL = `https://graph.facebook.com/v18.0/${this.PHONE_NUMBER_ID}/messages`;

  public async blastToLeads(params: WhatsAppDisseminateParams): Promise<void> {
    try {
      console.log(`[Stage 5B] Initiating WhatsApp blast for Property ID: ${params.property_unique_id} to ${params.target_phone_numbers.length} leads.`);

      if (!this.PHONE_NUMBER_ID || !this.ACCESS_TOKEN) {
        throw new Error('WhatsApp Environment Variables are missing.');
      }

      // 1. Fetch property data using Supabase instead of Prisma
      const { data: propertyRecord, error } = await supabase
        .from('chestone_properties')
        .select('*')
        .eq('id', params.property_db_id)
        .single();

      if (error || !propertyRecord) {
        throw new Error(`Property not found in database for WhatsApp blast: ${error?.message}`);
      }

      // 2. Construct the marketing caption
      const caption = this.constructMarketingCaption(propertyRecord);

      // 3. Dispatch messages concurrently
      const sendPromises = params.target_phone_numbers.map(async (phone) => {
        return this.sendVideoMessage(phone, params.gcs_url, caption);
      });

      const results = await Promise.allSettled(sendPromises);

      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      console.log(`[Stage 5B] WhatsApp Blast Complete. Success: ${successes}, Failed: ${failures}.`);

    } catch (error: any) {
      console.error(`[Stage 5B Fatal Error] WhatsApp deployment failed for Property ${params.property_unique_id}:`, error.message);
    }
  }

  private async sendVideoMessage(to_phone: string, video_url: string, caption: string): Promise<void> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to_phone, // Note: Must be formatted to E.164 standard (e.g., "254726111133") without the '+'
      type: 'video',
      video: {
        link: video_url,
        caption: caption,
      },
    };

    const response = await fetch(this.GRAPH_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Meta API Error for phone ${to_phone}: ${response.status} - ${errorData}`);
    }
  }

  private constructMarketingCaption(property: any): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });

    const displayPrice = property.price > 0 
      ? formatter.format(property.price) 
      : 'Contact us for pricing';

    let caption = `*Exclusive Preview: Chestone Properties*\n\n`;
    caption += `📍 *Location:* ${property.specific_location || 'Prime Location'}\n`;
    caption += `💰 *Price:* ${displayPrice}\n`;
    
    if (property.house_size_beds) {
      caption += `🛏️ *Beds:* ${property.house_size_beds} | 📐 *Size:* ${property.house_size_sqft} sqft\n`;
    }

    caption += `\nWatch the AI-generated tour above. Reply to this message to schedule a priority viewing or consult with our agents.`;
    
    return caption;
  }
}

export const whatsappService = new WhatsAppService();