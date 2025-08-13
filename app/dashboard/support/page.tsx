"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Search, Book, Send, Plus, MessageCircle, Clock, CheckCircle, XCircle, Star, Zap, Shield, Users, Headphones } from "lucide-react"

// Types for support tickets
interface SupportTicket {
  id: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  tags: string[]
  responses: SupportTicketResponse[]
}

interface SupportTicketResponse {
  id: string
  message: string
  isStaff: boolean
  createdAt: string
  user: {
    id: string
    fullName: string
    email: string
    role: string
  }
}

export default function SupportPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    priority: "Medium",
    category: "",
    message: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")

  // Ticket states
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    description: "",
    category: "",
    priority: "Medium",
    tags: [] as string[]
  })
  const [submittingTicket, setSubmittingTicket] = useState(false)
  const [ticketSubmitStatus, setTicketSubmitStatus] = useState<"idle" | "success" | "error">("idle")
  
  // Response states
  const [responseForms, setResponseForms] = useState<Record<string, string>>({})
  const [submittingResponse, setSubmittingResponse] = useState(false)
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set())

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

  // Load tickets on component mount
  useEffect(() => {
    loadTickets()
  }, [])

  const loadTickets = async () => {
    try {
      setLoadingTickets(true)
      const response = await fetch('/api/support/tickets')
      const result = await response.json()
      
      if (response.ok) {
        // Handle both old and new API response formats
        if (result.tickets) {
          setTickets(result.tickets || [])
        } else if (result.data) {
          setTickets(result.data || [])
        } else {
          setTickets([])
        }
      } else {
        console.error('Failed to load tickets:', result.error)
        setTickets([])
      }
    } catch (error) {
      console.error('Error loading tickets:', error)
      setTickets([])
    } finally {
      setLoadingTickets(false)
    }
  }

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus("idle")

    try {
      // Send the support request to our API
      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactForm)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setSubmitStatus("success")
        
        // Reset form after successful submission
        setContactForm({
          name: "",
          email: "",
          subject: "",
          priority: "Medium",
          category: "",
          message: ""
        })
      } else {
        setSubmitStatus("error")
        console.error('Support request failed:', result.error)
      }
    } catch (error) {
      setSubmitStatus("error")
      console.error('Error submitting support request:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setContactForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingTicket(true)
    setTicketSubmitStatus("idle")

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ticketForm)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Set success status
        setTicketSubmitStatus("success")
        
        // Reset form and hide ticket form
        setTicketForm({
          subject: "",
          description: "",
          category: "",
          priority: "Medium",
          tags: []
        })
        setShowTicketForm(false)
        
        // Reload tickets to show the new one
        await loadTickets()
        
        // Clear success message after 3 seconds
        setTimeout(() => setTicketSubmitStatus("idle"), 3000)
      } else {
        setTicketSubmitStatus("error")
        console.error('Failed to create ticket:', result.error)
      }
    } catch (error) {
      setTicketSubmitStatus("error")
      console.error('Error creating ticket:', error)
    } finally {
      setSubmittingTicket(false)
    }
  }

  const handleTicketInputChange = (field: string, value: string | string[]) => {
    setTicketForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddResponse = async (ticketId: string) => {
    if (!responseForms[ticketId]?.trim()) return
    
    setSubmittingResponse(true)
    
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: responseForms[ticketId] })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Clear response form for the specific ticket
        setResponseForms(prev => ({ ...prev, [ticketId]: "" }))
        
        // Instead of reloading all tickets, just add the new response to the current state
        const newResponse = result.response
        setTickets(prevTickets => 
          prevTickets.map(ticket => 
            ticket.id === ticketId 
              ? {
                  ...ticket,
                  responses: [...(ticket.responses || []), newResponse],
                  updatedAt: new Date().toISOString()
                }
              : ticket
          )
        )
        
        // Keep the ticket expanded
        setExpandedTickets(prev => new Set(prev).add(ticketId))
      } else {
        console.error('Failed to add response:', result.error)
        alert(`Failed to add response: ${result.error}`)
      }
    } catch (error) {
      console.error('Error adding response:', error)
      alert('Error adding response. Please try again.')
    } finally {
      setSubmittingResponse(false)
    }
  }

  const toggleTicketExpansion = (ticketId: string) => {
    setExpandedTickets(prev => {
      const newSet = new Set(prev)
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId)
      } else {
        newSet.add(ticketId)
      }
      return newSet
    })
  }

  const handleResponseInputChange = (ticketId: string, value: string) => {
    setResponseForms(prev => ({ ...prev, [ticketId]: value }))
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30'
      case 'in_progress':
        return 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border-yellow-500/30'
      case 'resolved':
        return 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-400 border-emerald-500/30'
      case 'closed':
        return 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 text-gray-400 border-gray-500/30'
      default:
        return 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-400 border-red-500/30'
      case 'high':
        return 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border-orange-500/30'
      case 'medium':
        return 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border-yellow-500/30'
      case 'low':
        return 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-emerald-400 border-emerald-500/30'
      default:
        return 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else if (diffInHours < 48) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10"></div>
        <div className="relative px-6 py-12 text-center">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-center mb-6">
              <div className="p-3 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl mr-4">
                <Headphones className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Support Center
              </h1>
            </div>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Get help with your account, payments, predictions, and more. Our support team is here to assist you 24/7.
            </p>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-emerald-400">{tickets.filter(t => t.status === 'resolved').length}</div>
                <div className="text-slate-400 text-sm">Resolved Tickets</div>
              </div>
              
              <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Clock className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-blue-400">{tickets.filter(t => t.status === 'open').length}</div>
                <div className="text-slate-400 text-sm">Open Tickets</div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <MessageCircle className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-purple-400">{tickets.reduce((acc, t) => acc + (t.responses?.length || 0), 0)}</div>
                <div className="text-slate-400 text-sm">Total Responses</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-12">
        <div className="mx-auto max-w-7xl">
          <Tabs defaultValue="faq" className="space-y-8">
            {/* Enhanced Tabs Header */}
            <div className="flex flex-col items-center">
              <TabsList className="grid w-full max-w-2xl grid-cols-3 bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600/30 backdrop-blur-sm">
                <TabsTrigger 
                  value="faq" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-emerald-600/20 data-[state=active]:border-emerald-500/30 data-[state=active]:text-emerald-400 transition-all duration-300"
                >
                  <Book className="w-4 h-4 mr-2" />
                  FAQ
                </TabsTrigger>
                <TabsTrigger 
                  value="tickets" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-blue-600/20 data-[state=active]:border-blue-500/30 data-[state=active]:text-blue-400 transition-all duration-300"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  My Tickets
                </TabsTrigger>
                <TabsTrigger 
                  value="contact" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/20 data-[state=active]:to-purple-600/20 data-[state=active]:border-purple-500/30 data-[state=active]:text-purple-400 transition-all duration-300"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Contact Us
                </TabsTrigger>
              </TabsList>
            </div>

            {/* FAQ Tab */}
            <TabsContent value="faq" className="space-y-6">
              <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 border-slate-600/30 backdrop-blur-sm p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Frequently Asked Questions</h2>
                    <p className="text-slate-400">Find answers to common questions about our platform</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <Input
                      placeholder="Search FAQ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-slate-700/50 border-slate-600/30 text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                <div className="grid gap-6">
                  {filteredFaqs.map((faq, index) => (
                    <div
                      key={index}
                      className="group bg-gradient-to-r from-slate-700/30 to-slate-600/30 border border-slate-600/20 rounded-xl p-6 hover:from-slate-700/50 hover:to-slate-600/50 hover:border-slate-500/40 transition-all duration-300 cursor-pointer transform hover:scale-[1.02]"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-3">
                            <div className="p-2 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 rounded-lg mr-3">
                              <Star className="w-4 h-4 text-emerald-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                              {faq.question}
                            </h3>
                          </div>
                          <p className="text-slate-300 leading-relaxed">{faq.answer}</p>
                        </div>
                        <Badge className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-400 border-blue-500/30 text-xs px-3 py-1">
                          {faq.category}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            {/* Tickets Tab */}
            <TabsContent value="tickets" className="space-y-6">
              <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 border-slate-600/30 backdrop-blur-sm p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Support Tickets</h2>
                    <p className="text-slate-400">Track and manage your support requests</p>
                  </div>
                  <Button
                    onClick={() => setShowTicketForm(!showTicketForm)}
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-emerald-500/25"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    New Ticket
                  </Button>
                </div>

                {/* New Ticket Form */}
                {showTicketForm && (
                  <Card className="bg-gradient-to-r from-slate-700/50 to-slate-600/50 border-slate-500/30 mb-8 p-6 backdrop-blur-sm">
                    <h3 className="text-xl font-semibold text-white mb-4">Create New Support Ticket</h3>
                    <form onSubmit={handleTicketSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="ticket-subject" className="text-slate-300">Subject *</Label>
                          <Input
                            id="ticket-subject"
                            value={ticketForm.subject}
                            onChange={(e) => handleTicketInputChange("subject", e.target.value)}
                            required
                            className="bg-slate-600/50 border-slate-500/30 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                            placeholder="Brief description of your issue"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ticket-category" className="text-slate-300">Category *</Label>
                          <select
                            id="ticket-category"
                            value={ticketForm.category}
                            onChange={(e) => handleTicketInputChange("category", e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500/30 text-white rounded-md focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                          >
                            <option value="">Select category</option>
                            <option value="Technical">Technical Issue</option>
                            <option value="Billing">Billing & Payment</option>
                            <option value="Account">Account & Access</option>
                            <option value="Feature">Feature Request</option>
                            <option value="General">General Inquiry</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="ticket-description" className="text-slate-300">Description *</Label>
                        <Textarea
                          id="ticket-description"
                          value={ticketForm.description}
                          onChange={(e) => handleTicketInputChange("description", e.target.value)}
                          required
                          className="bg-slate-600/50 border-slate-500/30 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 min-h-[100px]"
                          placeholder="Describe your issue in detail..."
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <Label htmlFor="ticket-priority" className="text-slate-300">Priority</Label>
                            <select
                              id="ticket-priority"
                              value={ticketForm.priority}
                              onChange={(e) => handleTicketInputChange("priority", e.target.value)}
                              className="px-3 py-2 bg-slate-600/50 border border-slate-500/30 text-white rounded-md focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                            >
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                              <option value="Urgent">Urgent</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex space-x-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowTicketForm(false)}
                            className="border-slate-500/30 text-slate-400 hover:bg-slate-600/50"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={submittingTicket}
                            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6"
                          >
                            {submittingTicket ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Creating...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Create Ticket
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </Card>
                )}

                {/* Status Messages */}
                {ticketSubmitStatus === "success" && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-xl">
                    <p className="text-emerald-400 text-center flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      ✅ Ticket created successfully! We'll get back to you soon.
                    </p>
                  </div>
                )}

                {ticketSubmitStatus === "error" && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 rounded-xl">
                    <p className="text-red-400 text-center flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      ❌ Failed to create ticket. Please try again.
                    </p>
                  </div>
                )}

                {/* Tickets List */}
                {loadingTickets ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading your tickets...</p>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="p-4 bg-gradient-to-r from-slate-700/30 to-slate-600/30 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <MessageCircle className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">No tickets yet</h3>
                    <p className="text-slate-400 mb-6">Create your first support ticket to get started</p>
                    <Button
                      onClick={() => setShowTicketForm(true)}
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Ticket
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tickets.map((ticket) => (
                      <Card
                        key={ticket.id}
                        className="bg-gradient-to-r from-slate-700/30 to-slate-600/30 border border-slate-600/20 hover:border-slate-500/40 transition-all duration-300 overflow-hidden"
                      >
                        <div className="p-6">
                          {/* Ticket Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h3 className="text-lg font-semibold text-white hover:text-emerald-400 transition-colors cursor-pointer">
                                  {ticket.subject}
                                </h3>
                                <Badge className={getStatusColor(ticket.status)}>
                                  {ticket.status.replace('_', ' ').toUpperCase()}
                                </Badge>
                                <Badge className={getPriorityColor(ticket.priority)}>
                                  {ticket.priority}
                                </Badge>
                              </div>
                              <p className="text-slate-400 text-sm mb-3">{ticket.description}</p>
                              <div className="flex items-center space-x-4 text-xs text-slate-500">
                                <span className="flex items-center">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {formatDate(ticket.createdAt)}
                                </span>
                                <span className="flex items-center">
                                  <MessageCircle className="w-3 h-3 mr-1" />
                                  {(ticket.responses?.length || 0)} responses
                                </span>
                                <span className="flex items-center">
                                  <Shield className="w-3 h-3 mr-1" />
                                  {ticket.category}
                                </span>
                              </div>
                            </div>
                            <Button
                              onClick={() => toggleTicketExpansion(ticket.id)}
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-white hover:bg-slate-600/50"
                            >
                              {expandedTickets.has(ticket.id) ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <MessageCircle className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          
                          {/* Expanded Content */}
                          {expandedTickets.has(ticket.id) && (
                            <div className="border-t border-slate-600/30 pt-6 space-y-6">
                              {/* Responses Section */}
                              <div>
                                <h4 className="text-white font-semibold mb-4 flex items-center">
                                  <MessageCircle className="w-5 h-5 mr-2 text-emerald-400" />
                                  Conversation
                                </h4>
                                
                                {/* Show existing responses */}
                                {(ticket.responses?.length || 0) > 0 ? (
                                  <div className="space-y-4 mb-6">
                                    {ticket.responses?.map((response) => (
                                      <div key={response.id} className={`p-4 rounded-xl ${
                                        response.isStaff 
                                          ? 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20' 
                                          : 'bg-gradient-to-r from-slate-700/50 to-slate-600/50 border border-slate-600/30'
                                      }`}>
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="flex items-center space-x-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                              response.isStaff 
                                                ? 'bg-gradient-to-r from-blue-500 to-cyan-500' 
                                                : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                                            }`}>
                                              <Users className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                              <span className="text-sm font-medium text-white">
                                                {response.user?.fullName || 'Unknown User'}
                                              </span>
                                              <div className="text-xs text-slate-400">
                                                {response.isStaff ? 'Support Staff' : 'User'}
                                              </div>
                                            </div>
                                          </div>
                                          <span className="text-xs text-slate-400">
                                            {formatDate(response.createdAt)}
                                          </span>
                                        </div>
                                        <p className="text-slate-300 text-sm leading-relaxed">{response.message}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-8 bg-gradient-to-r from-slate-700/30 to-slate-600/30 rounded-xl border border-slate-600/20">
                                    <MessageCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                                    <p className="text-slate-400 text-sm">No responses yet. Start the conversation below.</p>
                                  </div>
                                )}
                                
                                {/* Add Response Form */}
                                {ticket.status !== 'closed' && (
                                  <div className="bg-gradient-to-r from-slate-700/50 to-slate-600/50 border border-slate-600/30 rounded-xl p-4">
                                    <div className="flex items-start space-x-3">
                                      <div className="flex-1">
                                        <Textarea
                                          value={responseForms[ticket.id] || ""}
                                          onChange={(e) => handleResponseInputChange(ticket.id, e.target.value)}
                                          placeholder="Type your message..."
                                          className="bg-slate-600/50 border-slate-500/30 text-white min-h-[80px] resize-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                                          disabled={submittingResponse}
                                        />
                                      </div>
                                      <Button
                                        onClick={() => handleAddResponse(ticket.id)}
                                        disabled={submittingResponse || !responseForms[ticket.id]?.trim()}
                                        className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-2 rounded-xl transition-all duration-300 transform hover:scale-105"
                                      >
                                        {submittingResponse ? (
                                          <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Sending...
                                          </>
                                        ) : (
                                          <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Send
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Ticket Actions */}
                              <div className="flex justify-between items-center pt-4 border-t border-slate-600/30">
                                <div className="text-sm text-slate-400">
                                  <span className="flex items-center">
                                    <Clock className="w-4 h-4 mr-2" />
                                    Ticket created: {formatDate(ticket.createdAt)}
                                  </span>
                                  {ticket.updatedAt !== ticket.createdAt && (
                                    <span className="flex items-center ml-4">
                                      <Zap className="w-4 h-4 mr-2" />
                                      Last updated: {formatDate(ticket.updatedAt)}
                                    </span>
                                  )}
                                </div>
                                
                                {ticket.status !== 'closed' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all duration-300"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Close Ticket
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Contact Form Tab */}
            <TabsContent value="contact" className="space-y-6">
              <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 border-slate-600/30 backdrop-blur-sm p-8">
                <div className="text-center mb-8">
                  <div className="p-4 bg-gradient-to-r from-purple-500/20 to-purple-600/20 rounded-2xl w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <Send className="w-10 h-10 text-purple-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">Contact Support</h2>
                  <p className="text-slate-400 max-w-2xl mx-auto">
                    Need immediate assistance? Send us a message and we'll get back to you as soon as possible.
                  </p>
                </div>

                {/* Status Messages */}
                {submitStatus === "success" && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-xl">
                    <p className="text-emerald-400 text-center flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      ✅ Your message has been sent successfully! We'll respond within 24 hours.
                    </p>
                  </div>
                )}

                {submitStatus === "error" && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 rounded-xl">
                    <p className="text-red-400 text-center flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      ❌ There was an error sending your message. Please check your internet connection and try again. If the problem persists, please contact us directly at obadiah.kimani@snapbet.bet
                    </p>
                  </div>
                )}

                <form onSubmit={handleContactSubmit} className="max-w-4xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <Label htmlFor="name" className="text-slate-300 font-medium">
                        Full Name *
                      </Label>
                      <Input
                        id="name"
                        value={contactForm.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        required
                        className="bg-slate-700/50 border-slate-600/30 text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-slate-300 font-medium">
                        Email Address *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={contactForm.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        required
                        className="bg-slate-700/50 border-slate-600/30 text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300"
                        placeholder="Enter your email address"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <Label htmlFor="subject" className="text-slate-300 font-medium">
                        Subject *
                      </Label>
                      <Input
                        id="subject"
                        value={contactForm.subject}
                        onChange={(e) => handleInputChange("subject", e.target.value)}
                        required
                        className="bg-slate-700/50 border-slate-600/30 text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300"
                        placeholder="Brief description of your issue"
                      />
                    </div>
                    <div>
                      <Label htmlFor="priority" className="text-slate-300 font-medium">
                        Priority
                      </Label>
                      <select
                        id="priority"
                        value={contactForm.priority}
                        onChange={(e) => handleInputChange("priority", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/30 text-white rounded-lg focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-6">
                    <Label htmlFor="category" className="text-slate-300 font-medium">
                      Category
                    </Label>
                    <select
                      id="category"
                      value={contactForm.category}
                      onChange={(e) => handleInputChange("category", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/30 text-white rounded-lg focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300"
                    >
                      <option value="">Select a category</option>
                      <option value="Technical">Technical Issue</option>
                      <option value="Billing">Billing & Payment</option>
                      <option value="Account">Account & Access</option>
                      <option value="Feature">Feature Request</option>
                      <option value="General">General Inquiry</option>
                    </select>
                  </div>

                  <div className="mb-8">
                    <Label htmlFor="message" className="text-slate-300 font-medium">
                      Message *
                    </Label>
                    <Textarea
                      id="message"
                      value={contactForm.message}
                      onChange={(e) => handleInputChange("message", e.target.value)}
                      required
                      className="bg-slate-700/50 border-slate-600/30 text-white h-32 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300"
                      placeholder="Describe your issue in detail..."
                    />
                  </div>

                  <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                    <p className="text-slate-400 text-sm">
                      Your message will be sent to our support team
                    </p>
                    <Button 
                      type="submit" 
                      className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-8 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-purple-500/25"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
