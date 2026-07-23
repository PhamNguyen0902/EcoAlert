import { Outlet, Navigate } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { AppToaster } from "@/components/ui/app-toaster"

export function DashboardLayout() {
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-foreground selection:bg-primary/20">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
      <AppToaster />
    </div>
  )
}
