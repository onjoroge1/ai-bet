"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  AlertCircle, 
  Search, 
  Book, 
  Send, 
  Plus, 
  MessageCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Shield, 
  Users, 
  ChevronDown,
  ChevronUp,
  Mail,
  HelpCircle,
  RefreshCw,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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
        setContactForm({
          name: "",
          email: "",
          subject: "",
          priority: "Medium",
          category: "",
          message: ""
        })
        toast.success("Message sent successfully!")
      } else {
        setSubmitStatus("error")
        toast.error(result.error || "Failed to send message")
      }
    } catch (error) {
      setSubmitStatus("error")
      toast.error("Error sending message. Please try again.")
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
        setTicketSubmitStatus("success")
        setTicketForm({
          subject: "",
          description: "",
          category: "",
          priority: "Medium",
          tags: []
        })
        setShowTicketForm(false)
        await loadTickets()
        toast.success("Ticket created successfully!")
        setTimeout(() => setTicketSubmitStatus("idle"), 3000)
      } else {
        setTicketSubmitStatus("error")
        toast.error(result.error || "Failed to create ticket")
      }
    } catch (error) {
      setTicketSubmitStatus("error")
      toast.error("Error creating ticket. Please try again.")
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
        setResponseForms(prev => ({ ...prev, [ticketId]: "" }))
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
        setExpandedTickets(prev => new Set(prev).add(ticketId))
        toast.success("Response added successfully!")
      } else {
        toast.error(result.error || "Failed to add response")
      }
    } catch (error) {
      toast.error("Error adding response. Please try again.")
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
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'in_progress':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'resolved':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'closed':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
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

  // Stats
  const stats = {
    total: tickets.length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    open: tickets.filter(t => t.status === 'open').length,
    responses: tickets.reduce((acc, t) => acc + (t.responses?.length || 0), 0)
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Support Center</h1>
          <p className="text-slate-400">
            Get help with your account, payments, predictions, and more
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={loadTickets}
            disabled={loadingTickets}
          >
            <RefreshCw className={`w-4 h-4 ${loadingTickets ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Stats Overview ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/60 border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{stats.resolved}</p>
              <p className="text-xs text-slate-500">Resolved</p>
            </div>
          </div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">{stats.open}</p>
              <p className="text-xs text-slate-500">Open</p>
            </div>
          </div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-400">{stats.responses}</p>
              <p className="text-xs text-slate-500">Responses</p>
            </div>
          </div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-400">{stats.total}</p>
              <p className="text-xs text-slate-500">Total Tickets</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <Tabs defaultValue="faq" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-slate-800/60 border-slate-700">
          <TabsTrigger value="faq" className="data-[state=active]:bg-emerald-600">
            <Book className="w-4 h-4 mr-2" />
            FAQ
          </TabsTrigger>
          <TabsTrigger value="tickets" className="data-[state=active]:bg-emerald-600">
            <MessageCircle className="w-4 h-4 mr-2" />
            My Tickets
          </TabsTrigger>
          <TabsTrigger value="contact" className="data-[state=active]:bg-emerald-600">
            <Send className="w-4 h-4 mr-2" />
            Contact
          </TabsTrigger>
        </TabsList>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="space-y-4">
          <Card className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Frequently Asked Questions</h2>
                  <p className="text-slate-400 text-sm">Find answers to common questions</p>
                </div>
                <div className="relative w-full sm:w-auto sm:min-w-[280px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search FAQ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredFaqs.map((faq, index) => (
                  <Card key={index} className="bg-slate-700/30 border-slate-600">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                          <HelpCircle className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <h3 className="text-base font-semibold text-white">
                              {faq.question}
                            </h3>
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs shrink-0">
                              {faq.category}
                            </Badge>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed">{faq.answer}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="space-y-4">
          <Card className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Support Tickets</h2>
                  <p className="text-slate-400 text-sm">Track and manage your support requests</p>
                </div>
                <Button
                  onClick={() => setShowTicketForm(!showTicketForm)}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Ticket
                </Button>
              </div>

              {/* New Ticket Form */}
              {showTicketForm && (
                <Card className="bg-slate-700/30 border-slate-600 mb-6">
                  <CardContent className="p-5">
                    <h3 className="text-lg font-semibold text-white mb-5">Create New Support Ticket</h3>
                    <form onSubmit={handleTicketSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="ticket-subject" className="text-slate-300 mb-2 block text-sm">Subject *</Label>
                          <Input
                            id="ticket-subject"
                            value={ticketForm.subject}
                            onChange={(e) => handleTicketInputChange("subject", e.target.value)}
                            required
                            className="bg-slate-600/50 border-slate-500 text-white"
                            placeholder="Brief description"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ticket-category" className="text-slate-300 mb-2 block text-sm">Category *</Label>
                          <select
                            id="ticket-category"
                            value={ticketForm.category}
                            onChange={(e) => handleTicketInputChange("category", e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 text-white rounded-md"
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
                        <Label htmlFor="ticket-description" className="text-slate-300 mb-2 block text-sm">Description *</Label>
                        <Textarea
                          id="ticket-description"
                          value={ticketForm.description}
                          onChange={(e) => handleTicketInputChange("description", e.target.value)}
                          required
                          className="bg-slate-600/50 border-slate-500 text-white min-h-[100px] resize-none"
                          placeholder="Describe your issue..."
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <Label htmlFor="ticket-priority" className="text-slate-300 mb-2 block text-sm">Priority</Label>
                          <select
                            id="ticket-priority"
                            value={ticketForm.priority}
                            onChange={(e) => handleTicketInputChange("priority", e.target.value)}
                            className="px-3 py-2 bg-slate-600/50 border border-slate-500 text-white rounded-md"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowTicketForm(false)}
                            className="border-slate-600 text-slate-300"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={submittingTicket}
                            className="bg-emerald-600 hover:bg-emerald-500"
                          >
                            {submittingTicket ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                  </CardContent>
                </Card>
              )}

              {/* Status Messages */}
              {ticketSubmitStatus === "success" && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <p className="text-emerald-400 text-sm flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Ticket created successfully!
                  </p>
                </div>
              )}

              {ticketSubmitStatus === "error" && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Failed to create ticket. Please try again.
                  </p>
                </div>
              )}

              {/* Tickets List */}
              {loadingTickets ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  <p className="ml-3 text-slate-400">Loading tickets...</p>
                </div>
              ) : tickets.length === 0 ? (
                <Card className="bg-slate-800/60 border-slate-700 p-12 text-center">
                  <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No tickets yet</h3>
                  <p className="text-slate-400 text-sm mb-4">Create your first support ticket to get started</p>
                  <Button
                    onClick={() => setShowTicketForm(true)}
                    className="bg-emerald-600 hover:bg-emerald-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Ticket
                  </Button>
                </Card>
              ) : (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <Card
                      key={ticket.id}
                      className="bg-slate-800/60 border-slate-700"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="text-base font-semibold text-white">
                                {ticket.subject}
                              </h3>
                              <Badge className={getStatusColor(ticket.status)}>
                                {ticket.status.replace('_', ' ').toUpperCase()}
                              </Badge>
                              <Badge className={getPriorityColor(ticket.priority)}>
                                {ticket.priority}
                              </Badge>
                            </div>
                            <p className="text-slate-300 text-sm mb-3 line-clamp-2">{ticket.description}</p>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(ticket.createdAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="w-3 h-3" />
                                {(ticket.responses?.length || 0)} responses
                              </span>
                              <span className="flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                {ticket.category}
                              </span>
                            </div>
                          </div>
                          <Button
                            onClick={() => toggleTicketExpansion(ticket.id)}
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-white shrink-0"
                          >
                            {expandedTickets.has(ticket.id) ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        
                        {/* Expanded Content */}
                        {expandedTickets.has(ticket.id) && (
                          <div className="border-t border-slate-700 pt-5 space-y-5 mt-5">
                            <div>
                              <h4 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm">
                                <MessageCircle className="w-4 h-4 text-emerald-400" />
                                Conversation
                              </h4>
                              
                              {(ticket.responses?.length || 0) > 0 ? (
                                <div className="space-y-3 mb-5">
                                  {ticket.responses?.map((response) => (
                                    <div 
                                      key={response.id} 
                                      className={cn(
                                        "p-3 rounded-lg border",
                                        response.isStaff 
                                          ? 'bg-blue-500/10 border-blue-500/20' 
                                          : 'bg-slate-700/50 border-slate-600'
                                      )}
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <div className={cn(
                                            "w-7 h-7 rounded-full flex items-center justify-center",
                                            response.isStaff 
                                              ? 'bg-blue-500' 
                                              : 'bg-emerald-500'
                                          )}>
                                            <Users className="w-3.5 h-3.5 text-white" />
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
                                <div className="text-center py-6 bg-slate-700/30 rounded-lg border border-slate-600 mb-5">
                                  <MessageCircle className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                                  <p className="text-slate-400 text-sm">No responses yet. Start the conversation below.</p>
                                </div>
                              )}
                              
                              {ticket.status !== 'closed' && (
                                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                                    <div className="flex-1 w-full">
                                      <Textarea
                                        value={responseForms[ticket.id] || ""}
                                        onChange={(e) => handleResponseInputChange(ticket.id, e.target.value)}
                                        placeholder="Type your message..."
                                        className="bg-slate-600/50 border-slate-500 text-white min-h-[70px] resize-none"
                                        disabled={submittingResponse}
                                      />
                                    </div>
                                    <Button
                                      onClick={() => handleAddResponse(ticket.id)}
                                      disabled={submittingResponse || !responseForms[ticket.id]?.trim()}
                                      className="bg-emerald-600 hover:bg-emerald-500 shrink-0"
                                    >
                                      {submittingResponse ? (
                                        <>
                                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Form Tab */}
        <TabsContent value="contact" className="space-y-4">
          <Card className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center mb-3">
                  <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <Mail className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Contact Support</h2>
                <p className="text-slate-400 text-sm">
                  Need immediate assistance? Send us a message and we'll get back to you as soon as possible.
                </p>
              </div>

              {/* Status Messages */}
              {submitStatus === "success" && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <p className="text-emerald-400 text-sm flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Your message has been sent successfully!
                  </p>
                </div>
              )}

              {submitStatus === "error" && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Error sending message. Please try again or contact obadiah.kimani@snapbet.bet
                  </p>
                </div>
              )}

              <form onSubmit={handleContactSubmit} className="max-w-2xl mx-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-slate-300 mb-2 block text-sm">
                      Full Name *
                    </Label>
                    <Input
                      id="name"
                      value={contactForm.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      required
                      className="bg-slate-700/50 border-slate-600 text-white"
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-slate-300 mb-2 block text-sm">
                      Email Address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      required
                      className="bg-slate-700/50 border-slate-600 text-white"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="subject" className="text-slate-300 mb-2 block text-sm">
                      Subject *
                    </Label>
                    <Input
                      id="subject"
                      value={contactForm.subject}
                      onChange={(e) => handleInputChange("subject", e.target.value)}
                      required
                      className="bg-slate-700/50 border-slate-600 text-white"
                      placeholder="Brief description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority" className="text-slate-300 mb-2 block text-sm">
                      Priority
                    </Label>
                    <select
                      id="priority"
                      value={contactForm.priority}
                      onChange={(e) => handleInputChange("priority", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 text-white rounded-md"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="category" className="text-slate-300 mb-2 block text-sm">
                    Category
                  </Label>
                  <select
                    id="category"
                    value={contactForm.category}
                    onChange={(e) => handleInputChange("category", e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 text-white rounded-md"
                  >
                    <option value="">Select a category</option>
                    <option value="Technical">Technical Issue</option>
                    <option value="Billing">Billing & Payment</option>
                    <option value="Account">Account & Access</option>
                    <option value="Feature">Feature Request</option>
                    <option value="General">General Inquiry</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="message" className="text-slate-300 mb-2 block text-sm">
                    Message *
                  </Label>
                  <Textarea
                    id="message"
                    value={contactForm.message}
                    onChange={(e) => handleInputChange("message", e.target.value)}
                    required
                    className="bg-slate-700/50 border-slate-600 text-white h-32 resize-none"
                    placeholder="Describe your issue..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
                  <p className="text-slate-400 text-sm">
                    Your message will be sent to our support team
                  </p>
                  <Button 
                    type="submit" 
                    className="bg-emerald-600 hover:bg-emerald-500 w-full sm:w-auto"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
