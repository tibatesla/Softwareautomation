import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase.service';
import { videoGenerationQueue } from '../config/queue.config';
import { handleManualIntake } from '../controllers/respond.controller';

const router = Router();

// This allows you to test the raw intake logic via CURL
router.post('/webhooks/manual-intake', handleManualIntake);

router.post('/test-pipeline', async (req: Request, res: Response): Promise<void> => {
  try {
    const mockPropertyUniqueId = `CHESTONE-TEST-${Date.now()}`;

    // 1. Insert the mock record into Supabase PostgreSQL (Stage 2 Mock Ingestion)
    const { data: testProperty, error: dbError } = await supabase
      .from('chestone_properties')
      .insert({
        property_unique_id: mockPropertyUniqueId,
        price: 45000000.0,
        specific_location: "Kilimani, Nairobi",
        house_size_beds: 4,
        house_size_sqft: 2500,
        ready_to_move_date: new Date().toISOString(),
        payment_plan_structure: "Cash or Mortgage Structure",
        mortgage_allowed: true,
        amenities_list: ["Pool", "Gym", "High-Speed Elevators"],
        mall_1_dist: "2 km to Yaya Centre",
        hospital_dist: "5 km to Nairobi Hospital",
        security_features: "CCTV & Biometric Access Control",
        status: 'PENDING_INGESTION'
      })
      .select('*')
      .single();

    if (dbError || !testProperty) {
      throw new Error(`Supabase Test Mutation Core Failed: ${dbError?.message}`);
    }

    console.log(`[Test Framework] Mock database record created with internal ID: ${testProperty.id}`);

    // 2. Acknowledge the HTTP route pipeline caller immediately
    res.status(200).json({ 
      success: true, 
      message: "Mock Supabase record created. Enqueueing task to the Redis throttling layer.",
      db_id: testProperty.id,
      property_unique_id: testProperty.property_unique_id
    });

    // 3. Concurrency Protection Handoff: Push into the Redis Bull Queue cluster
    await videoGenerationQueue.add({
      internal_db_id: testProperty.id,
      display_price: "KSh 45,000,000",
      urgency_factor: "high",
      property_data: testProperty
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true
    });

    console.log(`[Test Framework] Success. Pipeline test delegated to video worker thread context.`);

  } catch (error: any) {
    console.error("[Test Ingestion Router Failure]: Initialization failed:", error.message || error);
    
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to initialize test pipeline inside Supabase state engine." });
    }
  }
});

export default router;