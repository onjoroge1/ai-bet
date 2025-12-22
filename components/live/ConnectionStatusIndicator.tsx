"use client"

import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ConnectionStatus, ConnectionQuality } from "@/hooks/use-live-match-websocket"

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus
  onReconnect?: () => void
  className?: string
}

/**
 * Visual indicator for WebSocket connection status
 * Shows connection quality, polling status, and allows manual reconnection
 */
export function ConnectionStatusIndicator({ 
  status, 
  onReconnect,
  className = "" 
}: ConnectionStatusIndicatorProps) {
  const { isConnected, isPolling, quality, reconnectAttempts } = status

  // Don't show if offline and not attempting to connect
  if (quality === 'offline' && reconnectAttempts === 0) {
    return null
  }

  const getQualityStyles = (quality: ConnectionQuality): { bg: string; text: string } => {
    switch (quality) {
      case 'excellent':
        return { bg: 'bg-emerald-500/20', text: 'text-emerald-500' }
      case 'good':
        return { bg: 'bg-green-500/20', text: 'text-green-500' }
      case 'degraded':
        return { bg: 'bg-yellow-500/20', text: 'text-yellow-500' }
      case 'poor':
        return { bg: 'bg-orange-500/20', text: 'text-orange-500' }
      case 'offline':
        return { bg: 'bg-red-500/20', text: 'text-red-500' }
      default:
        return { bg: 'bg-gray-500/20', text: 'text-gray-500' }
    }
  }

  const getQualityLabel = (quality: ConnectionQuality): string => {
    switch (quality) {
      case 'excellent':
        return 'Excellent'
      case 'good':
        return 'Good'
      case 'degraded':
        return 'Degraded'
      case 'poor':
        return 'Poor'
      case 'offline':
        return 'Offline'
      default:
        return 'Unknown'
    }
  }

  const getIcon = () => {
    if (isConnected) {
      return <Wifi className="w-3 h-3" />
    } else if (isPolling) {
      return <RefreshCw className="w-3 h-3 animate-spin" />
    } else {
      return <WifiOff className="w-3 h-3" />
    }
  }

  const qualityStyles = getQualityStyles(quality)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge 
        variant="outline" 
        className={`flex items-center gap-1.5 px-2 py-0.5 text-xs border-0 ${qualityStyles.bg} ${qualityStyles.text} ${isPolling ? 'animate-pulse' : ''}`}
      >
        {getIcon()}
        <span className="font-medium">
          {isConnected 
            ? getQualityLabel(quality) 
            : isPolling 
            ? 'Polling' 
            : reconnectAttempts > 0 
            ? `Reconnecting...` 
            : 'Offline'}
        </span>
        {reconnectAttempts > 0 && reconnectAttempts < 5 && (
          <span className="text-xs opacity-75">({reconnectAttempts})</span>
        )}
      </Badge>
      
      {onReconnect && (quality === 'offline' || quality === 'poor') && (
        <button
          onClick={onReconnect}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          title="Reconnect"
        >
          <RefreshCw className={`w-3 h-3 ${reconnectAttempts > 0 ? 'animate-spin' : ''}`} />
        </button>
      )}
      
      {quality === 'poor' && (
        <AlertCircle className="w-3 h-3 text-orange-500" title="Connection quality is poor" />
      )}
    </div>
  )
}

