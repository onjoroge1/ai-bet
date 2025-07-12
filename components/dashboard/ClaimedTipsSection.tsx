'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Clock, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface ClaimedTip {
  id: string;
  predictionId: string;
  creditsSpent: number;
  claimedAt: string;
  expiresAt: string;
  status: string;
  usedAt?: string;
  prediction: {
    id: string;
    predictionType: string;
    odds: number;
    confidenceScore: number;
    valueRating: string;
    explanation?: string;
    match: {
      id: string;
      homeTeam: {
        name: string;
      };
      awayTeam: {
        name: string;
      };
      league: {
        name: string;
      };
      matchDate: string;
    };
  };
}

interface ClaimedTipsData {
  claimedTips: ClaimedTip[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export function ClaimedTipsSection() {
  const [claimedTips, setClaimedTips] = useState<ClaimedTipsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    fetchClaimedTips();
  }, [activeTab]);

  const fetchClaimedTips = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/credits/claim-tip?limit=20`);
      const data = await response.json();
      
      if (data.success) {
        setClaimedTips(data.data);
      }
    } catch (error) {
      console.error('Error fetching claimed tips:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (status === 'used') {
      return <Badge variant="default" className="bg-green-500">Used</Badge>;
    } else if (isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    } else {
      return <Badge variant="secondary">Active</Badge>;
    }
  };

  const formatMatchDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
  };

  const formatClaimDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} left`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    } else {
      return `${minutes}m left`;
    }
  };

  const getActiveTipsCount = () => {
    if (!claimedTips?.claimedTips) return 0;
    return claimedTips.claimedTips.filter(tip => {
      const isExpired = new Date(tip.expiresAt) < new Date();
      const matchDate = new Date(tip.prediction.match.matchDate);
      const isMatchPlayed = matchDate < new Date();
      return tip.status === 'completed' && !isExpired && !isMatchPlayed;
    }).length;
  };

  const getUsedTipsCount = () => {
    if (!claimedTips?.claimedTips) return 0;
    return claimedTips.claimedTips.filter(tip => {
      const matchDate = new Date(tip.prediction.match.matchDate);
      const isMatchPlayed = matchDate < new Date();
      return tip.status === 'completed' && isMatchPlayed;
    }).length;
  };

  const getExpiredTipsCount = () => {
    if (!claimedTips?.claimedTips) return 0;
    return claimedTips.claimedTips.filter(tip => {
      const isExpired = new Date(tip.expiresAt) < new Date();
      const matchDate = new Date(tip.prediction.match.matchDate);
      const isMatchPlayed = matchDate < new Date();
      return tip.status === 'completed' && isExpired && !isMatchPlayed;
    }).length;
  };

  const getCurrentTabCount = () => {
    switch (activeTab) {
      case 'active':
        return getActiveTipsCount();
      case 'used':
        return getUsedTipsCount();
      case 'expired':
        return getExpiredTipsCount();
      default:
        return 0;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Claimed Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading claimed tips...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Claimed Tips
          {claimedTips && (
            <Badge variant="outline" className="ml-2">
              {getCurrentTabCount()}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Active ({getActiveTipsCount()})</TabsTrigger>
            <TabsTrigger value="used">Used ({getUsedTipsCount()})</TabsTrigger>
            <TabsTrigger value="expired">Expired ({getExpiredTipsCount()})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
            {claimedTips?.claimedTips.filter(tip => {
              const isExpired = new Date(tip.expiresAt) < new Date();
              const matchDate = new Date(tip.prediction.match.matchDate);
              const isMatchPlayed = matchDate < new Date();
              return tip.status === 'completed' && !isExpired && !isMatchPlayed;
            }).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active claimed tips</p>
                <p className="text-sm">Claim tips using your credits to see them here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {claimedTips?.claimedTips
                  .filter(tip => {
                    const isExpired = new Date(tip.expiresAt) < new Date();
                    const matchDate = new Date(tip.prediction.match.matchDate);
                    const isMatchPlayed = matchDate < new Date();
                    return tip.status === 'completed' && !isExpired && !isMatchPlayed;
                  })
                  .map((tip) => (
                    <div key={tip.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">
                              {tip.prediction.match.homeTeam.name} vs {tip.prediction.match.awayTeam.name}
                            </h4>
                            {getStatusBadge(tip.status, tip.expiresAt)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{tip.prediction.match.league.name}</span>
                            <span>•</span>
                            <span>{tip.prediction.predictionType}</span>
                            <span>•</span>
                            <span>Odds: {tip.prediction.odds}</span>
                            <span>•</span>
                            <span>Confidence: {tip.prediction.confidenceScore}%</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{tip.creditsSpent} credit{tip.creditsSpent > 1 ? 's' : ''}</div>
                          <div className="text-xs text-muted-foreground">
                            {getTimeUntilExpiry(tip.expiresAt)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Match: {formatMatchDate(tip.prediction.match.matchDate)}</span>
                        <span>Claimed: {formatClaimDate(tip.claimedAt)}</span>
                      </div>
                      
                      {tip.prediction.explanation && (
                        <div className="text-sm bg-muted/50 p-3 rounded">
                          <strong>Analysis:</strong> {tip.prediction.explanation}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="used" className="space-y-4">
            {claimedTips?.claimedTips.filter(tip => {
              const matchDate = new Date(tip.prediction.match.matchDate);
              const isMatchPlayed = matchDate < new Date();
              return tip.status === 'completed' && isMatchPlayed;
            }).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No used tips</p>
              </div>
            ) : (
              <div className="space-y-3">
                {claimedTips?.claimedTips
                  .filter(tip => {
                    const matchDate = new Date(tip.prediction.match.matchDate);
                    const isMatchPlayed = matchDate < new Date();
                    return tip.status === 'completed' && isMatchPlayed;
                  })
                  .map((tip) => (
                    <div key={tip.id} className="border rounded-lg p-4 space-y-3 opacity-75">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">
                              {tip.prediction.match.homeTeam.name} vs {tip.prediction.match.awayTeam.name}
                            </h4>
                            {getStatusBadge(tip.status, tip.expiresAt)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{tip.prediction.match.league.name}</span>
                            <span>•</span>
                            <span>{tip.prediction.predictionType}</span>
                            <span>•</span>
                            <span>Odds: {tip.prediction.odds}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{tip.creditsSpent} credit{tip.creditsSpent > 1 ? 's' : ''}</div>
                          {tip.usedAt && (
                            <div className="text-xs text-muted-foreground">
                              Used: {formatClaimDate(tip.usedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="expired" className="space-y-4">
            {claimedTips?.claimedTips.filter(tip => {
              const isExpired = new Date(tip.expiresAt) < new Date();
              const matchDate = new Date(tip.prediction.match.matchDate);
              const isMatchPlayed = matchDate < new Date();
              return tip.status === 'completed' && isExpired && !isMatchPlayed;
            }).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <XCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No expired tips</p>
              </div>
            ) : (
              <div className="space-y-3">
                {claimedTips?.claimedTips
                  .filter(tip => {
                    const isExpired = new Date(tip.expiresAt) < new Date();
                    const matchDate = new Date(tip.prediction.match.matchDate);
                    const isMatchPlayed = matchDate < new Date();
                    return tip.status === 'completed' && isExpired && !isMatchPlayed;
                  })
                  .map((tip) => (
                    <div key={tip.id} className="border rounded-lg p-4 space-y-3 opacity-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">
                              {tip.prediction.match.homeTeam.name} vs {tip.prediction.match.awayTeam.name}
                            </h4>
                            {getStatusBadge(tip.status, tip.expiresAt)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{tip.prediction.match.league.name}</span>
                            <span>•</span>
                            <span>{tip.prediction.predictionType}</span>
                            <span>•</span>
                            <span>Odds: {tip.prediction.odds}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{tip.creditsSpent} credit{tip.creditsSpent > 1 ? 's' : ''}</div>
                          <div className="text-xs text-muted-foreground">
                            Expired: {formatClaimDate(tip.expiresAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 