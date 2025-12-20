"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Edit, Trash2, Search, ShoppingBag, Loader2, Zap, Gift, Clock, Star, Crown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useUserCountry } from "@/contexts/user-country-context"

// Add debug logging function
const debugLog = (message: string, data?: any) => {
  console.log(`[Icon Debug] ${message}`, data || '')
}

// Define Country type based on API response
interface Country {
  id: string
  name: string
  code: string
  currencyCode: string
  currencySymbol: string
}

type QuickPurchaseType = "tip" | "weekend_pass" | "weekly_pass" | "special_game" | "monthly_sub"

type QuickPurchaseItemAdmin = {
  id?: string
  name: string
  price: string
  originalPrice?: string
  description: string
  features: string[]
  type: QuickPurchaseType
  iconName: string
  colorGradientFrom: string
  colorGradientTo: string
  isUrgent?: boolean
  timeLeft?: string
  isPopular?: boolean
  discountPercentage?: number
  isActive: boolean
  displayOrder: number
  countryId: string
  createdAt?: string
  updatedAt?: string
  country?: {
    currencyCode: string
    currencySymbol: string
  }
}

// Helper function to get icon based on type
const getIconForType = (type: QuickPurchaseType): string => {
  switch (type) {
    case "tip":
      return "Zap"
    case "weekend_pass":
      return "Gift"
    case "weekly_pass":
      return "Clock"
    case "special_game":
      return "Star"
    case "monthly_sub":
      return "Crown"
    default:
      return "Star"
  }
}

// Helper function to get color gradients based on type
const getColorsForType = (type: QuickPurchaseType): { from: string; to: string } => {
  switch (type) {
    case "tip":
      return { from: "from-blue-500", to: "to-cyan-500" }
    case "weekend_pass":
      return { from: "from-pink-500", to: "to-purple-500" }
    case "weekly_pass":
      return { from: "from-green-500", to: "to-emerald-500" }
    case "special_game":
      return { from: "from-yellow-500", to: "to-orange-500" }
    case "monthly_sub":
      return { from: "from-orange-500", to: "to-yellow-500" }
    default:
      return { from: "from-slate-500", to: "to-slate-400" }
  }
}

// Helper function to safely render icons
const renderIcon = (iconName: string, className?: string) => {
  debugLog('Attempting to render icon', { iconName, className })
  try {
    switch (iconName) {
      case "Zap":
        return <Zap className={className} />
      case "Gift":
        return <Gift className={className} />
      case "Clock":
        return <Clock className={className} />
      case "Star":
        return <Star className={className} />
      case "Crown":
        return <Crown className={className} />
      default:
        debugLog('Icon not found', { iconName })
        return <Star className={className} />
    }
  } catch (error) {
    debugLog('Error rendering icon', { iconName, error })
    return <Star className={className} />
  }
}

const initialFormData: QuickPurchaseItemAdmin = {
  id: "",
  name: "",
  price: "",
  description: "",
  features: [],
  type: "tip",
  iconName: "Zap",
  colorGradientFrom: "from-blue-500",
  colorGradientTo: "to-cyan-500",
  isUrgent: false,
  timeLeft: "",
  isPopular: false,
  discountPercentage: 0,
  isActive: true,
  displayOrder: 0,
  countryId: "cmbranpd60005vbpoyqs7tsxr",
  createdAt: "",
  updatedAt: "",
}

interface AdminQuickPurchaseManagementProps {
  shouldLoadData?: boolean
}

