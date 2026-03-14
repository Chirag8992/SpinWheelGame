import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { wheelApi } from '../api/wheel.api';
import { formatCoins } from '../utils/helpers';
import confetti from 'canvas-confetti';
import { io } from 'socket.io-client';

// ─────────────────────────────────────────────────────────────
// SPIN WHEEL CANVAS
// ─────────────────────────────────────────────────────────────
function SpinWheelCanvas({ players, spinning, gameOver }) {
  const canvasRef = useRef(null);
  const rotRef    = useRef(0);
  const speedRef  = useRef(0.004);
  const decelRef  = useRef(false);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W/2, cy = H/2, R = cx - 22;
    const COLORS = ['#f5c518','#00d4ff','#ff2d55','#00ff88','#bf5af2','#ff9f0a','#30d158','#64d2ff'];
    const visible = players.filter(p => p.status === 'active' || p.status === 'winner');

    if (visible.length === 0) {
      cancelAnimationFrame(rafRef.current);
      ctx.clearRect(0,0,W,H);
      ctx.beginPath(); ctx.arc(cx,cy,R,0,2*Math.PI);
      ctx.fillStyle = 'rgba(245,197,24,0.05)'; ctx.fill();
      ctx.strokeStyle = 'rgba(245,197,24,0.3)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.font='48px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🏆',cx,cy);
      return;
    }

    const slice = (2*Math.PI)/visible.length;
    if (spinning) { speedRef.current=0.2; decelRef.current=false; setTimeout(()=>{decelRef.current=true;},2200); }

    const draw = () => {
      ctx.clearRect(0,0,W,H);
      ctx.save(); ctx.shadowBlur=24; ctx.shadowColor='rgba(245,197,24,0.5)';
      ctx.beginPath(); ctx.arc(cx,cy,R+10,0,2*Math.PI);
      ctx.strokeStyle='rgba(245,197,24,0.35)'; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
      visible.forEach((p,i) => {
        const a0=rotRef.current+i*slice, a1=a0+slice, isWin=p.status==='winner';
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,a0,a1); ctx.closePath();
        ctx.fillStyle=isWin?'#f5c518':COLORS[i%COLORS.length]; ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=2; ctx.stroke();
        ctx.save(); ctx.translate(cx,cy); ctx.rotate(a0+slice/2);
        ctx.textAlign='right'; ctx.fillStyle='#000';
        ctx.font=`bold ${Math.min(13,110/visible.length)}px Rajdhani`; ctx.shadowBlur=0;
        ctx.fillText((isWin?'👑':'')+(p.username.length>9?p.username.slice(0,8)+'…':p.username),R-10,5);
        ctx.restore();
      });
      ctx.beginPath(); ctx.arc(cx,cy,30,0,2*Math.PI);
      ctx.fillStyle='#04040a'; ctx.fill();
      ctx.strokeStyle='rgba(245,197,24,0.6)'; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle='#f5c518'; ctx.font='20px serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(gameOver?'🏆':'🎡',cx,cy);
      ctx.beginPath(); ctx.moveTo(cx,cy-R-16); ctx.lineTo(cx-10,cy-R+6); ctx.lineTo(cx+10,cy-R+6); ctx.closePath();
      ctx.fillStyle='#f5c518'; ctx.shadowBlur=14; ctx.shadowColor='#f5c518'; ctx.fill();
    };

    const tick = () => {
      if (spinning) { if(decelRef.current&&speedRef.current>0.004) speedRef.current*=0.982; rotRef.current+=speedRef.current; }
      else { rotRef.current+=gameOver?0.001:0.004; }
      draw(); rafRef.current=requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current=requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [players, spinning, gameOver]);

  return <canvas ref={canvasRef} width={340} height={340} style={{ borderRadius:'50%', filter:spinning?'drop-shadow(0 0 32px rgba(245,197,24,0.75))':gameOver?'drop-shadow(0 0 24px rgba(245,197,24,0.5))':'drop-shadow(0 0 14px rgba(245,197,24,0.3))' }} />;
}

