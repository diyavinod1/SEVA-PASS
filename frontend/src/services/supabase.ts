/**
 * SEVA PASS — Client-Side Supabase Integration Service
 * 
 * SECURITY COMPLIANCE:
 * Only public credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are permitted.
 * Service-role keys bypass Row Level Security and MUST NEVER exist on the frontend.
 */

// Safety check against inadvertent secret exposure
const dangerousEnv = (import.meta.env as unknown as Record<string, string>);
if (dangerousEnv.VITE_SUPABASE_SERVICE_ROLE_KEY || dangerousEnv.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[SEVA PASS SECURITY VIOLATION] Detected service-role key in frontend environment! ' +
    'Service-role keys must NEVER be exposed to the client bundle. Remove immediately.'
  );
}

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export const getSupabaseConfig = (): SupabaseClientConfig => {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

  const isConfigured = Boolean(
    url &&
    anonKey &&
    !url.toLowerCase().includes('your-') &&
    !anonKey.toLowerCase().includes('your-')
  );

  return {
    url,
    anonKey,
    isConfigured
  };
};

export const checkSupabaseClientHealth = async (): Promise<{
  configured: boolean;
  reachable: boolean;
  statusText: string;
}> => {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return {
      configured: false,
      reachable: false,
      statusText: 'Supabase credentials not set or using placeholders in frontend/.env'
    };
  }

  try {
    const res = await fetch(`${config.url}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`
      }
    });

    return {
      configured: true,
      reachable: res.status === 200 || res.status === 404,
      statusText: res.ok ? 'Supabase REST gateway reachable' : `HTTP ${res.status}: ${res.statusText}`
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      configured: true,
      reachable: false,
      statusText: `Connection failed: ${message}`
    };
  }
};
