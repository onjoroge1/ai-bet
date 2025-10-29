"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { 
  Brain, 
  TrendingUp, 
  Target, 
  BarChart3, 
  Shield, 
  Zap, 
  CheckCircle, 
  ArrowRight,
  Database,
  Cpu,
  Eye,
  Lock,
  Star,
  Clock,
  Users,
  Globe
} from "lucide-react"

export default function ModelInfoPage() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Brain className="w-10 h-10" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold">
              How SnapBet AI Works
            </h1>
            <p className="text-xl md:text-2xl text-emerald-100 max-w-3xl mx-auto">
              Our AI isn't guessing — it's learning from 20+ years of football data to predict match outcomes with precision.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 px-4 py-2">
                <Database className="w-4 h-4 mr-2" />
                36,000+ Matches Analyzed
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 px-4 py-2">
                <Target className="w-4 h-4 mr-2" />
                75-80% Win Rate
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 px-4 py-2">
                <Shield className="w-4 h-4 mr-2" />
                Real-Time Validation
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="methodology">Methodology</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="technical">Technical</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            {/* Core Philosophy */}
            <Card className="bg-slate-800/60 border-slate-600/50 shadow-xl">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-3xl flex items-center justify-center gap-3">
                  <Brain className="w-8 h-8 text-emerald-600" />
                  The Smartest Business Strategy
                </CardTitle>
                <CardDescription className="text-lg text-slate-300 max-w-4xl mx-auto">
                  In betting, users don't return because of volume — they return because they win. 
                  Our AI helps them feel like "these picks actually hit" — that's infinitely more powerful 
                  than flooding them with 100 low-confidence calls.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                      <Target className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-semibold">Selective Strategy</h3>
                    <p className="text-slate-300">
                      Shows fewer matches (15–20%), but each with clear confidence 
                      ("SnapBet 74% win probability")
                    </p>
                  </div>
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center mx-auto">
                      <TrendingUp className="w-8 h-8 text-cyan-600" />
                    </div>
                    <h3 className="text-xl font-semibold">Real Wins</h3>
                    <p className="text-slate-300">
                      Delivers real wins they can verify — and brag about. 
                      Builds trust in our model's intelligence.
                    </p>
                  </div>
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto">
                      <Users className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-semibold">User Retention</h3>
                    <p className="text-slate-300">
                      They win → they trust → they return → they upgrade. 
                      The perfect retention loop.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Model Architecture */}
            <Card className="bg-slate-800/60 border-slate-600/50 shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Cpu className="w-6 h-6 text-emerald-600" />
                  Hybrid AI System
                </CardTitle>
                <CardDescription className="text-lg text-slate-300">
                  We use a sophisticated two-layer approach combining market intelligence with pattern recognition
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <BarChart3 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-2">Market Intelligence (V1)</h3>
                        <p className="text-slate-300">
                          Built on real bookmaker odds to understand crowd expectations. 
                          Ensures predictions are as efficient as professional markets.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Brain className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-2">Pattern Recognition (V2)</h3>
                        <p className="text-slate-300">
                          LightGBM algorithm finds hidden trends and performance signals 
                          the markets might miss. Trained on 36,000+ matches.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Value Proposition */}
            <Card className="bg-slate-800/60 border-slate-600/50 shadow-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">📈 Smarter Picks, Fewer Losses</CardTitle>
                <CardDescription className="text-lg text-slate-300">
                  SnapBet AI learns from 36,000+ matches and 20 years of data to find the 20% of games 
                  most likely to win — before the odds catch up.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="inline-flex items-center gap-2 bg-slate-700/50 px-6 py-3 rounded-full shadow-lg">
                  <span className="text-2xl font-bold text-emerald-400">75-80%</span>
                  <span className="text-slate-300">Win Rate on High-Confidence Picks</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Methodology Tab */}
          <TabsContent value="methodology" className="space-y-8">
            <Card className="bg-slate-800/60 border-slate-600/50 shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Eye className="w-6 h-6 text-emerald-600" />
                  How We Select Matches
                </CardTitle>
                <CardDescription className="text-lg text-slate-300">
                  Our selective strategy focuses on quality over quantity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-emerald-600">Confidence Threshold</h3>
                    <p className="text-slate-300">
                      We only show matches where our AI confidence is above 70%. 
                      This means we're betting on our own predictions.
                    </p>
                    <div className="bg-emerald-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-emerald-800">
                        "SnapBet 74% win probability" — when you see this, 
                        our model is highly confident in the outcome.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-cyan-600">Expected Value (EV)</h3>
                    <p className="text-slate-300">
                      Every prediction is validated against closing odds to ensure 
                      long-term profitability, not just accuracy.
                    </p>
                    <div className="bg-cyan-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-cyan-800">
                        We track Closing Line Value (CLV) to ensure our edge 
                        is real and sustainable.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/60 border-slate-600/50 shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl">Data Sources & Training</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto">
                      <Database className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="font-semibold">Match Data</h3>
                    <p className="text-sm text-slate-300">36,942 matches across 14 leagues</p>
                  </div>
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto">
                      <Clock className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="font-semibold">Time Range</h3>
                    <p className="text-sm text-slate-300">19 seasons (2002–2025)</p>
                  </div>
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                      <Globe className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold">Coverage</h3>
                    <p className="text-sm text-slate-300">Major European leagues</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-8">
            <Card className="bg-slate-800/60 border-slate-600/50 shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <BarChart3 className="w-6 h-6 text-emerald-600" />
                  Performance Metrics
                </CardTitle>
                <CardDescription className="text-lg">
                  Real results from our selective prediction strategy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                      <Target className="w-8 h-8 text-emerald-600" />
                    </div>
                    <div className="text-3xl font-bold text-emerald-600">75-80%</div>
                    <p className="text-sm text-slate-300">Win Rate on High-Confidence Picks</p>
                  </div>
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto">
                      <TrendingUp className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="text-3xl font-bold text-blue-600">51-52%</div>
                    <p className="text-sm text-slate-300">Overall 3-Way Accuracy</p>
                  </div>
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto">
                      <Zap className="w-8 h-8 text-purple-600" />
                    </div>
                    <div className="text-3xl font-bold text-purple-600">20%</div>
                    <p className="text-sm text-slate-300">Coverage (Selective Strategy)</p>
                  </div>
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center mx-auto">
                      <Shield className="w-8 h-8 text-cyan-600" />
                    </div>
                    <div className="text-3xl font-bold text-cyan-600">3x</div>
                    <p className="text-sm text-slate-300">More Likely to Hit Than Market</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/60 border-slate-600/50 shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl">Tier-Based Strategy</CardTitle>
                <CardDescription className="text-lg">
                  Different approaches for different user types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="p-6 border border-slate-200 rounded-xl">
                      <h3 className="text-lg font-semibold mb-3 text-slate-700">Free Users</h3>
                      <p className="text-sm text-slate-300 mb-4">
                        Broad coverage (V1+V2 blend) - See predictions for every game
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Accuracy:</span>
                          <span className="font-medium">55-57%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Coverage:</span>
                          <span className="font-medium">100%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Purpose:</span>
                          <span className="font-medium">SEO + Ad Views</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 border-2 border-emerald-200 rounded-xl bg-emerald-50">
                      <h3 className="text-lg font-semibold mb-3 text-emerald-700">Premium Users</h3>
                      <p className="text-sm text-emerald-600 mb-4">
                        V2 Selective picks only - Smaller list, 74-78% hit rate
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Accuracy:</span>
                          <span className="font-medium text-emerald-600">74-78%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Coverage:</span>
                          <span className="font-medium text-emerald-600">15-20%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Purpose:</span>
                          <span className="font-medium text-emerald-600">Credibility + Retention</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 border border-slate-200 rounded-xl">
                      <h3 className="text-lg font-semibold mb-3 text-slate-700">Pro Tier (Future)</h3>
                      <p className="text-sm text-slate-300 mb-4">
                        V2 + EV/CLV insights - Access to model confidence and analytics
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Features:</span>
                          <span className="font-medium">Edge Tracking</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Analytics:</span>
                          <span className="font-medium">CLV Analysis</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Purpose:</span>
                          <span className="font-medium">Advanced Users</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Technical Tab */}
          <TabsContent value="technical" className="space-y-8">
            <Card className="bg-slate-800/60 border-slate-600/50 shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Cpu className="w-6 h-6 text-emerald-600" />
                  Technical Implementation
                </CardTitle>
                <CardDescription className="text-lg">
                  Deep dive into our AI architecture and validation methods
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="model-architecture">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-3">
                        <Brain className="w-5 h-5 text-emerald-600" />
                        Model Architecture
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p className="text-slate-300">
                        SnapBet's V2 AI model uses <strong>LightGBM</strong>, a gradient-boosting algorithm 
                        optimized for multi-class football predictions (Home / Draw / Away). It blends 
                        market-based probabilities (V1 ridge regression model) with historical performance 
                        indicators like team form, rest days, and attacking metrics.
                      </p>
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Key Features:</h4>
                        <ul className="space-y-1 text-sm text-slate-300">
                          <li>• Gradient boosting for complex pattern recognition</li>
                          <li>• Multi-class classification (Home/Draw/Away)</li>
                          <li>• Feature engineering from 20+ data points</li>
                          <li>• Time-aware cross-validation for future-proof reliability</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="validation-methods">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-cyan-600" />
                        Validation & Calibration
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p className="text-slate-300">
                        The model is evaluated on 36,942 matches across 14 leagues over 19 seasons (2002–2025). 
                        Performance is validated through Expected Value (EV) vs market close and Closing Line Value (CLV) tracking.
                      </p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h4 className="font-semibold text-blue-800 mb-2">Expected Value (EV)</h4>
                          <p className="text-sm text-blue-700">
                            Measures the long-term profitability of predictions by comparing 
                            our probabilities to closing market odds.
                          </p>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-lg">
                          <h4 className="font-semibold text-emerald-800 mb-2">Closing Line Value (CLV)</h4>
                          <p className="text-sm text-emerald-700">
                            Tracks how our predictions compare to the final market consensus, 
                            indicating our edge over time.
                          </p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="data-processing">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-3">
                        <Database className="w-5 h-5 text-purple-600" />
                        Data Processing Pipeline
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p className="text-slate-300">
                        Our data pipeline processes real-time match data, historical performance metrics, 
                        and market odds to generate predictions. The system includes automated quality checks 
                        and calibration to ensure reliability.
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                          <span className="text-sm">Real-time data ingestion from multiple sources</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                          <span className="text-sm">Feature engineering and normalization</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                          <span className="text-sm">Model inference and confidence scoring</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                          <span className="text-sm">Quality validation and calibration</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/60 border-slate-600/50 shadow-xl bg-gradient-to-r from-slate-700/50 to-slate-600/50">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">🔬 Data Meets Discipline</CardTitle>
                <CardDescription className="text-lg">
                  We don't bet on everything. Our AI waits until the math says yes.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="max-w-2xl mx-auto space-y-4">
                  <p className="text-slate-300">
                    Our selective approach means we only show you predictions when our AI is confident. 
                    This discipline is what separates us from other prediction sites that flood you with 
                    low-confidence calls.
                  </p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Badge variant="outline" className="px-4 py-2">
                      <Lock className="w-4 h-4 mr-2" />
                      Quality Over Quantity
                    </Badge>
                    <Badge variant="outline" className="px-4 py-2">
                      <Star className="w-4 h-4 mr-2" />
                      Confidence-Based Selection
                    </Badge>
                    <Badge variant="outline" className="px-4 py-2">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Validated Results
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* CTA Section */}
        <Card className="bg-slate-800/60 border-slate-600/50 shadow-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white">
          <CardContent className="text-center py-12">
            <h2 className="text-3xl font-bold mb-4">🚀 Try SnapBet Select™</h2>
            <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
              Access the AI's high-confidence picks — where data, not emotion, drives the win.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="bg-white text-emerald-600 hover:bg-emerald-50">
                Unlock Premium Picks
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                View Free Predictions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
