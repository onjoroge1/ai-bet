'use client'

import React from 'react'
import { TeamLogoGenerator, SimpleTeamLogo } from './team-logo-generator'

/**
 * Demo component to showcase the new team logo designs
 * This can be used in development to test different logo styles
 */
export function TeamLogoDemo() {
  const demoMatches = [
    { homeTeam: 'Manchester United', awayTeam: 'Liverpool', league: 'Premier League' },
    { homeTeam: 'Real Madrid', awayTeam: 'Barcelona', league: 'La Liga' },
    { homeTeam: 'Bayern Munich', awayTeam: 'Borussia Dortmund', league: 'Bundesliga' },
    { homeTeam: 'Arsenal', awayTeam: 'Chelsea', league: 'Premier League' },
    { homeTeam: 'PSG', awayTeam: 'Marseille', league: 'Ligue 1' },
    { homeTeam: 'Sao Paulo', awayTeam: 'Mirassol', league: 'Brasileirao' },
    { homeTeam: 'Flamengo', awayTeam: 'Palmeiras', league: 'Brasileirao' },
    { homeTeam: 'Corinthians', awayTeam: 'Santos', league: 'Brasileirao' },
    { homeTeam: 'AC Milan', awayTeam: 'Inter Milan', league: 'Serie A' },
    { homeTeam: 'Juventus', awayTeam: 'Atletico Madrid', league: 'Champions League' }
  ]

  const demoTeams = [
    'Manchester United',
    'Liverpool', 
    'Arsenal',
    'Chelsea',
    'Real Madrid',
    'Barcelona',
    'Bayern Munich',
    'Juventus',
    'AC Milan',
    'PSG'
  ]

  return (
    <div className="p-8 bg-slate-900 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          🎨 New Team Logo Design Demo
        </h1>
        
        {/* Match Logos Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">
            Professional Match Logos (Full-Width Template Design)
          </h2>
          <div className="grid grid-cols-1 gap-8">
            {demoMatches.map((match, index) => (
              <div key={index} className="bg-slate-800 rounded-lg p-6">
                <h3 className="text-white font-medium mb-4 text-center text-lg">
                  {match.homeTeam} vs {match.awayTeam} - {match.league}
                </h3>
                <TeamLogoGenerator
                  homeTeam={match.homeTeam}
                  awayTeam={match.awayTeam}
                  league={match.league}
                  className="w-full h-48"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Single Team Logos Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">
            Single Team Logos
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {demoTeams.map((team, index) => (
              <div key={index} className="bg-slate-800 rounded-lg p-4 text-center">
                <h4 className="text-white text-sm mb-3">{team}</h4>
                <div className="flex justify-center">
                  <SimpleTeamLogo
                    teamName={team}
                    size="lg"
                    league="Premier League"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Size Variants */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">
            Size Variants
          </h2>
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-center space-x-8">
              <div className="text-center">
                <h4 className="text-white text-sm mb-2">Small</h4>
                <SimpleTeamLogo teamName="Manchester United" size="sm" />
              </div>
              <div className="text-center">
                <h4 className="text-white text-sm mb-2">Medium</h4>
                <SimpleTeamLogo teamName="Manchester United" size="md" />
              </div>
              <div className="text-center">
                <h4 className="text-white text-sm mb-2">Large</h4>
                <SimpleTeamLogo teamName="Manchester United" size="lg" />
              </div>
            </div>
          </div>
        </section>

        {/* Features List */}
        <section className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-white mb-4">
            ✨ New Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
            <div>
              <h3 className="text-white font-medium mb-2">🎨 Design</h3>
              <ul className="space-y-1 text-sm">
                <li>• Beautiful diagonal split design</li>
                <li>• Team-specific color schemes</li>
                <li>• League-specific styling</li>
                <li>• Professional gradient effects</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">⚡ Performance</h3>
              <ul className="space-y-1 text-sm">
                <li>• No external API dependencies</li>
                <li>• Instant logo generation</li>
                <li>• Pure SVG solution</li>
                <li>• 100% reliable</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">🔧 Technical</h3>
              <ul className="space-y-1 text-sm">
                <li>• No API-Football dependency</li>
                <li>• No environment variables needed</li>
                <li>• Consistent across all devices</li>
                <li>• Easy to customize</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">🎯 Usage</h3>
              <ul className="space-y-1 text-sm">
                <li>• Perfect for blog posts</li>
                <li>• Great for match previews</li>
                <li>• Ideal for team listings</li>
                <li>• Responsive design</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
