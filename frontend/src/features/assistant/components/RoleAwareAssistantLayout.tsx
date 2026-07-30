import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import CitizenLayout from '@/features/citizen/components/CitizenLayout';
import OfficerLayout from '@/features/officer/components/OfficerLayout';
import AdminLayout from '@/features/admin/components/AdminLayout';

export default function RoleAwareAssistantLayout() {
  const { role } = useAuth();
  if (role === 'CITIZEN') return <CitizenLayout />;
  if (role === 'OFFICER') return <OfficerLayout />;
  if (role === 'ADMIN') return <AdminLayout />;
  return <Navigate to="/login" replace />;
}
