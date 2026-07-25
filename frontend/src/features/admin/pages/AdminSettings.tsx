import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AdminSettings() {
  const { t } = useLanguage();
  const [systemName, setSystemName] = useState('EcoAlert Enterprise');
  const [description, setDescription] = useState('Environmental Monitoring & Reporting Platform');
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [timeout, setTimeoutVal] = useState('60');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Saved system settings');
    }, 500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.general_title')}</CardTitle>
          <CardDescription>{t('settings.general_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.system_name')}</label>
            <Input value={systemName} onChange={e => setSystemName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.system_desc')}</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.notifications_title')}</CardTitle>
          <CardDescription>{t('settings.notifications_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">{t('settings.email_notif')}</label>
              <p className="text-sm text-muted-foreground">{t('settings.email_notif_desc')}</p>
            </div>
            <input
              type="checkbox"
              checked={emailNotif}
              onChange={e => setEmailNotif(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">{t('settings.push_notif')}</label>
              <p className="text-sm text-muted-foreground">{t('settings.push_notif_desc')}</p>
            </div>
            <input
              type="checkbox"
              checked={pushNotif}
              onChange={e => setPushNotif(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.security_title')}</CardTitle>
          <CardDescription>{t('settings.security_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.session_timeout')}</label>
            <Input type="number" value={timeout} onChange={e => setTimeoutVal(e.target.value)} />
          </div>
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-red-500">{t('settings.maintenance_mode')}</label>
              <p className="text-sm text-muted-foreground">{t('settings.maintenance_desc')}</p>
            </div>
            <input
              type="checkbox"
              checked={maintenanceMode}
              onChange={e => setMaintenanceMode(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '...' : t('btn.save_changes')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
