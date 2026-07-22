import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const MOCK_LOGS = [
  { id: 1, timestamp: new Date(Date.now() - 1000 * 60 * 5), user: 'Admin User', action: 'USER_CREATED', resource: 'User: john@example.com', details: 'Created new citizen account' },
  { id: 2, timestamp: new Date(Date.now() - 1000 * 60 * 45), user: 'System', action: 'ALERT_VERIFIED', resource: 'Alert: #12345', details: 'AI auto-verified report' },
  { id: 3, timestamp: new Date(Date.now() - 1000 * 60 * 120), user: 'Admin User', action: 'ROLE_CHANGED', resource: 'User: jane@example.com', details: 'Changed role citizen -> officer' },
  { id: 4, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), user: 'Officer Bob', action: 'STATUS_UPDATED', resource: 'Alert: #12340', details: 'Updated status in_progress -> resolved' },
  { id: 5, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), user: 'Admin User', action: 'SETTINGS_UPDATED', resource: 'System Settings', details: 'Enabled maintenance mode' },
];

export default function AuditLogs() {
  const [search, setSearch] = useState('');

  const filteredLogs = MOCK_LOGS.filter(log => 
    log.action.toLowerCase().includes(search.toLowerCase()) || 
    log.user.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>System Activity Logs</CardTitle>
          <div className="flex space-x-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search logs..."
                className="w-[300px] pl-8"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-4 font-medium">Timestamp</th>
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Action</th>
                  <th className="p-4 font-medium">Resource</th>
                  <th className="p-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-4 whitespace-nowrap text-muted-foreground">{format(log.timestamp, 'MMM d, yyyy HH:mm:ss')}</td>
                    <td className="p-4 font-medium">{log.user}</td>
                    <td className="p-4">
                      <Badge variant="outline" className="font-mono text-xs">{log.action}</Badge>
                    </td>
                    <td className="p-4">{log.resource}</td>
                    <td className="p-4 text-muted-foreground">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
