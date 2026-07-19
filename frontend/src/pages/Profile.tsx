import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Mail, Shield, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Account Profile</h2>
        <p className="text-muted-foreground mt-1">Manage your personal information and preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-none shadow-md overflow-hidden bg-gradient-to-b from-primary/10 to-transparent">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 border-4 border-white shadow-sm mb-4">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.firstName} ${user.lastName}&backgroundColor=16A34A`} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{user.firstName?.[0]}</AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-bold">{user.firstName} {user.lastName}</h3>
            <p className="text-muted-foreground text-sm flex items-center justify-center gap-1 mt-1">
              <Mail className="h-3 w-3" /> {user.email}
            </p>
            <div className="mt-4 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> {user.role} ACCOUNT
            </div>
            
            <div className="w-full mt-8 pt-6 border-t border-primary/10">
              <Button variant="destructive" className="w-full" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your contact details and basic info.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" defaultValue={user.firstName} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" defaultValue={user.lastName} disabled />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue={user.email} disabled />
            </div>
            
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-4">Preferences</h4>
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">Receive emails about your report updates.</p>
                </div>
                <div className="h-5 w-9 bg-primary rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 h-3 w-3 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label>Push Notifications</Label>
                  <p className="text-xs text-muted-foreground">Receive in-app push notifications.</p>
                </div>
                <div className="h-5 w-9 bg-primary rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 h-3 w-3 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
            
            <div className="pt-4 flex justify-end">
              <Button disabled>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
