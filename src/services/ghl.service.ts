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

  // customFieldEntries — now 4 fields (was 3). transaction_type added
  // 2026-07-18 after realizing Investment/Lifestyle/Architectural are
  // marketing ANGLES, not transaction types — the original single
  // "investment vs personal use" question couldn't distinguish a renter
  // from a buyer. Real GHL field IDs confirmed via
  // GET /locations/{id}/customFields — see project doc for the earlier
  // silent-failure bug this pattern already caused once (undefined env
  // vars silently dropped by GHL, false "success" reported).
const customFieldEntries: Array<{ id: string | undefined; value: string | undefined }> = [
    {
      id: process.env.GHL_CUSTOM_FIELD_TRANSACTION_TYPE,
      value: payload.qualification_data.transaction_type,
    },
    {
      id: process.env.GHL_CUSTOM_FIELD_INVESTMENT_TYPE,
      value: payload.qualification_data.investment_type,
    },
    {
      id: process.env.GHL_CUSTOM_FIELD_BUDGET,
      value: payload.qualification_data.budget_envelope,
    },
    {
      id: process.env.GHL_FIELD_PROPERTY_INTERESTED_IN,
      value: payload.property_id,
    },
  ];

  // Guard against the exact failure mode from before: fail loudly if any
  // field ID is missing/misconfigured, rather than silently sending
  // undefined IDs to GHL and reporting false success.
  const missing = customFieldEntries.filter((f) => !f.id);
  if (missing.length > 0) {
    throw new Error(
      `Missing GHL custom field ID(s) in .env — check GHL_CUSTOM_FIELD_TRANSACTION_TYPE, ` +
      `GHL_CUSTOM_FIELD_INVESTMENT_TYPE, GHL_CUSTOM_FIELD_BUDGET, GHL_FIELD_PROPERTY_INTERESTED_IN. ` +
      `${missing.length} field(s) unresolved.`
    );
  }

  // investment_type is currently optional at the schema level (AI Agent
  // not yet extracting it — see respond.schema.ts, 2026-07-19). Drop any
  // entry with no value rather than sending it to GHL as undefined; this
  // is a distinct, expected case from the "missing .env ID" failure above
  // and should never throw.
  const resolvedCustomFieldEntries = customFieldEntries.filter(
    (f): f is { id: string; value: string } => !!f.value
  );

  const ghlPayload = {
    locationId: locationId,
    phone: payload.phone_number,
    name: payload.name || 'Unknown Contact',
    tags: [...payload.tags, 'Respond_AI_Processed'],
    customFields: resolvedCustomFieldEntries,
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