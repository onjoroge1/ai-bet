'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface ClaimTipButtonProps {
  predictionId: string;
  predictionType: string;
  odds: number;
  confidenceScore: number;
  valueRating: string;
  matchDetails: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    matchDate: string;
  };
  onClaimSuccess?: (data: any) => void;
  className?: string;
}

interface EligibilityData {
  isEligible: boolean;
  hasEnoughCredits: boolean;
  alreadyClaimed: boolean;
  isFree: boolean;
  currentCredits: number;
  requiredCredits: number;
  existingClaim?: {
    id: string;
    claimedAt: string;
    status: string;
  };
}

export function ClaimTipButton({
  predictionId,
  predictionType,
  odds,
  confidenceScore,
  valueRating,
  matchDetails,
  onClaimSuccess,
  className = ''
}: ClaimTipButtonProps) {
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Check eligibility on component mount
  useEffect(() => {
    checkEligibility();
  }, [predictionId]);

  const checkEligibility = async () => {
    try {
      const response = await fetch(`/api/credits/check-eligibility?predictionId=${predictionId}`);
      const data = await response.json();
      
      if (data.success) {
        setEligibility(data.data);
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
    }
  };

  const handleClaimTip = async () => {
    if (!eligibility?.isEligible) return;

    setIsClaiming(true);
    try {
      const response = await fetch('/api/credits/claim-tip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ predictionId }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Tip claimed successfully!', {
          description: `You now have ${data.data.remainingCredits} credits remaining.`,
        });
        
        // Update eligibility state
        setEligibility(prev => prev ? {
          ...prev,
          isEligible: false,
          alreadyClaimed: true,
          currentCredits: data.data.remainingCredits
        } : null);

        // Call success callback
        if (onClaimSuccess) {
          onClaimSuccess(data.data);
        }
      } else {
        toast.error('Failed to claim tip', {
          description: data.error || 'Please try again.',
        });
      }
    } catch (error) {
      console.error('Error claiming tip:', error);
      toast.error('Failed to claim tip', {
        description: 'Network error. Please try again.',
      });
    } finally {
      setIsClaiming(false);
    }
  };

  // Don't render if eligibility hasn't been checked yet
  if (!eligibility) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        disabled 
        className={`w-full ${className}`}
      >
        <CreditCard className="w-4 h-4 mr-2" />
        Loading...
      </Button>
    );
  }

  // Don't show button for free tips
  if (eligibility.isFree) {
    return null;
  }

  // Show "View Tip" button if already claimed
  if (eligibility.alreadyClaimed) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          asChild
        >
          <Link href={`/dashboard/tips/${predictionId}`}>
            <Eye className="w-4 h-4 mr-2" />
            View Tip
          </Link>
        </Button>
        <div className="text-xs text-muted-foreground text-center">
          Claimed {eligibility.existingClaim?.claimedAt ? 
            new Date(eligibility.existingClaim.claimedAt).toLocaleDateString() : 
            'recently'
          }
        </div>
      </div>
    );
  }

  // Show "Insufficient Credits" if not enough credits
  if (!eligibility.hasEnoughCredits) {
    return (
      <div className={`flex flex-col items-center gap-1 ${className}`}>
        <Button 
          variant="outline" 
          size="sm" 
          disabled 
          className="w-full"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Claim with Credit
        </Button>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <AlertCircle className="w-3 h-3" />
          Need more than 1 credit
        </div>
        <div className="text-xs text-muted-foreground">
          You have {eligibility.currentCredits} credits
        </div>
      </div>
    );
  }

  // Show claim button if eligible
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleClaimTip}
        disabled={isClaiming}
        className="w-full"
      >
        <CreditCard className="w-4 h-4 mr-2" />
        {isClaiming ? 'Claiming...' : 'Claim with Credit'}
      </Button>
      <div className="text-xs text-muted-foreground text-center">
        Costs 1 credit • You have {eligibility.currentCredits} credits
      </div>
    </div>
  );
} 