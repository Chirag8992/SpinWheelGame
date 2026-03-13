import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth.api';
import toast from 'react-hot-toast';

function Particles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i, size: Math.random() * 4 + 1, x: Math.random() * 100,
    delay: Math.random() * 8, dur: Math.random() * 10 + 8,
    color: Math.random() > 0.5 ? 'var(--gold)' : 'var(--purple)',
    opacity: Math.random() * 0.35 + 0.1,
  }));
  return (
    <div className="particle-bg">
      {particles.map(p => (
        <div key={p.id} className="particle" style={{
          width: p.size, height: p.size, left: `${p.x}%`, bottom: '-10px',
          background: p.color, opacity: p.opacity,
          animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`,
          boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
        }} />
      ))}
    </div>
  );
}

export default function RegisterAdminPage() {
  const { isAuth, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [form,    setForm]    = useState({ username:'', email:'', password:'', confirm:'', adminSecret:'' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [visible, setVisible] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    // Already logged in as admin → go to dashboard
    if (isAuth && isAdmin) navigate('/admin', { replace: true });
    setTimeout(() => setVisible(true), 50);
  }, [isAuth, isAdmin]);

  const handleChange = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.username || !form.email || !form.password || !form.adminSecret) {
      setError('All fields are required'); return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match'); return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters'); return;
    }

    setLoading(true);
    try {
      await authApi.registerAdmin({
        username:    form.username,
        email:       form.email,
        password:    form.password,
        adminSecret: form.adminSecret,
      });
      toast.success(`Admin account created for ${form.username}!`);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
      <Particles />

      {/* Glow orbs */}
      <div style={{ position:'fixed', top:'20%', left:'10%', width:350, height:350, borderRadius:'50%', background:'radial-gradient(circle, rgba(191,90,242,0.07), transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:'15%', right:'10%', width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,197,24,0.06), transparent 70%)', pointerEvents:'none' }} />

      <div style={{
        width:'100%', maxWidth:460, padding:'0 1.5rem', zIndex:1,
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>👑</div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:900, color:'var(--gold)', textShadow:'0 0 30px rgba(245,197,24,0.5)', letterSpacing:'0.15em' }}>
            ADMIN PORTAL
          </h1>
          <p style={{ color:'var(--text-muted)', marginTop:'0.4rem', fontSize:'0.9rem' }}>
            Create a new admin account
          </p>
        </div>

        {/* Warning banner */}
        <div style={{ marginBottom:'1.5rem', padding:'0.85rem 1rem', background:'rgba(191,90,242,0.08)', border:'1px solid rgba(191,90,242,0.25)', borderRadius:'var(--radius-md)', display:'flex', alignItems:'flex-start', gap:'0.6rem' }}>
          <span style={{ fontSize:'1rem', flexShrink:0 }}>🔐</span>
          <p style={{ color:'rgba(191,90,242,0.9)', fontSize:'0.8rem', lineHeight:1.5 }}>
            Admin registration requires a secret key. Contact your system administrator to obtain it.
          </p>
        </div>

        {/* Form card */}
        <div className="glass-card" style={{ padding:'2.5rem', border:'1px solid rgba(191,90,242,0.2)' }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'0.9rem', letterSpacing:'0.1em', marginBottom:'1.75rem', color:'var(--text-secondary)' }}>
            CREATE ADMIN ACCOUNT
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

              {/* Username */}
              <div>
                <label style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:'0.4rem' }}>
                  Username
                </label>
                <input className="input" type="text" placeholder="Admin username" value={form.username} onChange={handleChange('username')} autoFocus />
              </div>

              {/* Email */}
              <div>
                <label style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:'0.4rem' }}>
                  Email
                </label>
                <input className="input" type="email" placeholder="admin@example.com" value={form.email} onChange={handleChange('email')} />
              </div>

              {/* Password */}
              <div>
                <label style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:'0.4rem' }}>
                  Password
                </label>
                <input className="input" type="password" placeholder="Min 6 characters" value={form.password} onChange={handleChange('password')} />
              </div>

              {/* Confirm */}
              <div>
                <label style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:'0.4rem' }}>
                  Confirm Password
                </label>
                <input className="input" type="password" placeholder="Repeat password" value={form.confirm} onChange={handleChange('confirm')} />
              </div>

              {/* Admin Secret */}
              <div>
                <label style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', letterSpacing:'0.1em', color:'var(--purple)', textTransform:'uppercase', display:'block', marginBottom:'0.4rem' }}>
                  🔑 Admin Secret Key
                </label>
                <div style={{ position:'relative' }}>
                  <input
                    className="input"
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Enter admin secret key"
                    value={form.adminSecret}
                    onChange={handleChange('adminSecret')}
                    style={{ borderColor: form.adminSecret ? 'rgba(191,90,242,0.5)' : undefined, paddingRight:'3rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(s => !s)}
                    style={{ position:'absolute', right:'0.75rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1rem', lineHeight:1 }}
                  >
                    {showSecret ? '🙈' : '👁️'}
                  </button>
                </div>
                <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'0.35rem' }}>
                  Set in your backend <code style={{ color:'var(--purple)', background:'rgba(191,90,242,0.1)', padding:'0.1rem 0.3rem', borderRadius:3 }}>.env</code> as <code style={{ color:'var(--purple)', background:'rgba(191,90,242,0.1)', padding:'0.1rem 0.3rem', borderRadius:3 }}>ADMIN_SECRET</code>
                </p>
              </div>

              {/* Error */}
              {error && (
                <div style={{ padding:'0.75rem 1rem', background:'rgba(255,45,85,0.1)', border:'1px solid rgba(255,45,85,0.3)', borderRadius:'var(--radius-md)', color:'var(--red)', fontSize:'0.9rem', animation:'fadeIn 0.3s ease' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{ width:'100%', justifyContent:'center', marginTop:'0.5rem', fontFamily:'var(--font-display)', fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', border:'none', borderRadius:'var(--radius-md)', padding:'1rem 2.5rem', cursor: loading ? 'not-allowed' : 'pointer', background:'linear-gradient(135deg, var(--purple), #8b2fd4)', color:'#fff', boxShadow:'0 4px 20px rgba(191,90,242,0.35)', display:'flex', alignItems:'center', gap:'0.5rem', opacity: loading ? 0.7 : 1, transition:'var(--transition)' }}
              >
                {loading
                  ? <><div className="spinner" style={{ width:16, height:16, borderWidth:2, borderTopColor:'#fff', borderColor:'rgba(255,255,255,0.3)' }} /> Creating Admin...</>
                  : '👑 Create Admin Account'
                }
              </button>
            </div>
          </form>

          <div className="neon-divider" style={{ margin:'1.5rem 0' }} />

          <div style={{ display:'flex', justifyContent:'center', gap:'1.5rem', fontSize:'0.85rem', color:'var(--text-muted)' }}>
            <Link to="/login"    style={{ color:'var(--cyan)',  textDecoration:'none' }}>← Sign In</Link>
            <Link to="/register" style={{ color:'var(--gold)', textDecoration:'none' }}>Register User →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
