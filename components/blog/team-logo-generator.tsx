'use client'

import React, { useState, useEffect } from 'react'
import { teamLogoSVGService } from '@/lib/services/team-logo-svg.service'

interface TeamLogoGeneratorProps {
  homeTeam: string
  awayTeam: string
  league?: string
  className?: string
}

/**
 * TeamLogoGenerator creates a visual representation of a match using team names
 * Features beautiful diagonal split design with team-specific colors
 * No external API dependencies - pure SVG solution
 */
export function TeamLogoGenerator({ homeTeam, awayTeam, league, className = "" }: TeamLogoGeneratorProps) {
  const [homeTeamLogo, setHomeTeamLogo] = useState<string | null>(null)
  const [awayTeamLogo, setAwayTeamLogo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const generateMatchLogo = () => {
      try {
        setLoading(true)
        
        // Generate beautiful match logo with both teams
        const matchSVG = teamLogoSVGService.generateMatchLogoWithTeams(
          homeTeam,
          awayTeam,
          league,
          64
        )
        
        // Use the same logo for both teams in the match display
        setHomeTeamLogo(matchSVG)
        setAwayTeamLogo(matchSVG)
      } catch (error) {
        console.warn('Failed to generate match logo:', error)
        
        // Fallback to simple individual logos
        const homeSVG = teamLogoSVGService.generateTeamLogo({
          teamName: homeTeam,
          league: league,
          size: 64,
          style: 'minimal'
        })
        const awaySVG = teamLogoSVGService.generateTeamLogo({
          teamName: awayTeam,
          league: league,
          size: 64,
          style: 'minimal'
        })
        
        setHomeTeamLogo(homeSVG)
        setAwayTeamLogo(awaySVG)
      } finally {
        setLoading(false)
      }
    }

    generateMatchLogo()
  }, [homeTeam, awayTeam, league])

  // Generate team initials for fallback
  const getTeamInitials = (teamName: string) => {
    return teamName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 3)
  }

  const homeInitials = getTeamInitials(homeTeam)
  const awayInitials = getTeamInitials(awayTeam)

  return (
    <div className={`relative ${className}`}>
      {/* Match Header */}
      {league && (
        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-slate-800 text-slate-300 text-xs px-3 py-1 rounded-full border border-slate-600">
            {league}
          </div>
        </div>
      )}

      {/* Full Match Logo Display */}
      <div className="h-48 bg-gradient-to-br from-slate-800 to-slate-700 relative overflow-hidden rounded-lg">
        {loading ? (
          <div className="absolute inset-0 w-full h-full bg-slate-600 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : homeTeamLogo ? (
          <div 
            className="absolute inset-0 w-full h-full block"
            dangerouslySetInnerHTML={{ __html: homeTeamLogo }}
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-slate-600 flex items-center justify-center">
            <span className="font-bold text-2xl text-white">
              {homeInitials} vs {awayInitials}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * SimpleTeamLogo creates a minimal team logo for smaller spaces
 * Features beautiful diagonal split design with team-specific colors
 * No external API dependencies - pure SVG solution
 */
export function SimpleTeamLogo({ teamName, size = 'md', className = "", league }: { 
  teamName: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  league?: string
}) {
  const [teamLogo, setTeamLogo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const generateLogo = () => {
      try {
        setLoading(true)
        
        // Generate beautiful SVG logo with diagonal split design
        const svgLogo = teamLogoSVGService.generateTeamLogo({
          teamName: teamName,
          league: league,
          size: size === 'sm' ? 32 : size === 'md' ? 48 : 64,
          style: 'single'
        })
        setTeamLogo(svgLogo)
      } catch (error) {
        console.warn('Failed to generate team logo:', error)
        
        // Fallback to minimal logo
        const svgLogo = teamLogoSVGService.generateTeamLogo({
          teamName: teamName,
          league: league,
          size: size === 'sm' ? 32 : size === 'md' ? 48 : 64,
          style: 'minimal'
        })
        setTeamLogo(svgLogo)
      } finally {
        setLoading(false)
      }
    }

    generateLogo()
  }, [teamName, league, size])

  const getTeamInitials = (teamName: string) => {
    return teamName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2)
  }

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  }

  const initials = getTeamInitials(teamName)

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden shadow-md bg-slate-700 flex items-center justify-center ${className}`}>
      {loading ? (
        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
      ) : teamLogo ? (
        <div 
          className="w-full h-full"
          dangerouslySetInnerHTML={{ __html: teamLogo }}
        />
      ) : (
        <div className="w-full h-full bg-slate-600 flex items-center justify-center">
          <span className="font-bold text-white">
            {initials}
          </span>
        </div>
      )}
    </div>
  )
}
