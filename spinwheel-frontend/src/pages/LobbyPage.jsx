import { Play, Plus, XCircle, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { coinsApi } from '../api/coins.api';
import { wheelApi } from '../api/wheel.api';
import { useAuth } from '../context/AuthContext';
import { useWheel } from '../context/WheelContext';
import { formatCoins, getCountdown } from '../utils/helpers';


function CountdownTimer({ autoStartAt }) {
  const [cd, setCd] = useState(getCountdown(autoStartAt));
  useEffect(() => {
    const t = setInterval(() => setCd(getCountdown(autoStartAt)), 1000);
    return () => clearInterval(t);
  }, [autoStartAt]);
  const pct = Math.max(0, (cd.total / (3 * 60 * 1000)) * 100);
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Auto-starts in</p>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 900, color: cd.total < 30000 ? 'var(--red)' : 'var(--gold)', textShadow: cd.total < 30000 ? '0 0 30px var(--red)' : '0 0 30px var(--gold)', lineHeight: 1 }}>
        {String(cd.minutes).padStart(2,'0')}:{String(cd.seconds).padStart(2,'0')}
      </div>
      <div style={{ marginTop: '1rem', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: cd.total < 30000 ? 'var(--red)' : 'linear-gradient(90deg, var(--gold), var(--cyan))', borderRadius: 2, transition: 'width 1s linear', boxShadow: '0 0 10px var(--gold)' }} />
      </div>
    </div>
  );
}

function PlayerCard({ participant, index }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', background:'rgba(255,255,255,0.03)', borderRadius:'var(--radius-md)', border:'1px solid rgba(255,255,255,0.06)', animation:`fadeInUp 0.4s ease ${index*0.05}s both` }}>
      <div style={{ width:36, height:36, borderRadius:'50%', background:`hsl(${(participant.username.charCodeAt(0)*37)%360},60%,40%)`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontSize:'0.75rem', fontWeight:700, color:'#fff', flexShrink:0 }}>
        {participant.username[0].toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:'0.9rem', color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{participant.username}</div>
        <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Paid {formatCoins(participant.entry_fee_paid)} coins</div>
      </div>
      <span className="badge badge-green">Ready</span>
    </div>
  );
}

