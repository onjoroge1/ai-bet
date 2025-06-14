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
import { PlusCircle, Edit, Trash2, Search, ShoppingBag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import * as LucideIcons from "lucide-react" // For dynamic icons

// Matches the structure in components/dashboard/upgrade-offers.tsx
type QuickPurchaseItemAdmin = {
  id: string
  name: string
  price: string // Store as string, assuming base currency (e.g., KES)
  originalPrice?: string
  description: string
  features: string[]
  type: "tip" | "package" | "vip"
  iconName: keyof typeof LucideIcons // Store icon name
  colorGradientFrom: string // e.g., "from-emerald-500"
  colorGradientTo: string // e.g., "to-cyan-500"
  isUrgent?: boolean
  timeLeft?: string // e.g., "2h 15m" or ISO expiry
  isPopular?: boolean
  discountPercentage?: number // e.g., 30 for 30%
  isActive: boolean
  displayOrder: number
  targetLink?: string // e.g., "/dashboard/daily-tips"
  createdAt: string
  updatedAt: string
}

const initialQuickPurchaseItems: QuickPurchaseItemAdmin[] = [
  {
    id: "qp-daily-tip",
    name: "Today's Premium Tip",
    price: "150",
    description: "Arsenal vs Chelsea - Over 2.5 Goals",
    features: ["90% Confidence", "Detailed Analysis", "Live Updates", "Money Back if Wrong"],
    type: "tip",
    iconName: "Zap",
    colorGradientFrom: "from-emerald-500",
    colorGradientTo: "to-cyan-500",
    isUrgent: true,
    timeLeft: "2h 15m",
    isActive: true,
    displayOrder: 1,
    targetLink: "/dashboard/daily-tips",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "qp-weekend-package",
    name: "Weekend Special",
    price: "350",
    originalPrice: "500",
    description: "3 Premium Weekend Picks",
    features: ["Premier League Accumulator", "Expert Analysis", "Live Chat Support", "Profit Guarantee"],
    type: "package",
    iconName: "Gift",
    colorGradientFrom: "from-purple-500",
    colorGradientTo: "to-pink-500",
    isPopular: true,
    discountPercentage: 30,
    isActive: true,
    displayOrder: 2,
    targetLink: "/dashboard/weekend-special",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "qp-vip-monthly",
    name: "VIP Monthly",
    price: "2500",
    originalPrice: "3500",
    description: "Unlimited Premium Access",
    features: ["Unlimited Tips", "VIP Predictions", "Personal Advisor", "Video Analysis"],
    type: "vip",
    iconName: "Crown",
    colorGradientFrom: "from-yellow-500",
    colorGradientTo: "to-orange-500",
    discountPercentage: 29, // approx for savings
    isActive: true,
    displayOrder: 3,
    targetLink: "/dashboard/vip",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const IconRenderer = ({ name, className }: { name: keyof typeof LucideIcons; className?: string }) => {
  const IconComponent = LucideIcons[name] as React.ElementType
  if (!IconComponent) return <LucideIcons.HelpCircle className={className} /> // Fallback icon
  return <IconComponent className={className} />
}

export function AdminQuickPurchaseManagement() {
  const [items, setItems] = useState<QuickPurchaseItemAdmin[]>(initialQuickPurchaseItems)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<QuickPurchaseItemAdmin | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const handleAddNew = () => {
    setEditingItem(null)
    setIsModalOpen(true)
  }

  const handleEdit = (item: QuickPurchaseItemAdmin) => {
    setEditingItem(item)
    setIsModalOpen(true)
  }

  const handleDelete = (itemId: string) => {
    setItems(items.filter((i) => i.id !== itemId))
  }

  const handleSaveItem = (formData: QuickPurchaseItemAdmin) => {
    if (editingItem) {
      setItems(
        items.map((i) =>
          i.id === editingItem.id ? { ...formData, id: i.id, updatedAt: new Date().toISOString() } : i,
        ),
      )
    } else {
      setItems([
        ...items,
        {
          ...formData,
          id: `qp-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    }
    setIsModalOpen(false)
    setEditingItem(null)
  }

  const filteredItems = useMemo(() => {
    return items
      .filter((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }, [items, searchTerm])

  const QuickPurchaseForm = ({
    isOpen,
    onClose,
    onSave,
    initialData,
  }: {
    isOpen: boolean
    onClose: () => void
    onSave: (data: QuickPurchaseItemAdmin) => void
    initialData: QuickPurchaseItemAdmin | null
  }) => {
    const [formData, setFormData] = useState<Partial<QuickPurchaseItemAdmin>>(
      initialData || {
        type: "tip",
        isActive: true,
        displayOrder: (items.length + 1) * 10,
        iconName: "Zap",
        colorGradientFrom: "from-emerald-500",
        colorGradientTo: "to-cyan-500",
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
      onSave(formData as QuickPurchaseItemAdmin)
    }

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">
              {initialData ? "Edit Quick Purchase Item" : "Add New Quick Purchase Item"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" value={formData.name || ""} onChange={handleChange} required />
              </div>
              <div>
                <Label htmlFor="price">Price (Base Currency)</Label>
                <Input id="price" name="price" value={formData.price || ""} onChange={handleChange} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="originalPrice">Original Price (Optional)</Label>
                <Input
                  id="originalPrice"
                  name="originalPrice"
                  value={formData.originalPrice || ""}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="discountPercentage">Discount % (Optional)</Label>
                <Input
                  id="discountPercentage"
                  name="discountPercentage"
                  type="number"
                  value={formData.discountPercentage || ""}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select name="type" value={formData.type} onValueChange={(v) => handleSelectChange("type", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tip">Tip</SelectItem>
                    <SelectItem value="package">Package</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="colorGradientFrom">Color From (e.g., from-emerald-500)</Label>
                <Input
                  id="colorGradientFrom"
                  name="colorGradientFrom"
                  value={formData.colorGradientFrom || ""}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="colorGradientTo">Color To (e.g., to-cyan-500)</Label>
                <Input
                  id="colorGradientTo"
                  name="colorGradientTo"
                  value={formData.colorGradientTo || ""}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="timeLeft">Time Left (e.g., 2h 15m or ISO Date)</Label>
                <Input id="timeLeft" name="timeLeft" value={formData.timeLeft || ""} onChange={handleChange} />
              </div>
              <div>
                <Label htmlFor="targetLink">Target Link (e.g., /dashboard/daily-tips)</Label>
                <Input id="targetLink" name="targetLink" value={formData.targetLink || ""} onChange={handleChange} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  id="isPopular"
                  name="isPopular"
                  checked={!!formData.isPopular}
                  onCheckedChange={(c) => setFormData({ ...formData, isPopular: !!c })}
                />
                <Label htmlFor="isPopular">Is Popular?</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  name="isActive"
                  checked={!!formData.isActive}
                  onCheckedChange={(c) => setFormData({ ...formData, isActive: !!c })}
                />
                <Label htmlFor="isActive">Is Active (Visible)?</Label>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Save Item
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
        <CardTitle className="text-xl font-bold text-emerald-400 flex items-center">
          <ShoppingBag className="w-5 h-5 mr-2 text-emerald-500" />
          Quick Purchase Management
        </CardTitle>
        <Button onClick={handleAddNew} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
          <PlusCircle className="w-4 h-4 mr-1" /> Add New
        </Button>
      </CardHeader>
      <CardContent>
        <div className="relative w-full max-w-xs mb-4">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search items..."
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
                <TableHead>Type</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-700/30">
                  <TableCell className="font-medium">
                    {item.name} <IconRenderer name={item.iconName} className="w-3 h-3 inline ml-1" />
                  </TableCell>
                  <TableCell>
                    {item.price}
                    {item.originalPrice && (
                      <span className="line-through text-slate-500 ml-1 text-xs">{item.originalPrice}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize text-xs">
                      {item.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.isActive ? (
                      <Badge className="bg-green-500/20 text-green-400 text-xs">Active</Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-400 text-xs">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>{item.displayOrder}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(item)}
                      className="text-emerald-400 hover:text-emerald-300 mr-1 p-1 h-auto"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
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
          <QuickPurchaseForm
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false)
              setEditingItem(null)
            }}
            onSave={handleSaveItem}
            initialData={editingItem}
          />
        )}
      </CardContent>
    </Card>
  )
}
