// src/scripts/print-script-only.ts
import dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../services/supabase.service';
import { buildScenePlan } from '../services/scene-planner.service';

async function main() {
  const { data: property, error } = await supabase
    .from('chestone_properties')
    .select('*')
    .eq('property_unique_id', 'LIR-3BR-PLAT')
    .single();

  if (error || !property) {
    throw new Error('Property not found — confirm the poller has synced it.');
  }

  const photoUrls: string[] = property.property_images || [];
  const scenes = await buildScenePlan(property, photoUrls, 'Investment');

  console.log('\n===== FULL SCRIPT =====\n');
  scenes.forEach((scene, i) => {
    console.log(`Scene ${i + 1}: ${scene.script}\n`);
  });
}

main().catch((err) => { console.error(err); process.exit(1); });