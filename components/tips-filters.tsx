import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Filter, X } from "lucide-react"

export function TipsFilters() {
  const activeFilters = ["Premier League", "High Value", "Free Tips"]

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Filter className="w-5 h-5 text-emerald-400" />
        <h3 className="text-white font-semibold">Filters</h3>
      </div>

      <div className="space-y-4">
        {/* League Filter */}
        <div>
          <label className="text-slate-300 text-sm mb-2 block">League</label>
          <Select>
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
              <SelectValue placeholder="All Leagues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leagues</SelectItem>
              <SelectItem value="premier">Premier League</SelectItem>
              <SelectItem value="laliga">La Liga</SelectItem>
              <SelectItem value="bundesliga">Bundesliga</SelectItem>
              <SelectItem value="seriea">Serie A</SelectItem>
              <SelectItem value="ligue1">Ligue 1</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Confidence Filter */}
        <div>
          <label className="text-slate-300 text-sm mb-2 block">Confidence</label>
          <Select>
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
              <SelectValue placeholder="All Confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Confidence</SelectItem>
              <SelectItem value="high">90%+ (High)</SelectItem>
              <SelectItem value="medium">80-89% (Medium)</SelectItem>
              <SelectItem value="low">70-79% (Low)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Value Filter */}
        <div>
          <label className="text-slate-300 text-sm mb-2 block">Value</label>
          <Select>
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
              <SelectValue placeholder="All Value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Value</SelectItem>
              <SelectItem value="very-high">Very High</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Access Filter */}
        <div>
          <label className="text-slate-300 text-sm mb-2 block">Access</label>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Free Tips Only
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              VIP Tips Only
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="mt-6">
          <div className="text-slate-300 text-sm mb-2">Active Filters:</div>
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              >
                {filter}
                <X className="w-3 h-3 ml-1 cursor-pointer" />
              </Badge>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white mt-2 p-0">
            Clear All
          </Button>
        </div>
      )}
    </Card>
  )
}
