import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { wheelApi } from '../../api/wheel.api';
import { formatCoins, formatDateTime } from '../../utils/helpers';
import { Users, Layers, TrendingUp, Zap, Play, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function StatCard({ label, value, sub, color, icon: Icon, delay }) {
  return (
    <div className="glass-card" style={{ padding:'1.5rem', border:`1px solid ${color}22`, animation:`fadeInUp 0.4s ease ${delay}s both`, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`radial-gradient(circle, ${color}15, transparent 70%)`, pointerEvents:'none' }} />
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'0.75rem' }}>
        <div style={{ width:40, height:40, borderRadius:'var(--radius-md)', background:`${color}18`, border:`1px solid ${color}33`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={18} color={color} />
        </div>
      </div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', fontWeight:900, color, lineHeight:1, marginBottom:'0.25rem' }}>{value}</div>
      <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.15rem' }}>{label}</div>
      {sub && <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [entryFee, setEntryFee] = useState('100');
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await adminApi.getDashboard(); setStats(r.data.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const fee = parseFloat(entryFee);
    if (!fee || fee <= 0) { toast.error('Enter valid entry fee'); return; }
    setCreating(true);
    try {
      await wheelApi.create({ entryFee: fee });
      toast.success('Wheel created!');
      setShowCreate(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setCreating(false); }
  };

  const handleAbort = async (wheelId) => {
    if (!confirm('Abort wheel and refund all players?')) return;
    try { await wheelApi.abort({ wheelId }); toast.success('Wheel aborted'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleStart = async (wheelId) => {
    try { await wheelApi.start({ wheelId }); toast.success('Wheel started!'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const u = stats?.users;
  const w = stats?.wheels;
  const c = stats?.coins;

  return (
    <div className="page" style={{ padding:'2rem', maxWidth:1200, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem', animation:'fadeInUp 0.4s ease' }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:900, letterSpacing:'0.1em' }}>
            <span className="text-gold">ADMIN</span> DASHBOARD
          </h1>
          <p style={{ color:'var(--text-muted)', marginTop:'0.25rem' }}>System overview and controls</p>
        </div>
        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
          {!showCreate
            ? <button className="btn btn-gold" onClick={() => setShowCreate(true)}><Zap size={14}/> Create Wheel</button>
            : (
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                <input className="input" type="number" value={entryFee} onChange={e=>setEntryFee(e.target.value)} placeholder="Entry fee" style={{ width:120, padding:'0.5rem 0.75rem' }} />
                <button className="btn btn-gold btn-sm" onClick={handleCreate} disabled={creating}>
                  {creating ? <div className="spinner" style={{width:14,height:14,borderWidth:2}}/> : 'Create'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={()=>setShowCreate(false)}>✕</button>
              </div>
            )
          }
          <Link to="/admin/users"  className="btn btn-ghost"><Users size={14}/> Users</Link>
          <Link to="/admin/config" className="btn btn-ghost"><TrendingUp size={14}/> Config</Link>
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.5rem' }}>
          {[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:120}}/>)}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.5rem' }}>
          <StatCard label="Total Users"   value={u?.total_users||0}        sub={`${u?.active_users||0} active`}        color="var(--cyan)"   icon={Users}       delay={0} />
          <StatCard label="Total Wheels"  value={w?.total_wheels||0}       sub={`${w?.completed_wheels||0} completed`} color="var(--gold)"  icon={Layers}      delay={0.05} />
          <StatCard label="Total Wagered" value={`🪙${formatCoins(c?.total_entry_fees_collected||0)}`} sub="all time"  color="var(--green)" icon={TrendingUp}  delay={0.1} />
          <StatCard label="App Revenue"   value={`🪙${formatCoins(c?.total_app_earnings||0)}`}         sub="app pool"  color="var(--purple)" icon={TrendingUp} delay={0.15} />
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
        {/* Active wheel monitor */}
        <div className="glass-card" style={{ padding:'1.5rem', animation:'fadeInUp 0.5s ease' }}>
          <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'1.25rem' }}>
            Active Wheel
          </h3>
          {!stats?.activeWheel ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>
              <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>🎡</div>
              No active wheel
            </div>
          ) : (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.25rem' }}>
                <h4 style={{ fontFamily:'var(--font-display)', fontSize:'0.95rem' }}>Wheel #{stats.activeWheel.id}</h4>
                <span className={`badge ${stats.activeWheel.status==='waiting'?'badge-cyan':'badge-gold'}`}>{stats.activeWheel.status}</span>
              </div>
              {[
                { label:'Entry Fee',    value:`🪙 ${formatCoins(stats.activeWheel.entry_fee)}` },
                { label:'Winner Pool',  value:`🏆 ${formatCoins(stats.activeWheel.winner_pool)}` },
                { label:'Players',      value:`👥 ${stats.activeWheel.participant_count}` },
              ].map(s=>(
                <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'0.6rem 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>{s.label}</span>
                  <span style={{ fontFamily:'var(--font-display)', fontSize:'0.85rem', color:'var(--text-primary)' }}>{s.value}</span>
                </div>
              ))}
              {stats.activeWheel.status === 'waiting' && (
                <div style={{ display:'flex', gap:'0.5rem', marginTop:'1rem' }}>
                  <button className="btn btn-cyan btn-sm" style={{ flex:1, justifyContent:'center' }} onClick={() => handleStart(stats.activeWheel.id)} disabled={stats.activeWheel.participant_count < 3}>
                    <Play size={12}/> Start
                  </button>
                  <button className="btn btn-red btn-sm" onClick={() => handleAbort(stats.activeWheel.id)}>
                    <XCircle size={12}/> Abort
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent wheels */}
        <div className="glass-card" style={{ padding:'1.5rem', animation:'fadeInUp 0.55s ease' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
            <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase' }}>Recent Wheels</h3>
            <Link to="/admin/wheels" style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', color:'var(--cyan)', textDecoration:'none', letterSpacing:'0.08em' }}>VIEW ALL →</Link>
          </div>
          {loading ? <div className="skeleton" style={{height:200}}/> : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {(stats?.recentWheels||[]).map(w=>(
                <div key={w.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.65rem 0.75rem', background:'rgba(255,255,255,0.02)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontFamily:'var(--font-display)', fontSize:'0.8rem', color:'var(--gold)' }}>#{w.id}</span>
                    <span style={{ marginLeft:'0.5rem' }} className={`badge ${w.status==='finished'?'badge-green':w.status==='aborted'?'badge-red':'badge-cyan'}`}>{w.status}</span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontSize:'0.75rem', color:'var(--text-secondary)' }}>🪙 {formatCoins(w.entry_fee)}</div>
                    {w.winner && <div style={{ fontSize:'0.7rem', color:'var(--green)' }}>🏆 {w.winner}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
