import { Toaster } from 'react-hot-toast';
export default function Toast() {
  return (
    <Toaster position="top-right" toastOptions={{
      style: {
        background:'#0d0d18', color:'#ffffff',
        border:'1px solid rgba(245,197,24,0.2)',
        fontFamily:'Rajdhani, sans-serif', fontSize:'0.95rem', letterSpacing:'0.02em',
      },
      success: { iconTheme: { primary:'#f5c518', secondary:'#000' } },
    }} />
  );
}
