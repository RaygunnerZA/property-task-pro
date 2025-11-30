import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      style={{
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: '500',
        color: '#fff',
        backgroundColor: loading ? '#6c757d' : '#dc3545',
        border: 'none',
        borderRadius: '4px',
        cursor: loading ? 'not-allowed' : 'pointer'
      }}
    >
      {loading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
