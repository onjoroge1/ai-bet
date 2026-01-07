import { Metadata } from 'next'
import prisma from '@/lib/db'

interface MatchLayoutProps {
  params: Promise<{ match_id: string }>
  children: React.ReactNode
}

/**
 * Generate SEO metadata for match pages
 * For finished matches, this acts as blog-style content with full SEO optimization
 */
export async function generateMetadata({ params }: MatchLayoutProps): Promise<Metadata> {
  const { match_id } = await params
  const baseUrl = process.env.NEXTAUTH_URL || 'https://www.snapbet.bet'
  
  try {
    // First, try to get match data from MarketMatch table (most reliable source for team names)
    const marketMatch = await prisma.marketMatch.findUnique({
      where: { matchId: String(match_id) },
      select: {
        homeTeam: true,
        awayTeam: true,
        league: true,
        status: true,
        currentScore: true,
        finalResult: true,
        kickoffDate: true,
      }
    })

    // Also try QuickPurchase for prediction data
    const quickPurchase = await prisma.quickPurchase.findFirst({
      where: {
        matchId: match_id,
        type: { in: ['prediction', 'tip'] },
        isActive: true,
      },
      select: {
        matchData: true,
        predictionData: true,
        analysisSummary: true,
        updatedAt: true,
        name: true, // Extract team names from name field if needed
      }
    })

    // Determine which data source to use
    let matchData: any = null
    let predictionData: any = null
    let isFinished = false
    let homeTeam = 'Home Team'
    let awayTeam = 'Away Team'
    let league = ''
    let finalScore: any = null

    if (marketMatch) {
      // Use MarketMatch data (most reliable)
      homeTeam = marketMatch.homeTeam || 'Home Team'
      awayTeam = marketMatch.awayTeam || 'Away Team'
      league = marketMatch.league || ''
      isFinished = marketMatch.status === 'FINISHED'
      finalScore = marketMatch.finalResult || marketMatch.currentScore
      
      // Merge with QuickPurchase data if available
      if (quickPurchase) {
        matchData = quickPurchase.matchData as any
        predictionData = quickPurchase.predictionData as any
        // Override with MarketMatch data if QuickPurchase has placeholder names
        if (matchData?.home?.name && 
            (matchData.home.name === 'Home Team' || matchData.home.name === 'Team A' || matchData.home.name.includes('TBD'))) {
          matchData.home.name = homeTeam
        }
        if (matchData?.away?.name && 
            (matchData.away.name === 'Away Team' || matchData.away.name === 'Team B' || matchData.away.name.includes('TBD'))) {
          matchData.away.name = awayTeam
        }
      }
    } else if (quickPurchase) {
      // Fallback to QuickPurchase data
      matchData = quickPurchase.matchData as any
      predictionData = quickPurchase.predictionData as any
      isFinished = matchData?.status === 'FINISHED' || matchData?.final_result !== undefined
      
      // Extract team names - check multiple sources
      homeTeam = matchData?.home?.name || 
                 (quickPurchase.name ? quickPurchase.name.split(' vs ')[0]?.trim() : null) ||
                 'Home Team'
      awayTeam = matchData?.away?.name || 
                 (quickPurchase.name ? quickPurchase.name.split(' vs ')[1]?.trim() : null) ||
                 'Away Team'
      league = matchData?.league?.name || ''
      finalScore = matchData?.final_result?.score || matchData?.score
      
      // Clean up placeholder names
      if (homeTeam === 'Home Team' || homeTeam === 'Team A' || homeTeam.includes('TBD')) {
        homeTeam = 'Home Team'
      }
      if (awayTeam === 'Away Team' || awayTeam === 'Team B' || awayTeam.includes('TBD')) {
        awayTeam = 'Away Team'
      }
    } else {
      // No data found
      return {
        title: `Match ${match_id} | SnapBet AI`,
        description: 'View match predictions and analysis powered by AI.',
      }
    }
    
    // Create SEO-friendly title and description
    let title = `${homeTeam} vs ${awayTeam}`
    let description = `AI-powered match prediction and analysis for ${homeTeam} vs ${awayTeam}`
    
    if (isFinished && finalScore) {
      title = `${homeTeam} ${finalScore.home}-${finalScore.away} ${awayTeam} | Match Result & Analysis`
      description = `Final score: ${homeTeam} ${finalScore.home}-${finalScore.away} ${awayTeam}. View complete match analysis, statistics, and AI prediction results. ${league ? `${league} match.` : ''}`
    } else {
      title = `${homeTeam} vs ${awayTeam} | AI Prediction & Analysis`
      description = `Get AI-powered predictions for ${homeTeam} vs ${awayTeam}. ${predictionData?.analysis?.ai_summary ? predictionData.analysis.ai_summary.substring(0, 120) + '...' : 'Expert analysis, betting recommendations, and confidence scores.'}`
    }

    // Extract keywords from analysis
    const keywords = [
      homeTeam,
      awayTeam,
      league,
      'football prediction',
      'AI betting tips',
      'match analysis',
      'sports predictions',
      'sports betting',
      'football tips',
    ].filter(Boolean).filter((k) => k !== 'Home Team' && k !== 'Away Team' && k !== 'Team A' && k !== 'Team B')

    // Build canonical URL
    const canonical = `${baseUrl}/match/${match_id}`

    // Build structured data for SEO (JSON-LD)
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': isFinished ? 'SportsEvent' : 'Event',
      name: title,
      description,
      startDate: marketMatch?.kickoffDate?.toISOString() || matchData?.kickoff_at,
      location: {
        '@type': 'Place',
        name: league || 'Football Match',
      },
      sport: 'Football',
      ...(isFinished && finalScore && {
        result: {
          '@type': 'SportsEventResult',
          homeTeamScore: finalScore.home,
          awayTeamScore: finalScore.away,
        },
      }),
      ...(homeTeam !== 'Home Team' && awayTeam !== 'Away Team' && {
        competitor: [
          {
            '@type': 'SportsTeam',
            name: homeTeam,
          },
          {
            '@type': 'SportsTeam',
            name: awayTeam,
          },
        ],
      }),
    }

    return {
      title,
      description,
      keywords,
      alternates: {
        canonical,
      },
      openGraph: {
        title,
        description,
        url: canonical,
        type: isFinished ? 'article' : 'website',
        siteName: 'SnapBet AI',
        images: [
          {
            url: `${baseUrl}/og-image.jpg`,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        ...(isFinished && (quickPurchase?.updatedAt || marketMatch) && {
          publishedTime: (quickPurchase?.updatedAt || marketMatch?.kickoffDate)?.toISOString(),
        }),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [`${baseUrl}/og-image.jpg`],
        creator: '@snapbet',
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
      other: {
        'structured-data': JSON.stringify(structuredData),
        ...(isFinished && {
          // Article metadata for finished matches (blog-style)
          'article:published_time': (quickPurchase?.updatedAt || marketMatch?.kickoffDate)?.toISOString() || new Date().toISOString(),
          'article:modified_time': (quickPurchase?.updatedAt || marketMatch?.kickoffDate)?.toISOString() || new Date().toISOString(),
          'article:author': 'SnapBet AI',
          'article:section': league || 'Sports',
        }),
      },
    }
  } catch (error) {
    console.error('Error generating match metadata:', error)
    return {
      title: `Match ${match_id} | SnapBet AI`,
      description: 'View match predictions and analysis.',
    }
  }
}

export default function MatchLayout({ children }: MatchLayoutProps) {
  return <>{children}</>
}

