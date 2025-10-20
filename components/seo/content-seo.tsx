'use client'

import { useEffect } from 'react'

interface ContentSEOProps {
  keywords?: string[]
  category?: string
  readingTime?: number
  wordCount?: number
  lastModified?: string
  author?: string
}

/**
 * Advanced content SEO component
 * Implements content optimization and keyword targeting
 */
export function ContentSEO({
  keywords = [],
  category = 'sports',
  readingTime = 0,
  wordCount = 0,
  lastModified,
  author = 'SnapBet AI Team'
}: ContentSEOProps) {
  useEffect(() => {
    // Add structured data for articles
    if (typeof document !== 'undefined') {
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": document.title,
        "description": document.querySelector('meta[name="description"]')?.getAttribute('content'),
        "image": document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
        "author": {
          "@type": "Person",
          "name": author
        },
        "publisher": {
          "@type": "Organization",
          "name": "SnapBet AI",
          "logo": {
            "@type": "ImageObject",
            "url": "https://www.snapbet.bet/logo.png"
          }
        },
        "datePublished": lastModified || new Date().toISOString(),
        "dateModified": lastModified || new Date().toISOString(),
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": window.location.href
        },
        "keywords": keywords.join(', '),
        "articleSection": category,
        "wordCount": wordCount,
        "timeRequired": readingTime > 0 ? `PT${readingTime}M` : undefined,
        "inLanguage": "en-US"
      }

      // Remove existing article schema
      const existingSchema = document.querySelector('script[type="application/ld+json"][data-schema="article"]')
      if (existingSchema) {
        existingSchema.remove()
      }

      // Add new article schema
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-schema', 'article')
      script.textContent = JSON.stringify(structuredData)
      document.head.appendChild(script)
    }
  }, [keywords, category, readingTime, wordCount, lastModified, author])

  return null
}

/**
 * Keyword density analyzer hook
 */
export function useKeywordDensity() {
  const analyzeKeywordDensity = (content: string, targetKeywords: string[]) => {
    const words = content.toLowerCase().split(/\s+/)
    const totalWords = words.length
    const keywordDensity: Record<string, number> = {}

    targetKeywords.forEach(keyword => {
      const keywordWords = keyword.toLowerCase().split(/\s+/)
      let count = 0

      // Count exact phrase matches
      for (let i = 0; i <= words.length - keywordWords.length; i++) {
        const phrase = words.slice(i, i + keywordWords.length).join(' ')
        if (phrase === keyword.toLowerCase()) {
          count++
        }
      }

      // Count individual word matches
      keywordWords.forEach(word => {
        count += words.filter(w => w === word).length
      })

      keywordDensity[keyword] = (count / totalWords) * 100
    })

    return {
      keywordDensity,
      totalWords,
      recommendations: generateKeywordRecommendations(keywordDensity)
    }
  }

  const generateKeywordRecommendations = (density: Record<string, number>) => {
    const recommendations: string[] = []

    Object.entries(density).forEach(([keyword, percentage]) => {
      if (percentage < 0.5) {
        recommendations.push(`Increase usage of "${keyword}" (current: ${percentage.toFixed(2)}%)`)
      } else if (percentage > 3) {
        recommendations.push(`Reduce usage of "${keyword}" (current: ${percentage.toFixed(2)}%)`)
      } else {
        recommendations.push(`"${keyword}" density is optimal (${percentage.toFixed(2)}%)`)
      }
    })

    return recommendations
  }

  return { analyzeKeywordDensity }
}

/**
 * Content readability analyzer
 */
