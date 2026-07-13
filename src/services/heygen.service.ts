// src/services/heygen.service.ts
import { supabase } from './supabase.service';

export type VariantType = 'Investment' | 'Lifestyle' | 'Architectural';

export interface VideoScene {
  imageUrl: string;
  prompt: string;
  script: string;
}

export interface ProcessVideoParams {
  internal_db_id: string;
  scenes: VideoScene[];
}

export interface ProcessVideoParams {
  internal_db_id: number;
  variant: VariantType; // now specified by the caller — poller queues all 3
  property_data: {
    price?: number;
    price_min?: number;
    price_max?: number;
    unit_type?: string;
    specific_location?: string;
    property_name?: string;
    amenities?: string[];
    payment_plan_structure?: string;
    house_size_sqft?: number;
    [key: string]: unknown;
  };
}

interface PersonaTemplate {
  internal_tag: string;
  avatar_id: string;
  voice_id: string;
}

class HeyGenService {
  private readonly HEYGEN_API_URL = 'https://api.heygen.com/v2/video/generate';
  private readonly API_KEY = process.env.HEYGEN_API_KEY;


  public async generateAudioChunk(scriptText: string): Promise<string> {
    console.log(`[HeyGen] Generating audio chunk for script: "${scriptText.substring(0, 30)}..."`);
    
    // TODO: Insert your actual HeyGen API fetch request here.
    // For now, we return a mock file path so the TypeScript compiler passes 
    // and you can test the pipeline flow.
    return '/tmp/mock_heygen_audio.mp4'; 
  }
  // ⚠️ PLACEHOLDER IDS — every persona below uses the SAME avatar_id/voice_id
  // right now, which means Investment/Lifestyle/Architectural currently look
  // and sound IDENTICAL despite different labels. Get real distinct IDs from
  // your HeyGen dashboard (Avatars/Voices sections, or your custom-trained
  // avatars if you have them) and replace every entry below before this
  // produces the persona variety your contract's Section 1.2 requires.
  private readonly personaMatrix: Record<VariantType, PersonaTemplate[]> = {
    Investment: [
      { internal_tag: 'inv_avatar_alpha', avatar_id: '27ee7bdcf0e3442f8fee7dd48618a895', voice_id: '330290724a1b470fb63153f34d4c0183' },
      { internal_tag: 'inv_avatar_beta', avatar_id: '27ee7bdcf0e3442f8fee7dd48618a895', voice_id: '330290724a1b470fb63153f34d4c0183' },
      { internal_tag: 'inv_avatar_gamma', avatar_id: '27ee7bdcf0e3442f8fee7dd48618a895', voice_id: '330290724a1b470fb63153f34d4c0183' },
    ],
    Lifestyle: [
      { internal_tag: 'life_avatar_alpha', avatar_id: '27ee7bdcf0e3442f8fee7dd48618a895', voice_id: '330290724a1b470fb63153f34d4c0183' },
      { internal_tag: 'life_avatar_beta', avatar_id: '27ee7bdcf0e3442f8fee7dd48618a895', voice_id: '330290724a1b470fb63153f34d4c0183' },
      { internal_tag: 'life_avatar_gamma', avatar_id: '27ee7bdcf0e3442f8fee7dd48618a895', voice_id: '330290724a1b470fb63153f34d4c0183' },
    ],
    Architectural: [
      { internal_tag: 'arch_avatar_alpha', avatar_id: '27ee7bdcf0e3442f8fee7dd48618a895', voice_id: '330290724a1b470fb63153f34d4c0183' },
      { internal_tag: 'arch_avatar_beta', avatar_id: '27ee7bdcf0e3442f8fee7dd48618a895', voice_id: '330290724a1b470fb63153f34d4c0183' },
      { internal_tag: 'arch_avatar_gamma', avatar_id: '27ee7bdcf0e3442f8fee7dd48618a895', voice_id: '330290724a1b470fb63153f34d4c0183' },
    ]
  };

