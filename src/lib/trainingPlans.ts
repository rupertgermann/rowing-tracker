import { Session } from '@/types/session';
import { saveTrainingPlansToDB, fetchTrainingPlansFromDB } from '@/lib/dataSync';

// Training plan data structures
export interface TrainingSession {
  id: string;
  day: number; // Day of the week (0-6, Sunday = 0)
  week: number; // Week number in the plan
  type: 'endurance' | 'interval' | 'tempo' | 'recovery' | 'strength' | 'technique' | 'rest';
  title: string;
  description: string;
  duration: number; // Target duration in minutes
  distance?: number; // Target distance in meters
  pace?: {
    target: number; // Target pace in seconds per 500m
    range: [number, number]; // Acceptable pace range
  };
  power?: {
    target: number; // Target power in watts
    range: [number, number]; // Acceptable power range
  };
  strokeRate?: {
    target: number; // Target stroke rate
    range: [number, number]; // Acceptable range
  };
  intensity: 'low' | 'medium' | 'high';
  notes?: string;
  completed: boolean;
  actualSession?: Session; // Link to actual completed session
}

export interface TrainingWeek {
  id: string;
  weekNumber: number;
  sessions: TrainingSession[];
  focus: string; // Week focus (e.g., "Base Building", "Peak Week")
  totalVolume: number; // Target total minutes for the week
  completed: boolean;
  actualVolume: number; // Actual completed minutes
}

export interface TrainingPlan {
  id: string;
  title: string;
  description: string;
  goals: string[];
  duration: number; // Duration in weeks
  level: 'beginner' | 'intermediate' | 'advanced';
  focus: 'general_fitness' | 'endurance' | 'speed' | 'strength' | 'competition';
  createdAt: Date;
  updatedAt: Date;
  startDate?: Date; // When the plan starts
  weeks: TrainingWeek[];
  status: 'draft' | 'active' | 'completed' | 'paused';
  progress: {
    completedWeeks: number;
    completedSessions: number;
    totalSessions: number;
    adherenceRate: number; // Percentage of planned sessions completed
  };
}

export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  focus: 'general_fitness' | 'endurance' | 'speed' | 'strength' | 'competition';
  duration: number;
  structure: Omit<TrainingWeek, 'id' | 'completed' | 'actualVolume'>[];
}

export class TrainingPlansService {
  private static instance: TrainingPlansService;
  private readonly STORAGE_KEY = 'rowing_training_plans';
  private readonly ACTIVE_PLAN_KEY = 'rowing_active_training_plan';
  
  private constructor() {}
  
  static getInstance(): TrainingPlansService {
    if (!TrainingPlansService.instance) {
      TrainingPlansService.instance = new TrainingPlansService();
    }
    return TrainingPlansService.instance;
  }

  // Get all training plans
  async getPlans(): Promise<TrainingPlan[]> {
    try {
      const plans = await fetchTrainingPlansFromDB();
      return plans.map((plan: Record<string, unknown>) => this.deserializePlan(plan));
    } catch (error) {
      console.error('Failed to load training plans:', error);
      return [];
    }
  }

  // Get active training plan
  async getActivePlan(): Promise<TrainingPlan | null> {
    try {
      // Try localStorage cache first
      let activePlanId = localStorage.getItem(this.ACTIVE_PLAN_KEY);
      
      // If not in localStorage, check DB (via settings)
      if (!activePlanId) {
        try {
          const response = await fetch('/api/settings');
          if (response.ok) {
            const data = await response.json();
            activePlanId = data.settings?.dashboardSettings?.activePlanId || null;
            if (activePlanId) {
              // Cache in localStorage
              localStorage.setItem(this.ACTIVE_PLAN_KEY, activePlanId);
            }
          }
        } catch {
          console.warn('[TRAINING PLANS] Failed to fetch active plan from DB');
        }
      }
      
      if (!activePlanId) return null;
      
      const plan = await this.getPlan(activePlanId);
      return plan;
    } catch (error) {
      console.error('Failed to load active plan:', error);
      return null;
    }
  }

