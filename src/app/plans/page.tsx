'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { trainingPlans, TrainingPlan, TrainingWeek, TrainingSession } from '@/lib/trainingPlans';
import { cloudAI } from '@/lib/cloudAI';
import { useRowingStore } from '@/lib/store';
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
  Upload
} from 'lucide-react';

export default function PlansPage() {
  const { getSessions } = useRowingStore();
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<TrainingWeek | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [adherenceAnalysis, setAdherenceAnalysis] = useState<string | null>(null);

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
  }, []);

  const loadPlans = () => {
    try {
      const allPlans = trainingPlans.getPlans();
      const active = trainingPlans.getActivePlan();
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

      if (isAI && cloudAI.isConfigured()) {
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
      } else {
        // Template-based plan
        const templates = trainingPlans.getTemplates();
        const template = templates.find(t => t.level === planForm.level && t.focus === planForm.focus);
        
        if (!template) {
          throw new Error('No template found for selected level and focus');
        }

        const goals = planForm.goals.split(',').map(g => g.trim()).filter(g => g);
        newPlan = trainingPlans.createPlan({
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

  const handleActivatePlan = (planId: string) => {
    try {
      trainingPlans.setActivePlan(planId);
      const plan = trainingPlans.getPlan(planId);
      if (plan) {
        // Update plan status to active and set start date
        const updatedPlan = trainingPlans.updatePlan(planId, {
          status: 'active',
          startDate: new Date()
        });
        setActivePlan(updatedPlan);
        setPlans(plans.map(p => p.id === planId ? updatedPlan : p));
      }
    } catch (err) {
      setError('Failed to activate plan');
    }
  };

  const handleCompleteSession = (planId: string, weekId: string, sessionId: string) => {
    try {
      const userSessions = getSessions();
      // Find the most recent session that might match this planned session
      const recentSession = userSessions[0]; // Assuming sessions are sorted by date
      
      trainingPlans.completeSession(planId, weekId, sessionId, recentSession);
      loadPlans(); // Reload to get updated progress
    } catch (err) {
      setError('Failed to complete session');
    }
  };

  const handleDeletePlan = (planId: string) => {
    if (confirm('Are you sure you want to delete this plan?')) {
      try {
        trainingPlans.deletePlan(planId);
        setPlans(plans.filter(p => p.id !== planId));
        if (activePlan?.id === planId) {
          setActivePlan(null);
        }
      } catch (err) {
        setError('Failed to delete plan');
      }
    }
  };

  const handleAnalyzeAdherence = async () => {
    if (!activePlan || !cloudAI.isConfigured()) return;

    setIsLoading(true);
    setError(null);

    try {
      const userSessions = getSessions();
      const analysis = await cloudAI.analyzePlanAdherence(activePlan, userSessions);
      setAdherenceAnalysis(analysis);
    } catch (err) {
      setError('Failed to analyze adherence');
    } finally {
      setIsLoading(false);
    }
  };

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
        <Alert className="mb-4 border-red-200 bg-red-50">
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-blue-600" />
                  {activePlan.title}
                </CardTitle>
                <CardDescription>{activePlan.description}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(activePlan.status)}
                <Button variant="outline" size="sm" onClick={handleAnalyzeAdherence}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Analyze Progress
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

            {/* Adherence Analysis */}
            {adherenceAnalysis && (
              <Alert className="mb-4">
                <TrendingUp className="h-4 w-4" />
                <AlertDescription>
                  <div className="whitespace-pre-wrap">{adherenceAnalysis}</div>
                </AlertDescription>
              </Alert>
            )}

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
                        className={`p-3 border rounded-lg flex items-center justify-between ${
                          session.completed ? 'bg-green-50 border-green-200' : 'bg-white'
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
          <div className="grid gap-4">
            {plans.map((plan) => (
              <Card key={plan.id} className={plan.id === activePlan?.id ? 'border-blue-200' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {plan.title}
                        {plan.id === activePlan?.id && (
                          <Play className="h-4 w-4 text-blue-600" />
                        )}
                      </CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(plan.status)}
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">{plan.level}</Badge>
                        <Badge variant="outline">{plan.focus}</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{plan.duration} weeks</span>
                      <span>{plan.progress.totalSessions} sessions</span>
                      <span>Created {plan.createdAt.toLocaleDateString()}</span>
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
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePlan(plan.id)}
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
    </div>
  );
}
