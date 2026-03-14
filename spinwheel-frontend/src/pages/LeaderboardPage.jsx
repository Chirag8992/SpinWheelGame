import { useState, useEffect } from 'react';
import { publicApi } from '../api/public.api';
import { formatCoins } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const MEDAL = ['🥇','🥈','🥉'];
const MEDAL_COLORS = ['var(--gold)','#c0c0c0','#cd7f32'];

export default function LeaderboardPage() {
  const { user }   = useAuth();
  const [data,     setData]    = useState(null);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    publicApi.getLeaderboard(30)
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const topWinners = data?.topWinners || [];

  return (
    <div className="page" style={{ padding:'2rem', maxWidth:800, margin:'0 auto' }}>
      <div style={{ marginBottom:'2rem', animation:'fadeInUp 0.4s ease', textAlign:'center' }}>
        <div style={{ fontSize:'3rem', marginBottom:'0.5rem', animation:'float 3s ease-in-out infinite' }}>🏆</div>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', fontWeight:900, letterSpacing:'0.12em' }}>
          <span className="text-gold">LEADER</span>BOARD
        </h1>
        <p style={{ color:'var(--text-muted)', marginTop:'0.5rem' }}>Top winners of all time</p>
      </div>

      {/* Top 3 podium */}
      {!loading && topWinners.length >= 3 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem', marginBottom:'2rem', alignItems:'end' }}>
          {[topWinners[1], topWinners[0], topWinners[2]].map((w, i) => {
            const actualRank = i === 0 ? 1 : i === 1 ? 0 : 2;
            const isCenter   = i === 1;
            const color      = MEDAL_COLORS[actualRank];
            return (
              <div key={w.username} className="glass-card" style={{ padding:'1.5rem', textAlign:'center', border:`1px solid ${color}44`, animation:`fadeInUp ${0.3+i*0.1}s ease`, marginTop: isCenter ? 0 : '2rem', background: isCenter ? `rgba(245,197,24,0.06)` : 'var(--bg-card)', boxShadow: isCenter ? `0 0 40px rgba(245,197,24,0.15)` : 'none' }}>
                <div style={{ fontSize: isCenter ? '3rem' : '2rem', marginBottom:'0.5rem' }}>{MEDAL[actualRank]}</div>
                <div style={{ width: isCenter?56:44, height: isCenter?56:44, borderRadius:'50%', background:`hsl(${(w.username.charCodeAt(0)*37)%360},60%,40%)`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:900, color:'#fff', margin:'0 auto 0.75rem', fontSize: isCenter?'1.2rem':'1rem', border:`2px solid ${color}` }}>
                  {w.username[0].toUpperCase()}
                </div>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize: isCenter?'1rem':'0.85rem', color, marginBottom:'0.3rem', letterSpacing:'0.05em' }}>{w.username}</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize: isCenter?'1.2rem':'0.95rem', color:'var(--gold)', fontWeight:900 }}>
                  🪙 {formatCoins(w.total_won)}
                </div>
                <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:'0.25rem' }}>{w.total_wins} win{w.total_wins!==1?'s':''}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full table */}
      <div className="glass-card" style={{ padding:'1.5rem', animation:'fadeInUp 0.6s ease' }}>
        <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'1.25rem' }}>
          All Time Rankings
        </h3>

        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {[1,2,3,4,5].map(i=><div key={i} className="skeleton" style={{height:52}}/>)}
          </div>
        ) : topWinners.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
            <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>🎯</div>
            No winners yet. Start playing!
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {topWinners.map((w, i) => {
              const isMe    = w.username === user?.username;
              const isTop3  = i < 3;
              return (
                <div key={w.username} style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.85rem 1rem', borderRadius:'var(--radius-md)', background: isMe ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)', border: isMe ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent', animation:`fadeInUp ${0.1*i}s ease`, transition:'var(--transition)' }}>
                  <div style={{ fontFamily:'var(--font-display)', fontSize: isTop3?'1.2rem':'0.85rem', width:32, textAlign:'center', flexShrink:0 }}>
                    {isTop3 ? MEDAL[i] : `#${i+1}`}
                  </div>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:`hsl(${(w.username.charCodeAt(0)*37)%360},60%,40%)`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontSize:'0.8rem', fontWeight:700, color:'#fff', flexShrink:0 }}>
                    {w.username[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, color: isMe ? 'var(--cyan)' : 'var(--text-primary)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      {w.username}
                      {isMe && <span className="badge badge-cyan" style={{fontSize:'0.5rem'}}>YOU</span>}
                    </div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{w.total_wins} win{w.total_wins!==1?'s':''}</div>
                  </div>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:'0.95rem', color:'var(--gold)', fontWeight:700, textAlign:'right' }}>
                    🪙 {formatCoins(w.total_won)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