function NoWheelState({ isAdmin, onCreateWheel }) {
  const [entryFee, setEntryFee] = useState('100');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const handleCreate = async () => {
    const fee = parseFloat(entryFee);
    if (!fee || fee <= 0) { toast.error('Enter a valid entry fee'); return; }
    setCreating(true);
    try { await onCreateWheel(fee); setShowForm(false); } finally { setCreating(false); }
  };
  return (
    <div style={{ textAlign:'center', padding:'4rem 2rem' }}>
      <div style={{ fontSize:'5rem', marginBottom:'1.5rem', animation:'float 3s ease-in-out infinite' }}>🎡</div>
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', color:'var(--text-secondary)', letterSpacing:'0.1em', marginBottom:'0.75rem' }}>NO ACTIVE WHEEL</h2>
      <p style={{ color:'var(--text-muted)', marginBottom:'2rem', fontSize:'1rem' }}>Waiting for an admin to create a new spin wheel...</p>
      {isAdmin && (
        <div style={{ maxWidth:320, margin:'0 auto' }}>
          {!showForm ? (
            <button className="btn btn-gold btn-lg" onClick={() => setShowForm(true)}><Plus size={16} /> Create Wheel</button>
          ) : (
            <div className="glass-card" style={{ padding:'1.5rem', textAlign:'left' }}>
              <label style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:'0.5rem' }}>Entry Fee (coins)</label>
              <input className="input" type="number" min="1" value={entryFee} onChange={e => setEntryFee(e.target.value)} style={{ marginBottom:'1rem' }} />
              <div style={{ display:'flex', gap:'0.75rem' }}>
                <button className="btn btn-gold" style={{ flex:1, justifyContent:'center' }} disabled={creating} onClick={handleCreate}>
                  {creating ? <div className="spinner" style={{width:16,height:16,borderWidth:2}} /> : <><Zap size={14} /> Create</>}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LobbyPage() {

//   const { user, loading } = useAuth();

// if (loading) return <div>Loading Lobby...</div>;
// if (!user) return <Navigate to="/login" />;

  const { user, isAdmin } = useAuth();
  const { activeWheel, participants, gameStatus, fetchActive } = useWheel();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [aborting, setAborting] = useState(false);
  const hasJoined = participants.some(p => p.username === user?.username);

  useEffect(() => {
    coinsApi.getBalance().then(r => setBalance(r.data.data.coinBalance)).catch(() => {});
  }, [gameStatus]);

  useEffect(() => {
    if (gameStatus === 'active' && activeWheel?.id) navigate(`/game/${activeWheel.id}`);
  }, [gameStatus, activeWheel?.id]);

  const handleCreateWheel = async (entryFee) => {
    try { await wheelApi.create({ entryFee }); toast.success('Wheel created!'); fetchActive(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to create wheel'); }
  };

  const handleJoin = async () => {
    if (!activeWheel) return;
    setJoining(true);
    try {
      await wheelApi.join({ wheelId: activeWheel.id });
      toast.success(`Joined! ${formatCoins(activeWheel.entry_fee)} coins deducted.`);
      coinsApi.getBalance().then(r => setBalance(r.data.data.coinBalance));
      fetchActive();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to join'); }
    finally { setJoining(false); }
  };

  const handleStart = async () => {
    setStarting(true);
    try { await wheelApi.start({ wheelId: activeWheel.id }); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to start'); }
    finally { setStarting(false); }
  };

  const handleAbort = async () => {
    if (!confirm('Abort wheel and refund all players?')) return;
    setAborting(true);
    try { await wheelApi.abort({ wheelId: activeWheel.id }); toast.success('Wheel aborted. Players refunded.'); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to abort'); }
    finally { setAborting(false); }
  };

  return (
    <div className="page" style={{ padding:'2rem', maxWidth:1100, margin:'0 auto' }}>
      <div style={{ marginBottom:'2rem', animation:'fadeInUp 0.5s ease' }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:900, letterSpacing:'0.1em' }}>
          <span className="text-gold">GAME</span> LOBBY
        </h1>
        <p style={{ color:'var(--text-muted)', marginTop:'0.25rem' }}>Join the wheel and spin your way to the top</p>
      </div>

      {!activeWheel ? (
        <div className="glass-card" style={{ padding:'1rem' }}>
          <NoWheelState isAdmin={isAdmin} onCreateWheel={handleCreateWheel} />
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'1.5rem' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            <div className="glass-card" style={{ padding:'2rem', animation:'fadeInUp 0.4s ease', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-50, right:-50, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,197,24,0.08), transparent 70%)', pointerEvents:'none' }} />
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.25rem' }}>
                    <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', letterSpacing:'0.08em' }}>WHEEL #{activeWheel.id}</h2>
                    <span className={`badge ${gameStatus==='waiting'?'badge-cyan':'badge-gold'}`}>{gameStatus==='waiting'?'⏳ Waiting':'🔴 Active'}</span>
                  </div>
                  <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>Created by {activeWheel.created_by_username}</p>
                </div>
                {balance !== null && (
                  <div style={{ background:'rgba(245,197,24,0.1)', border:'1px solid rgba(245,197,24,0.2)', borderRadius:'var(--radius-xl)', padding:'0.5rem 1rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <span>🪙</span>
                    <span style={{ fontFamily:'var(--font-display)', fontSize:'0.85rem', color:'var(--gold)', fontWeight:700 }}>{formatCoins(balance)}</span>
                  </div>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', marginBottom:'2rem' }}>
                {[
                  { label:'Entry Fee',   value:`🪙 ${formatCoins(activeWheel.entry_fee)}`,   color:'var(--gold)' },
                  { label:'Winner Pool', value:`🏆 ${formatCoins(activeWheel.winner_pool)}`, color:'var(--green)' },
                  { label:'Players',     value:`👥 ${participants.length}`,                  color:'var(--cyan)' },
                ].map(s => (
                  <div key={s.label} style={{ background:'rgba(255,255,255,0.03)', borderRadius:'var(--radius-md)', padding:'1rem', textAlign:'center', border:'1px solid var(--border)' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', fontWeight:700, color:s.color, marginBottom:'0.25rem' }}>{s.value}</div>
                    <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {gameStatus === 'waiting' && activeWheel.auto_start_at && (
                <div style={{ marginBottom:'2rem' }}><CountdownTimer autoStartAt={activeWheel.auto_start_at} /></div>
              )}

              {participants.length < 3 && (
                <div style={{ marginBottom:'1.5rem', padding:'0.75rem 1rem', background:'rgba(255,45,85,0.08)', border:'1px solid rgba(255,45,85,0.2)', borderRadius:'var(--radius-md)', color:'var(--red)', fontSize:'0.85rem' }}>
                  ⚠️ Need at least 3 players to start ({3 - participants.length} more needed)
                </div>
              )}

              <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                {!hasJoined && gameStatus === 'waiting' && (
                  <button className="btn btn-gold btn-lg" onClick={handleJoin} disabled={joining} style={{ flex:1, justifyContent:'center', minWidth:160 }}>
                    {joining ? <><div className="spinner" style={{width:16,height:16,borderWidth:2}} /> Joining...</> : <><Zap size={16} /> Join — {formatCoins(activeWheel.entry_fee)} coins</>}
                  </button>
                )}
                {hasJoined && (
                  <div style={{ flex:1, padding:'1rem', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'var(--radius-md)', color:'var(--green)', fontFamily:'var(--font-display)', fontSize:'0.75rem', letterSpacing:'0.08em', textAlign:'center' }}>
                    ✅ YOU ARE IN — GOOD LUCK!
                  </div>
                )}
                {isAdmin && gameStatus === 'waiting' && (
                  <>
                    <button className="btn btn-cyan" onClick={handleStart} disabled={starting || participants.length < 3} style={{ justifyContent:'center' }}>
                      {starting ? <div className="spinner" style={{width:16,height:16,borderWidth:2}} /> : <><Play size={14} /> Start Now</>}
                    </button>
                    <button className="btn btn-red" onClick={handleAbort} disabled={aborting}>
                      {aborting ? <div className="spinner" style={{width:16,height:16,borderWidth:2}} /> : <><XCircle size={14} /> Abort</>}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="glass-card" style={{ padding:'1.5rem', animation:'fadeInUp 0.5s ease' }}>
              <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'1.25rem' }}>Prize Pool Breakdown</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                {[
                  { label:'🏆 Winner Pool', value: activeWheel.winner_pool, color:'var(--gold)',   pct: activeWheel.winner_percent },
                  { label:'👑 Admin Pool',  value: activeWheel.admin_pool,  color:'var(--cyan)',   pct: activeWheel.admin_percent },
                  { label:'🏛️ App Pool',   value: activeWheel.app_pool,    color:'var(--purple)', pct: activeWheel.app_percent },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.3rem' }}>
                      <span style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>{item.label}</span>
                      <span style={{ fontFamily:'var(--font-display)', fontSize:'0.8rem', color:item.color, fontWeight:700 }}>{formatCoins(item.value)} ({item.pct}%)</span>
                    </div>
                    <div style={{ height:6, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${item.pct}%`, background:item.color, borderRadius:3, boxShadow:`0 0 8px ${item.color}` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding:'1.5rem', animation:'fadeInUp 0.5s ease', alignSelf:'start' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
              <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase' }}>Players</h3>
              <span className="badge badge-cyan">{participants.length}</span>
            </div>
            {participants.length === 0 ? (
              <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)', fontSize:'0.9rem' }}>
                <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>👥</div>
                No players yet.<br/>Be the first to join!
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', maxHeight:500, overflowY:'auto' }}>
                {participants.map((p,i) => <PlayerCard key={p.id||i} participant={p} index={i} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
