"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Edit, Trash2, Search, GiftIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import * as LucideIcons from "lucide-react"

// Matches structure in components/dashboard/personalized-offers.tsx
type PersonalizedOfferAdmin = {
  id: string
  name: string
  price: string
  originalPrice?: string
  description: string
  features: string[]
  type: "package" | "tip" // Or other types
  discountPercentage?: number
  timeLeft?: string // Or expiry date/time
  maxClaims?: number
  reason?: string // e.g., "First-time user bonus"
  isUrgent?: boolean
  iconName: keyof typeof LucideIcons
  gradientFrom?: string
  gradientTo?: string
  isActive: boolean
  displayOrder: number
  // claimedCount: number; // This would likely be read-only from system
  createdAt: string
  updatedAt: string
}

const initialPersonalizedOffers: PersonalizedOfferAdmin[] = [
  {
    id: "po-newcomer",
    name: "Newcomer Special",
    price: "200",
    originalPrice: "400",
    description: "Perfect starter package for new users",
    features: ["5 Premium Tips", "Beginner Guide", "Email Support", "7-Day Trial"],
    type: "package",
    discountPercentage: 50,
    timeLeft: "23h 45m",
    maxClaims: 100,
    reason: "First-time user bonus",
    iconName: "Gift",
    gradientFrom: "from-purple-500",
    gradientTo: "to-pink-500",
    isActive: true,
    displayOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "po-loyalty",
    name: "Loyalty Reward",
    price: "300",
    originalPrice: "600",
    description: "Thank you for being a valued customer",
    features: ["Weekend Package", "VIP Chat Access", "Bonus Tips", "Priority Support"],
    type: "package",
    discountPercentage: 50,
    timeLeft: "2d 12h",
    maxClaims: 50,
    reason: "Active user for 30+ days",
    iconName: "Star",
    isActive: true,
    displayOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const IconRenderer = ({ name, className }: { name: keyof typeof LucideIcons; className?: string }) => {
  const IconComponent = LucideIcons[name] as React.ElementType
  if (!IconComponent) return <LucideIcons.HelpCircle className={className} />
  return <IconComponent className={className} />
}

export function AdminPersonalizedOffersManagement() {
  const [offers, setOffers] = useState<PersonalizedOfferAdmin[]>(initialPersonalizedOffers)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOffer, setEditingOffer] = useState<PersonalizedOfferAdmin | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const handleAddNew = () => {
    setEditingOffer(null)
    setIsModalOpen(true)
  }

  const handleEdit = (offer: PersonalizedOfferAdmin) => {
    setEditingOffer(offer)
    setIsModalOpen(true)
  }

  const handleDelete = (offerId: string) => {
    setOffers(offers.filter((o) => o.id !== offerId))
  }

  const handleSaveOffer = (formData: PersonalizedOfferAdmin) => {
    if (editingOffer) {
      setOffers(
        offers.map((o) =>
          o.id === editingOffer.id ? { ...formData, id: o.id, updatedAt: new Date().toISOString() } : o,
        ),
      )
    } else {
      setOffers([
        ...offers,
        {
          ...formData,
          id: `po-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    }
    setIsModalOpen(false)
    setEditingOffer(null)
  }

  const filteredOffers = useMemo(() => {
    return offers
      .filter((o) => o.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }, [offers, searchTerm])

  const PersonalizedOfferForm = ({
    isOpen,
    onClose,
    onSave,
    initialData,
  }: {
    isOpen: boolean
    onClose: () => void
    onSave: (data: PersonalizedOfferAdmin) => void
    initialData: PersonalizedOfferAdmin | null
  }) => {
    const [formData, setFormData] = useState<Partial<PersonalizedOfferAdmin>>(
      initialData || {
        type: "package",
        isActive: true,
        displayOrder: (offers.length + 1) * 10,
        iconName: "Gift",
        features: [],
      },
    )

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target
      if (type === "checkbox") {
        setFormData({ ...formData, [name]: (e.target as HTMLInputElement).checked })
      } else if (type === "number") {
        setFormData({ ...formData, [name]: Number.parseFloat(value) })
      } else {
        setFormData({ ...formData, [name]: value })
      }
    }

    const handleSelectChange = (name: string, value: string) => {
      setFormData({ ...formData, [name]: value })
    }

    const handleFeaturesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setFormData({ ...formData, features: e.target.value.split("\n") })
    }

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      if (!formData.name || !formData.price || !formData.iconName) {
        alert("Name, Price, and Icon Name are required.")
        return
      }
      onSave(formData as PersonalizedOfferAdmin)
    }

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-purple-400">
              {initialData ? "Edit Personalized Offer" : "Add New Personalized Offer"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 text-sm">
            {/* Form fields similar to QuickPurchaseForm, adapted for PersonalizedOfferAdmin */}
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" value={formData.name || ""} onChange={handleChange} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="price">Price</Label>
                <Input id="price" name="price" value={formData.price || ""} onChange={handleChange} required />
              </div>
              <div>
                <Label htmlFor="originalPrice">Original Price</Label>
                <Input
                  id="originalPrice"
                  name="originalPrice"
                  value={formData.originalPrice || ""}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" value={formData.description || ""} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="features">Features (One per line)</Label>
              <Textarea
                id="features"
                name="features"
                value={formData.features?.join("\n") || ""}
                onChange={handleFeaturesChange}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select name="type" value={formData.type} onValueChange={(v) => handleSelectChange("type", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="package">Package</SelectItem>
                    <SelectItem value="tip">Tip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="iconName">Icon Name (Lucide)</Label>
                <Select
                  name="iconName"
                  value={formData.iconName}
                  onValueChange={(v) => handleSelectChange("iconName", v as keyof typeof LucideIcons)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Icon" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Object.keys(LucideIcons)
                      .filter((key) => !key.includes(""))
                      .sort()
                      .map((iconKey) => (
                        <SelectItem key={iconKey} value={iconKey}>
                          <div className="flex items-center">
                            <IconRenderer name={iconKey as keyof typeof LucideIcons} className="w-4 h-4 mr-2" />
                            {iconKey}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="discountPercentage">Discount %</Label>
                <Input
                  id="discountPercentage"
                  name="discountPercentage"
                  type="number"
                  value={formData.discountPercentage || ""}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="timeLeft">Time Left (e.g., 2d 12h)</Label>
                <Input id="timeLeft" name="timeLeft" value={formData.timeLeft || ""} onChange={handleChange} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="maxClaims">Max Claims</Label>
                <Input
                  id="maxClaims"
                  name="maxClaims"
                  type="number"
                  value={formData.maxClaims || ""}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="reason">Reason for Offer</Label>
                <Input id="reason" name="reason" value={formData.reason || ""} onChange={handleChange} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gradientFrom">Gradient From</Label>
                <Input
                  id="gradientFrom"
                  name="gradientFrom"
                  value={formData.gradientFrom || ""}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="gradientTo">Gradient To</Label>
                <Input id="gradientTo" name="gradientTo" value={formData.gradientTo || ""} onChange={handleChange} />
              </div>
            </div>
            <div>
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                name="displayOrder"
                type="number"
                value={formData.displayOrder || 0}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isUrgent"
                  name="isUrgent"
                  checked={!!formData.isUrgent}
                  onCheckedChange={(c) => setFormData({ ...formData, isUrgent: !!c })}
                />
                <Label htmlFor="isUrgent">Is Urgent?</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  name="isActive"
                  checked={!!formData.isActive}
                  onCheckedChange={(c) => setFormData({ ...formData, isActive: !!c })}
                />
                <Label htmlFor="isActive">Is Active?</Label>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                Save Offer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 text-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-bold text-purple-400 flex items-center">
          <GiftIcon className="w-5 h-5 mr-2 text-purple-500" />
          Personalized Offers Management
        </CardTitle>
        <Button onClick={handleAddNew} className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
          <PlusCircle className="w-4 h-4 mr-1" /> Add New
        </Button>
      </CardHeader>
      <CardContent>
        <div className="relative w-full max-w-xs mb-4">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search offers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-sm"
          />
        </div>
        <div className="overflow-x-auto rounded-md border border-slate-700">
          <Table className="text-xs">
            <TableHeader className="bg-slate-900/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOffers.map((offer) => (
                <TableRow key={offer.id} className="hover:bg-slate-700/30">
                  <TableCell className="font-medium">
                    {offer.name} <IconRenderer name={offer.iconName} className="w-3 h-3 inline ml-1" />
                  </TableCell>
                  <TableCell>
                    {offer.price}
                    {offer.originalPrice && (
                      <span className="line-through text-slate-500 ml-1 text-xs">{offer.originalPrice}</span>
                    )}
                  </TableCell>
                  <TableCell>{offer.discountPercentage ? `${offer.discountPercentage}%` : "-"}</TableCell>
                  <TableCell>
                    {offer.isActive ? (
                      <Badge className="bg-green-500/20 text-green-400 text-xs">Active</Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-400 text-xs">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>{offer.displayOrder}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(offer)}
                      className="text-purple-400 hover:text-purple-300 mr-1 p-1 h-auto"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(offer.id)}
                      className="text-red-400 hover:text-red-300 p-1 h-auto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {isModalOpen && (
          <PersonalizedOfferForm
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false)
              setEditingOffer(null)
            }}
            onSave={handleSaveOffer}
            initialData={editingOffer}
          />
        )}
      </CardContent>
    </Card>
  )
}
