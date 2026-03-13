import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// Floating particle background
function Particles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id:    i,
    size:  Math.random() * 4 + 1,
    x:     Math.random() * 100,
    delay: Math.random() * 8,
    dur:   Math.random() * 10 + 8,
    color: Math.random() > 0.5 ? 'var(--gold)' : 'var(--cyan)',
    opacity: Math.random() * 0.4 + 0.1,
  }));

  return (
    <div className="particle-bg">
      {particles.map(p => (
        <div key={p.id} className="particle" style={{
          width:            p.size,
          height:           p.size,
          left:             `${p.x}%`,
          bottom:           '-10px',
          background:       p.color,
          opacity:          p.opacity,
          animationDuration:`${p.dur}s`,
          animationDelay:   `${p.delay}s`,
          boxShadow:        `0 0 ${p.size * 3}px ${p.color}`,
        }} />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const { login, isAuth } = useAuth();
  const navigate          = useNavigate();
  const location          = useLocation();
  const from              = location.state?.from?.pathname || '/lobby';

  const [form,    setForm]    = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isAuth) navigate(from, { replace: true });
    setTimeout(() => setVisible(true), 50);
  }, [isAuth]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username || !form.password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const user = await login(form.username, form.password);
      navigate(user.role === 'admin' ? '/admin' : from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <Particles />

      {/* Background glow orbs */}
      <div style={{ position:'fixed', top:'20%', left:'15%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,197,24,0.06), transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:'20%', right:'15%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(0,212,255,0.06), transparent 70%)', pointerEvents:'none' }} />

      {/* Card */}
      <div style={{
        width:      '100%',
        maxWidth:   440,
        padding:    '0 1.5rem',
        zIndex:     1,
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
          <div style={{ fontSize:'3rem', marginBottom:'0.5rem', animation:'float 3s ease-in-out infinite' }}>🎡</div>
          <h1 style={{
            fontFamily:  'var(--font-display)',
            fontSize:    '1.8rem',
            fontWeight:  900,
            color:       'var(--gold)',
            textShadow:  '0 0 30px rgba(245,197,24,0.5)',
            letterSpacing:'0.15em',
          }}>SPINWHEEL</h1>
          <p style={{ color:'var(--text-muted)', marginTop:'0.4rem', fontSize:'0.9rem' }}>
            The last one spinning wins everything
          </p>
        </div>

        {/* Form card */}
        <div className="glass-card" style={{ padding:'2.5rem', animation:'borderGlow 3s ease-in-out infinite' }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1rem', letterSpacing:'0.1em', marginBottom:'2rem', color:'var(--text-secondary)' }}>
            SIGN IN
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div>
                <label style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:'0.5rem' }}>
                  Username
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="Enter your username"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:'0.5rem' }}>
                  Password
                </label>
                <input
                  className="input"
                  type="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>

              {error && (
                <div style={{
                  padding:     '0.75rem 1rem',
                  background:  'rgba(255,45,85,0.1)',
                  border:      '1px solid rgba(255,45,85,0.3)',
                  borderRadius:'var(--radius-md)',
                  color:       'var(--red)',
                  fontSize:    '0.9rem',
                  animation:   'fadeIn 0.3s ease',
                }}>
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-gold btn-lg"
                disabled={loading}
                style={{ width:'100%', justifyContent:'center', marginTop:'0.5rem' }}
              >
                {loading ? <><div className="spinner" style={{width:16,height:16,borderWidth:2}} /> Signing in...</> : '⚡ Sign In'}
              </button>
            </div>
          </form>

          <div className="neon-divider" style={{ margin:'1.5rem 0' }} />

          <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'0.9rem' }}>
            No account?{' '}
            <Link to="/register" style={{ color:'var(--cyan)', textDecoration:'none', fontWeight:600 }}>
              Create one →
            </Link>
          </p>
          <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'0.5rem' }}>
            Admin?{' '}
            <Link to="/register-admin" style={{ color:'var(--purple)', textDecoration:'none', fontWeight:600 }}>
              Create admin account →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}