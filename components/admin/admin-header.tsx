"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Shield, Bell, Settings, Download, RefreshCw, FileText, Mail, Twitter, Target, Menu, X, BarChart3 } from "lucide-react"
import Link from "next/link"

export function AdminHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navigationLinks = [
    { href: "/admin/emails", label: "Email Templates", icon: Mail },
    { href: "/admin/blogs", label: "Blog", icon: FileText },
    { href: "/admin/blog-automation", label: "Blog Automation", icon: FileText },
    { href: "/admin/social-automation", label: "Social Automation", icon: Twitter },
    { href: "/admin/matches", label: "Matches", icon: Target },
    { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  ]

  return (
    <div className="mb-8">
      <div className="flex flex-col gap-4 mb-6">
        {/* Title and Badge Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 flex items-center space-x-2">
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />
              <span>Admin Dashboard</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300">Platform management and analytics overview</p>
          </div>

          {/* Desktop: Badge and Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 whitespace-nowrap">
              <Shield className="w-4 h-4 mr-2" />
              Super Admin
            </Badge>
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

          {/* Mobile: Badge and Menu Button */}
          <div className="flex md:hidden items-center justify-between gap-3">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              <Shield className="w-3 h-3 mr-1" />
              <span className="text-xs">Super Admin</span>
            </Badge>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white relative p-2">
                <Bell className="w-4 h-4" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              </Button>
              <DropdownMenu open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                    {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 w-56">
                  {navigationLinks.map((link) => {
                    const Icon = link.icon
                    return (
                      <DropdownMenuItem key={link.href} asChild>
                        <Link href={link.href} className="flex items-center cursor-pointer">
                          <Icon className="w-4 h-4 mr-2" />
                          {link.label}
                        </Link>
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuItem asChild>
                    <Link href="#" className="flex items-center cursor-pointer">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="#" className="flex items-center cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Desktop: Navigation Links */}
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          {navigationLinks.map((link) => {
            const Icon = link.icon
            return (
              <Button
                key={link.href}
                asChild
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                <Link href={link.href}>
                  <Icon className="w-4 h-4 mr-2" />
                  {link.label}
                </Link>
              </Button>
            )
          })}
        </div>
      </div>

      {/* System Status Bar */}
      <Card className="bg-slate-800/50 border-slate-700 p-3 sm:p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-xs sm:text-sm font-medium">All Systems Operational</span>
            </div>
            <div className="text-slate-400 text-xs sm:text-sm">Last updated: 2 minutes ago</div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-4 text-xs sm:text-sm">
              <div className="text-slate-300">
                <span className="font-medium">50,234</span> <span className="hidden sm:inline">Active Users</span><span className="sm:hidden">Users</span>
              </div>
              <div className="text-slate-300">
                <span className="font-medium">₦2.4M</span> <span className="hidden sm:inline">Revenue Today</span><span className="sm:hidden">Revenue</span>
              </div>
            </div>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export Report</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
