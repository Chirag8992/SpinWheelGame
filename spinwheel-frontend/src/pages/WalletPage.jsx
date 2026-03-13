import { useState, useEffect } from 'react';
import { coinsApi } from '../api/coins.api';
import { formatCoins, formatDateTime, txnLabel, txnColor } from '../utils/helpers';
import { ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';

function TxnIcon({ type }) {
  if (type.includes('credit')) return <ArrowUpCircle size={16} color="var(--green)" />;
  if (type.includes('debit'))  return <ArrowDownCircle size={16} color="var(--red)" />;
  return <RefreshCw size={16} color="var(--cyan)" />;
}

export default function WalletPage() {
  const [balance,  setBalance]  = useState(null);
  const [txns,     setTxns]     = useState([]);
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const LIMIT = 15;

  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const [balRes, txnRes] = await Promise.all([
        coinsApi.getBalance(),
        coinsApi.getTransactions(p, LIMIT)
      ]);
      setBalance(balRes.data.data.coinBalance);
      setTxns(txnRes.data.data.transactions);
      setTotal(txnRes.data.data.pagination.total);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(page); }, [page]);

  const filtered = filter === 'all' ? txns : txns.filter(t => t.type.includes(filter));
  const totalPages = Math.ceil(total / LIMIT);

  const filters = [
    { key:'all',    label:'All' },
    { key:'credit', label:'Credits' },
    { key:'debit',  label:'Debits' },
    { key:'refund', label:'Refunds' },
  ];

  return (
    <div className="page" style={{ padding:'2rem', maxWidth:900, margin:'0 auto' }}>
      <div style={{ marginBottom:'2rem', animation:'fadeInUp 0.4s ease' }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:900, letterSpacing:'0.1em' }}>
          <span className="text-gold">MY</span> WALLET
        </h1>
        <p style={{ color:'var(--text-muted)', marginTop:'0.25rem' }}>Your coin balance and transaction history</p>
      </div>

      {/* Balance Card */}
      <div className="glass-card" style={{ padding:'2.5rem', marginBottom:'1.5rem', textAlign:'center', position:'relative', overflow:'hidden', animation:'fadeInUp 0.4s ease', border:'1px solid rgba(245,197,24,0.2)', boxShadow:'0 0 40px rgba(245,197,24,0.06)' }}>
        <div style={{ position:'absolute', top:-60, left:'50%', transform:'translateX(-50%)', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,197,24,0.08), transparent 70%)', pointerEvents:'none' }} />
        <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>🪙</div>
        <p style={{ fontFamily:'var(--font-display)', fontSize:'0.65rem', letterSpacing:'0.15em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'0.5rem' }}>Current Balance</p>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'3.5rem', fontWeight:900, color:'var(--gold)', textShadow:'0 0 40px rgba(245,197,24,0.5)', lineHeight:1 }}>
          {balance === null ? '—' : formatCoins(balance)}
        </div>
        <p style={{ color:'var(--text-muted)', marginTop:'0.5rem', fontSize:'0.85rem' }}>coins available</p>
      </div>

      {/* Transactions */}
      <div className="glass-card" style={{ padding:'1.5rem', animation:'fadeInUp 0.5s ease' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
          <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase' }}>
            Transaction History
          </h3>
          <div style={{ display:'flex', gap:'0.4rem' }}>
            {filters.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', padding:'0.3rem 0.7rem', borderRadius:'var(--radius-sm)', border:`1px solid ${filter===f.key?'var(--gold)':'var(--border)'}`, background: filter===f.key?'rgba(245,197,24,0.1)':'transparent', color: filter===f.key?'var(--gold)':'var(--text-muted)', cursor:'pointer', letterSpacing:'0.08em', textTransform:'uppercase', transition:'var(--transition)' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {Array.from({length:5}).map((_,i) => <div key={i} className="skeleton" style={{ height:56 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
            <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>📭</div>
            No transactions yet
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                  <th className="hide-mobile">Description</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <TxnIcon type={t.type} />
                        <span style={{ color: txnColor(t.type), fontWeight:600, fontSize:'0.85rem' }}>
                          {txnLabel(t.type)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily:'var(--font-display)', fontSize:'0.85rem', color: txnColor(t.type), fontWeight:700 }}>
                        {t.type.includes('credit') ? '+' : '-'}{formatCoins(t.amount)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily:'var(--font-display)', fontSize:'0.8rem', color:'var(--text-secondary)' }}>
                        🪙 {formatCoins(t.balance_after)}
                      </span>
                    </td>
                    <td className="hide-mobile" style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.8rem' }}>
                      {t.description || '—'}
                    </td>
                    <td style={{ fontSize:'0.8rem', whiteSpace:'nowrap' }}>
                      {formatDateTime(t.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display:'flex', justifyContent:'center', gap:'0.5rem', marginTop:'1.5rem' }}>
                <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={() => setPage(p=>p-1)}>← Prev</button>
                <span style={{ display:'flex', alignItems:'center', fontFamily:'var(--font-display)', fontSize:'0.7rem', color:'var(--text-muted)', padding:'0 0.75rem' }}>
                  {page} / {totalPages}
                </span>
                <button className="btn btn-ghost btn-sm" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