  // Set active training plan
  async setActivePlan(planId: string): Promise<void> {
    // Cache in localStorage for synchronous access
    localStorage.setItem(this.ACTIVE_PLAN_KEY, planId);
    
    // Sync to database (non-blocking)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboardSettings: { activePlanId: planId }
        })
      });
      console.log('[TRAINING PLANS] Active plan synced to DB:', planId);
    } catch (error) {
      console.error('[TRAINING PLANS] Failed to sync active plan to DB:', error);
    }
  }
  
  // Clear active training plan
  async clearActivePlan(): Promise<void> {
    localStorage.removeItem(this.ACTIVE_PLAN_KEY);
    
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboardSettings: { activePlanId: null }
        })
      });
    } catch (error) {
      console.error('[TRAINING PLANS] Failed to clear active plan in DB:', error);
    }
  }

  // Get plan by ID
  async getPlan(planId: string): Promise<TrainingPlan | null> {
    const plans = await this.getPlans();
    return plans.find(p => p.id === planId) || null;
  }

  // Create new training plan
  async createPlan(planData: Omit<TrainingPlan, 'id' | 'createdAt' | 'updatedAt' | 'progress'>): Promise<TrainingPlan> {
    const newPlan: TrainingPlan = {
      id: this.generateId(),
      ...planData,
      createdAt: new Date(),
      updatedAt: new Date(),
      progress: {
        completedWeeks: 0,
        completedSessions: 0,
        totalSessions: this.calculateTotalSessions(planData.weeks),
        adherenceRate: 0
      }
    };

    const plans = await this.getPlans();
    plans.unshift(newPlan);
    await this.savePlans(plans);

    return newPlan;
  }

  // Update training plan
  async updatePlan(planId: string, updates: Partial<TrainingPlan>): Promise<TrainingPlan> {
    const plans = await this.getPlans();
    const planIndex = plans.findIndex(p => p.id === planId);
    
    if (planIndex === -1) {
      throw new Error('Plan not found');
    }

    const updatedPlan = {
      ...plans[planIndex],
      ...updates,
      updatedAt: new Date()
    };

    plans[planIndex] = updatedPlan;
    await this.savePlans(plans);

    return updatedPlan;
  }

  // Delete training plan
  async deletePlan(planId: string): Promise<void> {
    // If deleted plan was active, clear active plan pointer first
    // to avoid a stale activePlanId pointing to a removed record.
    const activePlanId = localStorage.getItem(this.ACTIVE_PLAN_KEY);
    if (activePlanId === planId) {
      await this.clearActivePlan();
    }

    const response = await fetch('/api/training-plans', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    });

    if (!response.ok) {
      let message = 'Failed to delete training plan';
      try {
        const data = await response.json();
        if (data?.error) message = data.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    // Defensive: if the active plan was derived from settings and not localStorage,
    // make sure it's cleared too.
    const activePlan = await this.getActivePlan();
    if (activePlan?.id === planId) {
      await this.clearActivePlan();
    }
  }

  // Mark session as completed
  async completeSession(planId: string, weekId: string, sessionId: string, actualSession?: Session): Promise<void> {
    const plan = await this.getPlan(planId);
    if (!plan) throw new Error('Plan not found');

    const week = plan.weeks.find((w: TrainingWeek) => w.id === weekId);
    if (!week) throw new Error('Week not found');

    const session = week.sessions.find((s: TrainingSession) => s.id === sessionId);
    if (!session) throw new Error('Session not found');

    // Mark session as completed
    session.completed = true;
    session.actualSession = actualSession;

    // Update week progress
    const completedSessionsInWeek = week.sessions.filter((s: TrainingSession) => s.completed).length;
    week.completed = completedSessionsInWeek === week.sessions.length;
    
    if (actualSession) {
      week.actualVolume += actualSession.duration / 60; // Convert to minutes
    }

    // Update plan progress
    this.updatePlanProgress(plan);

    // Save updated plan
    const plans = await this.getPlans();
    const planIndex = plans.findIndex((p: TrainingPlan) => p.id === planId);
    if (planIndex !== -1) {
      plans[planIndex] = { ...plan, updatedAt: new Date() };
      await this.savePlans(plans);
    }
  }

  // Get current week for active plan
  async getCurrentWeek(): Promise<TrainingWeek | null> {
    const activePlan = await this.getActivePlan();
    if (!activePlan || !activePlan.startDate) return null;

    const daysSinceStart = Math.floor((Date.now() - activePlan.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentWeekNumber = Math.floor(daysSinceStart / 7) + 1;

    return activePlan.weeks.find((w: TrainingWeek) => w.weekNumber === currentWeekNumber) || null;
  }

  // Get today's session
  async getTodaysSession(): Promise<TrainingSession | null> {
    const currentWeek = await this.getCurrentWeek();
    if (!currentWeek) return null;

    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    return currentWeek.sessions.find((s: TrainingSession) => s.day === today) || null;
  }

  // Calculate plan adherence
  calculateAdherence(plan: TrainingPlan): number {
    const totalSessions = plan.progress.totalSessions;
    const completedSessions = plan.progress.completedSessions;
    
    return totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
  }

  // Get plan templates
  getTemplates(): PlanTemplate[] {
    return [
      {
        id: 'beginner_general',
        name: 'Beginner General Fitness',
        description: '3-4 sessions per week focusing on basic fitness and technique',
        level: 'beginner',
        focus: 'general_fitness',
        duration: 8,
        structure: this.generateBeginnerGeneralStructure()
      },
      {
        id: 'intermediate_endurance',
        name: 'Intermediate Endurance',
        description: '4-5 sessions per week building aerobic capacity',
        level: 'intermediate',
        focus: 'endurance',
        duration: 12,
        structure: this.generateIntermediateEnduranceStructure()
      },
      {
        id: 'advanced_speed',
        name: 'Advanced Speed & Power',
        description: '5-6 sessions per week focusing on high-intensity work',
        level: 'advanced',
        focus: 'speed',
        duration: 16,
        structure: this.generateAdvancedSpeedStructure()
      }
    ];
  }

  // Private helper methods
  private async savePlans(plans: TrainingPlan[]): Promise<void> {
    try {
      console.log('[TRAINING PLANS] Saving plans to database:', plans.length);
      await saveTrainingPlansToDB(plans as unknown as Record<string, unknown>[]);
    } catch (error) {
      console.error('Failed to save training plans:', error);
    }
  }

  private generateId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateTotalSessions(weeks: TrainingWeek[]): number {
    return weeks.reduce((total, week) => total + week.sessions.length, 0);
  }

  private updatePlanProgress(plan: TrainingPlan): void {
    const completedWeeks = plan.weeks.filter(w => w.completed).length;
    const completedSessions = plan.weeks.reduce((total, week) => 
      total + week.sessions.filter(s => s.completed).length, 0
    );
    const totalSessions = this.calculateTotalSessions(plan.weeks);
    const adherenceRate = this.calculateAdherence(plan);

    plan.progress = {
      completedWeeks,
      completedSessions,
      totalSessions,
      adherenceRate
    };
  }

  private serializePlan(plan: TrainingPlan): Record<string, unknown> {
    return {
      ...plan,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      startDate: plan.startDate?.toISOString()
    };
  }

  private deserializePlan(plan: Record<string, unknown>): TrainingPlan {
    return {
      ...plan,
      createdAt: new Date(plan.createdAt as string | Date),
      updatedAt: new Date(plan.updatedAt as string | Date),
      startDate: plan.startDate ? new Date(plan.startDate as string | Date) : undefined,
      // Transform flat progress fields into nested progress object
      progress: {
        completedWeeks: (plan.completedWeeks as number) || 0,
        completedSessions: (plan.completedSessions as number) || 0,
        totalSessions: (plan.totalSessions as number) || 0,
        adherenceRate: (plan.adherenceRate as number) || 0,
      }
    } as TrainingPlan;
  }

  // Template generators
  private generateBeginnerGeneralStructure(): Omit<TrainingWeek, 'id' | 'completed' | 'actualVolume'>[] {
    // 8-week beginner structure
    return Array.from({ length: 8 }, (_, weekIndex) => ({
      weekNumber: weekIndex + 1,
      focus: weekIndex < 4 ? 'Base Building' : 'Progressive Loading',
      totalVolume: weekIndex < 4 ? 120 : 150, // minutes per week
      sessions: this.generateBeginnerWeeklySessions(weekIndex)
    }));
  }

  private generateIntermediateEnduranceStructure(): Omit<TrainingWeek, 'id' | 'completed' | 'actualVolume'>[] {
    // 12-week intermediate structure
    return Array.from({ length: 12 }, (_, weekIndex) => ({
      weekNumber: weekIndex + 1,
      focus: this.getEnduranceWeekFocus(weekIndex),
      totalVolume: 180 + (weekIndex * 10), // Progressive loading
      sessions: this.generateIntermediateWeeklySessions(weekIndex)
    }));
  }

  private generateAdvancedSpeedStructure(): Omit<TrainingWeek, 'id' | 'completed' | 'actualVolume'>[] {
    // 16-week advanced structure
    return Array.from({ length: 16 }, (_, weekIndex) => ({
      weekNumber: weekIndex + 1,
      focus: this.getSpeedWeekFocus(weekIndex),
      totalVolume: 240 + (weekIndex * 5), // High volume with progression
      sessions: this.generateAdvancedWeeklySessions(weekIndex)
    }));
  }

  private generateBeginnerWeeklySessions(weekIndex: number): TrainingSession[] {
    const baseSessions: TrainingSession[] = [
      {
        id: this.generateId(),
        day: 1, // Monday
        week: weekIndex + 1,
        type: 'endurance',
        title: 'Easy Endurance',
        description: 'Steady row focusing on technique',
        duration: 30,
        intensity: 'low',
        completed: false
      },
      {
        id: this.generateId(),
        day: 3, // Wednesday
        week: weekIndex + 1,
        type: 'technique',
        title: 'Technique Drills',
        description: 'Focus on blade work and body position',
        duration: 25,
        intensity: 'low',
        completed: false
      },
      {
        id: this.generateId(),
        day: 5, // Friday
        week: weekIndex + 1,
        type: 'interval',
        title: 'Light Intervals',
        description: 'Short intervals with recovery',
        duration: 35,
        intensity: 'medium',
        completed: false
      }
    ];

    return baseSessions;
  }

  private generateIntermediateWeeklySessions(weekIndex: number): TrainingSession[] {
    return [
      {
        id: this.generateId(),
        day: 1, // Monday
        week: weekIndex + 1,
        type: 'endurance',
        title: 'Steady State',
        description: 'Moderate intensity endurance work',
        duration: 45,
        intensity: 'medium',
        completed: false
      },
      {
        id: this.generateId(),
        day: 2, // Tuesday
        week: weekIndex + 1,
        type: 'interval',
        title: 'Threshold Intervals',
        description: 'Work at threshold pace',
        duration: 40,
        intensity: 'high',
        completed: false
      },
      {
        id: this.generateId(),
        day: 4, // Thursday
        week: weekIndex + 1,
        type: 'tempo',
        title: 'Tempo Row',
        description: 'Sustained moderate-high intensity',
        duration: 35,
        intensity: 'medium',
        completed: false
      },
      {
        id: this.generateId(),
        day: 6, // Saturday
        week: weekIndex + 1,
        type: 'endurance',
        title: 'Long Row',
        description: 'Extended endurance session',
        duration: 60,
        intensity: 'low',
        completed: false
      }
    ];
  }

  private generateAdvancedWeeklySessions(weekIndex: number): TrainingSession[] {
    return [
      {
        id: this.generateId(),
        day: 1, // Monday
        week: weekIndex + 1,
        type: 'interval',
        title: 'High-Intensity Intervals',
        description: 'Short, intense intervals with long recovery',
        duration: 50,
        intensity: 'high',
        completed: false
      },
      {
        id: this.generateId(),
        day: 2, // Tuesday
        week: weekIndex + 1,
        type: 'strength',
        title: 'Power Intervals',
        description: 'Focus on power development',
        duration: 45,
        intensity: 'high',
        completed: false
      },
      {
        id: this.generateId(),
        day: 3, // Wednesday
        week: weekIndex + 1,
        type: 'technique',
        title: 'Technique & Recovery',
        description: 'Light technique work',
        duration: 30,
        intensity: 'low',
        completed: false
      },
      {
        id: this.generateId(),
        day: 4, // Thursday
        week: weekIndex + 1,
        type: 'tempo',
        title: 'Race Pace Tempo',
        description: 'Extended work at race pace',
        duration: 55,
        intensity: 'high',
        completed: false
      },
      {
        id: this.generateId(),
        day: 5, // Friday
        week: weekIndex + 1,
        type: 'interval',
        title: 'Speed Development',
        description: 'Short sprints and speed work',
        duration: 40,
        intensity: 'high',
        completed: false
      },
      {
        id: this.generateId(),
        day: 6, // Saturday
        week: weekIndex + 1,
        type: 'endurance',
        title: 'Long Endurance',
        description: 'Extended steady state work',
        duration: 90,
        intensity: 'medium',
        completed: false
      }
    ];
  }

  private getEnduranceWeekFocus(weekIndex: number): string {
    if (weekIndex < 4) return 'Base Building';
    if (weekIndex < 8) return 'Aerobic Development';
    if (weekIndex < 10) return 'Threshold Training';
    return 'Peak Preparation';
  }

  private getSpeedWeekFocus(weekIndex: number): string {
    if (weekIndex < 4) return 'Power Base';
    if (weekIndex < 8) return 'Speed Development';
    if (weekIndex < 12) return 'Race Preparation';
    if (weekIndex < 14) return 'Peak Training';
    return 'Taper & Competition';
  }
}

// Export singleton instance
export const trainingPlans = TrainingPlansService.getInstance();
