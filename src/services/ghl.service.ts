// src/services/ghl.service.ts
import axios from 'axios';
import { RespondWebhookPayload } from '../schemas/respond.schema';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

export const syncQualifiedLeadToGHL = async (payload: RespondWebhookPayload) => {
  const ghlToken = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!ghlToken || !locationId) {
    throw new Error('Missing GHL credentials in environment.');
  }

  // Map the Respond.io data to GHL's expected Contact schema
  const ghlPayload = {
    locationId: locationId,
    phone: payload.phone_number,
    name: payload.name || 'Unknown Contact',
    tags: [...payload.tags, 'Respond_AI_Processed'],
    customFields: [
      {
        id: process.env.GHL_CUSTOM_FIELD_INVESTMENT_TYPE, // Replace with actual GHL Custom Field ID
        value: payload.qualification_data.investment_type
      },
      {
        id: process.env.GHL_CUSTOM_FIELD_BUDGET, // Replace with actual GHL Custom Field ID
        value: payload.qualification_data.budget_envelope
      },
      {
        id: process.env.GHL_CUSTOM_FIELD_PROPERTY_ID,
        value: payload.property_id
      }
    ]
  };

  try {
    const response = await axios.post(`${GHL_API_BASE}/contacts/upsert`, ghlPayload, {
      headers: {
        'Authorization': `Bearer ${ghlToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  } catch (error: any) {
    console.error('[GHL Sync Error]:', error.response?.data || error.message);
    throw new Error('Failed to synchronize contact with GoHighLevel');
  }
};