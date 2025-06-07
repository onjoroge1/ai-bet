import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, MoreHorizontal, Crown, Shield, User, Ban, Mail } from "lucide-react"

export function UserManagement() {
  const users = [
    {
      id: 1,
      name: "James Kiprotich",
      email: "james.k@email.com",
      country: "Kenya",
      flag: "🇰🇪",
      plan: "VIP",
      status: "active",
      winnings: "KES 127,500",
      joinDate: "2024-01-15",
    },
    {
      id: 2,
      name: "Priya Sharma",
      email: "priya.s@email.com",
      country: "India",
      flag: "🇮🇳",
      plan: "Pro",
      status: "active",
      winnings: "₹85,000",
      joinDate: "2024-01-12",
    },
    {
      id: 3,
      name: "Miguel Rodriguez",
      email: "miguel.r@email.com",
      country: "Philippines",
      flag: "🇵🇭",
      plan: "Free",
      status: "suspended",
      winnings: "₱25,000",
      joinDate: "2024-01-10",
    },
    {
      id: 4,
      name: "Sarah Johnson",
      email: "sarah.j@email.com",
      country: "UK",
      flag: "🇬🇧",
      plan: "VIP",
      status: "active",
      winnings: "£45,000",
      joinDate: "2024-01-08",
    },
  ]

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case "VIP":
        return <Crown className="w-3 h-3" />
      case "Pro":
        return <Shield className="w-3 h-3" />
      default:
        return <User className="w-3 h-3" />
    }
  }

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "VIP":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "Pro":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      case "suspended":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-xl font-semibold text-white mb-4 md:mb-0">User Management</h2>

        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search users..."
              className="pl-10 bg-slate-900/50 border-slate-600 text-white w-full md:w-48"
            />
          </div>
          <Select>
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white w-full md:w-24">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="free">Free</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900/70 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center">
                  <span className="text-slate-900 font-semibold text-sm">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{user.name}</span>
                    <span className="text-lg">{user.flag}</span>
                  </div>
                  <div className="text-slate-400 text-sm">{user.email}</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-emerald-400 font-medium text-sm">{user.winnings}</div>
                  <div className="text-slate-400 text-xs">Total winnings</div>
                </div>

                <div className="flex flex-col space-y-1">
                  <Badge className={getPlanColor(user.plan)}>
                    {getPlanIcon(user.plan)}
                    <span className="ml-1">{user.plan}</span>
                  </Badge>
                  <Badge className={getStatusColor(user.status)}>{user.status}</Badge>
                </div>

                <div className="flex items-center space-x-1">
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-1">
                    <Mail className="w-4 h-4" />
                  </Button>
                  {user.status === "active" ? (
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 p-1">
                      <Ban className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-emerald-400 p-1">
                      <Shield className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-1">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-between items-center">
        <div className="text-slate-400 text-sm">Showing 4 of 50,234 users</div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
            Previous
          </Button>
          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
            Next
          </Button>
        </div>
      </div>
    </Card>
  )
}
