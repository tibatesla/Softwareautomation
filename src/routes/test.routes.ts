import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase.service';
import { videoGenerationQueue } from '../config/queue.config';
import { handleManualIntake } from '../controllers/respond.controller';
import { handleManualHeygenReprocess } from '../controllers/heygen.controller';

const router = Router();

router.post('/webhooks/manual-intake', handleManualIntake);
router.post('/reprocess-heygen-job', handleManualHeygenReprocess);

// ⚠️ Costs real HeyGen API credits — now 3x per run (one per variant:
// Investment, Lifestyle, Architectural), since every property generates
// all 3 simultaneously. Use sparingly.
router.post('/test-pipeline', async (req: Request, res: Response): Promise<void> => {
  try {
    const mockPropertyUniqueId = `CHESTONE-TEST-${Date.now()}`;

    const { data: testProperty, error: dbError } = await supabase
      .from('chestone_properties')
      .insert({
        ghl_record_id: `manual-test-${Date.now()}`,
        property_unique_id: mockPropertyUniqueId,
        property_name: 'Direct Test Villa',
        price: 45000000.0,
        price_min: 45000000.0,
        price_max: 48000000.0,
        specific_location: 'Kilimani, Nairobi',
        house_size_sqft: 2500,
        unit_type: '4 Bedroom',
        payment_plan_structure: 'Cash or Mortgage Structure',
        amenities: ['Pool', 'Gym', 'High-Speed Elevators'],
        property_images: [
          'https://dummyimage.com/1920x1080/ccc/000.jpg&text=Test1',
          'https://dummyimage.com/1920x1080/ccc/000.jpg&text=Test2',
          'https://dummyimage.com/1920x1080/ccc/000.jpg&text=Test3',
          'https://dummyimage.com/1920x1080/ccc/000.jpg&text=Test4',
        ],
        status: 'RENDERING'
      })
      .select('*')
      .single();

    if (dbError || !testProperty) {
      throw new Error(`Supabase Test Mutation Core Failed: ${dbError?.message}`);
    }

    console.log(`[Test Framework] Mock property created with internal ID: ${testProperty.id}`);

    res.status(200).json({
      success: true,
      message: "Mock property created. Enqueueing 3 variant jobs (Investment/Lifestyle/Architectural).",
      db_id: testProperty.id,
      property_unique_id: testProperty.property_unique_id
    });

    const variants: Array<'Investment' | 'Lifestyle' | 'Architectural'> = [
      'Investment', 'Lifestyle', 'Architectural'
    ];

    for (const variant of variants) {
      await supabase
        .from('property_video_variants')
        .upsert(
          { property_id: testProperty.id, variant, status: 'PENDING' },
          { onConflict: 'property_id,variant' }
        );

      await videoGenerationQueue.add({
        internal_db_id: testProperty.id,
        variant,
        property_data: testProperty
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true
      });
    }

    console.log(`[Test Framework] Success. All 3 variant jobs delegated to video worker.`);

  } catch (error: any) {
    console.error("[Test Ingestion Router Failure]: Initialization failed:", error.message || error);

    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to initialize test pipeline inside Supabase state engine." });
    }
  }
});

export default router;