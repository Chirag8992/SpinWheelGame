import { formatCoins, formatDate } from '../../utils/helpers';
import { ToggleLeft, ToggleRight, PlusCircle, MinusCircle } from 'lucide-react';

export default function UserTable({ users = [], onToggle, onCredit, onDebit }) {
  if (users.length === 0) return (
    <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>No users found</div>
  );
  return (
    <table className="data-table">
      <thead>
        <tr><th>#</th><th>User</th><th>Role</th><th>Balance</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
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
            <td><span className={`badge ${u.is_active?'badge-green':'badge-red'}`}>{u.is_active?'● Active':'● Disabled'}</span></td>
            <td style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{formatDate(u.created_at)}</td>
            <td>
              <div style={{ display:'flex', gap:'0.4rem' }}>
                <button className="btn btn-ghost btn-sm" title="Credit" style={{ padding:'0.3rem 0.5rem', color:'var(--green)', borderColor:'rgba(0,255,136,0.2)' }} onClick={() => onCredit?.(u)}><PlusCircle size={13}/></button>
                <button className="btn btn-ghost btn-sm" title="Debit"  style={{ padding:'0.3rem 0.5rem', color:'var(--red)',   borderColor:'rgba(255,45,85,0.2)'  }} onClick={() => onDebit?.(u)}><MinusCircle size={13}/></button>
                <button className="btn btn-ghost btn-sm" title={u.is_active?'Disable':'Enable'} style={{ padding:'0.3rem 0.5rem' }} onClick={() => onToggle?.(u.id)}>
                  {u.is_active ? <ToggleRight size={13} color="var(--green)"/> : <ToggleLeft size={13} color="var(--red)"/>}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
