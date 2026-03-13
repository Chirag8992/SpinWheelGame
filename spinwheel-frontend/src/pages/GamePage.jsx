import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWheel } from '../context/WheelContext';
import { getSocket } from '../socket/socket';
import { wheelApi } from '../api/wheel.api';
import { formatCoins } from '../utils/helpers';
import confetti from 'canvas-confetti';

// ─────────────────────────────────────────────────────────────
// SPIN WHEEL CANVAS
// ─────────────────────────────────────────────────────────────
function SpinWheelCanvas({ players, spinning }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef({ rot: 0, speed: 0.004, decelerating: false });
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, R = cx - 22;

    const COLORS = ['#f5c518','#00d4ff','#ff2d55','#00ff88','#bf5af2','#ff9f0a','#30d158','#64d2ff'];
    const alive  = players.filter(p => p.status === 'active');
    if (alive.length === 0) return;

    const slice = (2 * Math.PI) / alive.length;

    // Reset speed on each spin trigger
    if (spinning) {
      stateRef.current.speed        = 0.2;
      stateRef.current.decelerating = false;
      setTimeout(() => { stateRef.current.decelerating = true; }, 2200);
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Glow ring
      ctx.save();
      ctx.shadowBlur = 24; ctx.shadowColor = 'rgba(245,197,24,0.5)';
      ctx.beginPath(); ctx.arc(cx, cy, R + 10, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(245,197,24,0.35)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();

      // Slices
      alive.forEach((p, i) => {
        const a0 = stateRef.current.rot + i * slice;
        const a1 = a0 + slice;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath();
        ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();

        // Name label
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(a0 + slice / 2);
        ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.font = `bold ${Math.min(13, 110 / alive.length)}px Rajdhani`;
        ctx.shadowBlur = 0;
        ctx.fillText(p.username.length > 9 ? p.username.slice(0,8)+'…' : p.username, R - 10, 5);
        ctx.restore();
      });

      // Centre hub
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 2 * Math.PI);
      ctx.fillStyle = '#04040a'; ctx.fill();
      ctx.strokeStyle = 'rgba(245,197,24,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#f5c518'; ctx.font = '20px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🎡', cx, cy);

      // Pointer
      ctx.beginPath();
      ctx.moveTo(cx, cy - R - 16);
      ctx.lineTo(cx - 10, cy - R + 6);
      ctx.lineTo(cx + 10, cy - R + 6);
      ctx.closePath();
      ctx.fillStyle = '#f5c518';
      ctx.shadowBlur = 14; ctx.shadowColor = '#f5c518';
      ctx.fill();
    };

    const tick = () => {
      const s = stateRef.current;
      if (spinning) {
        if (s.decelerating && s.speed > 0.004) s.speed *= 0.982;
        stateRef.current.rot += s.speed;
      } else {
        stateRef.current.rot += 0.004;
      }
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [players, spinning]);

  return (
    <canvas ref={canvasRef} width={340} height={340} style={{
      borderRadius: '50%',
      filter: spinning
        ? 'drop-shadow(0 0 32px rgba(245,197,24,0.7))'
        : 'drop-shadow(0 0 14px rgba(245,197,24,0.3))',
      transition: 'filter 0.5s',
    }} />
  );
}

