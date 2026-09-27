import React, { useState } from 'react';
import { api, User } from '../lib/api';

export function AuthDialog({ onDone, onCancel }: { onDone: (u: User) => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { onDone(mode === 'login' ? await api.login(email, password) : await api.register(email, password, name)); }
    catch (err: any) { setError(err.message || 'Operazione non riuscita'); }
    finally { setBusy(false); }
  };
  return (
    <div className="modal-backdrop" role="dialog" aria-label="Accesso">
      <form className="modal" onSubmit={submit} data-testid="auth-dialog">
        <h2>{mode === 'login' ? 'Accedi' : 'Crea account'}</h2>
        <p>Le configurazioni prodotto vengono salvate online e sono modificabili solo dal proprietario. I progetti fotografici restano nel browser.</p>
        {mode === 'register' && <div className="m-field"><label htmlFor="auth-name">Nome</label><input id="auth-name" className="m-input" value={name} onChange={e => setName(e.target.value)} data-testid="auth-name" /></div>}
        <div className="m-field"><label htmlFor="auth-email">Email</label><input id="auth-email" className="m-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} data-testid="auth-email" /></div>
        <div className="m-field"><label htmlFor="auth-password">Password (min. 6 caratteri)</label><input id="auth-password" className="m-input" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} data-testid="auth-password" /></div>
        {error && <p className="warn-box" data-testid="auth-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} data-testid="auth-switch">{mode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}</button>
          <button type="button" className="btn btn-outline" onClick={onCancel}>Annulla</button>
          <button type="submit" className="btn btn-gold" disabled={busy} data-testid="auth-submit">{busy ? 'Attendi…' : mode === 'login' ? 'Accedi' : 'Registrati'}</button>
        </div>
      </form>
    </div>
  );
}
