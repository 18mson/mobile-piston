import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
export const MIN_PASSWORD_LENGTH = 8;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';
const SYNTHETIC_EMAIL_DOMAIN = process.env.NEXT_PUBLIC_SYNTHETIC_EMAIL_DOMAIN || 'mobile-piston.local';
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return cachedClient;
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const clean = normalizeUsername(raw);
  if (!USERNAME_REGEX.test(clean)) {
    return 'Username harus 3-20 karakter (huruf kecil a-z, angka 0-9, atau _).';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }
  return null;
}

export function toSyntheticEmail(username: string): string {
  return `${normalizeUsername(username)}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function extractUsernameFromUser(user: User | null | undefined): string | null {
  if (!user) return null;
  const meta = user.user_metadata as { username?: unknown } | undefined;
  if (typeof meta?.username === 'string' && USERNAME_REGEX.test(normalizeUsername(meta.username))) {
    return normalizeUsername(meta.username);
  }
  if (typeof user.email === 'string' && user.email.includes('@')) {
    const prefix = normalizeUsername(user.email.split('@')[0]);
    if (USERNAME_REGEX.test(prefix)) return prefix;
  }
  return null;
}

export function mapAuthError(error: unknown, mode: 'login' | 'register'): string {
  if (!error || typeof error !== 'object') {
    return 'Terjadi gangguan autentikasi. Coba lagi.';
  }
  const err = error as { status?: number; message?: string; code?: string };
  const msg = (err.message ?? '').toLowerCase();
  if (err.status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  }
  if (mode === 'register') {
    if (
      msg.includes('already registered') ||
      msg.includes('already exists') ||
      msg.includes('duplicate') ||
      err.code === 'user_already_exists'
    ) {
      return 'Username sudah dipakai.';
    }
    if (msg.includes('password')) {
      return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
    }
  }
  if (mode === 'login') {
    if (
      msg.includes('invalid login') ||
      msg.includes('invalid credentials') ||
      err.code === 'invalid_credentials'
    ) {
      return 'Username atau password salah.';
    }
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Tidak dapat terhubung ke server akun. Periksa koneksi internet.';
  }
  return mode === 'login' ? 'Username atau password salah.' : 'Pendaftaran gagal. Coba lagi.';
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return true;
  const clean = normalizeUsername(username);
  if (!USERNAME_REGEX.test(clean)) return false;
  const { data, error } = await client.rpc('is_username_available', { candidate: clean });
  if (error) return true;
  return Boolean(data);
}

export async function signUpWithUsername(
  username: string,
  password: string,
  captchaToken?: string,
): Promise<{ user: User | null; error: string | null }> {
  const userErr = validateUsername(username);
  if (userErr) return { user: null, error: userErr };
  const passErr = validatePassword(password);
  if (passErr) return { user: null, error: passErr };

  const client = getSupabaseClient();
  if (!client) {
    return { user: null, error: 'Layanan akun belum dikonfigurasi di environment ini.' };
  }

  const clean = normalizeUsername(username);
  const available = await checkUsernameAvailable(clean);
  if (!available) {
    return { user: null, error: 'Username sudah dipakai.' };
  }

  const { data, error } = await client.auth.signUp({
    email: toSyntheticEmail(clean),
    password,
    options: {
      data: { username: clean },
      ...(captchaToken ? { captchaToken } : {}),
    },
  });

  if (error) {
    return { user: null, error: mapAuthError(error, 'register') };
  }
  return { user: data.user ?? null, error: null };
}

export async function signInWithUsername(
  username: string,
  password: string,
  captchaToken?: string,
): Promise<{ user: User | null; error: string | null }> {
  const userErr = validateUsername(username);
  if (userErr) return { user: null, error: 'Username atau password salah.' };
  const passErr = validatePassword(password);
  if (passErr) return { user: null, error: 'Username atau password salah.' };

  const client = getSupabaseClient();
  if (!client) {
    return { user: null, error: 'Layanan akun belum dikonfigurasi di environment ini.' };
  }

  const clean = normalizeUsername(username);
  const { data, error } = await client.auth.signInWithPassword({
    email: toSyntheticEmail(clean),
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });

  if (error) {
    return { user: null, error: mapAuthError(error, 'login') };
  }
  return { user: data.user ?? null, error: null };
}

export async function signOutAccount(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}
