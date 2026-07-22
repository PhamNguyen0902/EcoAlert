import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { getRoleHome } from '@/lib/routes';

export const ProtectedRoute = () => {
  return <Outlet />;
};