import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="spinner" style={{ width:48, height:48 }} />
    </div>
  );
}

export function ProtectedRoute({ children }) {
  const { isAuth, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!isAuth) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export function AdminRoute({ children }) {
  const { isAuth, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!isAuth)  return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isAdmin) return <Navigate to="/lobby" replace />;
  return children;
}

export default ProtectedRoute;
