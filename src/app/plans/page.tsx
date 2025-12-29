'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { trainingPlans, TrainingPlan, TrainingWeek, TrainingSession } from '@/lib/trainingPlans';
import { cloudAI } from '@/lib/cloudAI';
import { initializeCloudAIFromSettings, isAIAvailable, getAIConfigurationErrorMessage } from '@/lib/aiConfig';
import { useRowingStore } from '@/lib/store';
import { formatDateOnly } from '@/lib/dateTimeUtils';
import { memoryStorage } from '@/lib/memoryStorage';
import { chatStorage } from '@/lib/chatStorage';
import {
  Calendar,
  Play,
  Pause,
  CheckCircle,
  Circle,
  Plus,
  Edit2,
  Trash2,
  Target,
  TrendingUp,
  Clock,
  Zap,
  Users,
  AlertTriangle,
  Loader2,
  Eye,
  Settings,
  Download,
  Upload,
  History,
  RotateCcw,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PlanAnalysisArchiveModal } from '@/components/PlanAnalysisArchiveModal';

export default function PlansPage() {
  const router = useRouter();
  const { getSessions, setPendingPlanAnalysis } = useRowingStore();
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<TrainingWeek | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAnalysisArchive, setShowAnalysisArchive] = useState(false);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [viewingPlan, setViewingPlan] = useState<TrainingPlan | null>(null);
  const [editingPlan, setEditingPlan] = useState<TrainingPlan | null>(null);
  const [resetPlanId, setResetPlanId] = useState<string | null>(null);

  // Form state for plan creation
  const [planForm, setPlanForm] = useState({
    title: '',
    description: '',
    goals: '',
    level: 'intermediate' as 'beginner' | 'intermediate' | 'advanced',
    focus: 'general_fitness' as 'general_fitness' | 'endurance' | 'speed' | 'strength' | 'competition',
    duration: 8
  });

  useEffect(() => {
    loadPlans();
    // Keep AI availability consistent across reloads/navigation.
    initializeCloudAIFromSettings();
  }, []);

  // Auto-select current week when active plan changes
  useEffect(() => {
    const selectWeek = async () => {
      if (activePlan && activePlan.weeks.length > 0) {
        // Try to restore selected week from localStorage
        const savedWeekId = localStorage.getItem(`selectedWeek_${activePlan.id}`);
        if (savedWeekId) {
          const savedWeek = activePlan.weeks.find(w => w.id === savedWeekId);
          if (savedWeek) {
            setSelectedWeek(savedWeek);
            return;
          }
        }
        
        // Try to get current week based on start date
        const currentWeek = await trainingPlans.getCurrentWeek();
        if (currentWeek) {
          setSelectedWeek(currentWeek);
        } else {
          // Fallback to first week if no current week found
          setSelectedWeek(activePlan.weeks[0]);
        }
      } else {
        setSelectedWeek(null);
      }
    };
    
    selectWeek();
  }, [activePlan]);

  // Save selected week to localStorage when it changes
  useEffect(() => {
    if (selectedWeek && activePlan) {
      localStorage.setItem(`selectedWeek_${activePlan.id}`, selectedWeek.id);
    }
  }, [selectedWeek, activePlan]);

  const loadPlans = async () => {
    try {
      const allPlans = await trainingPlans.getPlans();
      const active = await trainingPlans.getActivePlan();
      setPlans(allPlans);
      setActivePlan(active);
      setError(null);
    } catch (err) {
      setError('Failed to load training plans');
    }
  };

  const handleCreatePlan = async (isAI: boolean = false) => {
    if (!planForm.title.trim() || !planForm.goals.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let newPlan: TrainingPlan;

      if (isAI) {
        // Ensure AI is configured from persisted settings (API key is stored in localStorage).
        initializeCloudAIFromSettings();

        if (!isAIAvailable()) {
          const errorMessage = getAIConfigurationErrorMessage();
          setError(errorMessage || 'Configure OpenAI API key to use AI generation');
          return;
        }

        // AI-generated plan
        const goals = planForm.goals.split(',').map(g => g.trim()).filter(g => g);
        const userSessions = getSessions();

        newPlan = await cloudAI.generateTrainingPlan(
          goals,
          planForm.level,
          planForm.focus,
          planForm.duration,
          userSessions
        );

        // Save AI-generated plan to database
        newPlan = await trainingPlans.createPlan({
          title: newPlan.title,
          description: newPlan.description,
          goals: newPlan.goals,
          level: newPlan.level,
          focus: newPlan.focus,
          duration: newPlan.duration,
          weeks: newPlan.weeks,
          status: newPlan.status
        });
      } else {
        // Template-based plan
        const templates = trainingPlans.getTemplates();
        const template = templates.find(t => t.level === planForm.level && t.focus === planForm.focus);

        if (!template) {
          throw new Error('No template found for selected level and focus');
        }

        const goals = planForm.goals.split(',').map(g => g.trim()).filter(g => g);
        newPlan = await trainingPlans.createPlan({
          title: planForm.title,
          description: planForm.description,
          goals,
          level: planForm.level,
          focus: planForm.focus,
          duration: planForm.duration,
          weeks: template.structure.map((week, index) => ({
            ...week,
            id: `week_${Date.now()}_${index}`,
            completed: false,
            actualVolume: 0
          })),
          status: 'draft'
        });
      }

      setPlans([newPlan, ...plans]);
      setShowCreateForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivatePlan = async (planId: string) => {
    try {
      // First, update the currently active plan's status to 'paused'
      const currentActivePlan = await trainingPlans.getActivePlan();
      if (currentActivePlan && currentActivePlan.id !== planId) {
        await trainingPlans.updatePlan(currentActivePlan.id, {
          status: 'paused'
        });
      }

      // Set the new plan as active
      trainingPlans.setActivePlan(planId);
      const plan = await trainingPlans.getPlan(planId);
      if (plan) {
        // Update plan status to active and set start date
        const updatedPlan = await trainingPlans.updatePlan(planId, {
          status: 'active',
          startDate: new Date()
        });

        // Sync to memory for AI coach access
        await memoryStorage.addSystemDocument(
          'training_plan',
          `Training Plan: ${plan.title}`,
          {
            id: plan.id,
            title: plan.title,
            description: plan.description,
            goals: plan.goals,
            level: plan.level,
            focus: plan.focus,
            duration: plan.duration,
            startDate: new Date().toISOString(),
            weeklyStructure: plan.weeks.map(w => ({
              weekNumber: w.weekNumber,
              focus: w.focus,
              totalVolume: w.totalVolume,
              sessions: w.sessions.map(s => ({
                day: s.day,
                type: s.type,
                title: s.title,
                duration: s.duration,
                intensity: s.intensity,
              }))
            }))
          },
          {
            description: `${plan.duration}-week ${plan.level} ${plan.focus} plan`,
            status: 'active'
          }
        );

        // Reload plans from localStorage to ensure state synchronization
        loadPlans();
      }
    } catch (err) {
      setError('Failed to activate plan');
    }
  };

  const handleCompleteSession = async (planId: string, weekId: string, sessionId: string) => {
    try {
      const userSessions = getSessions();
      // Find the most recent session that might match this planned session
      const recentSession = userSessions[0]; // Assuming sessions are sorted by date

      await trainingPlans.completeSession(planId, weekId, sessionId, recentSession);
      
      // Update local state immediately for better UX
      if (activePlan && activePlan.id === planId) {
        const updatedActivePlan = await trainingPlans.getPlan(planId);
        if (updatedActivePlan) {
          setActivePlan(updatedActivePlan);
          // Update selected week if it's the one being modified
          if (selectedWeek && selectedWeek.id === weekId) {
            const updatedWeek = updatedActivePlan.weeks.find(w => w.id === weekId);
            if (updatedWeek) {
              setSelectedWeek(updatedWeek);
            }
          }
        }
      }
      
      // Update plans list
      const updatedPlans = await trainingPlans.getPlans();
      setPlans(updatedPlans);
    } catch (err) {
      setError('Failed to complete session');
    }
  };

  const handleDeletePlan = (planId: string) => {
    setDeletePlanId(planId);
  };

  const confirmDeletePlan = async () => {
    if (!deletePlanId) return;
    try {
      await trainingPlans.deletePlan(deletePlanId);
      setPlans(plans.filter(p => p.id !== deletePlanId));
      if (activePlan?.id === deletePlanId) {
        setActivePlan(null);
      }
    } catch (err) {
      setError('Failed to delete plan');
    }
    setDeletePlanId(null);
  };

  const handleResetPlan = (planId: string) => {
    setResetPlanId(planId);
  };

  const confirmResetPlan = async () => {
    if (!resetPlanId) return;
    try {
      const plan = await trainingPlans.getPlan(resetPlanId);
      await trainingPlans.updatePlan(resetPlanId, {
        status: 'draft',
        startDate: undefined,
        progress: {
          completedWeeks: 0,
          completedSessions: 0,
          totalSessions: plan?.progress.totalSessions || 0,
          adherenceRate: 0
        }
      });
      loadPlans();
    } catch (err) {
      setError('Failed to reset plan');
    }
    setResetPlanId(null);
  };

  const handleEditPlan = (plan: TrainingPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      title: plan.title,
      description: plan.description,
      goals: plan.goals.join(', '),
      level: plan.level,
      focus: plan.focus,
      duration: plan.duration
    });
  };

  const handleSaveEdit = async () => {
    if (!editingPlan) return;
    try {
      await trainingPlans.updatePlan(editingPlan.id, {
        title: planForm.title,
        description: planForm.description,
        goals: planForm.goals.split(',').map(g => g.trim()).filter(g => g),
        level: planForm.level,
        focus: planForm.focus,
        duration: planForm.duration
      });
      loadPlans();
      setEditingPlan(null);
      resetForm();
    } catch (err) {
      setError('Failed to update plan');
    }
  };

  const handleAnalyzeAdherence = useCallback(() => {
    if (!activePlan) return;

    const userSessions = getSessions();

    // Build a comprehensive prompt with plan and session data
    const planSummary = {
      title: activePlan.title,
      description: activePlan.description,
      level: activePlan.level,
      focus: activePlan.focus,
      duration: activePlan.duration,
      status: activePlan.status,
      progress: activePlan.progress,
      weeks: activePlan.weeks.map(week => ({
        weekNumber: week.weekNumber,
        sessions: week.sessions.map(s => ({
          day: s.day,
          type: s.type,
          duration: s.duration,
          intensity: s.intensity,
          description: s.description
        }))
      }))
    };

    // Get recent sessions for context (last 30 days or last 20 sessions)
    const recentSessions = userSessions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20)
      .map(s => ({
        date: new Date(s.timestamp).toISOString().split('T')[0],
        distance: s.distance,
        duration: s.duration,
        avgPower: s.avgPower,
        avgSplit: s.avgSplit,
        avgStrokeRate: s.avgStrokeRate
      }));

    const prompt = `Please analyze my progress on my training plan "${activePlan.title}".

**Training Plan Details:**
${JSON.stringify(planSummary, null, 2)}

**My Recent Rowing Sessions (last ${recentSessions.length} sessions):**
${JSON.stringify(recentSessions, null, 2)}

Please provide:
1. An assessment of how well I'm following the plan
2. Areas where I'm doing well
3. Areas that need improvement
4. Specific recommendations for the coming week
5. Any adjustments to the plan based on my actual performance`;

    // Store pending plan analysis data for chat handoff
    setPendingPlanAnalysis({
      planId: activePlan.id,
      planTitle: activePlan.title,
      prompt,
      planData: JSON.stringify(planSummary, null, 2)
    });

    // Navigate to chat
    router.push('/chat?fromPlanAnalysis=true');
  }, [activePlan, getSessions, setPendingPlanAnalysis, router]);

  const resetForm = () => {
    setPlanForm({
      title: '',
      description: '',
      goals: '',
      level: 'intermediate',
      focus: 'general_fitness',
      duration: 8
    });
  };

  const getSessionIcon = (type: TrainingSession['type']) => {
    switch (type) {
      case 'endurance': return <Clock className="h-4 w-4" />;
      case 'interval': return <Zap className="h-4 w-4" />;
      case 'tempo': return <TrendingUp className="h-4 w-4" />;
      case 'strength': return <Target className="h-4 w-4" />;
      case 'technique': return <Users className="h-4 w-4" />;
      case 'recovery': return <Pause className="h-4 w-4" />;
      case 'rest': return <Circle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getIntensityColor = (intensity: TrainingSession['intensity']) => {
    switch (intensity) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusBadge = (status: TrainingPlan['status']) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'completed': return <Badge className="bg-blue-100 text-blue-800">Completed</Badge>;
      case 'paused': return <Badge className="bg-yellow-100 text-yellow-800">Paused</Badge>;
      case 'draft': return <Badge variant="outline">Draft</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatDayName = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Target className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Training Plans</h1>
            <p className="text-muted-foreground">
              AI-powered training programs designed for your goals
            </p>
          </div>
        </div>

        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50 text-red-900 dark:bg-red-900/20 dark:border-red-900 dark:text-red-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              ×
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Create Plan Form */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Training Plan</CardTitle>
            <CardDescription>
              Choose between AI-generated personalized plan or template-based plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Plan Title *</Label>
                <Input
                  id="title"
                  value={planForm.title}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Summer Endurance Program"
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (weeks)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="4"
                  max="24"
                  value={planForm.duration}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={planForm.description}
                onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of your training plan"
              />
            </div>

            <div>
              <Label htmlFor="goals">Goals *</Label>
              <Input
                id="goals"
                value={planForm.goals}
                onChange={(e) => setPlanForm(prev => ({ ...prev, goals: e.target.value }))}
                placeholder="e.g., improve 2k time, build aerobic base, increase power"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separate multiple goals with commas
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="level">Experience Level</Label>
                <select
                  id="level"
                  value={planForm.level}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, level: e.target.value as any }))}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <Label htmlFor="focus">Training Focus</Label>
                <select
                  id="focus"
                  value={planForm.focus}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, focus: e.target.value as any }))}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="general_fitness">General Fitness</option>
                  <option value="endurance">Endurance</option>
                  <option value="speed">Speed & Power</option>
                  <option value="strength">Strength</option>
                  <option value="competition">Competition</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleCreatePlan(false)}
                disabled={isLoading || !planForm.title.trim() || !planForm.goals.trim()}
                variant="outline"
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Use Template
              </Button>
              <Button
                onClick={() => handleCreatePlan(true)}
                disabled={isLoading || !planForm.title.trim() || !planForm.goals.trim() || !cloudAI.isConfigured()}
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Generate with AI
              </Button>
              <Button variant="ghost" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              {!cloudAI.isConfigured() && (
                <span className="text-sm text-muted-foreground">
                  Configure OpenAI API key to use AI generation
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Plan */}
      {activePlan && (
        <Card className="mb-6 border-blue-200">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0 pb-4">
                  <Play className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <CardTitle className="truncate">
                    {activePlan.title}
                  </CardTitle>
                </div>
                <CardDescription>{activePlan.description}</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {getStatusBadge(activePlan.status)}
                <Button variant="outline" size="sm" onClick={handleAnalyzeAdherence}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Analyze Progress
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAnalysisArchive(true)}>
                  <History className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {activePlan.progress.completedWeeks}/{activePlan.duration}
                </div>
                <div className="text-sm text-muted-foreground">Weeks Complete</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {activePlan.progress.completedSessions}/{activePlan.progress.totalSessions}
                </div>
                <div className="text-sm text-muted-foreground">Sessions Done</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {activePlan.progress.adherenceRate.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Adherence Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {activePlan.goals.length}
                </div>
                <div className="text-sm text-muted-foreground">Goals</div>
              </div>
            </div>

            {/* Week Navigation */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Weekly Schedule</h3>
                <span className="text-sm text-muted-foreground">
                  (Week {selectedWeek?.weekNumber || 1})
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                {activePlan.weeks.map((week) => (
                  <Button
                    key={week.id}
                    variant={selectedWeek?.id === week.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedWeek(week)}
                  >
                    Week {week.weekNumber}
                    {week.completed && <CheckCircle className="h-3 w-3 ml-1" />}
                  </Button>
                ))}
              </div>

              {/* Selected Week Sessions */}
              {selectedWeek && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{selectedWeek.focus}</h4>
                    <Badge variant="outline">
                      {selectedWeek.sessions.filter(s => s.completed).length}/{selectedWeek.sessions.length} Complete
                    </Badge>
                  </div>

                  <div className="grid gap-2">
                    {selectedWeek.sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`p-3 border rounded-lg flex items-center justify-between ${session.completed ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-card dark:bg-card'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${getIntensityColor(session.intensity)}`}>
                            {getSessionIcon(session.type)}
                          </div>
                          <div>
                            <div className="font-medium">{session.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatDayName(session.day)} • {session.duration}min • {session.type}
                            </div>
                            {session.description && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {session.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.completed ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleCompleteSession(activePlan.id, selectedWeek.id, session.id)}
                            >
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Plans */}
      <div>
        <h2 className="text-xl font-semibold mb-4">All Plans</h2>
        {plans.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No Training Plans Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first training plan to get started with structured workouts.
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {plans
              .filter((plan) => plan.id !== activePlan?.id)
              .map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle className="truncate pb-4">
                      {plan.title}
                    </CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {getStatusBadge(plan.status)}
                      <Badge variant="outline">{plan.level}</Badge>
                      <Badge variant="outline">{plan.focus}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{plan.duration} weeks</span>
                      <span>{plan.progress.totalSessions} sessions</span>
                      <span>Created {formatDateOnly(plan.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {plan.id !== activePlan?.id && (
                        <Button
                          size="sm"
                          onClick={() => handleActivatePlan(plan.id)}
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingPlan(plan)}
                        title="View plan details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPlan(plan)}
                        title="Edit plan"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetPlan(plan.id)}
                        title="Reset progress"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePlan(plan.id)}
                        title="Delete plan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deletePlanId !== null}
        onOpenChange={(open) => !open && setDeletePlanId(null)}
        title="Delete Training Plan"
        description="Are you sure you want to delete this training plan? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeletePlan}
        variant="destructive"
      />

      <ConfirmDialog
        open={resetPlanId !== null}
        onOpenChange={(open) => !open && setResetPlanId(null)}
        title="Reset Training Plan"
        description="This will reset all progress and set the plan status back to 'Draft'. The weekly schedule will be preserved."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={confirmResetPlan}
        variant="destructive"
      />

      {/* View Plan Modal */}
      {viewingPlan && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{viewingPlan.title}</CardTitle>
                  <CardDescription>{viewingPlan.description}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setViewingPlan(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Level</Label>
                  <p className="font-medium capitalize">{viewingPlan.level}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Focus</Label>
                  <p className="font-medium capitalize">{viewingPlan.focus.replace('_', ' ')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Duration</Label>
                  <p className="font-medium">{viewingPlan.duration} weeks</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p className="font-medium capitalize">{viewingPlan.status}</p>
                </div>
              </div>
              {viewingPlan.goals.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Goals</Label>
                  <ul className="list-disc list-inside mt-1">
                    {viewingPlan.goals.map((goal, i) => (
                      <li key={i} className="text-sm">{goal}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Progress</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div className="text-center p-2 bg-muted rounded">
                    <div className="text-lg font-bold">{viewingPlan.progress.completedWeeks}/{viewingPlan.duration}</div>
                    <div className="text-xs text-muted-foreground">Weeks</div>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
                    <div className="text-lg font-bold">{viewingPlan.progress.completedSessions}/{viewingPlan.progress.totalSessions}</div>
                    <div className="text-xs text-muted-foreground">Sessions</div>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
                    <div className="text-lg font-bold">{viewingPlan.progress.adherenceRate.toFixed(0)}%</div>
                    <div className="text-xs text-muted-foreground">Adherence</div>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Weekly Schedule ({viewingPlan.weeks.length} weeks)</Label>
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {viewingPlan.weeks.map((week) => (
                    <div key={week.weekNumber} className="p-2 border rounded text-sm">
                      <div className="font-medium">Week {week.weekNumber}: {week.focus}</div>
                      <div className="text-muted-foreground">{week.sessions.length} sessions, {week.totalVolume} min total</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Edit Training Plan</CardTitle>
              <CardDescription>Update the plan details. Weekly schedule cannot be edited.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={planForm.title}
                  onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-goals">Goals (comma-separated)</Label>
                <Input
                  id="edit-goals"
                  value={planForm.goals}
                  onChange={(e) => setPlanForm({ ...planForm, goals: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-level">Level</Label>
                  <select
                    id="edit-level"
                    value={planForm.level}
                    onChange={(e) => setPlanForm({ ...planForm, level: e.target.value as any })}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="edit-focus">Focus</Label>
                  <select
                    id="edit-focus"
                    value={planForm.focus}
                    onChange={(e) => setPlanForm({ ...planForm, focus: e.target.value as any })}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="general_fitness">General Fitness</option>
                    <option value="endurance">Endurance</option>
                    <option value="speed">Speed</option>
                    <option value="strength">Strength</option>
                    <option value="competition">Competition</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => { setEditingPlan(null); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <PlanAnalysisArchiveModal
        open={showAnalysisArchive}
        onOpenChange={setShowAnalysisArchive}
        planId={activePlan?.id}
        planTitle={activePlan?.title}
      />
    </div>
  );
}
