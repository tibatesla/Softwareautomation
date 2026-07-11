// src/services/heygen.service.ts
import { supabase } from './supabase.service';

export type VariantType = 'Investment' | 'Lifestyle' | 'Architectural';

export interface ProcessVideoParams {
  internal_db_id: number;
  display_price: string;
  urgency_factor: 'high' | 'low';
  property_data: any; 
}

interface PersonaTemplate {
  internal_tag: string; 
  avatar_id: string;
  voice_id: string;
}

class HeyGenService {
  private readonly HEYGEN_API_URL = 'https://api.heygen.com/v2/video/generate';
  private readonly API_KEY = process.env.HEYGEN_API_KEY;

  // IMPORTANT: Ensure your active paid Avatar/Voice IDs are populated here!
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

  public async processVideo(params: ProcessVideoParams): Promise<void> {
    try {
      console.log(`[Stage 3] Initiating HeyGen build for Property DB ID: ${params.internal_db_id}`);

      const variant = this.mapToVariantStrategy(params.property_data, params.urgency_factor);
      const persona = await this.selectOptimalPersona(variant);
      const payload = this.constructHeyGenPayload(params, variant, persona);

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
      const { error: updateError } = await supabase
        .from('chestone_properties')
        .update({ heygen_job_id: trackingReference, status: 'RENDERING' })
        .eq('id', params.internal_db_id);

      if (updateError) throw new Error(`Supabase Update Error: ${updateError.message}`);

      console.log(`[Stage 3] Success. Job ${heygenJobId} queued using Avatar: ${persona.internal_tag}.`);

    } catch (error) {
      console.error(`[Stage 3 Fatal Error] Failed to process video for DB ID ${params.internal_db_id}:`, error);
      try {
        await supabase.from('chestone_properties').update({ status: 'FAILED' }).eq('id', params.internal_db_id);
      } catch (dbError) {
        console.error('[Stage 3 Database Fallback Error] Network failure on fallback:', dbError);
      }
      throw error; 
    }
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

  private mapToVariantStrategy(propertyData: any, urgencyFactor: string): VariantType {
    if (urgencyFactor === 'high' || propertyData.payment_plan_structure?.toLowerCase().includes('roi')) return 'Investment';
    if (propertyData.house_size_sqft && propertyData.house_size_sqft > 4000) return 'Architectural';
    return 'Lifestyle';
  }

  private constructHeyGenPayload(params: ProcessVideoParams, variant: VariantType, persona: PersonaTemplate) {
    const textScript = `Welcome to Chestone Properties. We are thrilled to present this magnificent ${variant} opportunity located at ${params.property_data.specific_location}. Available for ${params.display_price}.`;
    
    // Notice how clean this is. We only request the Avatar on a White Background.
    // FFmpeg will handle the Annex B branding locally when the webhook arrives.
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