function ElimBanner({ name }) {
  if (!name) return null;
  return (
    <div style={{ position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:300,pointerEvents:'none',animation:'fadeInUp 0.25s ease',textAlign:'center' }}>
      <div style={{ background:'rgba(20,4,8,0.96)',border:'2px solid var(--red)',borderRadius:'var(--radius-lg)',padding:'1.5rem 3rem',boxShadow:'0 0 60px rgba(255,45,85,0.55)',backdropFilter:'blur(12px)' }}>
        <div style={{ fontSize:'2.8rem',lineHeight:1,marginBottom:'0.4rem' }}>💀</div>
        <div style={{ fontFamily:'var(--font-display)',fontSize:'1.5rem',fontWeight:900,color:'#fff' }}>{name}</div>
        <div style={{ fontFamily:'var(--font-display)',fontSize:'0.65rem',color:'rgba(255,100,120,0.9)',letterSpacing:'0.18em',marginTop:'0.35rem',textTransform:'uppercase' }}>Eliminated!</div>
      </div>
    </div>
  );
}

function WinnerModal({ winnerUsername, amountWon, isMe, onClose }) {
  const TOTAL=8;
  const [secs,setSecs]=useState(TOTAL);
  useEffect(()=>{
    const fire=(o)=>confetti({particleCount:90,spread:70,origin:{y:0.6},colors:['#f5c518','#00d4ff','#fff'],...o});
    fire({angle:60,origin:{x:0.1}}); fire({angle:120,origin:{x:0.9}});
    setTimeout(()=>fire({angle:90,origin:{x:0.5},particleCount:150}),350);
  },[]);
  useEffect(()=>{
    const t=setInterval(()=>setSecs(s=>{if(s<=1){clearInterval(t);onClose();return 0;}return s-1;}),1000);
    return ()=>clearInterval(t);
  },[onClose]);
  return (
    <div style={{ position:'fixed',inset:0,zIndex:250,background:'rgba(0,0,0,0.88)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeIn 0.35s ease' }}>
      <div className="glass-card" style={{ maxWidth:460,width:'90%',padding:'3rem 2rem',textAlign:'center',border:`1px solid ${isMe?'rgba(245,197,24,0.5)':'rgba(255,45,85,0.4)'}`,animation:'fadeInUp 0.45s ease' }}>
        <div style={{ fontSize:'4.5rem',marginBottom:'0.75rem',animation:'float 2s ease-in-out infinite' }}>{isMe?'🏆':'💀'}</div>
        <h2 style={{ fontFamily:'var(--font-display)',fontSize:'1.9rem',fontWeight:900,color:isMe?'var(--gold)':'var(--red)',marginBottom:'0.5rem' }}>{isMe?'🎉 YOU WIN!':'💀 YOU LOSE'}</h2>
        <div style={{ background:'rgba(245,197,24,0.08)',border:'1px solid rgba(245,197,24,0.2)',borderRadius:'var(--radius-md)',padding:'0.75rem 1rem',marginBottom:'1rem' }}>
          <p style={{ fontFamily:'var(--font-display)',fontSize:'0.6rem',color:'var(--text-muted)',textTransform:'uppercase',marginBottom:'0.25rem' }}>Winner</p>
          <p style={{ fontFamily:'var(--font-display)',fontSize:'1.2rem',fontWeight:900,color:'var(--gold)' }}>👑 {winnerUsername}</p>
        </div>
        <p style={{ color:'var(--text-muted)',marginBottom:'2rem' }}>
          {isMe?'You won':'They won'} <span style={{ color:'var(--gold)',fontFamily:'var(--font-display)',fontWeight:900,fontSize:'1.1rem' }}>🪙 {formatCoins(amountWon)}</span> coins!
        </p>
        <div style={{ marginBottom:'1.25rem' }}>
          <div style={{ height:5,background:'rgba(255,255,255,0.08)',borderRadius:3,overflow:'hidden' }}>
            <div style={{ height:'100%',width:`${(secs/TOTAL)*100}%`,background:'var(--gold)',borderRadius:3,transition:'width 1s linear' }} />
          </div>
          <p style={{ fontFamily:'var(--font-display)',fontSize:'0.65rem',color:'var(--text-muted)',marginTop:'0.4rem' }}>Returning to lobby in {secs}s…</p>
        </div>
        <button className="btn btn-gold btn-lg" onClick={onClose} style={{ width:'100%',justifyContent:'center' }}>Back to Lobby Now</button>
      </div>
    </div>
  );
}

