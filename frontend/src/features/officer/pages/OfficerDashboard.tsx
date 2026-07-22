import React from 'react';
import { motion } from 'framer-motion';
import { Alert } from '@/types';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ClipboardList, ShieldCheck, Activity, CheckCircle2, Map as MapIcon, ArrowRight } from 'lucide-react';
import { useAlerts } from '@/hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatDistanceToNow } from 'date-fns';

const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444'];

export default function OfficerDashboard() {
  const navigate = useNavigate();
  const { data: alertsData, isLoading } = useAlerts(1, 100);
  const alerts = alertsData?.items || [];
  if (isLoading) return <LoadingSpinner className="mx-auto mt-20" />;

  const assigned = alerts.filter((a: Alert) => a.status === 'assigned');
  const pending = alerts.filter((a: Alert) => a.status === 'pending' || a.status === 'ai_analyzing');
  const inProgress = alerts.filter((a: Alert) => a.status === 'in_progress');
  const resolved = alerts.filter((a: Alert) => a.status === 'resolved');

  const statusData = [
    { name: 'Pending', value: pending.length },
    { name: 'Assigned', value: assigned.length },
    { name: 'In Progress', value: inProgress.length },
    { name: 'Resolved', value: resolved.length },
  ];

  const categoryCount = alerts.reduce((acc: Record<string, number>, curr: Alert) => {
    acc[curr.category] = (acc[curr.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const categoryData = Object.entries(categoryCount).map(([name, value]) => ({ name, value }));

  const recentActivity = alerts.slice(0, 5);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
          <p className="text-muted-foreground">Monitor and manage environmental reports.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/officer/pending')}>
            <ShieldCheck className="mr-2 h-4 w-4" /> View Pending
          </Button>
          <Button onClick={() => navigate('/officer/map')}>
            <MapIcon className="mr-2 h-4 w-4" /> Go to Map
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Assigned to Me', value: assigned.length, icon: ClipboardList, color: 'text-blue-500' },
          { title: 'Pending Verification', value: pending.length, icon: ShieldCheck, color: 'text-amber-500' },
          { title: 'In Progress', value: inProgress.length, icon: Activity, color: 'text-orange-500' },
          { title: 'Resolved Today', value: resolved.length, icon: CheckCircle2, color: 'text-green-500' },
        ].map((stat, i) => (
          <motion.div key={i} variants={item}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <motion.div variants={item} className="lg:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Reports by Status</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.1)' }} contentStyle={{ borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={item} className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Category Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest reports across all statuses.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((alert: Alert) => (
                <div key={alert._id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(alert.createdAt || Date.now()), { addSuffix: true })} • {alert.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.severity === 'high' || alert.severity === 'critical' ? 'destructive' : 'default'}>
                      {alert.severity}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/officer/reports/${alert._id}`)}>
                      View <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
