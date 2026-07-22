import { Users, FileText, ShieldCheck, Activity } from 'lucide-react';
import { useUsers, useAlerts } from '@/hooks/hooks';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';

const mockChartData = [
  { name: 'Jan', reports: 40 },
  { name: 'Feb', reports: 30 },
  { name: 'Mar', reports: 55 },
  { name: 'Apr', reports: 45 },
  { name: 'May', reports: 70 },
  { name: 'Jun', reports: 65 },
];

const mockPieData = [
  { name: 'Citizens', value: 400 },
  { name: 'Officers', value: 50 },
  { name: 'Admins', value: 10 },
];
const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b'];

export default function AdminDashboard() {
  const { data: usersData } = useUsers(1, 1);
  const { data: alertsData } = useAlerts(1, 5);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={usersData?.total || 0} icon={Users} />
        <StatCard title="Total Reports" value={alertsData?.total || 0} icon={FileText} />
        <StatCard title="Active Officers" value={50} icon={ShieldCheck} />
        <StatCard title="System Status" value="Operational" icon={Activity} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Reports Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockChartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="reports" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>User Demographics</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={mockPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {mockPieData.map((_, index) => (
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
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alertsData?.alerts?.map(alert => (
                <div key={alert._id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-sm text-muted-foreground">{new Date(alert.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-sm">{alert.status}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col space-y-2">
            <Link to="/admin/users" className="text-blue-500 hover:underline">Manage Users</Link>
            <Link to="/admin/reports" className="text-blue-500 hover:underline">View Reports</Link>
            <Link to="/admin/monitoring" className="text-blue-500 hover:underline">System Health</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
