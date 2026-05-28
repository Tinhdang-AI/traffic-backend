import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { nodeFetch } from '../common/http/node-fetch.helper';

@Injectable()
export class SupabaseService {
  private readonly adminClient: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    console.log('[SupabaseService] Loaded SUPABASE_URL:', url);
    console.log('[SupabaseService] Loaded SUPABASE_SERVICE_ROLE_KEY length:', serviceRoleKey ? serviceRoleKey.length : 0);
    if (serviceRoleKey) {
      console.log('[SupabaseService] Loaded SUPABASE_SERVICE_ROLE_KEY prefix:', serviceRoleKey.substring(0, 20));
    }

    if (!url || !serviceRoleKey) {
      throw new Error(
        'Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env',
      );
    }

    this.adminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      // Use Node.js https module instead of undici (fixes ConnectTimeoutError on Windows)
      global: { fetch: nodeFetch as unknown as typeof fetch },
    });
  }

  /**
   * Returns the admin (service role) Supabase client.
   * Use for server-side operations: reading/writing data, admin auth.
   */
  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  /**
   * Returns a transient, unauthenticated Supabase client using the anon key.
   * Safe to use for user auth operations (login, refresh session) to prevent
   * polluting the singleton adminClient's authentication state.
   */
  createAuthClient(): SupabaseClient {
    const url = this.configService.get<string>('SUPABASE_URL')!;
    const anonKey = this.configService.get<string>('SUPABASE_ANON_KEY')!;

    return createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      // Use Node.js https module instead of undici (fixes ConnectTimeoutError on Windows)
      global: { fetch: nodeFetch as unknown as typeof fetch },
    });
  }

  /**
   * Returns a user-scoped Supabase client authenticated with a user JWT.
   * Use when you need RLS (Row Level Security) to apply.
   */
  getUserClient(accessToken: string): SupabaseClient {
    const url = this.configService.get<string>('SUPABASE_URL')!;
    const anonKey = this.configService.get<string>('SUPABASE_ANON_KEY')!;

    return createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        // Use Node.js https module instead of undici (fixes ConnectTimeoutError on Windows)
        fetch: nodeFetch as unknown as typeof fetch,
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
}

