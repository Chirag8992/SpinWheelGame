export default function StatsCard({ label, value, sub, color, icon: Icon, delay = 0 }) {
  return (
    <div className="glass-card" style={{ padding:'1.5rem', border:`1px solid ${color}22`, animation:`fadeInUp 0.4s ease ${delay}s both`, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`radial-gradient(circle, ${color}15, transparent 70%)`, pointerEvents:'none' }} />
      <div style={{ marginBottom:'0.75rem' }}>
        {Icon && (
          <div style={{ width:40, height:40, borderRadius:'var(--radius-md)', background:`${color}18`, border:`1px solid ${color}33`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'0.75rem' }}>
            <Icon size={18} color={color} />
          </div>
        )}
      </div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', fontWeight:900, color, lineHeight:1, marginBottom:'0.25rem' }}>{value}</div>
      <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.15rem' }}>{label}</div>
      {sub && <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}
