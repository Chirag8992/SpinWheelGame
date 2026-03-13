import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../api/admin.api';
import { coinsApi } from '../../api/coins.api';
import { formatCoins, formatDate } from '../../utils/helpers';
import { Search, ToggleLeft, ToggleRight, PlusCircle, MinusCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function CoinModal({ user, type, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [desc,   setDesc]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return; }
    setLoading(true);
    try {
      if (type === 'credit') await coinsApi.credit({ userId: user.id, amount: amt, description: desc });
      else                   await coinsApi.debit ({ userId: user.id, amount: amt, description: desc });
      toast.success(`${type === 'credit' ? 'Credited' : 'Debited'} ${formatCoins(amt)} coins ${type==='credit'?'to':'from'} ${user.username}`);
      onDone();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div className="glass-card" style={{ padding:'2rem', width:360, border:`1px solid ${type==='credit'?'rgba(0,255,136,0.3)':'rgba(255,45,85,0.3)'}` }} onClick={e=>e.stopPropagation()}>
        <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.9rem', letterSpacing:'0.1em', marginBottom:'1.25rem', color: type==='credit'?'var(--green)':'var(--red)' }}>
          {type==='credit'?'💰 Credit':'💸 Debit'} Coins — {user.username}
        </h3>
        <label style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', color:'var(--text-muted)', letterSpacing:'0.1em', textTransform:'uppercase', display:'block', marginBottom:'0.4rem' }}>Amount</label>
        <input className="input" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" style={{ marginBottom:'0.75rem' }} autoFocus />
        <label style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', color:'var(--text-muted)', letterSpacing:'0.1em', textTransform:'uppercase', display:'block', marginBottom:'0.4rem' }}>Note (optional)</label>
        <input className="input" type="text" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Reason..." style={{ marginBottom:'1.25rem' }} />
        <div style={{ display:'flex', gap:'0.75rem' }}>
          <button className={`btn ${type==='credit'?'btn-cyan':'btn-red'}`} style={{ flex:1, justifyContent:'center' }} onClick={handleSubmit} disabled={loading}>
            {loading ? <div className="spinner" style={{width:16,height:16,borderWidth:2}}/> : type==='credit'?'Credit':'Debit'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [users,   setUsers]   = useState([]);
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // { user, type }
  const LIMIT = 20;

  const load = useCallback(async (p=1, s='') => {
    setLoading(true);
    try {
      const r = await adminApi.getUsers(p, s);
      setUsers(r.data.data.users);
      setTotal(r.data.data.pagination.total);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, search); }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(1, search);
  };

  const handleToggle = async (userId) => {
    try {
      const r = await adminApi.toggleUser(userId);
      toast.success(r.data.message);
      load(page, search);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page" style={{ padding:'2rem', maxWidth:1100, margin:'0 auto' }}>
      {modal && <CoinModal user={modal.user} type={modal.type} onClose={() => setModal(null)} onDone={() => { setModal(null); load(page, search); }} />}

      <div style={{ marginBottom:'2rem', animation:'fadeInUp 0.4s ease', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:900, letterSpacing:'0.1em' }}>
            <span className="text-gold">USER</span> MANAGEMENT
          </h1>
          <p style={{ color:'var(--text-muted)', marginTop:'0.25rem' }}>{total} total users</p>
        </div>
        <form onSubmit={handleSearch} style={{ display:'flex', gap:'0.5rem' }}>
          <div style={{ position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
            <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users..." style={{ paddingLeft:'2.25rem', width:220 }} />
          </div>
          <button type="submit" className="btn btn-gold btn-sm">Search</button>
        </form>
      </div>

      <div className="glass-card" style={{ padding:'1.5rem', animation:'fadeInUp 0.5s ease', overflowX:'auto' }}>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {[1,2,3,4,5].map(i=><div key={i} className="skeleton" style={{height:56}}/>)}
          </div>
        ) : (
          <>
            <table className="data-table" style={{ minWidth:700 }}>
              <thead>
                <tr>
                  <th>#</th><th>User</th><th>Role</th><th>Balance</th><th>Status</th><th>Joined</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontFamily:'var(--font-display)', fontSize:'0.75rem', color:'var(--text-muted)' }}>{u.id}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                        <div style={{ width:30, height:30, borderRadius:'50%', background:`hsl(${(u.username.charCodeAt(0)*37)%360},60%,40%)`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontSize:'0.7rem', fontWeight:700, color:'#fff', flexShrink:0 }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:'0.9rem' }}>{u.username}</div>
                          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${u.role==='admin'?'badge-gold':'badge-cyan'}`}>{u.role}</span></td>
                    <td style={{ fontFamily:'var(--font-display)', fontSize:'0.85rem', color:'var(--gold)' }}>🪙 {formatCoins(u.coin_balance)}</td>
                    <td>
                      <span className={`badge ${u.is_active?'badge-green':'badge-red'}`}>
                        {u.is_active ? '● Active' : '● Disabled'}
                      </span>
                    </td>
                    <td style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{formatDate(u.created_at)}</td>
                    <td>
                      <div style={{ display:'flex', gap:'0.4rem' }}>
                        <button className="btn btn-ghost btn-sm" title="Credit coins" style={{ padding:'0.3rem 0.5rem', color:'var(--green)', borderColor:'rgba(0,255,136,0.2)' }} onClick={() => setModal({ user:u, type:'credit' })}>
                          <PlusCircle size={13}/>
                        </button>
                        <button className="btn btn-ghost btn-sm" title="Debit coins"  style={{ padding:'0.3rem 0.5rem', color:'var(--red)', borderColor:'rgba(255,45,85,0.2)' }} onClick={() => setModal({ user:u, type:'debit' })}>
                          <MinusCircle size={13}/>
                        </button>
                        <button className="btn btn-ghost btn-sm" title={u.is_active?'Disable':'Enable'} style={{ padding:'0.3rem 0.5rem' }} onClick={() => handleToggle(u.id)}>
                          {u.is_active ? <ToggleRight size={13} color="var(--green)"/> : <ToggleLeft size={13} color="var(--red)"/>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{ display:'flex', justifyContent:'center', gap:'0.5rem', marginTop:'1.5rem' }}>
                <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
                <span style={{ display:'flex', alignItems:'center', fontFamily:'var(--font-display)', fontSize:'0.7rem', color:'var(--text-muted)', padding:'0 0.75rem' }}>{page} / {totalPages}</span>
                <button className="btn btn-ghost btn-sm" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
