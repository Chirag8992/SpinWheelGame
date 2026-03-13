import { formatCoins, formatDateTime, txnLabel, txnColor } from '../../utils/helpers';
import { ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';

function TxnIcon({ type }) {
  if (type.includes('credit')) return <ArrowUpCircle size={15} color="var(--green)" />;
  if (type.includes('debit'))  return <ArrowDownCircle size={15} color="var(--red)" />;
  return <RefreshCw size={15} color="var(--cyan)" />;
}

export default function TransactionTable({ transactions = [] }) {
  if (transactions.length === 0) return (
    <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>
      <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>📭</div>No transactions yet
    </div>
  );
  return (
    <table className="data-table">
      <thead>
        <tr><th>Type</th><th>Amount</th><th>Balance After</th><th>Date</th></tr>
      </thead>
      <tbody>
        {transactions.map(t => (
          <tr key={t.id}>
            <td>
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <TxnIcon type={t.type} />
                <span style={{ color:txnColor(t.type), fontWeight:600, fontSize:'0.85rem' }}>{txnLabel(t.type)}</span>
              </div>
            </td>
            <td><span style={{ fontFamily:'var(--font-display)', fontSize:'0.85rem', color:txnColor(t.type), fontWeight:700 }}>{t.type.includes('credit')?'+':'-'}{formatCoins(t.amount)}</span></td>
            <td><span style={{ fontFamily:'var(--font-display)', fontSize:'0.8rem', color:'var(--text-secondary)' }}>🪙 {formatCoins(t.balance_after)}</span></td>
            <td style={{ fontSize:'0.8rem', whiteSpace:'nowrap' }}>{formatDateTime(t.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
