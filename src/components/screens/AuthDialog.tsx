'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  MIN_PASSWORD_LENGTH,
  isSupabaseConfigured,
  normalizeUsername,
  signInWithUsername,
  signUpWithUsername,
  validatePassword,
  validateUsername,
} from '../../game/auth/supabaseClient';

type AuthTab = 'login' | 'register';

export default function AuthDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<AuthTab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const switchTab = (next: AuthTab) => {
    setTab(next);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const cleanUser = normalizeUsername(username);
    const userErr = validateUsername(cleanUser);
    if (userErr) {
      setError(tab === 'login' ? 'Username atau password salah.' : userErr);
      return;
    }

    const passErr = validatePassword(password);
    if (passErr) {
      setError(tab === 'login' ? 'Username atau password salah.' : passErr);
      return;
    }

    if (tab === 'register' && password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setSubmitting(true);
    try {
      const result =
        tab === 'login'
          ? await signInWithUsername(cleanUser, password)
          : await signUpWithUsername(cleanUser, password);

      if (result.error || !result.user) {
        setError(result.error ?? 'Autentikasi gagal. Coba lagi.');
        return;
      }

      setPassword('');
      setConfirmPassword('');
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const configured = isSupabaseConfigured();

  return (
    <dialog
      ref={ref}
      className="dialog auth-dialog"
      aria-labelledby="auth-heading"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">Simpan Progres Akun</p>
          <h2 id="auth-heading">{tab === 'login' ? 'Masuk Akun' : 'Daftar Akun'}</h2>
        </div>
        <button className="btn btn-quiet" type="button" onClick={onClose} data-nav data-gamepad-back>
          Tutup
        </button>
      </div>

      <div className="auth-tabs" role="tablist" aria-label="Pilih mode akun">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'login'}
          className="btn auth-tab"
          data-active={tab === 'login'}
          onClick={() => switchTab('login')}
        >
          Masuk
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'register'}
          className="btn auth-tab"
          data-active={tab === 'register'}
          onClick={() => switchTab('register')}
        >
          Daftar
        </button>
      </div>

      {!configured && (
        <p className="auth-warning" role="status">
          Server akun belum dikonfigurasi (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Kamu tetap bisa bermain sebagai tamu.
        </p>
      )}

      {tab === 'register' && (
        <p className="auth-warning" role="note">
          Peringatan: Pendaftaran tidak memakai email. Jika password lupa atau hilang, akun TIDAK bisa dipulihkan.
        </p>
      )}

      {error && (
        <p className="mp-error" role="alert">
          {error}
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="mp-field auth-field">
          <span>Username (3-20 karakter: a-z, 0-9, _)</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="contoh: pembalap_86"
            required
          />
        </label>

        <label className="mp-field auth-field">
          <span>Password (minimal {MIN_PASSWORD_LENGTH} karakter)</span>
          <input
            type="password"
            name="password"
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        {tab === 'register' && (
          <label className="mp-field auth-field">
            <span>Konfirmasi password</span>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
        )}

        <div className="auth-actions">
          <button
            className="btn btn-primary auth-submit"
            type="submit"
            disabled={submitting || !configured}
          >
            {submitting
              ? 'Memproses...'
              : tab === 'login'
                ? 'Masuk'
                : 'Daftar & Simpan'}
          </button>
          <button
            className="btn btn-quiet auth-guest"
            type="button"
            onClick={onClose}
          >
            Main sebagai tamu
          </button>
        </div>
      </form>
    </dialog>
  );
}
