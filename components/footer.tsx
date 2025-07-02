import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Globe, MessageCircle, Twitter, Instagram, Facebook, CreditCard } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-slate-900" />
              </div>
              <span className="text-xl font-bold text-white">SnapBet</span>
            </div>
            <p className="text-slate-400 mb-6 max-w-md">
              Your trusted partner for AI-powered sports predictions. Join thousands of users who are already winning with our advanced analytics and machine learning insights.
            </p>
            <div className="flex space-x-3">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <Twitter className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <Instagram className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <Facebook className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <MessageCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <a href="/daily-tips" className="text-slate-400 hover:text-white text-sm">
                  Daily Predictions
                </a>
              </li>
              <li>
                <a href="/weekly-specials" className="text-slate-400 hover:text-white text-sm">
                  VIP Zone
                </a>
              </li>
              <li>
                <a href="/live-predictions" className="text-slate-400 hover:text-white text-sm">
                  Community
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm">
                  Success Stories
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm">
                  Responsible Gambling
                </a>
              </li>
            </ul>
          </div>

          {/* Global Access */}
          <div>
            <h3 className="text-white font-semibold mb-4">Global Access</h3>
            <div className="space-y-3">
              <div className="flex items-center text-slate-400 text-sm">
                <Globe className="w-4 h-4 mr-2" />
                25+ Countries
              </div>
              <div className="flex items-center text-slate-400 text-sm">
                <CreditCard className="w-4 h-4 mr-2" />
                Local Payments
              </div>
              <div className="space-y-1">
                <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-xs mr-1">
                  English
                </Badge>
                <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-xs mr-1">
                  Swahili
                </Badge>
                <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-xs mr-1">
                  Hindi
                </Badge>
                <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-xs mr-1">
                  Tagalog
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-slate-400 text-sm mb-4 md:mb-0">
              © 2024 SnapBet. All rights reserved. Licensed and regulated.
            </div>
            <div className="flex items-center space-x-4 text-slate-400 text-sm">
              <span>🔒 SSL Secured</span>
              <span>🛡️ Licensed</span>
              <span>18+ Only</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
