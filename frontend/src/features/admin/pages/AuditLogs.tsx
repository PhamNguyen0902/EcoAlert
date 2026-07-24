import { useState } from 'react';
import { useAuditLogs } from '@/hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useAuditLogs(page, 15, search);

  if (isLoading) return <LoadingSpinner />;

  const logs = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Nhật ký Hoạt động (Audit Logs)</h2>
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
                {logs.map((log: any) => (
                  <tr key={log._id || log.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-4 whitespace-nowrap text-muted-foreground">
                      {format(new Date(log.createdAt || log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                    </td>
                    <td className="p-4 font-medium">{log.user}</td>
                    <td className="p-4">
                      <Badge variant="outline" className="font-mono text-xs">{log.action}</Badge>
                    </td>
                    <td className="p-4 font-medium">{log.resource}</td>
                    <td className="p-4 text-muted-foreground">{log.details || '-'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      Chưa có nhật ký hoạt động nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              Trang trước
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={logs.length < 15}>
              Trang sau
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
