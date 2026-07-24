import { Users, FileText, ShieldCheck, Activity } from 'lucide-react';
import { useUsers, useAlerts } from '@/hooks/hooks';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Alert, User } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b'];

export default function AdminDashboard() {
  const { t } = useLanguage();
  const { data: usersData } = useUsers(1, 100);
  const { data: alertsData } = useAlerts(1, 100);

  const usersList: User[] = usersData?.items || [];
  const alertsList: Alert[] = alertsData?.items || [];

  const totalUsers = usersData?.total || usersList.length;
  const totalReports = alertsData?.total || alertsList.length;

  const officers = usersList.filter(u => u.role?.toUpperCase() === 'OFFICER');
  const activeOfficersCount = officers.filter(u => u.isActive).length;
  const citizensCount = usersList.filter(u => u.role?.toUpperCase() === 'CITIZEN').length;
  const adminsCount = usersList.filter(u => u.role?.toUpperCase() === 'ADMIN').length;

  const pieData = [
    { name: 'Citizens', value: citizensCount || 1 },
    { name: 'Officers', value: officers.length || 0 },
    { name: 'Admins', value: adminsCount || 0 },
  ];

  // Group alerts by status
  const statusCounts: Record<string, number> = alertsList.reduce((acc, alert) => {
    const status = (alert.status || 'OTHER').toUpperCase();
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const reportsStatusData = [
    { name: 'Pending', reports: statusCounts['PENDING'] || 0 },
    { name: 'Verified', reports: statusCounts['VERIFIED'] || 0 },
    { name: 'Assigned', reports: statusCounts['ASSIGNED'] || 0 },
    { name: 'In Progress', reports: statusCounts['IN_PROGRESS'] || 0 },
    { name: 'Resolved', reports: statusCounts['RESOLVED'] || 0 },
    { name: 'Closed', reports: statusCounts['CLOSED'] || 0 },
  ];

  const recentAlerts = alertsList.slice(0, 5);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">{t('nav.dashboard')}</h2>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t('stats.total_users')} value={totalUsers} icon={Users} />
        <StatCard title={t('stats.total_reports')} value={totalReports} icon={FileText} />
        <StatCard title={t('stats.active_officers')} value={activeOfficersCount} icon={ShieldCheck} />
        <StatCard title={t('stats.system_status')} value={t('stats.operational')} icon={Activity} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>{t('stats.reports_by_status')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportsStatusData}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="reports" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>{t('stats.user_demographics')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label>
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.recent_activity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAlerts.map(alert => (
                <div key={alert._id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(alert.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                  <Badge variant="outline" className="capitalize text-xs">
                    {alert.status?.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
              {recentAlerts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('stats.no_recent_reports')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('stats.quick_links')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col space-y-3 text-sm">
            <Link to="/admin/users" className="text-primary hover:underline font-medium">{t('nav.users')} ({totalUsers})</Link>
            <Link to="/admin/officers" className="text-primary hover:underline font-medium">{t('nav.officers')} ({officers.length})</Link>
            <Link to="/admin/reports" className="text-primary hover:underline font-medium">{t('nav.reports')} ({totalReports})</Link>
            <Link to="/admin/categories" className="text-primary hover:underline font-medium">{t('nav.categories')}</Link>
            <Link to="/admin/audit" className="text-primary hover:underline font-medium">{t('nav.audit')}</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
