// src/utils/helpers.js

export function formatCoins(amount) {
  const n = parseFloat(amount) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function txnLabel(type) {
  const labels = {
    winner_pool_credit: 'Tournament Win',
    entry_fee_debit:    'Entry Fee',
    admin_pool_credit:  'Admin Commission',
    refund_credit:      'Refund',
    manual_credit:      'System Credit',
    manual_debit:       'System Debit'
  };
  return labels[type] || type.replace(/_/g, ' ');
}

export function txnColor(type) {
  if (type.includes('credit') || type.includes('refund')) return 'var(--green)';
  if (type.includes('debit')) return 'var(--red)';
  return 'var(--cyan)';
}

export function getCountdown(targetDate) {
  const total = Date.parse(targetDate) - Date.now();
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  return { total, minutes, seconds };
}