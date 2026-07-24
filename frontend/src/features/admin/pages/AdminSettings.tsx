import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

export default function AdminSettings() {
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
      toast.success('Đã lưu cấu hình hệ thống thành công!');
    }, 500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Cấu hình Hệ thống (System Settings)</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cấu hình Chung</CardTitle>
          <CardDescription>Thông tin cơ bản về nền tảng EcoAlert.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tên hệ thống</label>
            <Input value={systemName} onChange={e => setSystemName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mô tả hệ thống</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thông báo</CardTitle>
          <CardDescription>Thiết lập quy tắc gửi thông báo toàn hệ thống.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Email Thông báo</label>
              <p className="text-sm text-muted-foreground">Gửi báo cáo tổng hợp hàng ngày tới Quản trị viên</p>
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
              <label className="text-sm font-medium">Push Notifications</label>
              <p className="text-sm text-muted-foreground">Bật thông báo đẩy thời gian thực</p>
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
          <CardTitle>Bảo mật & Bảo trì</CardTitle>
          <CardDescription>Chính sách bảo mật và chế độ bảo trì.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Thời gian hết hạn phiên làm việc (phút)</label>
            <Input type="number" value={timeout} onChange={e => setTimeoutVal(e.target.value)} />
          </div>
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-red-500">Chế độ Bảo trì (Maintenance Mode)</label>
              <p className="text-sm text-muted-foreground">Tạm thời khóa truy cập hệ thống đối với Citizen & Officer</p>
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
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