  public async processVideo(params: { internal_db_id: number; variant: VariantType; property_data: ProcessVideoParams['property_data'] }): Promise<void> {
    try {
      console.log(`[Stage 3] Initiating HeyGen build for Property DB ID: ${params.internal_db_id}, variant: ${params.variant}`);

      const displayPrice = this.formatDisplayPrice(
        params.property_data.price_min ?? params.property_data.price,
        params.property_data.price_max ?? params.property_data.price,
      );
      const persona = await this.selectOptimalPersona(params.variant);
      const payload = this.constructHeyGenPayload(params.property_data, displayPrice, params.variant, persona);

      const response = await fetch(this.HEYGEN_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.API_KEY as string,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HeyGen API Error: ${response.status} - ${errorData}`);
      }

      const responseData = await response.json();
      const heygenJobId = responseData.data?.video_id || responseData.data?.id;

      if (!heygenJobId) throw new Error("Failed to extract valid video_id from HeyGen API response.");

      const trackingReference = `${heygenJobId}_${persona.internal_tag}`;

      // Tracked per-variant now, not on the property row directly — each
      // property has 3 independent rows in property_video_variants.
      const { error: updateError } = await supabase
        .from('property_video_variants')
        .update({ heygen_job_id: trackingReference, status: 'RENDERING', updated_at: new Date().toISOString() })
        .eq('property_id', params.internal_db_id)
        .eq('variant', params.variant);

      if (updateError) throw new Error(`Supabase Update Error: ${updateError.message}`);

      console.log(`[Stage 3] Success. Job ${heygenJobId} queued using Avatar: ${persona.internal_tag} (variant: ${params.variant}).`);

    } catch (error) {
      console.error(`[Stage 3 Fatal Error] Failed to process ${params.variant} video for DB ID ${params.internal_db_id}:`, error);
      try {
        await supabase
          .from('property_video_variants')
          .update({ status: 'FAILED', updated_at: new Date().toISOString() })
          .eq('property_id', params.internal_db_id)
          .eq('variant', params.variant);
      } catch (dbError) {
        console.error('[Stage 3 Database Fallback Error] Network failure on fallback:', dbError);
      }
      throw error;
    }
  }

  /** Formats a price range into the script-friendly spoken string. Handles
   *  missing price gracefully, and collapses to a single figure when
   *  min === max (most properties won't have a real range yet). */
  private formatDisplayPrice(min: number | undefined | null, max: number | undefined | null): string {
    if (!min || min <= 0) return 'a price available on request';
    const fmt = (n: number) => {
      const millions = n / 1_000_000;
      return millions >= 1 ? `KES ${millions.toFixed(millions % 1 === 0 ? 0 : 1)} Million` : `KES ${n.toLocaleString()}`;
    };
    if (!max || max === min) return fmt(min);
    return `starting from ${fmt(min)}, up to ${fmt(max)}`;
  }

  private async selectOptimalPersona(variant: VariantType): Promise<PersonaTemplate> {
    const pool = this.personaMatrix[variant];
    try {
      const { data, error } = await supabase
        .from('fact_creative_performance')
        .select('creative_id, clicks')
        .order('clicks', { ascending: false })
        .limit(20);

      if (!error && data && data.length > 0) {
        for (const record of data) {
          const matchedPersona = pool.find(p => record.creative_id.includes(p.internal_tag));
          if (matchedPersona) {
            console.log(`[Optimization] Selected winning persona: ${matchedPersona.internal_tag} based on ad clicks.`);
            return matchedPersona;
          }
        }
      }
    } catch (err) {
      console.warn('[Optimization Warning] Analytics fetch failed, falling back to A/B rotation.');
    }
    const randomIndex = Math.floor(Math.random() * pool.length);
    console.log(`[Optimization] Insufficient data. Randomly selected persona: ${pool[randomIndex].internal_tag} for A/B testing.`);
    return pool[randomIndex];
  }

  private constructHeyGenPayload(
    propertyData: ProcessVideoParams['property_data'],
    displayPrice: string,
    variant: VariantType,
    persona: PersonaTemplate,
  ) {
    const textScript = `Welcome to Chestone Properties. We are thrilled to present this magnificent ${variant} opportunity located at ${propertyData.specific_location || 'Nairobi'}. Available for ${displayPrice}.`;

    return {
      video_inputs: [
        {
          character: { type: 'avatar', avatar_id: persona.avatar_id, avatar_style: 'normal' },
          voice: { type: 'text', input_text: textScript, voice_id: persona.voice_id },
          background: { type: 'color', value: '#FFFFFF' }
        }
      ],
      dimension: { width: 1920, height: 1080 }
    };
  }
}

export const heygenService = new HeyGenService();