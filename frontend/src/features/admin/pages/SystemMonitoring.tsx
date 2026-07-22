import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Server, Database, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

const SERVICES = [
  { name: 'API Gateway', port: 3000, status: 'healthy', uptime: '99.9%', mem: '145MB', icon: Cloud },
  { name: 'User Service', port: 3001, status: 'healthy', uptime: '99.9%', mem: '210MB', icon: Server },
  { name: 'Alert Service', port: 3002, status: 'healthy', uptime: '99.8%', mem: '340MB', icon: Server },
  { name: 'Media Service', port: 3003, status: 'healthy', uptime: '99.9%', mem: '512MB', icon: Server },
  { name: 'GIS Service', port: 3004, status: 'healthy', uptime: '99.7%', mem: '890MB', icon: Server },
  { name: 'AI Service', port: 3005, status: 'healthy', uptime: '98.5%', mem: '2.4GB', icon: Server },
  { name: 'Notification Service', port: 3006, status: 'healthy', uptime: '99.9%', mem: '120MB', icon: Server },
  { name: 'MongoDB', port: 27017, status: 'healthy', uptime: '99.9%', mem: '4.2GB', icon: Database },
  { name: 'Redis', port: 6379, status: 'healthy', uptime: '99.9%', mem: '1.1GB', icon: Database },
  { name: 'RabbitMQ', port: 5672, status: 'healthy', uptime: '99.9%', mem: '650MB', icon: Database },
];

export default function SystemMonitoring() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">System Monitoring</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4 animate-pulse text-green-500" />
          Auto-refreshing every 30s
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SERVICES.map(service => (
          <Card key={service.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{service.name}</CardTitle>
              <service.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <div className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  service.status === 'healthy' ? "bg-green-500" : "bg-red-500"
                )} />
                <span className="text-2xl font-bold capitalize">{service.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Port: {service.port}</p>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Uptime</p>
                  <p className="font-medium">{service.uptime}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Memory</p>
                  <p className="font-medium">{service.mem}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
