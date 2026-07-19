// src/services/personas.service.ts
//
// SINGLE SOURCE OF TRUTH for avatar/voice personas. Previously this logic
// was split (and drifting) between heygen.service.ts's personaMatrix +
// selectOptimalPersona(), and video-orchestrator.service.ts's separate
// single-entry PERSONAS map. Two places meant two things to update and
// forget to sync — this file replaces both.
//
// heygen.service.ts's processVideo() is now superseded by
// video-orchestrator.service.ts + heygen-chunk.service.ts and should not be
// called from video.worker.ts anymore — CONFIRM this switch actually
// happened; if video.worker.ts still calls heygenService.processVideo, the
// old file's separate (also-placeholder) persona logic is what's actually
// running, not this one.

import { supabase } from './supabase.service';

export type VariantType = 'Investment' | 'Lifestyle' | 'Architectural';

export interface PersonaTemplate {
  internal_tag: string;
  avatar_id: string;
  voice_id: string;
}

// Fill in with your 9 real avatars — 3 per category, matching how
// selectOptimalPersona() below rotates/picks between them. Each avatar_id
// and voice_id comes from GET /v3/avatars/looks/{id} (default_voice_id) or
// GET /v3/voices if you want to mix a different voice onto a given avatar.
//
// CURRENT STATE (2026-07-16): only 1 real persona filled per variant while
// testing end-to-end. The other 2 slots per variant are commented out
// rather than left as "REPLACE_ME" placeholders — this matters:
// selectOptimalPersona() picks randomly from whatever array it's given, so
// a live REPLACE_ME string in the pool would eventually get selected and
// silently fail a real render. Commenting them out means the pool has
// exactly 1 real option until you uncomment more, same discipline as
// TEST_SINGLE_VARIANT — nothing to forget, nothing that can be picked by
// accident.
export const PERSONAS: Record<VariantType, PersonaTemplate[]> = {
  Investment: [
    { internal_tag: 'inv_avatar_alpha', avatar_id: '954565cb9e1e4ccc8b874d3c00db851f', voice_id: '0516c2d857eb425c94e90b068241914e' },
    // { internal_tag: 'inv_avatar_beta', avatar_id: 'REPLACE_ME', voice_id: 'REPLACE_ME' },
    // { internal_tag: 'inv_avatar_gamma', avatar_id: 'REPLACE_ME', voice_id: 'REPLACE_ME' },
  ],
  Lifestyle: [
    { internal_tag: 'life_avatar_alpha', avatar_id: 'REPLACE_ME', voice_id: 'REPLACE_ME' },
    // { internal_tag: 'life_avatar_beta', avatar_id: 'REPLACE_ME', voice_id: 'REPLACE_ME' },
    // { internal_tag: 'life_avatar_gamma', avatar_id: 'REPLACE_ME', voice_id: 'REPLACE_ME' },
  ],
  Architectural: [
    { internal_tag: 'arch_avatar_alpha', avatar_id: 'REPLACE_ME', voice_id: 'REPLACE_ME' },
    // { internal_tag: 'arch_avatar_beta', avatar_id: 'REPLACE_ME', voice_id: 'REPLACE_ME' },
    // { internal_tag: 'arch_avatar_gamma', avatar_id: 'REPLACE_ME', voice_id: 'REPLACE_ME' },
  ],
};

/**
 * Picks the best-performing persona for a variant based on real ad click
 * data, falling back to random rotation when there's not enough data yet.
 * This is the actual "recycle whichever avatar is performing better" logic
 * — moved here unchanged from heygen.service.ts, just now with a single
 * home instead of living only in the file that's being retired.
 */
export async function selectOptimalPersona(variant: VariantType): Promise<PersonaTemplate> {
  const pool = PERSONAS[variant];
  try {
    const { data, error } = await supabase
      .from('fact_creative_performance')
      .select('creative_id, clicks')
      .order('clicks', { ascending: false })
      .limit(20);

    if (!error && data && data.length > 0) {
      for (const record of data) {
        const matchedPersona = pool.find((p) => record.creative_id.includes(p.internal_tag));
        if (matchedPersona) {
          console.log(`[Personas] Selected winning persona: ${matchedPersona.internal_tag} based on ad clicks.`);
          return matchedPersona;
        }
      }
    }
  } catch (err) {
    console.warn('[Personas] Analytics fetch failed, falling back to A/B rotation.');
  }
  const randomIndex = Math.floor(Math.random() * pool.length);
  console.log(`[Personas] Insufficient data. Randomly selected persona: ${pool[randomIndex].internal_tag} for A/B testing.`);
  return pool[randomIndex];
}