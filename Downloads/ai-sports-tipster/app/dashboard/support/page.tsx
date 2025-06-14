"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageCircle, Phone, Mail, AlertCircle, Search, Book, Video, Download, Star, Send } from "lucide-react"

export default function SupportPage() {
  const [searchQuery, setSearchQuery] = useState("")

  const faqs = [
    {
      question: "How do I place a bet using your predictions?",
      answer:
        "Our predictions are for informational purposes. You can use them as guidance when placing bets on your preferred betting platform. We provide detailed analysis to help you make informed decisions.",
      category: "Betting",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept M-Pesa, Airtel Money, bank transfers, and major credit cards. M-Pesa is the most popular payment method among our Kenyan users.",
      category: "Payment",
    },
    {
      question: "How accurate are your predictions?",
      answer:
        "Our AI-powered predictions have an average accuracy rate of 78-85%. However, sports betting always involves risk, and we recommend responsible gambling.",
      category: "Predictions",
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer:
        "Yes, you can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your current billing period.",
      category: "Subscription",
    },
    {
      question: "Do you offer refunds?",
      answer:
        "We offer a 7-day money-back guarantee for new subscribers. For other refund requests, please contact our support team.",
      category: "Refunds",
    },
  ]

  const tickets = [
    {
      id: "#TK-001",
      subject: "Payment not processed",
      status: "Open",
      priority: "High",
      date: "2024-02-15",
      lastUpdate: "2 hours ago",
    },
    {
      id: "#TK-002",
      subject: "Unable to access VIP predictions",
      status: "In Progress",
      priority: "Medium",
      date: "2024-02-14",
      lastUpdate: "1 day ago",
    },
    {
      id: "#TK-003",
      subject: "Feature request: Mobile app",
      status: "Closed",
      priority: "Low",
      date: "2024-02-10",
      lastUpdate: "5 days ago",
    },
  ]

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Help & Support</h1>
          <p className="text-slate-300">Get help with your account, payments, and predictions</p>
        </div>

        {/* Quick Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 border-emerald-500/30 p-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Live Chat</h3>
                <p className="text-slate-300 text-sm">Get instant help</p>
              </div>
            </div>
            <p className="text-slate-300 text-sm mb-4">Available 24/7 for VIP members</p>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">Start Chat</Button>
          </Card>

          <Card className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-500/30 p-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Phone className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Phone Support</h3>
                <p className="text-slate-300 text-sm">Call us directly</p>
              </div>
            </div>
            <p className="text-slate-300 text-sm mb-4">+254 700 123 456</p>
            <Button variant="outline" className="w-full border-blue-500 text-blue-400 hover:bg-blue-500/10">
              Call Now
            </Button>
          </Card>

          <Card className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/30 p-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Email Support</h3>
                <p className="text-slate-300 text-sm">Send us a message</p>
              </div>
            </div>
            <p className="text-slate-300 text-sm mb-4">support@aitipster.com</p>
            <Button variant="outline" className="w-full border-purple-500 text-purple-400 hover:bg-purple-500/10">
              Send Email
            </Button>
          </Card>
        </div>

        <Tabs defaultValue="faq" className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700 grid w-full grid-cols-4">
            <TabsTrigger value="faq" className="data-[state=active]:bg-emerald-600">
              FAQ
            </TabsTrigger>
            <TabsTrigger value="tickets" className="data-[state=active]:bg-emerald-600">
              My Tickets
            </TabsTrigger>
            <TabsTrigger value="contact" className="data-[state=active]:bg-emerald-600">
              Contact Us
            </TabsTrigger>
            <TabsTrigger value="resources" className="data-[state=active]:bg-emerald-600">
              Resources
            </TabsTrigger>
          </TabsList>

          {/* FAQ Section */}
          <TabsContent value="faq">
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="flex items-center space-x-4 mb-6">
                <Book className="w-6 h-6 text-emerald-400" />
                <h2 className="text-xl font-semibold text-white">Frequently Asked Questions</h2>
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search FAQs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div className="space-y-4">
                {filteredFaqs.map((faq, index) => (
                  <Card key={index} className="bg-slate-700/50 border-slate-600 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-white font-medium">{faq.question}</h3>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                        {faq.category}
                      </Badge>
                    </div>
                    <p className="text-slate-300 text-sm">{faq.answer}</p>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Support Tickets */}
          <TabsContent value="tickets">
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <AlertCircle className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-xl font-semibold text-white">Support Tickets</h2>
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">New Ticket</Button>
              </div>

              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <Card key={ticket.id} className="bg-slate-700/50 border-slate-600 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-emerald-400 font-mono text-sm">{ticket.id}</span>
                        <h3 className="text-white font-medium">{ticket.subject}</h3>
                      </div>
                      <Badge
                        className={`${
                          ticket.status === "Open"
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : ticket.status === "In Progress"
                              ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                              : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {ticket.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>Created: {ticket.date}</span>
                      <span>Last update: {ticket.lastUpdate}</span>
                      <Badge variant="outline" className="border-slate-600 text-slate-400">
                        {ticket.priority} Priority
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Contact Form */}
          <TabsContent value="contact">
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="flex items-center space-x-4 mb-6">
                <Send className="w-6 h-6 text-emerald-400" />
                <h2 className="text-xl font-semibold text-white">Contact Support</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-slate-300">
                      Full Name
                    </Label>
                    <Input
                      id="name"
                      defaultValue="James Kiprotich"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-slate-300">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      defaultValue="james.kiprotich@email.com"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject" className="text-slate-300">
                      Subject
                    </Label>
                    <Input
                      id="subject"
                      placeholder="Brief description of your issue"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="priority" className="text-slate-300">
                      Priority
                    </Label>
                    <Input id="priority" defaultValue="Medium" className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                  <div>
                    <Label htmlFor="category" className="text-slate-300">
                      Category
                    </Label>
                    <Input
                      id="category"
                      placeholder="e.g., Payment, Technical, Account"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="message" className="text-slate-300">
                      Message
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="Describe your issue in detail..."
                      className="bg-slate-700 border-slate-600 text-white h-20"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Resources */}
          <TabsContent value="resources">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700 p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <Video className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-white">Video Tutorials</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Getting Started Guide</span>
                    <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300">
                      Watch
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Understanding Predictions</span>
                    <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300">
                      Watch
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Payment Methods</span>
                    <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300">
                      Watch
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700 p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <Download className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-white">Downloads</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">User Manual (PDF)</span>
                    <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300">
                      Download
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Betting Guide</span>
                    <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300">
                      Download
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Mobile App</span>
                    <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300">
                      Download
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Customer Satisfaction */}
            <Card className="bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 border-emerald-500/30 p-6 mt-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">Rate Your Experience</h3>
                <p className="text-slate-300 mb-4">How satisfied are you with our support?</p>
                <div className="flex justify-center space-x-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className="w-6 h-6 text-yellow-400 fill-current cursor-pointer hover:scale-110 transition-transform"
                    />
                  ))}
                </div>
                <Button variant="outline" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/10">
                  Submit Feedback
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
