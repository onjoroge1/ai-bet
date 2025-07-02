"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { Plus, Edit, Trash2, DollarSign, Globe, Package, Search, Filter } from "lucide-react"

interface Country {
  id: string
  name: string
  code: string
  currencyCode: string
  currencySymbol: string
  flagEmoji: string
  isActive: boolean
}

interface PricingConfig {
  id: string
  countryId: string
  packageType: string
  price: number
  createdAt: string
  updatedAt: string
  country: {
    id: string
    name: string
    code: string
    currencyCode: string
    currencySymbol: string
    flagEmoji: string
  }
}

interface PricingFormData {
  id?: string
  countryId: string
  packageType: string
  price: string
}

const PACKAGE_TYPES = [
  { value: "prediction", label: "Prediction" },
  { value: "tip", label: "Tip" },
  { value: "package", label: "Package" },
  { value: "vip", label: "VIP" },
  { value: "premium", label: "Premium" }
]

export function PricingManagement() {
  const [pricingConfigs, setPricingConfigs] = useState<PricingConfig[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<PricingConfig | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterPackageType, setFilterPackageType] = useState("all")
  const [formData, setFormData] = useState<PricingFormData>({
    countryId: "",
    packageType: "prediction",
    price: ""
  })

  useEffect(() => {
    fetchPricingConfigs()
    fetchCountries()
  }, [])

  const fetchPricingConfigs = async () => {
    try {
      const response = await fetch("/api/admin/pricing")
      if (!response.ok) throw new Error("Failed to fetch pricing configurations")
      const data = await response.json()
      setPricingConfigs(data)
    } catch (error) {
      console.error("Error fetching pricing configurations:", error)
      toast.error("Failed to load pricing configurations")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCountries = async () => {
    try {
      const response = await fetch("/api/admin/pricing/countries")
      if (!response.ok) throw new Error("Failed to fetch countries")
      const data = await response.json()
      setCountries(data)
    } catch (error) {
      console.error("Error fetching countries:", error)
      toast.error("Failed to load countries")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.countryId || !formData.packageType || !formData.price) {
      toast.error("Please fill in all required fields")
      return
    }

    if (parseFloat(formData.price) <= 0) {
      toast.error("Price must be greater than 0")
      return
    }

    try {
      const url = "/api/admin/pricing"
      const method = editingConfig ? "PUT" : "POST"
      const body = editingConfig 
        ? { id: editingConfig.id, price: formData.price }
        : formData

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save pricing configuration")
      }

      const savedConfig = await response.json()
      
      if (editingConfig) {
        setPricingConfigs(prev => 
          prev.map(config => 
            config.id === editingConfig.id ? savedConfig : config
          )
        )
        toast.success("Pricing configuration updated successfully")
      } else {
        setPricingConfigs(prev => [...prev, savedConfig])
        toast.success("Pricing configuration created successfully")
      }

      handleCloseForm()
    } catch (error) {
      console.error("Error saving pricing configuration:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save pricing configuration")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pricing configuration?")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/pricing?id=${id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete pricing configuration")
      }

      setPricingConfigs(prev => prev.filter(config => config.id !== id))
      toast.success("Pricing configuration deleted successfully")
    } catch (error) {
      console.error("Error deleting pricing configuration:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete pricing configuration")
    }
  }

  const handleEdit = (config: PricingConfig) => {
    setEditingConfig(config)
    setFormData({
      id: config.id,
      countryId: config.countryId,
      packageType: config.packageType,
      price: config.price.toString()
    })
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingConfig(null)
    setFormData({
      countryId: "",
      packageType: "prediction",
      price: ""
    })
  }

  const handleAddNew = () => {
    setEditingConfig(null)
    setFormData({
      countryId: "",
      packageType: "prediction",
      price: ""
    })
    setIsFormOpen(true)
  }

  const filteredConfigs = pricingConfigs.filter(config => {
    const matchesSearch = 
      config.country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      config.country.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      config.packageType.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = !filterPackageType || filterPackageType === "all" || config.packageType === filterPackageType
    
    return matchesSearch && matchesFilter
  })

  const getCountryById = (countryId: string) => {
    return countries.find(country => country.id === countryId)
  }

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-6 h-6 text-emerald-500" />
              <CardTitle className="text-white">Pricing Management</CardTitle>
            </div>
            <Button onClick={handleAddNew} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Pricing
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search countries or package types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Select value={filterPackageType} onValueChange={setFilterPackageType}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Filter by package type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="all">All Package Types</SelectItem>
                  {PACKAGE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="bg-slate-600 text-slate-300">
                {filteredConfigs.length} configurations
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-300">Country</TableHead>
                  <TableHead className="text-slate-300">Package Type</TableHead>
                  <TableHead className="text-slate-300">Price</TableHead>
                  <TableHead className="text-slate-300">Last Updated</TableHead>
                  <TableHead className="text-right text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConfigs.map((config) => {
                  return (
                    <TableRow key={config.id} className="border-slate-700 hover:bg-slate-700/30">
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{config.country.flagEmoji}</span>
                          <div>
                            <div className="font-medium text-white">{config.country.name}</div>
                            <div className="text-sm text-slate-400">{config.country.code}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                          {config.packageType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-white">
                          {config.country.currencySymbol}{config.price.toLocaleString()}
                        </div>
                        <div className="text-sm text-slate-400">{config.country.currencyCode}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-400">
                          {new Date(config.updatedAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(config)}
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(config.id)}
                            className="border-red-600 text-red-400 hover:bg-red-600/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {filteredConfigs.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              {searchTerm || (filterPackageType && filterPackageType !== "all") ? "No pricing configurations match your filters" : "No pricing configurations found"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="sm:max-w-[500px] bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">
              {editingConfig ? "Edit Pricing Configuration" : "Add New Pricing Configuration"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="countryId">Country *</Label>
              <Select
                value={formData.countryId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, countryId: value }))}
                disabled={!!editingConfig}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {countries.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      <div className="flex items-center space-x-2">
                        <span>{country.flagEmoji}</span>
                        <span>{country.name}</span>
                        <span className="text-slate-400">({country.currencySymbol})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="packageType">Package Type *</Label>
              <Select
                value={formData.packageType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, packageType: value }))}
                disabled={!!editingConfig}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select package type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {PACKAGE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  className="bg-slate-700 border-slate-600 text-white"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseForm}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                {editingConfig ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
} 