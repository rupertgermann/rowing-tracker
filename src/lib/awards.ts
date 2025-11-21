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
  Target
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
  // Duration Milestones
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

  // Distance Milestones
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
  
  // Power Achievements
  {
    id: 'power-200',
    title: 'Powerhouse',
    description: 'Maintain an average power of 200W+ in a session',
    icon: Zap,
    color: 'text-yellow-400',
    condition: (sessions) => sessions.some(s => s.avgPower >= 200 && s.duration > 300) // min 5 mins
  },
];
