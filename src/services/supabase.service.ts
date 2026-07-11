// src/services/supabase.service.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing critical Supabase environment configuration tokens.');
}

export const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export interface PropertyMatchResult {
  id: string;
  property_unique_id: string;
  title: string;
  price: number;
  specific_location: string;
  similarity: number;
}

export class VectorSearchService {
  private client: SupabaseClient;

  constructor() {
    this.client = supabase;
  }

  /**
   * Executes a remote procedure call (RPC) match against the pgvector index
   * using cosine distance (1 - cosine_similarity).
   */
  public async findVectorMatchingProperties(
    embedding: number[],
    matchThreshold: number = 0.75,
    matchCount: number = 5
  ): Promise<PropertyMatchResult[]> {
    if (embedding.length !== 1536) {
      throw new Error(`Invalid vector dimensionality: Expected 1536, got ${embedding.length}`);
    }

    const { data, error } = await this.client.rpc('match_properties', {
      query_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    if (error) {
      throw new Error(`Supabase Vector Search RPC Failed: ${error.message}`);
    }

    return data as PropertyMatchResult[];
  }
}