import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Shield, Bell, Settings, Download, RefreshCw, FileText, Mail } from "lucide-react"
import Link from "next/link"

export function AdminHeader() {
  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center space-x-2">
            <Shield className="w-8 h-8 text-emerald-400" />
            <span>Admin Dashboard</span>
          </h1>
          <p className="text-slate-300">Platform management and analytics overview</p>
        </div>

        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Shield className="w-4 h-4 mr-2" />
            Super Admin
          </Badge>
          <Button asChild variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">
            <Link href="/admin/emails">
              <Mail className="w-4 h-4 mr-2" />
              Email Templates
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">
            <Link href="/admin/blogs">
              <FileText className="w-4 h-4 mr-2" />
              Blog
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white relative">
            <Bell className="w-4 h-4" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* System Status Bar */}
      <Card className="bg-slate-800/50 border-slate-700 p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm font-medium">All Systems Operational</span>
            </div>
            <div className="text-slate-400 text-sm">Last updated: 2 minutes ago</div>
          </div>

          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <div className="text-slate-300 text-sm">
              <span className="font-medium">50,234</span> Active Users
            </div>
            <div className="text-slate-300 text-sm">
              <span className="font-medium">₦2.4M</span> Revenue Today
            </div>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
