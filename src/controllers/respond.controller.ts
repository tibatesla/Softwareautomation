// src/controllers/respond.controller.ts
import { Request, Response } from 'express';
import { respondWebhookSchema } from '../schemas/respond.schema';
import { syncQualifiedLeadToGHL } from '../services/ghl.service';
import { supabase } from '../services/supabase.service'; 

export const handleRespondWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Strict Schema Validation
    const parsedData = respondWebhookSchema.parse(req.body);

    // 2. Drop the interaction into the Supabase Operational Cache
    // This maintains your stateless architecture while allowing fast local reads
    const { error: dbError } = await supabase
      .from('respond_conversations_log')
      .upsert({
        contact_id: parsedData.contact_id,
        phone_number: parsedData.phone_number,
        property_id: parsedData.property_id,
        investment_type: parsedData.qualification_data.investment_type,
        budget: parsedData.qualification_data.budget_envelope,
        is_qualified: parsedData.tags.includes('Qualified_Lead'),
        updated_at: new Date().toISOString()
      }, { onConflict: 'contact_id' });

    if (dbError) {
      console.warn('[Supabase Cache Warning]: Failed to log conversation state', dbError);
    }

    // 3. Sync to GoHighLevel (The Source of Truth)
    // We only push to GHL if the lead successfully passed the AI qualification matrix
    if (parsedData.tags.includes('Qualified_Lead')) {
      await syncQualifiedLeadToGHL(parsedData);
    // console.log("[System] GHL Sync bypassed. Lead saved to Supabase only.");
    }

    // 4. Acknowledge Receipt to Make.com quickly to prevent timeout loops
    res.status(200).json({ 
      success: true, 
      message: 'Payload processed and routed successfully' 
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
       res.status(400).json({ error: 'Malformed webhook payload', details: error.errors });
       return;
    }
    
    console.error('[Respond Webhook Execution Failure]:', error);
    res.status(500).json({ error: 'Internal system failure during processing' });
  }
};
export const handleManualIntake = async (req: any, res: any) => {
  res.status(200).send("Manual intake test route alive");
};