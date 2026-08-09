import { useState } from 'react';
import { useAlerts, useDeleteAlert } from '@/hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Search, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Alert } from '@/types';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ReportManagement() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  const { data, isLoading } = useAlerts(page, 10);
  const deleteAlert = useDeleteAlert();

  if (isLoading) return <LoadingSpinner />;

  const filteredAlerts = (data?.items || []).filter((a: Alert) => 
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t('reports.management_title')}</h2>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>{t('reports.env_reports')}</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('reports.search_placeholder')}
              className="w-[300px] pl-8"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-4 font-medium">{t('reports.col_title')}</th>
                  <th className="p-4 font-medium">{t('reports.col_category')}</th>
                  <th className="p-4 font-medium">{t('reports.col_severity')}</th>
                  <th className="p-4 font-medium">{t('reports.col_status')}</th>
                  <th className="p-4 font-medium">{t('reports.col_date')}</th>
                  <th className="p-4 font-medium">{t('reports.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert: Alert) => (
                  <tr key={alert._id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-4 font-medium">{alert.title}</td>
                    <td className="p-4 capitalize">{alert.category}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={
                        alert.severity === 'high' ? 'border-red-500 text-red-500' :
                        alert.severity === 'medium' ? 'border-orange-500 text-orange-500' :
                        'border-blue-500 text-blue-500'
                      }>
                        {alert.severity}
                      </Badge>
                    </td>
                    <td className="p-4 capitalize">{alert.status}</td>
                    <td className="p-4 text-muted-foreground">{format(new Date(alert.createdAt), 'MMM d, yyyy')}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Link to={`/admin/reports/${alert._id}`}>
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500"
                          onClick={() => {
                            if(confirm('Delete report?')) {
                              deleteAlert.mutate(alert._id);
                              toast.success(t('toast.report_deleted_success'));
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>{t('reports.prev')}</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>{t('reports.next')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
