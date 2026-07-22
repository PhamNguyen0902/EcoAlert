import { useMemo } from 'react';
import { useAlerts } from '@/hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { CheckCircle2, AlertTriangle, Clock, Activity } from 'lucide-react';
import { format, parseISO, startOfMonth } from 'date-fns';
import { Alert } from '@/types';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function OfficerStats() {
  const { data, isLoading } = useAlerts(1, 1000);

  const stats = useMemo(() => {
    if (!data?.items) return null;
    const alerts = data.items;

    // Basic counts
    const total = alerts.length;
    const resolved = alerts.filter((a: Alert) => a.status === 'resolved').length;
    const pending = alerts.filter((a: Alert) => a.status === 'pending' || a.status === 'ai_analyzing').length;
    const inProgress = alerts.filter((a: Alert) => a.status === 'in_progress' || a.status === 'verified' || a.status === 'assigned').length;
    
    const resolutionRate = total > 0 ? ((resolved / total) * 100).toFixed(1) : '0';

    // Status distribution
    const statusData = [
      { name: 'Pending', value: pending },
      { name: 'In Progress', value: inProgress },
      { name: 'Resolved', value: resolved },
    ].filter(d => d.value > 0);

    // Category distribution
    const categoryCount: Record<string, number> = {};
    alerts.forEach((a: Alert) => {
      const cat = a.category || 'Other';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    const categoryData = Object.entries(categoryCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Timeline data (group by month)
    const timelineCount: Record<string, number> = {};
    alerts.forEach((a: Alert) => {
      const monthDate = startOfMonth(parseISO(a.createdAt));
      const key = format(monthDate, 'MMM yyyy');
      timelineCount[key] = (timelineCount[key] || 0) + 1;
    });
    
    // Convert to array and reverse to simulate chronological order if needed
    const timelineData = Object.entries(timelineCount)
      .map(([name, value]) => ({ name, value }))
      .reverse();

    return { total, resolved, resolutionRate, statusData, categoryData, timelineData, pending, inProgress };
  }, [data]);

  if (isLoading || !stats) {
    return <div className="p-8 text-center">Loading statistics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Performance Statistics</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Reports Handled"
          value={stats.total.toString()}
          icon={Activity}
          description="All time"
        />
        <StatCard
          title="Resolution Rate"
          value={`${stats.resolutionRate}%`}
          icon={CheckCircle2}
          description="Reports marked as resolved"
        />
        <StatCard
          title="Currently Pending"
          value={stats.pending.toString()}
          icon={Clock}
          description="Awaiting verification"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress.toString()}
          icon={AlertTriangle}
          description="Actively being worked on"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Reports Over Time</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.timelineData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="value" name="Reports" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Reports by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.categoryData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={100} />
                  <RechartsTooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
