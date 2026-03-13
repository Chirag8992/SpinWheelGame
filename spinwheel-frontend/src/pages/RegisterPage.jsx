import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Particles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i, size: Math.random() * 4 + 1, x: Math.random() * 100,
    delay: Math.random() * 8, dur: Math.random() * 10 + 8,
    color: Math.random() > 0.5 ? 'var(--gold)' : 'var(--cyan)',
    opacity: Math.random() * 0.4 + 0.1,
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

export default function RegisterPage() {
  const { register, isAuth } = useAuth();
  const navigate = useNavigate();
  const [form,    setForm]    = useState({ username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isAuth) navigate('/lobby', { replace: true });
    setTimeout(() => setVisible(true), 50);
  }, [isAuth]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.username || !form.email || !form.password) {
      setError('Please fill in all fields'); return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match'); return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters'); return;
    }

    setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      navigate('/lobby', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key:'username', label:'Username', type:'text',     placeholder:'Choose a username' },
    { key:'email',    label:'Email',    type:'email',    placeholder:'your@email.com' },
    { key:'password', label:'Password', type:'password', placeholder:'Min 6 characters' },
    { key:'confirm',  label:'Confirm',  type:'password', placeholder:'Repeat password' },
  ];

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
      <Particles />
      <div style={{ position:'fixed', top:'30%', right:'10%', width:350, height:350, borderRadius:'50%', background:'radial-gradient(circle, rgba(191,90,242,0.06), transparent 70%)', pointerEvents:'none' }} />

      <div style={{
        width:'100%', maxWidth:440, padding:'0 1.5rem', zIndex:1,
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>🎮</div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:900, color:'var(--gold)', textShadow:'0 0 30px rgba(245,197,24,0.5)', letterSpacing:'0.15em' }}>
            JOIN THE GAME
          </h1>
          <p style={{ color:'var(--text-muted)', marginTop:'0.4rem', fontSize:'0.9rem' }}>
            Create your account and start spinning
          </p>
        </div>

        <div className="glass-card" style={{ padding:'2.5rem' }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1rem', letterSpacing:'0.1em', marginBottom:'2rem', color:'var(--text-secondary)' }}>
            CREATE ACCOUNT
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              {fields.map(f => (
                <div key={f.key}>
                  <label style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:'0.5rem' }}>
                    {f.label}
                  </label>
                  <input
                    className="input"
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}

              {error && (
                <div style={{ padding:'0.75rem 1rem', background:'rgba(255,45,85,0.1)', border:'1px solid rgba(255,45,85,0.3)', borderRadius:'var(--radius-md)', color:'var(--red)', fontSize:'0.9rem', animation:'fadeIn 0.3s ease' }}>
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-gold btn-lg"
                disabled={loading}
                style={{ width:'100%', justifyContent:'center', marginTop:'0.5rem' }}
              >
                {loading
                  ? <><div className="spinner" style={{width:16,height:16,borderWidth:2}} /> Creating account...</>
                  : '🚀 Create Account'
                }
              </button>
            </div>
          </form>

          <div className="neon-divider" style={{ margin:'1.5rem 0' }} />

          <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'0.9rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color:'var(--cyan)', textDecoration:'none', fontWeight:600 }}>
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
