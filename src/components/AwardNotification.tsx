'use client';

import { useEffect, useState } from 'react';
import { useRowingStore } from '@/lib/store';
import { AWARDS } from '@/lib/awards';
import { X, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AwardNotification() {
  const { newlyEarnedAward, dismissNewAward } = useRowingStore();
  const [visible, setVisible] = useState(false);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => {
      dismissNewAward();
    }, 300); // Wait for exit animation
  };

  useEffect(() => {
    if (newlyEarnedAward) {
      setVisible(true);
      // Auto dismiss after 10 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [newlyEarnedAward]);

  if (!newlyEarnedAward || !visible) return null;

  const awardDef = AWARDS.find(a => a.id === newlyEarnedAward.awardId);
  if (!awardDef) return null;

  const Icon = awardDef.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <Card className="w-[90vw] max-w-md relative bg-background border-2 border-primary/20 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           {/* Simple CSS confetti placeholder or similar effect */}
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full flex justify-center">
             <div className="animate-pulse text-yellow-500 opacity-20 text-9xl absolute top-1/4">
               <PartyPopper />
             </div>
           </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-2 top-2 z-10" 
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader className="text-center pt-10 pb-2 relative z-10">
          <div className="mx-auto mb-4 p-4 rounded-full bg-secondary/50 w-24 h-24 flex items-center justify-center shadow-inner">
            <Icon className={`h-12 w-12 ${awardDef.color}`} />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-primary uppercase tracking-widest">New Achievement Unlocked!</div>
            <CardTitle className="text-2xl font-bold">{awardDef.title}</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="text-center pb-8 relative z-10">
          <p className="text-muted-foreground">
            {awardDef.description}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
