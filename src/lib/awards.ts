import { Session } from '@/types/session';
import { 
  Trophy, 
  Timer, 
  Flame, 
  Medal, 
  Award as AwardIcon, 
  Zap,
  Activity,
  TrendingUp,
  Target,
  Crown
} from 'lucide-react';

export interface Award {
  id: string;
  title: string;
  description: string;
  icon: any; // Lucide icon component
  color: string; // Tailwind color class for icon
  condition: (sessions: Session[], stats?: any) => boolean;
}

export interface EarnedAward {
  awardId: string;
  earnedAt: Date;
}

export const AWARDS: Award[] = [
  // Session Count Milestones
  {
    id: 'sessions-1',
    title: 'First Splash',
    description: 'Complete your first rowing session',
    icon: Medal,
    color: 'text-blue-400',
    condition: (sessions) => sessions.length >= 1
  },
  {
    id: 'sessions-10',
    title: 'Getting Habitual',
    description: 'Complete 10 rowing sessions',
    icon: Medal,
    color: 'text-blue-600',
    condition: (sessions) => sessions.length >= 10
  },
  {
    id: 'sessions-50',
    title: 'Committed',
    description: 'Complete 50 rowing sessions',
    icon: Trophy,
    color: 'text-indigo-600',
    condition: (sessions) => sessions.length >= 50
  },
  {
    id: 'sessions-100',
    title: 'Century Club',
    description: 'Complete 100 rowing sessions',
    icon: Trophy,
    color: 'text-violet-600',
    condition: (sessions) => sessions.length >= 100
  },
  {
    id: 'sessions-365',
    title: 'Year of Rowing',
    description: 'Complete 365 rowing sessions',
    icon: Crown,
    color: 'text-gold-500',
    condition: (sessions) => sessions.length >= 365
  },

  // Duration Milestones
  {
    id: 'duration-1h',
    title: 'Hour of Power',
    description: 'Accumulate 1 hour of total rowing time',
    icon: Timer,
    color: 'text-sky-500',
    condition: (sessions) => {
      const totalSeconds = sessions.reduce((acc, s) => acc + s.duration, 0);
      return totalSeconds >= 3600;
    }
  },
  {
    id: 'duration-5h',
    title: 'Dedicated Rower',
    description: 'Accumulate 5 hours of total rowing time',
    icon: Timer,
    color: 'text-blue-500',
    condition: (sessions) => {
      const totalSeconds = sessions.reduce((acc, s) => acc + s.duration, 0);
      return totalSeconds >= 5 * 3600;
    }
  },
  {
    id: 'duration-10h',
    title: 'Endurance Master',
    description: 'Accumulate 10 hours of total rowing time',
    icon: Timer,
    color: 'text-indigo-500',
    condition: (sessions) => {
      const totalSeconds = sessions.reduce((acc, s) => acc + s.duration, 0);
      return totalSeconds >= 10 * 3600;
    }
  },
  {
    id: 'duration-24h',
    title: 'Marathon Mindset',
    description: 'Accumulate 24 hours of total rowing time',
    icon: Timer,
    color: 'text-purple-500',
    condition: (sessions) => {
      const totalSeconds = sessions.reduce((acc, s) => acc + s.duration, 0);
      return totalSeconds >= 24 * 3600;
    }
  },
  {
    id: 'duration-50h',
    title: 'Pro Status',
    description: 'Accumulate 50 hours of total rowing time',
    icon: Timer,
    color: 'text-fuchsia-500',
    condition: (sessions) => {
      const totalSeconds = sessions.reduce((acc, s) => acc + s.duration, 0);
      return totalSeconds >= 50 * 3600;
    }
  },
  {
    id: 'duration-100h',
    title: 'Rowing Legend',
    description: 'Accumulate 100 hours of total rowing time',
    icon: Timer,
    color: 'text-pink-600',
    condition: (sessions) => {
      const totalSeconds = sessions.reduce((acc, s) => acc + s.duration, 0);
      return totalSeconds >= 100 * 3600;
    }
  },

  // Streak Milestones
  {
    id: 'streak-3',
    title: 'Getting Serious',
    description: 'Row for 3 consecutive days',
    icon: Flame,
    color: 'text-orange-500',
    condition: (_, stats) => stats && stats.bestStreak >= 3
  },
  {
    id: 'streak-5',
    title: 'On Fire',
    description: 'Row for 5 consecutive days',
    icon: Flame,
    color: 'text-red-500',
    condition: (_, stats) => stats && stats.bestStreak >= 5
  },
  {
    id: 'streak-7',
    title: 'Unstoppable',
    description: 'Row for 7 consecutive days',
    icon: Flame,
    color: 'text-red-600',
    condition: (_, stats) => stats && stats.bestStreak >= 7
  },
  {
    id: 'streak-10',
    title: 'Iron Will',
    description: 'Row for 10 consecutive days',
    icon: Flame,
    color: 'text-rose-600',
    condition: (_, stats) => stats && stats.bestStreak >= 10
  },
  {
    id: 'streak-14',
    title: 'Two Week Titan',
    description: 'Row for 14 consecutive days',
    icon: Flame,
    color: 'text-rose-700',
    condition: (_, stats) => stats && stats.bestStreak >= 14
  },
  {
    id: 'streak-21',
    title: 'Habit Master',
    description: 'Row for 21 consecutive days',
    icon: Flame,
    color: 'text-rose-800',
    condition: (_, stats) => stats && stats.bestStreak >= 21
  },
  {
    id: 'streak-30',
    title: 'Monthly Master',
    description: 'Row for 30 consecutive days',
    icon: Flame,
    color: 'text-rose-900',
    condition: (_, stats) => stats && stats.bestStreak >= 30
  },
  {
    id: 'streak-45',
    title: 'Unbreakable',
    description: 'Row for 45 consecutive days',
    icon: Flame,
    color: 'text-pink-600',
    condition: (_, stats) => stats && stats.bestStreak >= 45
  },
  {
    id: 'streak-60',
    title: 'Two Month Triumph',
    description: 'Row for 60 consecutive days',
    icon: Flame,
    color: 'text-pink-700',
    condition: (_, stats) => stats && stats.bestStreak >= 60
  },
  {
    id: 'streak-100',
    title: 'Century Streak',
    description: 'Row for 100 consecutive days',
    icon: Crown,
    color: 'text-fuchsia-600',
    condition: (_, stats) => stats && stats.bestStreak >= 100
  },

  // Distance Milestones
  {
    id: 'dist-10k',
    title: '10k Warmup',
    description: 'Row a total of 10,000 meters',
    icon: Activity,
    color: 'text-teal-500',
    condition: (sessions) => {
      const totalDist = sessions.reduce((acc, s) => acc + s.distance, 0);
      return totalDist >= 10000;
    }
  },
  {
    id: 'dist-50k',
    title: '50k Club',
    description: 'Row a total of 50,000 meters',
    icon: Activity,
    color: 'text-emerald-500',
    condition: (sessions) => {
      const totalDist = sessions.reduce((acc, s) => acc + s.distance, 0);
      return totalDist >= 50000;
    }
  },
  {
    id: 'dist-100k',
    title: 'Centurion',
    description: 'Row a total of 100,000 meters',
    icon: Target,
    color: 'text-green-600',
    condition: (sessions) => {
      const totalDist = sessions.reduce((acc, s) => acc + s.distance, 0);
      return totalDist >= 100000;
    }
  },
  {
    id: 'dist-250k',
    title: 'Quarter Million',
    description: 'Row a total of 250,000 meters',
    icon: Target,
    color: 'text-green-700',
    condition: (sessions) => {
      const totalDist = sessions.reduce((acc, s) => acc + s.distance, 0);
      return totalDist >= 250000;
    }
  },
  {
    id: 'dist-500k',
    title: 'Half Million',
    description: 'Row a total of 500,000 meters',
    icon: Trophy,
    color: 'text-yellow-500',
    condition: (sessions) => {
      const totalDist = sessions.reduce((acc, s) => acc + s.distance, 0);
      return totalDist >= 500000;
    }
  },
  {
    id: 'dist-750k',
    title: 'Three Quarter Mill',
    description: 'Row a total of 750,000 meters',
    icon: Trophy,
    color: 'text-yellow-600',
    condition: (sessions) => {
      const totalDist = sessions.reduce((acc, s) => acc + s.distance, 0);
      return totalDist >= 750000;
    }
  },
  {
    id: 'dist-1m',
    title: 'Million Meter Club',
    description: 'Row a total of 1,000,000 meters',
    icon: Crown,
    color: 'text-amber-500',
    condition: (sessions) => {
      const totalDist = sessions.reduce((acc, s) => acc + s.distance, 0);
      return totalDist >= 1000000;
    }
  },
  
  // Power & Performance Achievements
  {
    id: 'power-150',
    title: 'Strong Pulls',
    description: 'Maintain an average power of 150W+ in a session (>5min)',
    icon: Zap,
    color: 'text-amber-400',
    condition: (sessions) => sessions.some(s => s.avgPower >= 150 && s.duration > 300)
  },
  {
    id: 'power-200',
    title: 'Powerhouse',
    description: 'Maintain an average power of 200W+ in a session (>5min)',
    icon: Zap,
    color: 'text-yellow-500',
    condition: (sessions) => sessions.some(s => s.avgPower >= 200 && s.duration > 300)
  },
  {
    id: 'power-250',
    title: 'Watt Monster',
    description: 'Maintain an average power of 250W+ in a session (>5min)',
    icon: Zap,
    color: 'text-orange-500',
    condition: (sessions) => sessions.some(s => s.avgPower >= 250 && s.duration > 300)
  },
  {
    id: 'power-300',
    title: 'Elite Power',
    description: 'Maintain an average power of 300W+ in a session (>5min)',
    icon: Zap,
    color: 'text-red-600',
    condition: (sessions) => sessions.some(s => s.avgPower >= 300 && s.duration > 300)
  },
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    description: 'Row 500m with an average pace under 1:45',
    icon: TrendingUp,
    color: 'text-red-500',
    condition: (sessions) => sessions.some(s => s.distance === 500 && s.avgSplit < 105) // 105 seconds = 1:45
  },
  {
    id: 'speed-light',
    title: 'Lightspeed',
    description: 'Row 500m with an average pace under 1:35',
    icon: TrendingUp,
    color: 'text-purple-600',
    condition: (sessions) => sessions.some(s => s.distance === 500 && s.avgSplit < 95) // 95 seconds = 1:35
  },
  
  // Improvement Awards (vs Baseline)
  {
    id: 'improve-power-10',
    title: 'Power Up',
    description: 'Improve Average Power by 10% compared to your first 3 sessions',
    icon: TrendingUp,
    color: 'text-green-500',
    condition: (sessions) => {
      if (sessions.length < 10) return false;
      // Sort by date to find baseline
      const sorted = [...sessions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      // Filter for valid workouts (>5 min)
      const valid = sorted.filter(s => s.duration > 300);
      if (valid.length < 5) return false;
      
      const baseline = valid.slice(0, 3).reduce((acc, s) => acc + s.avgPower, 0) / 3;
      const best = Math.max(...valid.map(s => s.avgPower));
      
      return best >= baseline * 1.10;
    }
  },
  {
    id: 'improve-power-25',
    title: 'Major Gains',
    description: 'Improve Average Power by 25% compared to your first 3 sessions',
    icon: TrendingUp,
    color: 'text-green-600',
    condition: (sessions) => {
      if (sessions.length < 10) return false;
      const sorted = [...sessions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const valid = sorted.filter(s => s.duration > 300);
      if (valid.length < 5) return false;
      
      const baseline = valid.slice(0, 3).reduce((acc, s) => acc + s.avgPower, 0) / 3;
      const best = Math.max(...valid.map(s => s.avgPower));
      
      return best >= baseline * 1.25;
    }
  },
  {
    id: 'improve-power-50',
    title: 'Beast Mode',
    description: 'Improve Average Power by 50% compared to your first 3 sessions',
    icon: TrendingUp,
    color: 'text-emerald-600',
    condition: (sessions) => {
      if (sessions.length < 10) return false;
      const sorted = [...sessions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const valid = sorted.filter(s => s.duration > 300);
      if (valid.length < 5) return false;
      
      const baseline = valid.slice(0, 3).reduce((acc, s) => acc + s.avgPower, 0) / 3;
      const best = Math.max(...valid.map(s => s.avgPower));
      
      return best >= baseline * 1.50;
    }
  },
  {
    id: 'improve-power-75',
    title: 'Unleashed',
    description: 'Improve Average Power by 75% compared to your first 3 sessions',
    icon: TrendingUp,
    color: 'text-teal-600',
    condition: (sessions) => {
      if (sessions.length < 10) return false;
      const sorted = [...sessions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const valid = sorted.filter(s => s.duration > 300);
      if (valid.length < 5) return false;
      
      const baseline = valid.slice(0, 3).reduce((acc, s) => acc + s.avgPower, 0) / 3;
      const best = Math.max(...valid.map(s => s.avgPower));
      
      return best >= baseline * 1.75;
    }
  },
  {
    id: 'improve-power-100',
    title: 'Double Power',
    description: 'Double your Average Power (+100%) compared to your first 3 sessions',
    icon: Zap,
    color: 'text-yellow-600',
    condition: (sessions) => {
      if (sessions.length < 10) return false;
      const sorted = [...sessions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const valid = sorted.filter(s => s.duration > 300);
      if (valid.length < 5) return false;
      
      const baseline = valid.slice(0, 3).reduce((acc, s) => acc + s.avgPower, 0) / 3;
      const best = Math.max(...valid.map(s => s.avgPower));
      
      return best >= baseline * 2.0;
    }
  },
  {
    id: 'improve-pace-5',
    title: 'Picking Up Speed',
    description: 'Improve Average Pace by 5% compared to your first 3 sessions',
    icon: TrendingUp,
    color: 'text-blue-500',
    condition: (sessions) => {
      if (sessions.length < 10) return false;
      const sorted = [...sessions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const valid = sorted.filter(s => s.duration > 300 && s.avgSplit > 0);
      if (valid.length < 5) return false;
      
      // Lower split is better. Baseline split.
      const baseline = valid.slice(0, 3).reduce((acc, s) => acc + s.avgSplit, 0) / 3;
      const best = Math.min(...valid.map(s => s.avgSplit));
      
      // 5% faster means split is 95% of baseline or less
      return best <= baseline * 0.95;
    }
  },
  {
    id: 'improve-pace-10',
    title: 'Rapid Evolution',
    description: 'Improve Average Pace by 10% compared to your first 3 sessions',
    icon: TrendingUp,
    color: 'text-blue-600',
    condition: (sessions) => {
      if (sessions.length < 10) return false;
      const sorted = [...sessions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const valid = sorted.filter(s => s.duration > 300 && s.avgSplit > 0);
      if (valid.length < 5) return false;
      
      const baseline = valid.slice(0, 3).reduce((acc, s) => acc + s.avgSplit, 0) / 3;
      const best = Math.min(...valid.map(s => s.avgSplit));
      
      return best <= baseline * 0.90;
    }
  },

  {
    id: 'early-bird',
    title: 'Early Bird',
    description: 'Complete a session before 8 AM',
    icon: Timer,
    color: 'text-orange-400',
    condition: (sessions) => sessions.some(s => {
      const date = new Date(s.timestamp);
      return date.getHours() < 8 && date.getHours() >= 4;
    })
  },
  {
    id: 'night-owl',
    title: 'Night Owl',
    description: 'Complete a session after 9 PM',
    icon: Timer,
    color: 'text-purple-400',
    condition: (sessions) => sessions.some(s => {
      const date = new Date(s.timestamp);
      return date.getHours() >= 21;
    })
  }
];
