import { useUsers, useToggleUserStatus } from '@/hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { User } from '@/types';
import toast from 'react-hot-toast';

export default function OfficerManagement() {
  const { data, isLoading } = useUsers(1, 100);
  const toggleStatus = useToggleUserStatus();

  if (isLoading) return <LoadingSpinner />;

  const officers = (data?.items || []).filter((u: User) => u.role?.toLowerCase() === 'officer');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Officer Management</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {officers.map((officer: User) => (
          <Card key={officer._id}>
            <CardHeader className="flex flex-row items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={officer.avatar} />
                <AvatarFallback>{officer.fullName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <CardTitle className="text-lg">{officer.fullName}</CardTitle>
                <CardDescription>{officer.email}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={officer.isActive ? 'default' : 'secondary'}>
                    {officer.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Assigned Reports</span>
                  <span className="font-medium">{Math.floor(Math.random() * 20)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Resolution Rate</span>
                  <span className="font-medium">{Math.floor(Math.random() * 40 + 60)}%</span>
                </div>
                <div className="pt-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => { toggleStatus.mutate({ id: officer._id, isActive: !officer.isActive }); toast.success('Status updated'); }}
                  >
                    {officer.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button className="w-full">View Details</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