export function AdminQuickPurchaseManagement({ shouldLoadData = true }: AdminQuickPurchaseManagementProps) {
  debugLog('Rendering AdminQuickPurchaseManagement')
  const [countries, setCountries] = useState<Country[]>([])
  const [items, setItems] = useState<QuickPurchaseItemAdmin[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<QuickPurchaseItemAdmin | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [formData, setFormData] = useState<QuickPurchaseItemAdmin>(initialFormData)

  // Fetch countries only when shouldLoadData is true
  useEffect(() => {
    if (shouldLoadData) {
      const fetchCountries = async () => {
        try {
          const response = await fetch('/api/countries')
          if (response.ok) {
            const countriesData = await response.json()
            setCountries(countriesData)
          }
        } catch (error) {
          console.error('Error fetching countries:', error)
        }
      }
      fetchCountries()
    }
  }, [shouldLoadData])

  // Remove the USD country ID logic since we're using a specific ID
  useEffect(() => {
    if (shouldLoadData) {
      console.log('Component mounted')
      console.log('Available countries:', countries)
    }
  }, [countries, shouldLoadData])

  // Fetch quick purchases only when shouldLoadData is true
  useEffect(() => {
    if (shouldLoadData) {
      fetchQuickPurchases()
    } else {
      setIsLoading(false)
    }
  }, [shouldLoadData])

  const fetchQuickPurchases = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/admin/quick-purchases")
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        console.error('Error response:', errorData)
        throw new Error(errorData?.message || "Failed to fetch quick purchases")
      }
      const data = await response.json()
      console.log('Fetched quick purchases:', data)
      setItems(data)
    } catch (error) {
      console.error("Error fetching quick purchases:", error)
      toast.error("Failed to fetch quick purchases")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddNew = () => {
    setEditingItem(null)
    setFormData(initialFormData)
    setIsModalOpen(true)
  }

  const handleEdit = (item: QuickPurchaseItemAdmin) => {
    setEditingItem(item)
    setFormData(item)
    setIsModalOpen(true)
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return

    try {
      const response = await fetch(`/api/admin/quick-purchases/${itemId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete item")
      }

      setItems(items.filter(item => item.id !== itemId))
      toast.success("Item deleted successfully")
    } catch (error) {
      console.error("Error deleting item:", error)
      toast.error("Failed to delete item")
    }
  }

  const handleSaveItem = async (formData: QuickPurchaseItemAdmin) => {
    try {
      const response = await fetch("/api/admin/quick-purchases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save item")
      }

      const savedItem = await response.json()
      console.log('Saved item:', savedItem)

      // Refresh the items list
      const itemsResponse = await fetch("/api/admin/quick-purchases")
      if (!itemsResponse.ok) {
        throw new Error("Failed to refresh items list")
      }
      const updatedItems = await itemsResponse.json()
      setItems(updatedItems)

      toast.success("Item saved successfully")
      setIsModalOpen(false)
      setFormData(initialFormData)
    } catch (error) {
      console.error("Error saving item:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save item")
    }
  }

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
    const [formData, setFormData] = useState<QuickPurchaseItemAdmin>(initialData || initialFormData)

    useEffect(() => {
      if (initialData) {
        setFormData(initialData)
      } else {
        setFormData(initialFormData)
      }
    }, [initialData])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target
      setFormData({ ...formData, [name]: value })
    }

    const handleSelectChange = (name: string, value: string) => {
      if (name === "type") {
        const colors = getColorsForType(value as QuickPurchaseType)
        setFormData({
          ...formData,
          type: value as QuickPurchaseType,
          iconName: getIconForType(value as QuickPurchaseType),
          colorGradientFrom: colors.from,
          colorGradientTo: colors.to
        })
      } else {
        setFormData({ ...formData, [name]: value })
      }
    }

    const handleFeaturesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const features = e.target.value.split("\n").filter(f => f.trim())
      console.log('Features changed:', features)
      setFormData({ ...formData, features })
    }

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      
      // Validate required fields
      if (!formData.name || !formData.price || !formData.description || !formData.type || !formData.iconName || !formData.countryId) {
        toast.error("Please fill in all required fields")
        return
      }

      // Trim whitespace from text fields
      const trimmedData = {
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim(),
      }

      // Get colors based on type
      const { from, to } = getColorsForType(trimmedData.type)

      // Prepare data for submission
      const dataToSave = {
        name: trimmedData.name,
        description: trimmedData.description,
        price: trimmedData.price.toString(),
        originalPrice: trimmedData.originalPrice ? trimmedData.originalPrice.toString() : null,
        features: trimmedData.features || [],
        type: trimmedData.type,
        iconName: trimmedData.iconName,
        colorGradientFrom: from,
        colorGradientTo: to,
        isUrgent: trimmedData.isUrgent || false,
        timeLeft: trimmedData.timeLeft || null,
        isPopular: trimmedData.isPopular || false,
        discountPercentage: trimmedData.discountPercentage ? parseInt(trimmedData.discountPercentage.toString()) : null,
        isActive: true,
        displayOrder: parseInt(trimmedData.displayOrder.toString()) || 0,
        countryId: trimmedData.countryId
      }

      console.log('Submitting data:', dataToSave)

      try {
        const response = await fetch("/api/admin/quick-purchases", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataToSave),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to save item")
        }

        const savedItem = await response.json()
        console.log('Saved item:', savedItem)

        // Refresh the items list
        const itemsResponse = await fetch("/api/admin/quick-purchases")
        if (!itemsResponse.ok) {
          throw new Error("Failed to refresh items list")
        }
        const updatedItems = await itemsResponse.json()
        setItems(updatedItems)

        toast.success("Item saved successfully")
        setIsModalOpen(false)
        setFormData(initialFormData)
      } catch (error) {
        console.error("Error saving item:", error)
        toast.error(error instanceof Error ? error.message : "Failed to save item")
      }
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
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" name="price" value={formData.price || ""} onChange={handleChange} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="originalPrice">Original Price (USD)</Label>
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
              <Textarea 
                id="description" 
                name="description" 
                value={formData.description || ""} 
                onChange={handleChange}
                required 
              />
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
                    <SelectValue>
                      <div className="flex items-center">
                        {formData.type && renderIcon(getIconForType(formData.type), "w-4 h-4 mr-2")}
                        <span className="capitalize">{formData.type.replace('_', ' ')}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tip">
                      <div className="flex items-center">{renderIcon("Zap", "w-4 h-4 mr-2")}<span>Single Tip</span></div>
                    </SelectItem>
                    <SelectItem value="weekend_pass">
                      <div className="flex items-center">{renderIcon("Gift", "w-4 h-4 mr-2")}<span>Weekend Pass</span></div>
                    </SelectItem>
                    <SelectItem value="weekly_pass">
                      <div className="flex items-center">{renderIcon("Clock", "w-4 h-4 mr-2")}<span>Weekly Pass</span></div>
                    </SelectItem>
                    <SelectItem value="special_game">
                      <div className="flex items-center">{renderIcon("Star", "w-4 h-4 mr-2")}<span>Special Game</span></div>
                    </SelectItem>
                    <SelectItem value="monthly_sub">
                      <div className="flex items-center">{renderIcon("Crown", "w-4 h-4 mr-2")}<span>Monthly Subscription</span></div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="timeLeft">Time Left (e.g., 2h 15m or ISO Date)</Label>
                <Input id="timeLeft" name="timeLeft" value={formData.timeLeft || ""} onChange={handleChange} />
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
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isUrgent"
                  name="isUrgent"
                  checked={!!formData.isUrgent}
                  onCheckedChange={(checked) => setFormData({ ...formData, isUrgent: !!checked })}
                />
                <Label htmlFor="isUrgent">Urgent</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isPopular"
                  name="isPopular"
                  checked={!!formData.isPopular}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPopular: !!checked })}
                />
                <Label htmlFor="isPopular">Popular</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  name="isActive"
                  checked={!!formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: !!checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Quick Purchase Management</CardTitle>
            <Button onClick={handleAddNew} className="bg-emerald-600 hover:bg-emerald-700">
              <PlusCircle className="w-4 h-4 mr-2" />
              Add New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-slate-700/50 border-slate-600 text-white"
              />
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            </div>
          ) : (
            <div className="rounded-md border border-slate-700">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-800/50 hover:bg-slate-800/50">
                    <TableHead className="text-slate-300">Name</TableHead>
                    <TableHead className="text-slate-300">Type</TableHead>
                    <TableHead className="text-slate-300">Price</TableHead>
                    <TableHead className="text-slate-300">Status</TableHead>
                    <TableHead className="text-slate-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items
                    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(item => (
                      <TableRow key={item.id} className="border-slate-700">
                        <TableCell className="font-medium text-white">
                          <div className="flex items-center space-x-2">
                            {renderIcon(item.iconName, "w-4 h-4 text-slate-400")}
                            <span>{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${
                              item.type === "tip"
                                ? "bg-blue-500/20 text-blue-400"
                                : item.type === "weekend_pass"
                                ? "bg-pink-500/20 text-pink-400"
                                : item.type === "weekly_pass"
                                ? "bg-green-500/20 text-green-400"
                                : item.type === "special_game"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-orange-500/20 text-orange-400"
                            }`}
                          >
                            {item.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white">
                          {item.country?.currencySymbol || "$"}
                          {item.price}
                          {item.originalPrice && Number(item.originalPrice) !== Number(item.price) && (
                            <span className="text-slate-400 line-through ml-2">
                              {item.country?.currencySymbol || "$"}
                              {item.originalPrice}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${
                              item.isActive
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-slate-500/20 text-slate-400"
                            }`}
                          >
                            {item.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(item)}
                              className="text-slate-400 hover:text-white"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item.id || "")}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <QuickPurchaseForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveItem}
        initialData={editingItem}
      />
    </div>
  )
}
