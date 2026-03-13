export default function Loader({ size = 40, text = '' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', padding:'3rem' }}>
      <div className="spinner" style={{ width:size, height:size }} />
      {text && <p style={{ color:'var(--text-muted)', fontFamily:'var(--font-display)', fontSize:'0.7rem', letterSpacing:'0.1em', textTransform:'uppercase' }}>{text}</p>}
    </div>
  );
}
