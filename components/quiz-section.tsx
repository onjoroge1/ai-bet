"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, Clock, Target, Users, Zap, Trophy, Star } from "lucide-react"
import Link from "next/link"

export function QuizSection() {
  return (
    <section className="py-16 px-4 bg-slate-900/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <Brain className="w-8 h-8 text-emerald-400" />
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Think you know sports?
            </h2>
          </div>
          <p className="text-slate-300 text-lg mb-6">
            Test your knowledge and win up to 50 credits!
          </p>
          <p className="text-slate-400 text-base max-w-2xl mx-auto">
            Answer 5 questions correctly and earn credits to use on real predictions
          </p>
        </div>

        {/* Main Quiz Card */}
        <div className="mx-auto">
          <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                {/* Left Side - Quiz Info */}
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-emerald-400" />
                      <span className="text-slate-300">Takes 2 minutes</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Target className="w-5 h-5 text-emerald-400" />
                      <span className="text-slate-300">5 questions</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Trophy className="w-5 h-5 text-emerald-400" />
                      <span className="text-slate-300">Win real credits</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-white">What you'll learn:</h3>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-slate-300 text-sm">Understanding confidence scores</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-slate-300 text-sm">Reading prediction analytics</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-slate-300 text-sm">Value betting strategies</span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    size="lg" 
                    className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white px-8 py-4 text-lg group"
                    asChild
                  >
                    <Link href="/snapbet-quiz">
                      <Zap className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                      Start Quiz - Takes 2 minutes
                    </Link>
                  </Button>
                </div>

                {/* Right Side - Stats & Rewards */}
                <div className="space-y-6">
                  {/* Social Proof */}
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="text-center space-y-2">
                      <div className="flex items-center justify-center space-x-2">
                        <Users className="w-5 h-5 text-emerald-400" />
                        <span className="text-2xl font-bold text-white">2,847</span>
                      </div>
                      <p className="text-slate-300 text-sm">users completed today</p>
                    </div>
                  </div>

                  {/* Average Score */}
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="text-center space-y-2">
                      <div className="text-2xl font-bold text-emerald-400">3.2/5</div>
                      <p className="text-slate-300 text-sm">average score</p>
                    </div>
                  </div>

                  {/* Reward Structure */}
                  <div className="bg-gradient-to-br from-emerald-900/30 to-cyan-900/30 rounded-lg p-4 border border-emerald-700/50">
                    <h4 className="text-white font-semibold mb-3 text-center">Reward Structure</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300 text-sm">5/5 correct:</span>
                        <Badge variant="secondary" className="bg-emerald-600 text-white">50 credits</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300 text-sm">4/5 correct:</span>
                        <Badge variant="secondary" className="bg-cyan-600 text-white">25 credits</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300 text-sm">3/5 correct:</span>
                        <Badge variant="secondary" className="bg-blue-600 text-white">10 credits</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300 text-sm">2/5 or less:</span>
                        <Badge variant="secondary" className="bg-slate-600 text-white">5 credits</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Stats */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-6 text-slate-400 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span>Quiz resets daily</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
              <span>Credits expire in 24h</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span>No credit card required</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
} 