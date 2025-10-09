'use client'

import { getConfidenceBgColor, getConfidenceColor } from '@/lib/clv-calculator'

interface CLVConfidenceMeterProps {
  confidence: number
  evPercent: number
  size?: 'sm' | 'md' | 'lg'
}

export function CLVConfidenceMeter({ 
  confidence, 
  evPercent, 
  size = 'md' 
}: CLVConfidenceMeterProps) {
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  return (
    <div className="space-y-1">
      {/* Confidence Score */}
      <div className="flex items-center justify-between">
        <span className={`font-semibold ${getConfidenceColor(confidence)} ${textSizeClasses[size]}`}>
          {confidence}/100
        </span>
        <span className={`text-muted-foreground ${textSizeClasses[size]}`}>
          EV: {evPercent > 0 ? '+' : ''}{evPercent.toFixed(2)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`${sizeClasses[size]} ${getConfidenceBgColor(confidence)} transition-all duration-300 rounded-full`}
          style={{ width: `${confidence}%` }}
        />
      </div>

      {/* Confidence Label */}
      <div className={`text-center ${textSizeClasses[size]} text-muted-foreground`}>
        {confidence >= 85 && 'Excellent Edge'}
        {confidence >= 70 && confidence < 85 && 'Strong Edge'}
        {confidence >= 55 && confidence < 70 && 'Good Edge'}
        {confidence >= 40 && confidence < 55 && 'Moderate Edge'}
        {confidence >= 25 && confidence < 40 && 'Weak Edge'}
        {confidence < 25 && 'Minimal Edge'}
      </div>
    </div>
  )
}

