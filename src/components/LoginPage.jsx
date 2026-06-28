import { useState } from 'react';
import { login } from '../services/auth.js';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.left}>
        <div style={styles.overlay}>
          <p style={styles.tagline}>Czytaj. Rozumiej. Pamiętaj.</p>
        </div>
      </div>

      <div style={styles.right}>
        <div style={styles.card}>
          <div style={styles.logoRow}>
            <span style={styles.logoGreek}>Η</span>
            <span style={styles.logoText}>Homeric</span>
          </div>
          <p style={styles.subtitle}>Platforma nauki przez literaturę</p>

          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>Adres e-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="twoj@email.pl"
              required
              style={styles.input}
              autoComplete="email"
            />

            <label style={styles.label}>Hasło</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
              autoComplete="current-password"
            />

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" disabled={loading} style={styles.btn}>
              {loading ? 'Logowanie…' : 'Zaloguj się'}
            </button>
          </form>

          <p style={styles.footer}>
            &copy; {new Date().getFullYear()} Homeric &mdash; wszelkie prawa zastrzeżone
          </p>
        </div>
      </div>
    </div>
  );
}

const BROWN_DARK  = '#3D2314';
const BROWN_MID   = '#7B4A1E';
const BROWN_LIGHT = '#C8920A';
const CREAM       = '#FDF6EC';
const WHITE       = '#FFFFFF';

const styles = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'Georgia', 'Times New Roman', serif",
    background: CREAM,
  },
  left: {
    flex: '1 1 55%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundImage: `linear-gradient(rgba(61,35,20,0.55), rgba(61,35,20,0.55)), url('/homeric.png')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundColor: BROWN_DARK,
    minHeight: '100vh',
  },
  overlay: {
    textAlign: 'center',
    padding: '0 40px',
  },
  tagline: {
    color: WHITE,
    fontSize: '1.6rem',
    fontStyle: 'italic',
    letterSpacing: '0.04em',
    textShadow: '0 2px 12px rgba(0,0,0,0.6)',
    margin: 0,
  },
  right: {
    flex: '0 0 420px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: CREAM,
    padding: '48px 32px',
  },
  card: {
    width: '100%',
    maxWidth: '360px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  logoGreek: {
    fontSize: '2.8rem',
    color: BROWN_LIGHT,
    lineHeight: 1,
    fontWeight: 'bold',
  },
  logoText: {
    fontSize: '2rem',
    color: BROWN_DARK,
    fontWeight: '700',
    letterSpacing: '0.02em',
  },
  subtitle: {
    color: BROWN_MID,
    fontSize: '0.9rem',
    marginBottom: '36px',
    marginTop: 0,
    letterSpacing: '0.03em',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    color: BROWN_DARK,
    fontSize: '0.8rem',
    fontWeight: '600',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginTop: '12px',
    fontFamily: 'system-ui, sans-serif',
  },
  input: {
    padding: '11px 14px',
    border: `1.5px solid #D4B896`,
    borderRadius: '6px',
    fontSize: '0.95rem',
    background: WHITE,
    color: BROWN_DARK,
    outline: 'none',
    fontFamily: 'system-ui, sans-serif',
    transition: 'border-color 0.2s',
  },
  error: {
    color: '#C0392B',
    fontSize: '0.82rem',
    margin: '6px 0 0',
    fontFamily: 'system-ui, sans-serif',
  },
  btn: {
    marginTop: '24px',
    padding: '13px',
    background: BROWN_DARK,
    color: WHITE,
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    fontFamily: 'system-ui, sans-serif',
    transition: 'background 0.2s',
  },
  footer: {
    marginTop: '40px',
    color: '#A08060',
    fontSize: '0.72rem',
    textAlign: 'center',
    fontFamily: 'system-ui, sans-serif',
  },
};