export function useReadabilityAnalysis() {
  const analyzeReadability = (content: string) => {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = content.split(/\s+/).filter(w => w.length > 0)
    const syllables = words.reduce((total, word) => total + countSyllables(word), 0)

    const avgWordsPerSentence = words.length / sentences.length
    const avgSyllablesPerWord = syllables / words.length

    // Flesch Reading Ease Score
    const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)

    // Flesch-Kincaid Grade Level
    const gradeLevel = (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59

    return {
      fleschScore: Math.round(fleschScore),
      gradeLevel: Math.round(gradeLevel * 10) / 10,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
      totalWords: words.length,
      totalSentences: sentences.length,
      recommendations: generateReadabilityRecommendations(fleschScore, gradeLevel)
    }
  }

  const countSyllables = (word: string): number => {
    word = word.toLowerCase()
    if (word.length <= 3) return 1
    
    const vowels = 'aeiouy'
    let count = 0
    let previousWasVowel = false
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i])
      if (isVowel && !previousWasVowel) {
        count++
      }
      previousWasVowel = isVowel
    }
    
    // Handle silent 'e'
    if (word.endsWith('e')) count--
    
    return Math.max(1, count)
  }

  const generateReadabilityRecommendations = (fleschScore: number, gradeLevel: number) => {
    const recommendations: string[] = []

    if (fleschScore < 30) {
      recommendations.push('Content is very difficult to read. Consider shorter sentences and simpler words.')
    } else if (fleschScore < 50) {
      recommendations.push('Content is difficult to read. Try breaking up long sentences.')
    } else if (fleschScore < 70) {
      recommendations.push('Content is fairly easy to read. Good balance achieved.')
    } else {
      recommendations.push('Content is very easy to read. Consider adding more complex ideas if appropriate.')
    }

    if (gradeLevel > 12) {
      recommendations.push(`Grade level is ${gradeLevel} (college+). Consider simplifying for broader audience.`)
    } else if (gradeLevel < 6) {
      recommendations.push(`Grade level is ${gradeLevel} (elementary). Consider adding more sophisticated content.`)
    } else {
      recommendations.push(`Grade level is ${gradeLevel} (middle/high school). Good for general audience.`)
    }

    return recommendations
  }

  return { analyzeReadability }
}

/**
 * SEO content optimizer hook
 */
export function useSEOContentOptimizer() {
  const optimizeContent = (content: string, targetKeywords: string[]) => {
    const recommendations: string[] = []
    
    // Check for keyword in first 100 words
    const first100Words = content.split(/\s+/).slice(0, 100).join(' ').toLowerCase()
    const hasKeywordInFirst100 = targetKeywords.some(keyword => 
      first100Words.includes(keyword.toLowerCase())
    )
    
    if (!hasKeywordInFirst100) {
      recommendations.push('Include target keywords in the first 100 words of content')
    }

    // Check for heading structure
    const headingCount = (content.match(/<h[1-6][^>]*>/gi) || []).length
    if (headingCount < 2) {
      recommendations.push('Add more headings to improve content structure')
    }

    // Check for internal links
    const internalLinks = (content.match(/<a[^>]*href=["']\/[^"']*["'][^>]*>/gi) || []).length
    if (internalLinks < 2) {
      recommendations.push('Add more internal links to improve SEO')
    }

    // Check for images with alt text
    const images = (content.match(/<img[^>]*>/gi) || []).length
    const imagesWithAlt = (content.match(/<img[^>]*alt=["'][^"']*["'][^>]*>/gi) || []).length
    if (images > 0 && imagesWithAlt < images) {
      recommendations.push('Add alt text to all images for better accessibility and SEO')
    }

    return {
      recommendations,
      score: calculateContentScore(content, targetKeywords),
      metrics: {
        headingCount,
        internalLinks,
        images,
        imagesWithAlt,
        hasKeywordInFirst100
      }
    }
  }

  const calculateContentScore = (content: string, targetKeywords: string[]): number => {
    let score = 0
    
    // Keyword in first 100 words (20 points)
    const first100Words = content.split(/\s+/).slice(0, 100).join(' ').toLowerCase()
    if (targetKeywords.some(keyword => first100Words.includes(keyword.toLowerCase()))) {
      score += 20
    }
    
    // Heading structure (20 points)
    const headingCount = (content.match(/<h[1-6][^>]*>/gi) || []).length
    score += Math.min(20, headingCount * 5)
    
    // Internal links (20 points)
    const internalLinks = (content.match(/<a[^>]*href=["']\/[^"']*["'][^>]*>/gi) || []).length
    score += Math.min(20, internalLinks * 10)
    
    // Images with alt text (20 points)
    const images = (content.match(/<img[^>]*>/gi) || []).length
    const imagesWithAlt = (content.match(/<img[^>]*alt=["'][^"']*["'][^>]*>/gi) || []).length
    if (images > 0) {
      score += (imagesWithAlt / images) * 20
    } else {
      score += 20 // No images is fine
    }
    
    // Content length (20 points)
    const wordCount = content.split(/\s+/).length
    if (wordCount >= 300) score += 20
    else if (wordCount >= 200) score += 15
    else if (wordCount >= 100) score += 10
    
    return Math.min(100, score)
  }

  return { optimizeContent }
}
