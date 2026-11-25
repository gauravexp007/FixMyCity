import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

export function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setError('');
      const res = await api.get('/complaints/stats');
      setData(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to load dashboard statistics';
      setError(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}
