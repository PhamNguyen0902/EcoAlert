import { useState } from 'react';
import { useAlerts, useUpdateAlertStatus } from '../hooks/hooks';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Search, Eye, Filter, MoreVertical, CheckCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { useLanguage } from '../contexts/LanguageContext';

export default function ReportList() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  const { data: alertsData, isLoading } = useAlerts(page, 10, search ? { title: search } : {});
  const updateStatusMutation = useUpdateAlertStatus();

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const alerts = alertsData?.items || [];
  const total = alertsData?.total || 0;
  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('reports.management_title')}</h2>
          <p className="text-muted-foreground mt-1">{t('reports.management_subtitle')}</p>
        </div>
        <Button asChild><Link to="/report">{t('my_reports.btn_create')}</Link></Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('reports.search_placeholder')}
                className="pl-9 bg-muted/50 w-full sm:max-w-md"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" /> {t('btn.filter')}
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium text-slate-500">{t('reports.col_title')}</th>
                  <th className="px-6 py-4 font-medium text-slate-500">{t('reports.col_date')}</th>
                  <th className="px-6 py-4 font-medium text-slate-500">{t('reports.col_category')}</th>
                  <th className="px-6 py-4 font-medium text-slate-500">{t('reports.col_severity')}</th>
                  <th className="px-6 py-4 font-medium text-slate-500">{t('reports.col_status')}</th>
                  <th className="px-6 py-4 font-medium text-slate-500 text-right">{t('reports.col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {alerts.map((alert: any) => (
                  <tr key={alert._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{alert.title}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{alert._id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                      {format(new Date(alert.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {alert.category || 'Unclassified'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : alert.severity === 'HIGH' ? 'warning' : 'default'}>
                        {alert.severity}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={['RESOLVED', 'CLOSED'].includes(alert.status) ? 'success' : 'outline'}>
                        {alert.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild title={t('btn.view')}>
                          <Link to={`/alerts/${alert._id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/alerts/${alert._id}`} className="cursor-pointer flex items-center">
                                <Eye className="mr-2 h-4 w-4" /> {t('btn.view')}
                              </Link>
                            </DropdownMenuItem>
                            {alert.status !== 'CLOSED' && (
                              <DropdownMenuItem 
                                className="cursor-pointer flex items-center text-green-600 focus:text-green-600"
                                onClick={() => updateStatusMutation.mutate({ id: alert._id, status: 'CLOSED' })}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" /> {t('alert_detail.btn_resolve')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      -
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  {t('reports.prev')}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  {t('reports.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Ensure CheckCircle is imported correctly in the above code if not already. Wait, let me just add it.
