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
    // Try to get match data from QuickPurchase (faster)
    const quickPurchase = await prisma.quickPurchase.findFirst({
      where: {
        matchId: match_id,
        type: { in: ['prediction', 'tip'] },
        isActive: true,
        predictionData: { not: null }
      },
      select: {
        matchData: true,
        predictionData: true,
        analysisSummary: true,
        updatedAt: true
      }
    })

    if (!quickPurchase) {
      return {
        title: `Match ${match_id} | SnapBet AI`,
        description: 'View match predictions and analysis powered by AI.',
      }
    }

    const matchData = quickPurchase.matchData as any
    const predictionData = quickPurchase.predictionData as any
    const isFinished = matchData?.status === 'FINISHED' || matchData?.final_result !== undefined

    // Extract match info
    const homeTeam = matchData?.home?.name || 'Home Team'
    const awayTeam = matchData?.away?.name || 'Away Team'
    const league = matchData?.league?.name || ''
    const finalScore = matchData?.final_result?.score || matchData?.score
    
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
      'sports predictions'
    ].filter(Boolean)

    // Build canonical URL
    const canonical = `${baseUrl}/match/${match_id}`

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
        ...(isFinished && quickPurchase.updatedAt && {
          publishedTime: quickPurchase.updatedAt.toISOString(),
        }),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
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
      ...(isFinished && {
        // Article metadata for finished matches (blog-style)
        other: {
          'article:published_time': quickPurchase.updatedAt?.toISOString() || new Date().toISOString(),
          'article:modified_time': quickPurchase.updatedAt?.toISOString() || new Date().toISOString(),
          'article:author': 'SnapBet AI',
          'article:section': league || 'Sports',
        },
      }),
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

