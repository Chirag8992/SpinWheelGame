import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { coinsApi } from '../../api/coins.api';
import { useState, useEffect } from 'react';
import { Zap, LayoutDashboard, Wallet, Trophy, LogOut, User, Settings } from 'lucide-react';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate  = useNavigate();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    coinsApi.getBalance()
      .then(r => setBalance(r.data.data.coinBalance))
      .catch(() => {});
  }, [location.pathname]); // refresh on every page change

  const handleLogout = () => { logout(); navigate('/login'); };

  const navLinks = [
    { to: '/lobby',       label: 'Lobby',       icon: Zap },
    { to: '/wallet',      label: 'Wallet',       icon: Wallet },
    { to: '/leaderboard', label: 'Leaderboard',  icon: Trophy },
    { to: '/profile',     label: 'Profile',      icon: User },
    ...(isAdmin ? [
      { to: '/admin',     label: 'Admin',        icon: LayoutDashboard },
    ] : [])
  ];

  return (
    <nav style={{
      position:     'fixed',
      top:          0,
      left:         0,
      right:        0,
      zIndex:       100,
      padding:      '0 2rem',
      height:       '64px',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'space-between',
      background:   'rgba(4, 4, 10, 0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(245,197,24,0.1)',
    }}>
      {/* Logo */}
      <Link to="/lobby" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.4rem' }}>🎡</span>
        <span style={{
          fontFamily:  'var(--font-display)',
          fontSize:    '1rem',
          fontWeight:  900,
          color:       'var(--gold)',
          textShadow:  '0 0 20px var(--gold)',
          letterSpacing: '0.1em'
        }}>SPINWHEEL</span>
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {navLinks.map(({ to, label, icon: Icon }) => {
          const active = location.pathname.startsWith(to);
          return (
            <Link key={to} to={to} style={{
              textDecoration: 'none',
              display:        'flex',
              alignItems:     'center',
              gap:            '0.4rem',
              padding:        '0.4rem 0.8rem',
              borderRadius:   'var(--radius-md)',
              fontFamily:     'var(--font-display)',
              fontSize:       '0.65rem',
              fontWeight:     600,
              letterSpacing:  '0.08em',
              textTransform:  'uppercase',
              color:          active ? 'var(--gold)' : 'var(--text-secondary)',
              background:     active ? 'rgba(245,197,24,0.1)' : 'transparent',
              border:         active ? '1px solid rgba(245,197,24,0.2)' : '1px solid transparent',
              transition:     'var(--transition)',
            }}>
              <Icon size={13} />
              <span className="hide-mobile">{label}</span>
            </Link>
          );
        })}
      </div>

      {/* Right: balance + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {balance !== null && (
          <div style={{
            fontFamily:  'var(--font-display)',
            fontSize:    '0.8rem',
            color:       'var(--gold)',
            display:     'flex',
            alignItems:  'center',
            gap:         '0.4rem',
          }}>
            🪙 <span style={{ fontWeight: 700 }}>{parseFloat(balance).toLocaleString()}</span>
          </div>
        )}

        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '0.5rem',
          color:      'var(--text-secondary)',
          fontSize:   '0.85rem'
        }}>
          <span className="hide-mobile">{user?.username}</span>
          {isAdmin && <span className="badge badge-gold">Admin</span>}
        </div>

        <button onClick={handleLogout} className="btn btn-ghost btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <LogOut size={13} />
          <span className="hide-mobile">Logout</span>
        </button>
      </div>
    </nav>
  );
}
