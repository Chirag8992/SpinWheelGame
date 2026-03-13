import { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin.api';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';

function SliderField({ label, value, onChange, color, description }) {
  return (
    <div style={{ marginBottom:'1.5rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
        <label style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase' }}>{label}</label>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'1.2rem', fontWeight:900, color, textShadow:`0 0 15px ${color}` }}>{value}%</div>
      </div>
      <input type="range" min="0" max="100" value={value} onChange={e=>onChange(parseFloat(e.target.value))}
        style={{ width:'100%', accentColor: color, cursor:'pointer', height:6 }} />
      <div style={{ height:6, background:`${color}22`, borderRadius:3, marginTop:'0.4rem', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${value}%`, background:color, borderRadius:3, boxShadow:`0 0 8px ${color}`, transition:'width 0.2s' }} />
      </div>
      <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'0.4rem' }}>{description}</p>
    </div>
  );
}

export default function AdminConfig() {
  const [config,   setConfig]   = useState({ winnerPercent:60, adminPercent:30, appPercent:10 });
  const [settings, setSettings] = useState({ auto_start_seconds:180, elimination_interval_seconds:7, min_participants:3 });
  const [savingCfg, setSavingCfg] = useState(false);
  const [savingSet, setSavingSet] = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([adminApi.getConfig(), adminApi.getSettings()])
      .then(([cfgRes, setRes]) => {
        if (cfgRes.data.data) {
          const d = cfgRes.data.data;
          setConfig({ winnerPercent: parseFloat(d.winner_percent), adminPercent: parseFloat(d.admin_percent), appPercent: parseFloat(d.app_percent) });
        }
        if (setRes.data.data) setSettings(setRes.data.data);
      })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, []);

  const total = config.winnerPercent + config.adminPercent + config.appPercent;
  const isValid = Math.abs(total - 100) < 0.01;

  const handleSaveConfig = async () => {
    if (!isValid) { toast.error('Percentages must sum to 100'); return; }
    setSavingCfg(true);
    try {
      await adminApi.updateConfig({ winnerPercent: config.winnerPercent, adminPercent: config.adminPercent, appPercent: config.appPercent });
      toast.success('Coin distribution updated!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSavingCfg(false); }
  };

  const handleSaveSettings = async () => {
    setSavingSet(true);
    try {
      await adminApi.updateSettings(settings);
      toast.success('Settings updated!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSavingSet(false); }
  };

  return (
    <div className="page" style={{ padding:'2rem', maxWidth:860, margin:'0 auto' }}>
      <div style={{ marginBottom:'2rem', animation:'fadeInUp 0.4s ease' }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:900, letterSpacing:'0.1em' }}>
          <span className="text-gold">GAME</span> CONFIG
        </h1>
        <p style={{ color:'var(--text-muted)', marginTop:'0.25rem' }}>Configure coin distribution and game settings</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
        {/* Coin distribution */}
        <div className="glass-card" style={{ padding:'2rem', animation:'fadeInUp 0.4s ease', border:'1px solid rgba(245,197,24,0.15)' }}>
          <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.75rem', letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'0.5rem' }}>
            Coin Distribution
          </h3>
          <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:'1.75rem' }}>
            How entry fees are split between winner, admin, and app.
          </p>

          {loading ? <div className="skeleton" style={{height:200}}/> : (
            <>
              <SliderField label="Winner Pool" value={config.winnerPercent} onChange={v=>setConfig(c=>({...c,winnerPercent:v}))} color="var(--gold)"   description="Goes to the last surviving player" />
              <SliderField label="Admin Pool"  value={config.adminPercent}  onChange={v=>setConfig(c=>({...c,adminPercent:v}))}  color="var(--cyan)"   description="Goes to the wheel creator (admin)" />
              <SliderField label="App Pool"    value={config.appPercent}    onChange={v=>setConfig(c=>({...c,appPercent:v}))}    color="var(--purple)" description="Platform revenue" />

              {/* Sum indicator */}
              <div style={{ padding:'0.75rem 1rem', borderRadius:'var(--radius-md)', background: isValid?'rgba(0,255,136,0.08)':'rgba(255,45,85,0.08)', border:`1px solid ${isValid?'rgba(0,255,136,0.25)':'rgba(255,45,85,0.25)'}`, marginBottom:'1.25rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>Total</span>
                <span style={{ fontFamily:'var(--font-display)', fontWeight:900, color: isValid?'var(--green)':'var(--red)', fontSize:'1rem' }}>
                  {total.toFixed(1)}% {isValid ? '✓' : '⚠️ must be 100%'}
                </span>
              </div>

              <button className="btn btn-gold" style={{ width:'100%', justifyContent:'center' }} onClick={handleSaveConfig} disabled={savingCfg||!isValid}>
                {savingCfg ? <div className="spinner" style={{width:16,height:16,borderWidth:2}}/> : <><Save size={14}/> Save Config</>}
              </button>
            </>
          )}
        </div>

        {/* System settings */}
        <div className="glass-card" style={{ padding:'2rem', animation:'fadeInUp 0.5s ease', border:'1px solid rgba(0,212,255,0.12)' }}>
          <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.75rem', letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'0.5rem' }}>
            Game Settings
          </h3>
          <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:'1.75rem' }}>
            Timing and participation rules.
          </p>

          {loading ? <div className="skeleton" style={{height:200}}/> : (
            <>
              {[
                { key:'auto_start_seconds',           label:'Auto-start timer (seconds)', min:30,  max:600, desc:'Wheel auto-starts after this many seconds if min players joined' },
                { key:'elimination_interval_seconds', label:'Elimination interval (s)',   min:3,   max:60,  desc:'Seconds between each elimination' },
                { key:'min_participants',             label:'Min participants',           min:2,   max:20,  desc:'Minimum players needed to start the wheel' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:'1.5rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                    <label style={{ fontFamily:'var(--font-display)', fontSize:'0.65rem', letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase' }}>{f.label}</label>
                    <span style={{ fontFamily:'var(--font-display)', fontSize:'1rem', fontWeight:700, color:'var(--cyan)' }}>{settings[f.key]}</span>
                  </div>
                  <input type="range" min={f.min} max={f.max} value={settings[f.key]} onChange={e=>setSettings(s=>({...s,[f.key]:parseInt(e.target.value)}))}
                    style={{ width:'100%', accentColor:'var(--cyan)', cursor:'pointer' }} />
                  <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'0.3rem' }}>{f.desc}</p>
                </div>
              ))}

              <button className="btn btn-cyan" style={{ width:'100%', justifyContent:'center', color:'#000' }} onClick={handleSaveSettings} disabled={savingSet}>
                {savingSet ? <div className="spinner" style={{width:16,height:16,borderWidth:2}}/> : <><Save size={14}/> Save Settings</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