function PlayerCard({ p, isMe, flash }) {
  const cfg={
    active:    {border:'1px solid rgba(0,255,136,0.2)', bg:'rgba(0,255,136,0.05)', badge:'badge-green',label:'✅ Alive'},
    eliminated:{border:'1px solid rgba(255,45,85,0.2)', bg:'rgba(255,45,85,0.05)', badge:'badge-red',  label:'💀 Out'},
    winner:    {border:'1px solid rgba(245,197,24,0.5)',bg:'rgba(245,197,24,0.1)', badge:'badge-gold', label:'👑 Winner'},
  };
  const c=cfg[p.status]||cfg.active;
  return (
    <div style={{ display:'flex',alignItems:'center',gap:'0.6rem',padding:'0.6rem',borderRadius:'var(--radius-md)',border:flash?'1px solid rgba(255,45,85,0.7)':c.border,background:flash?'rgba(255,45,85,0.18)':c.bg,opacity:p.status==='eliminated'?0.6:1,transition:'all 0.5s ease',position:'relative' }}>
      {isMe&&<div style={{ position:'absolute',top:-5,right:-5,width:14,height:14,borderRadius:'50%',background:'var(--cyan)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',color:'#000',fontWeight:900 }}>★</div>}
      <div style={{ width:34,height:34,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontWeight:700,fontSize:'0.75rem',color:'#fff',background:`hsl(${(p.username.charCodeAt(0)*37)%360},60%,38%)`,filter:p.status==='eliminated'?'grayscale(1)':'none' }}>
        {p.status==='winner'?'🏆':p.username[0].toUpperCase()}
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:'0.82rem',fontWeight:600,color:p.status==='eliminated'?'var(--text-muted)':'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{p.username}</div>
        <span className={`badge ${c.badge}`} style={{ fontSize:'0.55rem' }}>{c.label}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN GAME PAGE
// KEY FIX: All mutable values stored in refs, not state.
// State setters called directly — no intermediate callbacks.
// ─────────────────────────────────────────────────────────────
export default function GamePage() {
  const { wheelId } = useParams();
  const navigate    = useNavigate();
  const { user, token } = useAuth();

  // React state — drives UI rendering
  const [players,   setPlayers]   = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [wheelInfo, setWheelInfo] = useState(null);
  const [gameOver,  setGameOver]  = useState(false);
  const [winner,    setWinner]    = useState(null);
  const [spinning,  setSpinning]  = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [elimName,  setElimName]  = useState(null);
  const [flashName, setFlashName] = useState(null);
  const [countdown, setCountdown] = useState(7);

  // Refs — mutable, never stale inside closures
  const cdRef       = useRef(null);
  const spinRef     = useRef(null);
  const gameOverRef = useRef(false);
  const navigateRef = useRef(navigate);
  const tokenRef    = useRef(token);
  navigateRef.current = navigate;
  tokenRef.current    = token;

  const INTERVAL = 7;

  // ── Load wheel data ──────────────────────────────────────
  useEffect(() => {
    wheelApi.getById(wheelId)
      .then(r => {
        const { wheel, participants } = r.data.data;
        setWheelInfo(wheel);
        setPlayers((participants||[]).map(p => ({
          username:       p.username,
          status:         p.status==='winner'?'winner':p.status==='eliminated'?'eliminated':'active',
          entry_fee_paid: p.entry_fee_paid,
        })));
        if (wheel.status === 'finished') {
          gameOverRef.current = true;
          setGameOver(true);
          if (wheel.winner_username) {
            setWinner({ winnerUsername: wheel.winner_username, amountWon: wheel.winner_pool });
            setTimeout(() => setShowModal(true), 300);
          }
        } else if (wheel.status === 'active') {
          // start countdown immediately
          if (cdRef.current) clearInterval(cdRef.current);
          setCountdown(INTERVAL);
          cdRef.current = setInterval(() => setCountdown(c => c<=1 ? INTERVAL : c-1), 1000);
        }
      })
      .catch(() => navigateRef.current('/lobby'));
  }, [wheelId]);

  // ── Dedicated socket — created once, never recreated ────
  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

    const sock = io(SOCKET_URL, {
      auth:       { token: tokenRef.current },
      transports: ['websocket','polling'],
      forceNew:   true,
    });

    sock.on('connect', () => {
      console.log('[GAME] socket connected:', sock.id);
      sock.emit('join_room', { wheelId: parseInt(wheelId, 10) });
    });

    sock.on('connect_error', e => console.warn('[GAME] connect error:', e.message));

    // ── player_eliminated ──────────────────────────────
    sock.on('player_eliminated', (data) => {
      console.log('[GAME] player_eliminated:', data);

      if (gameOverRef.current) return;

      const { eliminatedUsername, remainingPlayers } = data;

      // 1. Update player list
      setPlayers(prev => prev.map(p =>
        p.username === eliminatedUsername ? { ...p, status:'eliminated' } : p
      ));

      // 2. Add to feed
      setFeedItems(prev => [data, ...prev]);

      // 3. Show banner
      setElimName(eliminatedUsername);
      setFlashName(eliminatedUsername);
      setTimeout(() => setElimName(null),  2500);
      setTimeout(() => setFlashName(null), 2500);

      // 4. Spin wheel — clear old timer first
      if (spinRef.current) clearTimeout(spinRef.current);
      setSpinning(true);
      spinRef.current = setTimeout(() => setSpinning(false), 3000);

      // 5. Countdown
      if (cdRef.current) clearInterval(cdRef.current);

      if (remainingPlayers > 1) {
        // more eliminations coming — restart countdown
        setCountdown(INTERVAL);
        cdRef.current = setInterval(() => setCountdown(c => c<=1 ? INTERVAL : c-1), 1000);
      } else {
        // last elimination — winner coming, stop countdown
        setCountdown(0);
        cdRef.current = null;
      }
    });

    // ── game_over ──────────────────────────────────────
    sock.on('game_over', (data) => {
      console.log('[GAME] game_over:', data);

      // 1. Set ref immediately — blocks any late elim events
      gameOverRef.current = true;

      // 2. Stop countdown
      if (cdRef.current) { clearInterval(cdRef.current); cdRef.current = null; }
      setCountdown(0);

      // 3. Stop spin
      if (spinRef.current) { clearTimeout(spinRef.current); spinRef.current = null; }
      setSpinning(false);

      // 4. Mark winner in list
      setPlayers(prev => prev.map(p =>
        p.username === data.winnerUsername ? { ...p, status:'winner' } : p
      ));

      // 5. Set game over state
      setGameOver(true);
      setWinner({ winnerUsername: data.winnerUsername, amountWon: data.amountWon });

      // 6. Show modal after spin settles
      setTimeout(() => setShowModal(true), 1500);
    });

    sock.on('wheel_started', () => {
      console.log('[GAME] wheel_started');
      if (cdRef.current) clearInterval(cdRef.current);
      setCountdown(INTERVAL);
      cdRef.current = setInterval(() => setCountdown(c => c<=1 ? INTERVAL : c-1), 1000);
    });

    // Cleanup on unmount
    return () => {
      console.log('[GAME] cleaning up socket');
      sock.removeAllListeners();
      sock.disconnect();
      if (cdRef.current) clearInterval(cdRef.current);
      if (spinRef.current) clearTimeout(spinRef.current);
    };
  }, []); // ← EMPTY DEPS — socket created once, never re-created
  // wheelId and token accessed via refs inside handlers

  const handleClose = () => {
    setShowModal(false);
    navigate('/lobby', { replace: true });
  };

  const alive      = players.filter(p => p.status==='active');
  const dead       = players.filter(p => p.status==='eliminated');
  const winnerP    = players.find(p => p.status==='winner');
  const totalElims = Math.max(players.length-1, 0);
  const isMe = n => n === user?.username;

  return (
    <div className="page" style={{ padding:'2rem', maxWidth:1200, margin:'0 auto' }}>

      {elimName && <ElimBanner name={elimName} />}

      {showModal && winner && (
        <WinnerModal
          winnerUsername={winner.winnerUsername}
          amountWon={winner.amountWon}
          isMe={isMe(winner.winnerUsername)}
          onClose={handleClose}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'2rem',flexWrap:'wrap',gap:'1rem' }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)',fontSize:'1.5rem',fontWeight:900,letterSpacing:'0.1em' }}>
            <span className="text-gold">LIVE</span> GAME
            {!gameOver && <span style={{ marginLeft:'0.75rem' }} className="badge badge-red">🔴 LIVE</span>}
            {gameOver  && <span style={{ marginLeft:'0.75rem' }} className="badge badge-gold">✅ FINISHED</span>}
          </h1>
          <p style={{ color:'var(--text-muted)',marginTop:'0.25rem' }}>
            Wheel #{wheelId} — {gameOver
              ? `Winner: ${winner?.winnerUsername||winnerP?.username}`
              : `${alive.length} player${alive.length!==1?'s':''} remaining`}
          </p>
        </div>
        {wheelInfo && (
          <div style={{ display:'flex',gap:'0.75rem',flexWrap:'wrap' }}>
            {[
              {label:'Prize Pool',value:`🏆 ${formatCoins(wheelInfo.winner_pool)}`,color:'var(--gold)'},
              {label:'Alive',     value:`✅ ${alive.length}`,                       color:'var(--green)'},
              {label:'Eliminated',value:`💀 ${dead.length}/${totalElims}`,           color:'var(--red)'},
            ].map(s=>(
              <div key={s.label} style={{ background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'0.6rem 1rem',textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-display)',fontSize:'0.9rem',color:s.color,fontWeight:700 }}>{s.value}</div>
                <div style={{ fontSize:'0.6rem',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 320px',gap:'1.5rem' }}>
        <div style={{ display:'flex',flexDirection:'column',gap:'1.5rem' }}>

          {/* Wheel */}
          <div className="glass-card" style={{ padding:'2.5rem',display:'flex',flexDirection:'column',alignItems:'center',gap:'2rem',position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse at center, rgba(245,197,24,0.04), transparent 70%)',pointerEvents:'none' }} />
            <SpinWheelCanvas players={players} spinning={spinning} gameOver={gameOver} />

            {!gameOver && countdown > 0 && (
              <div style={{ textAlign:'center',width:'100%',maxWidth:300 }}>
                <p style={{ fontFamily:'var(--font-display)',fontSize:'0.6rem',letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase',marginBottom:'0.5rem' }}>Next elimination in</p>
                <div style={{ display:'flex',alignItems:'center',gap:'0.75rem' }}>
                  <div style={{ fontFamily:'var(--font-display)',fontSize:'2.8rem',fontWeight:900,minWidth:64,color:countdown<=2?'var(--red)':'var(--cyan)',textShadow:`0 0 24px ${countdown<=2?'var(--red)':'var(--cyan)'}` }}>
                    {countdown}s
                  </div>
                  <div style={{ flex:1,height:7,background:'rgba(255,255,255,0.07)',borderRadius:4,overflow:'hidden' }}>
                    <div style={{ height:'100%',width:`${(countdown/INTERVAL)*100}%`,background:countdown<=2?'var(--red)':'var(--cyan)',borderRadius:4,transition:'width 1s linear' }} />
                  </div>
                </div>
              </div>
            )}

            {gameOver && (
              <div style={{ textAlign:'center',padding:'1.25rem 2rem',background:'rgba(245,197,24,0.07)',border:'1px solid rgba(245,197,24,0.25)',borderRadius:'var(--radius-lg)',width:'100%',maxWidth:320 }}>
                <p style={{ fontFamily:'var(--font-display)',fontSize:'0.6rem',letterSpacing:'0.15em',color:'var(--text-muted)',textTransform:'uppercase',marginBottom:'0.5rem' }}>🏆 Game Over — Winner</p>
                <p style={{ fontFamily:'var(--font-display)',fontSize:'1.6rem',fontWeight:900,color:'var(--gold)',textShadow:'0 0 20px var(--gold)' }}>
                  {winner?.winnerUsername||winnerP?.username||'—'}
                </p>
                {winner?.amountWon && (
                  <p style={{ color:'var(--text-secondary)',marginTop:'0.3rem' }}>
                    Won <span style={{ color:'var(--gold)',fontWeight:700 }}>🪙 {formatCoins(winner.amountWon)}</span>
                  </p>
                )}
                <button className="btn btn-gold btn-sm" onClick={handleClose} style={{ marginTop:'1rem',width:'100%',justifyContent:'center' }}>Back to Lobby</button>
              </div>
            )}
          </div>

          {/* Feed */}
          <div className="glass-card" style={{ padding:'1.5rem' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem' }}>
              <h3 style={{ fontFamily:'var(--font-display)',fontSize:'0.7rem',letterSpacing:'0.12em',color:'var(--text-muted)',textTransform:'uppercase' }}>Elimination Feed</h3>
              <span className="badge badge-red">{feedItems.length}/{totalElims}</span>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:'0.5rem',maxHeight:320,overflowY:'auto' }}>
              {feedItems.length===0 ? (
                <div style={{ textAlign:'center',padding:'2rem',color:'var(--text-muted)',fontSize:'0.9rem' }}>
                  <div style={{ fontSize:'1.5rem',marginBottom:'0.5rem' }}>⏳</div>Waiting for first elimination...
                </div>
              ) : feedItems.map((e,i)=>(
                <div key={i} style={{ display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.65rem 0.75rem',borderRadius:'var(--radius-md)',background:i===0?'rgba(255,45,85,0.12)':'rgba(255,255,255,0.02)',border:i===0?'1px solid rgba(255,45,85,0.35)':'1px solid transparent',animation:i===0?'fadeInUp 0.3s ease':'none' }}>
                  <span style={{ fontSize:'1.1rem' }}>💀</span>
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:700,fontSize:'0.9rem',color:i===0?'var(--red)':'var(--text-secondary)' }}>{e.eliminatedUsername}</span>
                    <span style={{ color:'var(--text-muted)',fontSize:'0.8rem' }}> was eliminated</span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)',fontSize:'0.65rem',color:'var(--text-muted)' }}>#{e.eliminationOrder}</div>
                    <div style={{ fontSize:'0.65rem',color:'var(--cyan)' }}>{e.remainingPlayers} left</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Players */}
        <div className="glass-card" style={{ padding:'1.5rem',alignSelf:'start',position:'sticky',top:'80px' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem' }}>
            <h3 style={{ fontFamily:'var(--font-display)',fontSize:'0.7rem',letterSpacing:'0.12em',color:'var(--text-muted)',textTransform:'uppercase' }}>Players</h3>
            <div style={{ display:'flex',gap:'0.4rem' }}>
              <span className="badge badge-green">{alive.length} alive</span>
              <span className="badge badge-red">{dead.length} out</span>
            </div>
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:'0.5rem',maxHeight:520,overflowY:'auto' }}>
            {winnerP && <PlayerCard p={winnerP} isMe={isMe(winnerP.username)} flash={false} />}
            {winnerP && (alive.length>0||dead.length>0) && <div className="neon-divider" />}
            {alive.map((p,i) => <PlayerCard key={i} p={p} isMe={isMe(p.username)} flash={false} />)}
            {dead.length>0 && alive.length>0 && <div className="neon-divider" />}
            {dead.map((p,i) => <PlayerCard key={`d${i}`} p={p} isMe={isMe(p.username)} flash={p.username===flashName} />)}
          </div>
        </div>
      </div>
    </div>
  );
}