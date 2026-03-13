import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { wheelApi } from '../../api/wheel.api';
import { formatCoins, formatDateTime } from '../../utils/helpers';
import { Eye } from 'lucide-react';

export default function AdminWheels() {
  const [wheels,  setWheels]  = useState([]);
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const LIMIT = 15;

  const load = async (p=1) => {
    setLoading(true);
    try {
      const r = await wheelApi.getHistory(p);
      setWheels(r.data.data.wheels);
      setTotal(r.data.data.pagination.total);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(page); }, [page]);

  const totalPages = Math.ceil(total / LIMIT);

  const statusBadge = (s) => {
    const map = { finished:'badge-green', aborted:'badge-red', active:'badge-gold', waiting:'badge-cyan' };
    return map[s] || 'badge-cyan';
  };

  return (
    <div className="page" style={{ padding:'2rem', maxWidth:1100, margin:'0 auto' }}>
      <div style={{ marginBottom:'2rem', animation:'fadeInUp 0.4s ease' }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:900, letterSpacing:'0.1em' }}>
          <span className="text-gold">WHEEL</span> HISTORY
        </h1>
        <p style={{ color:'var(--text-muted)', marginTop:'0.25rem' }}>{total} total wheels</p>
      </div>

      <div className="glass-card" style={{ padding:'1.5rem', animation:'fadeInUp 0.5s ease', overflowX:'auto' }}>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {[1,2,3,4,5].map(i=><div key={i} className="skeleton" style={{height:52}}/>)}
          </div>
        ) : wheels.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
            <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>🎡</div>No wheels yet
          </div>
        ) : (
          <>
            <table className="data-table" style={{ minWidth:800 }}>
              <thead>
                <tr>
                  <th>#</th><th>Status</th><th>Entry Fee</th><th>Winner Pool</th><th>Admin Pool</th><th>Winner</th><th>Created By</th><th>Date</th><th></th>
                </tr>
              </thead>
              <tbody>
                {wheels.map(w => (
                  <tr key={w.id}>
                    <td style={{ fontFamily:'var(--font-display)', fontSize:'0.8rem', color:'var(--gold)' }}>#{w.id}</td>
                    <td><span className={`badge ${statusBadge(w.status)}`}>{w.status}</span></td>
                    <td style={{ fontFamily:'var(--font-display)', fontSize:'0.8rem' }}>🪙 {formatCoins(w.entry_fee)}</td>
                    <td style={{ fontFamily:'var(--font-display)', fontSize:'0.8rem', color:'var(--gold)' }}>🏆 {formatCoins(w.winner_pool)}</td>
                    <td style={{ fontFamily:'var(--font-display)', fontSize:'0.8rem', color:'var(--cyan)' }}>👑 {formatCoins(w.admin_pool)}</td>
                    <td style={{ color:'var(--green)', fontSize:'0.85rem', fontWeight:600 }}>{w.winner_username || <span style={{color:'var(--text-muted)'}}>—</span>}</td>
                    <td style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>{w.created_by_username}</td>
                    <td style={{ fontSize:'0.8rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDateTime(w.created_at)}</td>
                    <td>
                      <Link to={`/game/${w.id}`} className="btn btn-ghost btn-sm" style={{ padding:'0.3rem 0.5rem' }}><Eye size={12}/></Link>
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
