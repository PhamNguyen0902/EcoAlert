import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  FileText, 
  Map, 
  PlusCircle, 
  Bell, 
  User, 
  Settings,
  Leaf
} from "lucide-react"

export function Sidebar() {
  const location = useLocation()

  const links = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "Map View", href: "/map", icon: Map },
    { name: "Create Report", href: "/report", icon: PlusCircle },
    { name: "Notifications", href: "/notifications", icon: Bell },
  ]

  const bottomLinks = [
    { name: "Profile", href: "/profile", icon: User },
    { name: "Settings", href: "/settings", icon: Settings },
  ]

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card shadow-sm">
      <div className="flex h-16 items-center border-b px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg shadow-sm">
            <Leaf size={20} />
          </div>
          EcoAlert
        </Link>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <nav className="space-y-1.5">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = location.pathname === link.href
            return (
              <Link
                key={link.name}
                to={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon size={18} />
                {link.name}
              </Link>
            )
          })}
        </nav>
      </div>
      
      <div className="border-t p-4">
        <nav className="space-y-1.5">
          {bottomLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.name}
                to={link.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon size={18} />
                {link.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
