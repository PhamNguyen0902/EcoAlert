import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Mail, Shield, LogOut, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUpdateProfile } from "../hooks/hooks";
import toast from "react-hot-toast";

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const updateProfileMutation = useUpdateProfile();

  // Tách fullName thành firstName và lastName hoặc quản lý dạng fullName
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [phone, setPhone] = useState(user?.phone || "");

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(
      { fullName, phone },
      {
        onSuccess: (updatedData) => {
          toast.success("Cập nhật thông tin thành công!");
          // Cập nhật lại localStorage nếu cần
          const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
          localStorage.setItem(
            "user",
            JSON.stringify({ ...storedUser, fullName, phone }),
          );
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || "Cập nhật thất bại");
        },
      },
    );
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Account Profile</h2>
        <p className="text-muted-foreground mt-1">
          Manage your personal information and preferences.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-none shadow-md overflow-hidden bg-gradient-to-b from-primary/10 to-transparent">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 border-4 border-white shadow-sm mb-4">
              <AvatarImage
                src={
                  user.avatar ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${user.fullName}`
                }
              />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {user.fullName?.[0]}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-bold">{user.fullName}</h3>
            <p className="text-muted-foreground text-sm flex items-center justify-center gap-1 mt-1">
              <Mail className="h-3 w-3" /> {user.email}
            </p>
            <div className="mt-4 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> {user.role} ACCOUNT
            </div>

            <div className="w-full mt-8 pt-6 border-t border-primary/10">
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your contact details and basic info.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="096xxxxxxx"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={user.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed.
                </p>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
