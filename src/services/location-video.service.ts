import { supabase } from './supabase.service';
import { videoGenerationQueue } from '../config/queue.config';

export async function ensureLocationVideoQueued(locationName: string): Promise<void> {
  if (!locationName || locationName === 'Location unverified') return;

  const { data: existing } = await supabase
    .from('location_videos')
    .select('location_name, status')
    .eq('location_name', locationName)
    .maybeSingle();

  if (existing && (existing.status === 'COMPLETED' || existing.status === 'RENDERING')) {
    return;
  }

  await supabase
    .from('location_videos')
    .upsert({ location_name: locationName, status: 'RENDERING', updated_at: new Date().toISOString() });

  await videoGenerationQueue.add(
    { kind: 'location', location_name: locationName },
    { attempts: 3, backoff: { type: 'exponential', delay: 10000 }, removeOnComplete: true }
  );

  console.log(`[LocationVideo] Queued neighborhood video generation for "${locationName}"`);
}