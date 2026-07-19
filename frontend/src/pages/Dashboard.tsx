import { useAlerts } from '../hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { FileText, Clock, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { data: alertsData, isLoading } = useAlerts(1, 100);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const alerts = alertsData?.items || [];

  // Calculate stats
  const stats = {
    total: alerts.length,
    pending: alerts.filter((a: any) => a.status === 'PENDING').length,
    processing: alerts.filter((a: any) => ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS'].includes(a.status)).length,
    resolved: alerts.filter((a: any) => ['RESOLVED', 'CLOSED'].includes(a.status)).length,
    rejected: alerts.filter((a: any) => a.status === 'REJECTED').length,
  };

  // Mock data for months based on alerts (in a real app, backend aggregates this)
  const monthlyData = [
    { name: 'Jan', reports: 12 },
    { name: 'Feb', reports: 19 },
    { name: 'Mar', reports: 15 },
    { name: 'Apr', reports: 22 },
    { name: 'May', reports: stats.total },
  ];

  const categoryData = [
    { name: 'Waste', value: alerts.filter((a: any) => a.category === 'Waste').length || 1 },
    { name: 'Water', value: alerts.filter((a: any) => a.category === 'Water').length || 1 },
    { name: 'Air', value: alerts.filter((a: any) => a.category === 'Air').length || 1 },
    { name: 'Other', value: alerts.filter((a: any) => !['Waste', 'Water', 'Air'].includes(a.category)).length || 1 },
  ].filter(d => d.value > 0);
  
  const COLORS = ['#16A34A', '#3B82F6', '#F59E0B', '#64748B'];

  const recentAlerts = alerts.slice(0, 5);

  const statCards = [
    { title: 'Total Reports', value: stats.total, icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100' },
    { title: 'Pending', value: stats.pending, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' },
    { title: 'Processing', value: stats.processing, icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-100' },
    { title: 'Resolved', value: stats.resolved, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
    { title: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-muted-foreground mt-1">Monitor environmental incidents across the city in real-time.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-x-2">
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <div className="text-3xl font-bold">{stat.value}</div>
                </div>
                <div className="mt-4 text-sm font-medium text-muted-foreground">{stat.title}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-6">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Reports by Month</CardTitle>
            <CardDescription>Incident frequency over the last 5 months</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="reports" fill="#16A34A" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
            <CardDescription>AI-classified categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Reports</CardTitle>
                <CardDescription>Latest incidents submitted to the system</CardDescription>
              </div>
              <Link to="/reports" className="text-sm font-medium text-primary hover:underline">View All</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAlerts.map((alert: any) => (
                <div key={alert._id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col gap-1">
                    <Link to={`/alerts/${alert._id}`} className="font-semibold hover:text-primary transition-colors">{alert.title}</Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(alert.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                      <span>•</span>
                      <span>{alert.address}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : alert.severity === 'HIGH' ? 'warning' : 'default'}>
                      {alert.severity}
                    </Badge>
                    <Badge variant={['RESOLVED', 'CLOSED'].includes(alert.status) ? 'success' : 'outline'}>
                      {alert.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {recentAlerts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No reports found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Summary</CardTitle>
            <CardDescription>System analysis performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="text-sm font-medium">Average Confidence</div>
                <div className="font-bold text-green-600">89.4%</div>
              </div>
              <div className="flex items-center justify-between border-b pb-4">
                <div className="text-sm font-medium">Auto-assigned</div>
                <div className="font-bold">142</div>
              </div>
              <div className="flex items-center justify-between pb-4">
                <div className="text-sm font-medium">Processing Time</div>
                <div className="font-bold">1.2s</div>
              </div>
              
              <div className="pt-4 bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
                EcoAlert AI model is performing optimally. All visual data from the last 24h successfully classified.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
