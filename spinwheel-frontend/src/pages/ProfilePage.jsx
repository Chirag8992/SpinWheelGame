import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { wheelApi } from '../api/wheel.api';
import { coinsApi } from '../api/coins.api';
import { formatCoins, formatDate, txnLabel, txnColor } from '../utils/helpers';

function StatCard({ label, value, color, icon }) {
  return (
    <div className="glass-card" style={{ padding:'1.5rem', textAlign:'center', border:`1px solid ${color}22`, animation:'fadeInUp 0.4s ease' }}>
      <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>{icon}</div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:'1.6rem', fontWeight:900, color, textShadow:`0 0 20px ${color}`, marginBottom:'0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
        {label}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [balance,    setBalance]    = useState(null);
  const [history,    setHistory]    = useState([]);
  const [txnStats,   setTxnStats]   = useState({ wins:0, totalWon:0, totalWagered:0, gamesPlayed:0 });
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [balRes, histRes, txnRes] = await Promise.all([
          coinsApi.getBalance(),
          wheelApi.getHistory(1),
          coinsApi.getTransactions(1, 100),
        ]);
        setBalance(balRes.data.data.coinBalance);
        setHistory(histRes.data.data.wheels || []);

        const txns = txnRes.data.data.transactions || [];
        const wins         = txns.filter(t => t.type === 'winner_pool_credit');
        const entryFees    = txns.filter(t => t.type === 'entry_fee_debit');
        setTxnStats({
          wins:          wins.length,
          totalWon:      wins.reduce((s, t) => s + parseFloat(t.amount), 0),
          totalWagered:  entryFees.reduce((s, t) => s + parseFloat(t.amount), 0),
          gamesPlayed:   entryFees.length,
        });
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, []);

  const winRate = txnStats.gamesPlayed > 0 ? ((txnStats.wins / txnStats.gamesPlayed) * 100).toFixed(1) : '0';

  return (
    <div className="page" style={{ padding:'2rem', maxWidth:900, margin:'0 auto' }}>
      <div style={{ marginBottom:'2rem', animation:'fadeInUp 0.4s ease' }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:900, letterSpacing:'0.1em' }}>
          <span className="text-gold">MY</span> PROFILE
        </h1>
      </div>

      {/* Profile header */}
      <div className="glass-card" style={{ padding:'2rem', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'1.5rem', flexWrap:'wrap', animation:'fadeInUp 0.4s ease', border:'1px solid rgba(245,197,24,0.15)' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:`hsl(${(user?.username?.charCodeAt(0)*37||0)%360},60%,40%)`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontSize:'1.8rem', fontWeight:900, color:'#fff', flexShrink:0, boxShadow:'0 0 20px rgba(245,197,24,0.3)', border:'2px solid rgba(245,197,24,0.3)' }}>
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.25rem' }}>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.3rem', fontWeight:900 }}>{user?.username}</h2>
            <span className={`badge ${user?.role==='admin'?'badge-gold':'badge-cyan'}`}>{user?.role}</span>
          </div>
          <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>{user?.email}</p>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', color:'var(--gold)', fontWeight:900 }}>
            🪙 {balance !== null ? formatCoins(balance) : '—'}
          </div>
          <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Current Balance</div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.5rem' }}>
        <StatCard label="Games Played" value={txnStats.gamesPlayed}              color="var(--cyan)"   icon="🎮" />
        <StatCard label="Total Wins"   value={txnStats.wins}                     color="var(--gold)"  icon="🏆" />
        <StatCard label="Win Rate"     value={`${winRate}%`}                     color="var(--green)" icon="📈" />
        <StatCard label="Total Won"    value={`🪙${formatCoins(txnStats.totalWon)}`} color="var(--purple)" icon="💰" />
      </div>

      {/* Game history */}
      <div className="glass-card" style={{ padding:'1.5rem', animation:'fadeInUp 0.6s ease' }}>
        <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'1.25rem' }}>
          Recent Games
        </h3>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {[1,2,3].map(i=><div key={i} className="skeleton" style={{height:52}}/>)}
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>
            <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>🎲</div>
            No games played yet. Head to the lobby!
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Wheel #</th>
                <th>Status</th>
                <th>Entry Fee</th>
                <th>Winner Pool</th>
                <th>Winner</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0,10).map(w => (
                <tr key={w.id}>
                  <td style={{ fontFamily:'var(--font-display)', fontSize:'0.8rem', color:'var(--gold)' }}>#{w.id}</td>
                  <td>
                    <span className={`badge ${w.status==='finished'?'badge-green':w.status==='aborted'?'badge-red':'badge-cyan'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td style={{ fontFamily:'var(--font-display)', fontSize:'0.8rem' }}>🪙 {formatCoins(w.entry_fee)}</td>
                  <td style={{ fontFamily:'var(--font-display)', fontSize:'0.8rem', color:'var(--gold)' }}>🏆 {formatCoins(w.winner_pool)}</td>
                  <td style={{ fontSize:'0.85rem', color: w.winner_username ? 'var(--green)' : 'var(--text-muted)' }}>
                    {w.winner_username || '—'}
                  </td>
                  <td style={{ fontSize:'0.8rem' }}>{formatDate(w.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
