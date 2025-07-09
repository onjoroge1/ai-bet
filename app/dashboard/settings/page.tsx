"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  Bell, 
  CreditCard, 
  Shield, 
  Settings as SettingsIcon,
  ArrowLeft,
  Save,
  Eye,
  EyeOff
} from "lucide-react"
import Link from "next/link"
import { AccountSettings } from "@/components/settings/AccountSettings"
import { NotificationSettings } from "@/components/settings/NotificationSettings"
import { PaymentSettings } from "@/components/settings/PaymentSettings"
import { PrivacySettings } from "@/components/settings/PrivacySettings"

type SettingsTab = "account" | "notifications" | "payment" | "privacy"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account")

  const settingsTabs = [
    {
      id: "account" as SettingsTab,
      label: "Account",
      icon: User,
      description: "Profile information and password"
    },
    {
      id: "notifications" as SettingsTab,
      label: "Notifications",
      icon: Bell,
      description: "Email and push notifications"
    },
    {
      id: "payment" as SettingsTab,
      label: "Payment & Billing",
      icon: CreditCard,
      description: "Payment methods and billing history"
    },
    {
      id: "privacy" as SettingsTab,
      label: "Privacy & Security",
      icon: Shield,
      description: "Privacy settings and security"
    }
  ]

  const renderActiveTab = () => {
    switch (activeTab) {
      case "account":
        return <AccountSettings />
      case "notifications":
        return <NotificationSettings />
      case "payment":
        return <PaymentSettings />
      case "privacy":
        return <PrivacySettings />
      default:
        return <AccountSettings />
    }
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <SettingsIcon className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold text-white">Settings</h1>
            </div>
          </div>
          <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
            Phase 1 MVP
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-800/50 border-slate-700 p-4">
              <h3 className="text-white font-semibold mb-4">Settings</h3>
              <nav className="space-y-2">
                {settingsTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-all duration-200 ${
                      activeTab === tab.id
                        ? "bg-emerald-600 text-white"
                        : "text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <div>
                      <div className="font-medium">{tab.label}</div>
                      <div className="text-xs opacity-75">{tab.description}</div>
                    </div>
                  </button>
                ))}
              </nav>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              {renderActiveTab()}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