// ─────────────────────────────────────────────────────────────
// ELIMINATION FLASH BANNER  (centre-screen popup)
// ─────────────────────────────────────────────────────────────
function ElimBanner({ name }) {
  if (!name) return null;
  return (
    <div style={{
      position:      'fixed',
      top: '50%', left: '50%',
      transform:     'translate(-50%, -50%)',
      zIndex:        300,
      pointerEvents: 'none',
      animation:     'fadeInUp 0.25s ease',
      textAlign:     'center',
    }}>
      <div style={{
        background:     'rgba(20,4,8,0.96)',
        border:         '2px solid var(--red)',
        borderRadius:   'var(--radius-lg)',
        padding:        '1.5rem 3rem',
        boxShadow:      '0 0 60px rgba(255,45,85,0.55)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ fontSize: '2.8rem', lineHeight: 1, marginBottom: '0.4rem' }}>💀</div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:900, color:'#fff', letterSpacing:'0.06em' }}>
          {name}
        </div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'0.65rem', color:'rgba(255,100,120,0.9)', letterSpacing:'0.18em', marginTop:'0.35rem', textTransform:'uppercase' }}>
          Eliminated!
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// WINNER MODAL  (auto-closes and redirects)
// ─────────────────────────────────────────────────────────────
function WinnerModal({ winner, isMe, onClose }) {
  const TOTAL = 8;
  const [secs, setSecs] = useState(TOTAL);

  useEffect(() => {
    // Confetti burst
    const fire = (o) => confetti({ particleCount:90, spread:70, origin:{y:0.6}, colors:['#f5c518','#00d4ff','#fff'], ...o });
    fire({ angle:60, origin:{x:0.1} });
    fire({ angle:120, origin:{x:0.9} });
    setTimeout(() => fire({ angle:90, origin:{x:0.5}, particleCount:150 }), 350);
    setTimeout(() => fire({ angle:90, origin:{x:0.5}, particleCount:80  }), 900);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setSecs(s => {
      if (s <= 1) { clearInterval(t); onClose(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [onClose]);

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:250,
      background:'rgba(0,0,0,0.88)', backdropFilter:'blur(12px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      animation:'fadeIn 0.35s ease',
    }}>
      <div className="glass-card" style={{
        maxWidth:460, width:'90%', padding:'3rem 2rem', textAlign:'center',
        border:'1px solid rgba(245,197,24,0.45)',
        boxShadow:'0 0 80px rgba(245,197,24,0.22)',
        animation:'fadeInUp 0.45s ease',
      }}>
        <div style={{ fontSize:'4.5rem', marginBottom:'0.75rem', animation:'float 2s ease-in-out infinite' }}>🏆</div>

        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.9rem', fontWeight:900, color:'var(--gold)', textShadow:'0 0 40px var(--gold)', letterSpacing:'0.1em', marginBottom:'0.4rem' }}>
          {isMe ? '🎉 YOU WIN!' : '❌ YOU LOSE'}
        </h2>

        <p style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', color:'#fff', marginBottom:'0.2rem', letterSpacing:'0.04em' }}>
          Winner: {winner.winnerUsername}
        </p>

        <p style={{ color:'var(--text-muted)', fontSize:'0.95rem', marginBottom:'2rem' }}>
          {isMe ? 'You won' : 'They won'}{' '}
          <span style={{ color:'var(--gold)', fontFamily:'var(--font-display)', fontWeight:900, fontSize:'1.1rem' }}>
            🪙 {formatCoins(winner.amountWon)}
          </span>{' '}coins
        </p>

        {/* Auto-close bar */}
        <div style={{ marginBottom:'1.25rem' }}>
          <div style={{ height:5, background:'rgba(255,255,255,0.08)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${(secs/TOTAL)*100}%`, background:'var(--gold)', borderRadius:3, transition:'width 1s linear', boxShadow:'0 0 10px var(--gold)' }} />
          </div>
          <p style={{ fontFamily:'var(--font-display)', fontSize:'0.65rem', color:'var(--text-muted)', letterSpacing:'0.1em', marginTop:'0.4rem' }}>
            Returning to lobby in {secs}s…
          </p>
        </div>

        <button className="btn btn-gold btn-lg" onClick={onClose} style={{ width:'100%', justifyContent:'center' }}>
          Back to Lobby Now
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PLAYER CARD  (sidebar)
// ─────────────────────────────────────────────────────────────
function PlayerCard({ p, isMe, flash }) {
  const cfg = {
    active:     { border:'1px solid rgba(0,255,136,0.2)',  bg:'rgba(0,255,136,0.05)',  badge:'badge-green', label:'✅ Alive'   },
    eliminated: { border:'1px solid rgba(255,45,85,0.2)',  bg:'rgba(255,45,85,0.05)',  badge:'badge-red',   label:'💀 Out'     },
    winner:     { border:'1px solid rgba(245,197,24,0.45)',bg:'rgba(245,197,24,0.09)', badge:'badge-gold',  label:'👑 Winner'  },
  };
  const c = cfg[p.status] || cfg.active;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.6rem',
      borderRadius:'var(--radius-md)',
      border:      flash ? '1px solid rgba(255,45,85,0.7)' : c.border,
      background:  flash ? 'rgba(255,45,85,0.18)'          : c.bg,
      opacity:     p.status === 'eliminated' ? 0.6 : 1,
      transition:  'all 0.5s ease',
      position:    'relative',
    }}>
      {isMe && (
        <div style={{ position:'absolute', top:-5, right:-5, width:14, height:14, borderRadius:'50%', background:'var(--cyan)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'8px', color:'#000', fontWeight:900 }}>★</div>
      )}
      <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.75rem', color:'#fff', background:`hsl(${(p.username.charCodeAt(0)*37)%360},60%,38%)`, filter: p.status==='eliminated'?'grayscale(1)':'none' }}>
        {p.status==='winner' ? '🏆' : p.username[0].toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'0.82rem', fontWeight:600, color: p.status==='eliminated'?'var(--text-muted)':'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {p.username}
        </div>
        <span className={`badge ${c.badge}`} style={{ fontSize:'0.55rem' }}>{c.label}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN GAME PAGE
// ─────────────────────────────────────────────────────────────
export default function GamePage() {
  const { wheelId } = useParams();
  const navigate    = useNavigate();
  const { user, token } = useAuth();
  const { activeWheel, participants, eliminations, winner: ctxWinner, gameStatus } = useWheel();

  const [wheelData,    setWheelData]     = useState(null);

  // UI state
  const [spinning,     setSpinning]      = useState(false);
  const [showWinner,   setShowWinner]    = useState(false);
  const [elimName,     setElimName]      = useState(null); // for banner
  const [flashName,    setFlashName]     = useState(null); // for card flash
  const [countdown,    setCountdown]     = useState(7);

  const cdRef        = useRef(null);
  const prevElimCount = useRef(0);
  const elimTimeouts  = useRef([]);
  const INTERVAL     = 7;

  const winner   = ctxWinner;
  const gameOver = gameStatus === 'finished' || !!winner;
  const players  = participants || [];
  const feedItems = eliminations || [];

  // ── Load wheel data ─────────────────────────────────────
  useEffect(() => {
    wheelApi.getById(wheelId)
      .then(r => setWheelData(r.data.data.wheel))
      .catch(() => navigate('/lobby'));
  }, [wheelId]);

  // ── Ensure we are in the wheel room (re-join on reconnect) ─
  useEffect(() => {
    const socket = getSocket(token);
    const id = parseInt(wheelId, 10);
    if (!id) return;
    const join = () => socket.emit('join_room', { wheelId: id });
    join();
    socket.on('connect', join);
    return () => socket.off('connect', join);
  }, [wheelId, token]);

  // ── Countdown helpers ────────────────────────────────────
  const clearElimTimeouts = useCallback(() => {
    elimTimeouts.current.forEach(clearTimeout);
    elimTimeouts.current = [];
  }, []);

  const stopCountdown = useCallback(() => {
    if (cdRef.current) { clearInterval(cdRef.current); cdRef.current = null; }
  }, []);

  const startCountdown = useCallback(() => {
    stopCountdown();
    setCountdown(INTERVAL);
    cdRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          if (cdRef.current) { clearInterval(cdRef.current); cdRef.current = null; }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [stopCountdown]);

  // Start/stop countdown based on game status
  useEffect(() => {
    if (gameStatus === 'active' && !gameOver) {
      startCountdown();
    } else {
      stopCountdown();
      setCountdown(0);
    }
    return stopCountdown;
  }, [gameStatus, gameOver, startCountdown, stopCountdown]);

  // React to new eliminations for UI effects
  useEffect(() => {
    if (eliminations.length <= prevElimCount.current) return;
    const latest = eliminations[0];
    prevElimCount.current = eliminations.length;
    if (!latest) return;

    clearElimTimeouts();
    setElimName(latest.eliminatedUsername);
    setFlashName(latest.eliminatedUsername);
    elimTimeouts.current.push(setTimeout(() => setElimName(null), 2500));
    elimTimeouts.current.push(setTimeout(() => setFlashName(null), 2500));

    setSpinning(true);
    elimTimeouts.current.push(setTimeout(() => setSpinning(false), 3500));

    const remaining = typeof latest.remainingPlayers === 'number'
      ? latest.remainingPlayers
      : players.filter(p => p.status === 'active').length;

    if (gameStatus === 'active' && !gameOver && remaining > 1) {
      startCountdown();
    } else {
      stopCountdown();
      setCountdown(0);
    }

    return clearElimTimeouts;
  }, [eliminations.length, gameStatus, gameOver, startCountdown, clearElimTimeouts, players, stopCountdown]);

  // Show winner modal when game ends
  useEffect(() => {
    if (!winner || showWinner) return;
    stopCountdown();
    setCountdown(0);
    const t = setTimeout(() => setShowWinner(true), 1200);
    return () => clearTimeout(t);
  }, [winner, showWinner, stopCountdown]);

  // ── Winner close → back to lobby ────────────────────────
  const handleClose = useCallback(() => {
    setShowWinner(false);
    navigate('/lobby', { replace: true });
  }, [navigate]);

  // ── Aborted → auto-redirect ──────────────────────────────
  useEffect(() => {
    if (gameStatus === 'aborted') {
      setTimeout(() => navigate('/lobby', { replace: true }), 3000);
    }
  }, [gameStatus]);

  // ── Derived ──────────────────────────────────────────────
  const alive     = players.filter(p => p.status === 'active');
  const dead      = players.filter(p => p.status === 'eliminated');
  const isMe      = (name) => name === user?.username;
  const wheelInfo = wheelData || activeWheel;

  return (
    <div className="page" style={{ padding:'2rem', maxWidth:1200, margin:'0 auto' }}>

      {/* Elimination banner */}
      {elimName && <ElimBanner name={elimName} />}

      {/* Winner modal */}
      {showWinner && winner && (
        <WinnerModal winner={winner} isMe={isMe(winner.winnerUsername)} onClose={handleClose} />
      )}

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem', animation:'fadeInUp 0.4s ease' }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:900, letterSpacing:'0.1em' }}>
            <span className="text-gold">LIVE</span> GAME
            {!gameOver && <span style={{ marginLeft:'0.75rem' }} className="badge badge-red">🔴 LIVE</span>}
            {gameOver  && <span style={{ marginLeft:'0.75rem' }} className="badge badge-gold">✅ FINISHED</span>}
          </h1>
          <p style={{ color:'var(--text-muted)', marginTop:'0.25rem' }}>
            Wheel #{wheelId} — {alive.length} player{alive.length !== 1 ? 's' : ''} remaining
          </p>
        </div>

        {wheelInfo && (
          <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
            {[
              { label:'Prize Pool', value:`🏆 ${formatCoins(wheelInfo.winner_pool)}`, color:'var(--gold)'  },
              { label:'Alive',      value:`✅ ${alive.length}`,                        color:'var(--green)' },
              { label:'Eliminated', value:`💀 ${dead.length}`,                         color:'var(--red)'   },
            ].map(s => (
              <div key={s.label} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'0.6rem 1rem', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'0.9rem', color:s.color, fontWeight:700 }}>{s.value}</div>
                <div style={{ fontSize:'0.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'1.5rem' }}>

        {/* ── Left col ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>

          {/* Wheel card */}
          <div className="glass-card" style={{ padding:'2.5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'2rem', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at center, rgba(245,197,24,0.04), transparent 70%)', pointerEvents:'none' }} />

            <SpinWheelCanvas players={players} spinning={spinning} />

            {/* Countdown — only while game is running */}
            {!gameOver && gameStatus === 'active' && (
              <div style={{ textAlign:'center', width:'100%', maxWidth:300 }}>
                <p style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', letterSpacing:'0.14em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'0.5rem' }}>
                  Next elimination in
                </p>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:'2.8rem', fontWeight:900, minWidth:64, color: countdown <= 2 ? 'var(--red)' : 'var(--cyan)', textShadow:`0 0 24px ${countdown<=2?'var(--red)':'var(--cyan)'}`, transition:'color 0.3s' }}>
                    {countdown}s
                  </div>
                  <div style={{ flex:1, height:7, background:'rgba(255,255,255,0.07)', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(countdown/INTERVAL)*100}%`, background: countdown<=2 ? 'var(--red)' : 'var(--cyan)', borderRadius:4, transition:'width 1s linear', boxShadow:'0 0 10px currentColor' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Game over message inside wheel card */}
            {gameOver && (
              <div style={{ textAlign:'center' }}>
                <p style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', color:'var(--gold)', textShadow:'0 0 24px var(--gold)', letterSpacing:'0.1em' }}>
                  🏆 GAME OVER
                </p>
                {winner && (
                  <p style={{ color:'var(--text-secondary)', marginTop:'0.4rem' }}>
                    Winner: <strong style={{ color:'var(--gold)' }}>{winner.winnerUsername}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Elimination feed */}
          <div className="glass-card" style={{ padding:'1.5rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase' }}>
                Elimination Feed
              </h3>
              {feedItems.length > 0 && <span className="badge badge-red">{feedItems.length} eliminated</span>}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', maxHeight:320, overflowY:'auto' }}>
              {feedItems.length === 0 ? (
                <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)', fontSize:'0.9rem' }}>
                  <div style={{ fontSize:'1.5rem', marginBottom:'0.5rem' }}>⏳</div>
                  Waiting for first elimination...
                </div>
              ) : feedItems.map((e, i) => (
                <div key={i} style={{
                  display:'flex', alignItems:'center', gap:'0.75rem',
                  padding:'0.65rem 0.75rem', borderRadius:'var(--radius-md)',
                  background: i===0 ? 'rgba(255,45,85,0.12)' : 'rgba(255,255,255,0.02)',
                  border: i===0 ? '1px solid rgba(255,45,85,0.35)' : '1px solid transparent',
                  animation: i===0 ? 'fadeInUp 0.3s ease' : 'none',
                }}>
                  <span style={{ fontSize:'1.1rem' }}>💀</span>
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:700, fontSize:'0.9rem', color: i===0?'var(--red)':'var(--text-secondary)' }}>
                      {e.eliminatedUsername}
                    </span>
                    <span style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}> was eliminated</span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontSize:'0.65rem', color:'var(--text-muted)' }}>#{e.eliminationOrder}</div>
                    <div style={{ fontSize:'0.65rem', color:'var(--cyan)' }}>{e.remainingPlayers} left</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right col — Players ── */}
        <div className="glass-card" style={{ padding:'1.5rem', alignSelf:'start', position:'sticky', top:'80px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
            <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase' }}>Players</h3>
            <div style={{ display:'flex', gap:'0.4rem' }}>
              <span className="badge badge-green">{alive.length} alive</span>
              <span className="badge badge-red">{dead.length} out</span>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', maxHeight:520, overflowY:'auto' }}>
            {/* alive first */}
            {alive.map((p, i) => (
              <PlayerCard key={i} p={p} isMe={isMe(p.username)} flash={false} />
            ))}
            {dead.length > 0 && alive.length > 0 && <div className="neon-divider" />}
            {/* eliminated below, newest-out on top */}
            {dead.map((p, i) => (
              <PlayerCard key={`d${i}`} p={p} isMe={isMe(p.username)} flash={p.username === flashName} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
