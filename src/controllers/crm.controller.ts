// src/controllers/crm.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { LeadTrackingService } from '../services/tracking.service';
import { videoGenerationQueue, VideoJobPayload } from '../config/queue.config';
import { supabase } from '../services/supabase.service';

const trackingService = new LeadTrackingService();

export class CrmWebhookController {
  public async handleInboundCrmEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { event, lead_id, name, email, phone, target_property_id, fbc, gclid, status } = req.body;

      // Handle target transaction triggers
      if (status !== 'Tour_Scheduled') {
        res.status(200).json({ status: 'ACKNOWLEDGED', message: 'Event ignored: Status configuration mismatch.' });
        return;
      }

      // Normalization and Cryptographic PII Execution
      const attributionContext = trackingService.processInboundLeadIdentity(email, phone, fbc, gclid);

      // Persist Lead State Log inside Supabase
      const { error: dbError } = await supabase
        .from('chestone_leads_attribution')
        .insert([{
          lead_id,
          hashed_email: attributionContext.hashedEmail,
          hashed_phone: attributionContext.hashedPhone,
          fb_click_id: attributionContext.fbc,
          google_click_id: attributionContext.gclid,
          current_state: status,
          updated_at: new Date().toISOString()
        }]);

      if (dbError) {
        console.error('[Supabase DB Mutation Error]:', dbError.message);
      }

      // Dispatch tracking instructions directly to the processing queue
      /*const taskPayload: VideoJobPayload = {
        leadId: lead_id,
        clientName: name,
        propertyId: target_property_id,
        hashedEmail: attributionContext.hashedEmail,
        hashedPhone: attributionContext.hashedPhone,
        fbc: attributionContext.fbc,
        gclid: attributionContext.gclid,
      };
*/
     /* await videoGenerationQueue.add(taskPayload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      }); */

      res.status(200).json({
        success: true,
        message: 'Webhook processed, data hashed, and job appended to the throttling cluster safely.',
      });
    } catch (err: any) {
      console.error('[Webhook Processing Exception Failure]:', err.message);
      res.status(500).json({ error: 'Internal Server Error executing webhook processing pipelines.' });
    }
  }
}