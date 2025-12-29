'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { settings, Settings, UserPreferences, DataManagement, TrainingSettings, NotificationSettings, PrivacySettings, AISettings } from '@/lib/settings';
import { cloudAI } from '@/lib/cloudAI';
import { deleteAllInsightsFromDB } from '@/lib/dataSync';
import { useAIInsights } from '@/hooks/useAIInsights';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_CHAT_SYSTEM_PROMPT,
  DEFAULT_PLAN_GENERATION_PROMPT,
  DEFAULT_INSIGHTS_PROMPT,
  DEFAULT_EXPLAIN_CHART_PROMPT,
  DEFAULT_AWARD_SUGGESTIONS_PROMPT,
  DEFAULT_USER_PROFILE_PROMPT
} from '@/lib/aiPromptDefaults';
import {
  DEFAULT_ACHIEVEMENT_IMAGE_PROMPT,
  DEFAULT_ACHIEVEMENT_STORY_PROMPT
} from '@/types/achievement';
import { ACHIEVEMENT_COLOR_PALETTES } from '@/lib/achievementColors';
import {
  migrateImagesFromIndexedDB,
  getAllAchievementImageIdsFromIndexedDB
} from '@/lib/imageStorage';
import { memoryStorage, MemoryDocument } from '@/lib/memoryStorage';
import {
  Settings as SettingsIcon,
  User,
  Database,
  Target,
  Bell,
  Shield,
  Brain,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Save,
  AlertTriangle,
  CheckCircle,
  Info,
  Key,
  TestTube,
  FileText,
  Sparkles,
  Heart,
  Loader2,
  Trophy
} from 'lucide-react';
import {
  AI_TEXT_MODEL_OPTIONS,
  AI_REASONING_EFFORT_OPTIONS,
  AI_RESPONSE_VERBOSITY_OPTIONS,
  AI_ACHIEVEMENT_IMAGE_MODEL_OPTIONS,
  AI_ACHIEVEMENT_IMAGE_QUALITY_OPTIONS,
  AI_ACHIEVEMENT_IMAGE_SIZE_OPTIONS,
} from '@/lib/aiModelOptions';

type SettingsCategory =
  | 'userPreferences'
  | 'dataManagement'
  | 'trainingSettings'
  | 'notificationSettings'
  | 'privacySettings'
  | 'aiSettings';

export default function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('userPreferences');
  // Initialize as null to avoid hydration mismatch - load from localStorage after mount
  const [settingsData, setSettingsData] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<DataManagement['storageUsage'] | null>(null);
  
  // Get refreshArchivedInsights from useAIInsights hook
  const { refreshArchivedInsights } = useAIInsights();

  // Load storage usage
  useEffect(() => {
    const loadStorageUsage = async () => {
      const usage = await settings.calculateStorageUsage();
      setStorageUsage(usage);
    };
    loadStorageUsage();
  }, [settingsData]);

  // Toast component for overlay notifications
  const Toast = ({ message, type, onExit }: { message: string; type: 'success' | 'error'; onExit: () => void }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
      // Trigger fade-in animation on mount
      setIsVisible(true);
    }, []);

    const handleExit = () => {
      setIsVisible(false);
      setTimeout(onExit, 300); // Wait for slide-out animation
    };

    useEffect(() => {
      // Auto-dismiss and trigger exit animation
      const exitTimer = setTimeout(handleExit, type === 'success' ? 3000 : 5000);
      return () => clearTimeout(exitTimer);
    }, [type, onExit]);

    return (
      <div
        className={`
          fixed bottom-4 right-4 z-50 max-w-sm transform transition-all duration-300 ease-in-out
          ${isVisible
            ? 'translate-x-0 opacity-100 scale-100'  // Fade in (visible)
            : 'translate-x-0 opacity-0 scale-100'    // Start faded out (no slide)
          }
        `}
      >
        <div
          className={`
            rounded-lg border p-4 shadow-lg flex items-center gap-3
            ${type === 'success'
              ? 'bg-green-700 text-white border-green-800'
              : 'border-red-200 text-red-800 bg-red-50'
            }
          `}
        >
          {type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          )}
          <span className="text-sm font-medium leading-relaxed">{message}</span>
        </div>
      </div>
    );
  };

  // AI Settings state moved to component level (React Rules of Hooks)
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  
  // Personal Context state
  const [isCondensingProfile, setIsCondensingProfile] = useState(false);
  const [profileRawInput, setProfileRawInput] = useState('');
  const [memoryDocuments, setMemoryDocuments] = useState<MemoryDocument[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  
  // Image migration state
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ migrated: number; failed: string[]; total: number } | null>(null);
  const [indexedDBImageCount, setIndexedDBImageCount] = useState<number | null>(null);

  // Prompt editor modal state
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<{
    key: string;
    label: string;
    description: string;
    value: string;
    defaultValue: string;
  } | null>(null);
  const [promptEditorValue, setPromptEditorValue] = useState('');

  // Clear data confirmation dialog state
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [dataCategoryToClear, setDataCategoryToClear] = useState<'sessions' | 'chatHistory' | 'trainingPlans' | 'insightsArchive' | null>(null);

  // Auto-dismiss connection status with proper cleanup
  useEffect(() => {
    if (connectionStatus === 'success' || connectionStatus === 'error') {
      const timeoutId = setTimeout(() => setConnectionStatus('idle'), 3000);
      return () => clearTimeout(timeoutId);
    }
  }, [connectionStatus]);

  useEffect(() => {
    loadSettings();
  }, []);

  // Sync profileRawInput with settings when loaded
  useEffect(() => {
    if (settingsData?.aiSettings?.userProfileRawInput) {
      setProfileRawInput(settingsData.aiSettings.userProfileRawInput);
    }
  }, [settingsData?.aiSettings?.userProfileRawInput]);

  // Load memory documents
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const docs = await memoryStorage.getAllDocuments();
        // Filter to only user-uploaded documents (PDFs and text notes)
        const userDocs = docs.filter(doc => 
          doc.source === 'user' || doc.type === 'note'
        );
        setMemoryDocuments(userDocs);
      } catch (error) {
        console.error('Failed to load memory documents:', error);
      }
    };
    loadDocuments();
  }, []);

  // Check for legacy IndexedDB images that need migration
  useEffect(() => {
    const checkIndexedDBImages = async () => {
      try {
        const ids = await getAllAchievementImageIdsFromIndexedDB();
        setIndexedDBImageCount(ids.length);
      } catch (error) {
        console.error('Failed to check IndexedDB images:', error);
        setIndexedDBImageCount(0);
      }
    };
    checkIndexedDBImages();
  }, []);

  const loadSettings = () => {
    try {
      const data = settings.getSettings();
      setSettingsData(data);
    } catch (error) {
      setErrorMessage('Failed to load settings');
    }
  };

  const clearInsightsArchive = async () => {
    setIsLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const result = await deleteAllInsightsFromDB();
      if (!result.success) {
        setErrorMessage(result.error || 'Failed to clear insights archive');
        return;
      }

      await refreshArchivedInsights?.();
      setSuccessMessage('Insights archive cleared');
    } catch (error) {
      setErrorMessage('Failed to clear insights archive');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPrompt = async (
    promptKey: 'systemPrompt' | 'chatSystemPrompt' | 'planGenerationPrompt' | 'insightsPrompt' | 'explainChartPrompt' | 'awardSuggestionsPrompt',
    defaultValue: string
  ) => {
    await saveSettings('aiSettings', { [promptKey]: defaultValue });
    setSuccessMessage('Prompt reset to default');
  };

  const openPromptEditor = (
    key: string,
    label: string,
    description: string,
    value: string,
    defaultValue: string
  ) => {
    setEditingPrompt({ key, label, description, value, defaultValue });
    setPromptEditorValue(value);
    setPromptEditorOpen(true);
  };

  const savePromptFromEditor = () => {
    if (editingPrompt) {
      // Special handling for userProfileRawInput - also update local state
      if (editingPrompt.key === 'userProfileRawInput') {
        setProfileRawInput(promptEditorValue);
      }
      saveSettings('aiSettings', { [editingPrompt.key]: promptEditorValue });
      setPromptEditorOpen(false);
      setEditingPrompt(null);
    }
  };

  const resetPromptInEditor = async () => {
    if (editingPrompt) {
      setPromptEditorValue(editingPrompt.defaultValue);
      // Save the default value to settings
      await saveSettings('aiSettings', { [editingPrompt.key]: editingPrompt.defaultValue });
      setSuccessMessage('Prompt reset to default');
    }
  };

  const saveSettings = async (category: SettingsCategory, updates: any) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      switch (category) {
        case 'userPreferences':
          settings.updateUserPreferences(updates);
          break;
        case 'dataManagement':
          settings.updateDataManagement(updates);
          break;
        case 'trainingSettings':
          settings.updateTrainingSettings(updates);
          break;
        case 'notificationSettings':
          settings.updateNotificationSettings(updates);
          break;
        case 'privacySettings':
          settings.updatePrivacySettings(updates);
          break;
        case 'aiSettings':
          settings.updateAISettings(updates);
          break;
      }

      loadSettings();
      setSuccessMessage('Settings saved successfully');
    } catch (error) {
      setErrorMessage('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const exportSettings = () => {
    try {
      const data = settings.exportSettings();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rowing-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessMessage('Settings exported successfully');
    } catch (error) {
      setErrorMessage('Failed to export settings');
    }
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result as string;
        const result = settings.importSettings(data);
        if (result.success) {
          loadSettings();
          setSuccessMessage('Settings imported successfully');
        } else {
          setErrorMessage(result.error || 'Failed to import settings');
        }
      };
      reader.readAsText(file);
    }
  };

  const resetCategory = (category: SettingsCategory) => {
    if (!confirm(`Are you sure you want to reset ${category} to default values?`)) return;

    settings.resetCategory(category);
    loadSettings();
    setSuccessMessage('Settings reset to defaults');
  };

  const clearDataCategory = async (category: 'sessions' | 'chatHistory' | 'trainingPlans' | 'insightsArchive') => {
    // Set the category and show dialog instead of using confirm()
    setDataCategoryToClear(category);
    setShowClearDataConfirm(true);
  };

  const executeClearDataCategory = async () => {
    if (!dataCategoryToClear) return;

    try {
      // Handle insightsArchive separately since it's not in settings
      if (dataCategoryToClear === 'insightsArchive') {
        await clearInsightsArchive();
        setShowClearDataConfirm(false);
        setDataCategoryToClear(null);
        return;
      }

      settings.clearDataCategory(dataCategoryToClear);

      // Also clear from Zustand store if clearing sessions
      if (dataCategoryToClear === 'sessions') {
        const { useRowingStore } = require('@/lib/store');
        useRowingStore.getState().clearSessions();
      }

      setSuccessMessage(`${dataCategoryToClear} cleared successfully`);
    } catch (error) {
      setErrorMessage(`Failed to clear ${dataCategoryToClear}`);
    } finally {
      setShowClearDataConfirm(false);
      setDataCategoryToClear(null);
    }
  };

  if (!settingsData) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-64 mb-8"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const categories = [
    { id: 'userPreferences', name: 'User Preferences', icon: User, description: 'Appearance, language, and display options' },
    { id: 'dataManagement', name: 'Data Management', icon: Database, description: 'Export, import, and storage management' },
    { id: 'trainingSettings', name: 'Training Settings', icon: Target, description: 'Training zones, goals, and preferences' },
    { id: 'notificationSettings', name: 'Notifications', icon: Bell, description: 'Alerts and reminders' },
    { id: 'privacySettings', name: 'Privacy', icon: Shield, description: 'Data sharing and privacy controls' },
    { id: 'aiSettings', name: 'AI Settings', icon: Brain, description: 'Configure AI assistant, training plans, achievement generation, etc.' }
  ];

  const renderUserPreferences = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="theme">Theme</Label>
          <select
            id="theme"
            value={settingsData.userPreferences.theme}
            onChange={(e) => saveSettings('userPreferences', { theme: e.target.value as any })}
            className="w-full mt-1 p-2 border rounded-md"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>

        <div>
          <Label htmlFor="lightModeBrightness">
            Light Mode Brightness: {settingsData.userPreferences.lightModeBrightness}%
          </Label>
          <div className="mt-2">
            <Slider
              id="lightModeBrightness"
              value={[settingsData.userPreferences.lightModeBrightness]}
              onValueChange={(value) => saveSettings('userPreferences', { lightModeBrightness: value[0] })}
              min={30}
              max={100}
              step={5}
              disabled={settingsData.userPreferences.theme === 'dark'}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Reduce brightness for a softer light mode appearance (only applies in light mode)
          </p>
        </div>

        <div>
          <Label htmlFor="units">Units</Label>
          <select
            id="units"
            value={settingsData.userPreferences.units}
            onChange={(e) => saveSettings('userPreferences', { units: e.target.value as any })}
            className="w-full mt-1 p-2 border rounded-md"
          >
            <option value="metric">Metric</option>
            <option value="imperial">Imperial</option>
          </select>
        </div>

        <div>
          <Label htmlFor="dateFormat">Date Format</Label>
          <select
            id="dateFormat"
            value={settingsData.userPreferences.dateFormat}
            onChange={(e) => saveSettings('userPreferences', { dateFormat: e.target.value as any })}
            className="w-full mt-1 p-2 border rounded-md"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>

        <div>
          <Label htmlFor="timeFormat">Time Format</Label>
          <select
            id="timeFormat"
            value={settingsData.userPreferences.timeFormat}
            onChange={(e) => saveSettings('userPreferences', { timeFormat: e.target.value as any })}
            className="w-full mt-1 p-2 border rounded-md"
          >
            <option value="12h">12-hour</option>
            <option value="24h">24-hour</option>
          </select>
        </div>

        <div>
          <Label htmlFor="language">Language</Label>
          <select
            id="language"
            value={settingsData.userPreferences.language}
            onChange={(e) => saveSettings('userPreferences', { language: e.target.value as any })}
            className="w-full mt-1 p-2 border rounded-md"
          >
            {settings.getAvailableLanguages().map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="defaultChartType">Default Chart Type</Label>
          <select
            id="defaultChartType"
            value={settingsData.userPreferences.defaultChartType}
            onChange={(e) => saveSettings('userPreferences', { defaultChartType: e.target.value as any })}
            className="w-full mt-1 p-2 border rounded-md"
          >
            <option value="line">Line</option>
            <option value="bar">Bar</option>
            <option value="area">Area</option>
          </select>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={settingsData.userPreferences.animationsEnabled}
          onCheckedChange={(checked) => saveSettings('userPreferences', { animationsEnabled: checked })}
        />
        <Label>Enable Animations</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={settingsData.userPreferences.showPromptSuggestions}
          onCheckedChange={(checked) => saveSettings('userPreferences', { showPromptSuggestions: checked })}
        />
        <Label>Show Default Prompt Suggestions</Label>
      </div>

      <div>
        <Label htmlFor="customPrompts">Custom Prompts</Label>
        <div className="mt-1">
          <textarea
            id="customPrompts"
            value={settingsData.userPreferences.customPrompts.join('\n')}
            onChange={(e) => {
              const prompts = e.target.value
                .split('\n')
                .map(prompt => prompt.trim())
                .filter(prompt => prompt.length > 0);
              saveSettings('userPreferences', { customPrompts: prompts });
            }}
            placeholder="Enter your custom prompts, one per line..."
            className="w-full p-2 border rounded-md min-h-[100px] resize-y"
            rows={6}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Add your own custom prompts, one per line. These will always be visible in the chat interface.
          </p>
        </div>
      </div>
    </div>
  );

  const renderDataManagement = () => {
    if (!storageUsage) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Storage Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Sessions:</span>
                  <span>{settings.formatBytes(storageUsage.sessions)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Chat History:</span>
                  <span>{settings.formatBytes(storageUsage.chatHistory)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Training Plans:</span>
                  <span>{settings.formatBytes(storageUsage.trainingPlans)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Insights Archive:</span>
                  <span>{settings.formatBytes(storageUsage.insightsArchive)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>{settings.formatBytes(storageUsage.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Export & Import</CardTitle>
            <CardDescription>Backup your settings and data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button onClick={exportSettings} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Settings
              </Button>

              <Button variant="outline" asChild>
                <label className="cursor-pointer flex items-center">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Settings
                  <input
                    type="file"
                    accept=".json"
                    onChange={importSettings}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-red-600">Clear Data</CardTitle>
            <CardDescription>Permanently remove stored data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                variant="outline"
                onClick={() => clearDataCategory('sessions')}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Sessions
              </Button>

              <Button
                variant="outline"
                onClick={() => clearDataCategory('chatHistory')}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Chat History
              </Button>

              <Button
                variant="outline"
                onClick={() => clearDataCategory('trainingPlans')}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Training Plans
              </Button>

              <Button
                variant="outline"
                onClick={() => clearDataCategory('insightsArchive')}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Insights Archive
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTrainingSettings = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Training Zones (Heart Rate)</CardTitle>
          <CardDescription>Configure your heart rate training zones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(settingsData.trainingSettings.defaultTrainingZones).map(([zone, range]) => (
              <div key={zone} className="grid grid-cols-3 gap-4 items-center">
                <Label className="font-medium">Zone {zone.slice(-1)}</Label>
                <Input
                  type="number"
                  placeholder="Min"
                  value={range.min}
                  onChange={(e) => {
                    const updatedZones = {
                      ...settingsData.trainingSettings.defaultTrainingZones,
                      [zone]: { ...range, min: parseInt(e.target.value) || 0 }
                    };
                    saveSettings('trainingSettings', { defaultTrainingZones: updatedZones });
                  }}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={range.max}
                  onChange={(e) => {
                    const updatedZones = {
                      ...settingsData.trainingSettings.defaultTrainingZones,
                      [zone]: { ...range, max: parseInt(e.target.value) || 0 }
                    };
                    saveSettings('trainingSettings', { defaultTrainingZones: updatedZones });
                  }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Weekly Goal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="goalType">Goal Type</Label>
              <select
                id="goalType"
                value={settingsData.trainingSettings.weeklyGoal.type}
                onChange={(e) => saveSettings('trainingSettings', {
                  weeklyGoal: { ...settingsData.trainingSettings.weeklyGoal, type: e.target.value as any }
                })}
                className="w-full mt-1 p-2 border rounded-md"
              >
                <option value="sessions">Sessions</option>
                <option value="distance">Distance (km)</option>
                <option value="duration">Duration (minutes)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="goalTarget">Target</Label>
              <Input
                id="goalTarget"
                type="number"
                value={settingsData.trainingSettings.weeklyGoal.target}
                onChange={(e) => saveSettings('trainingSettings', {
                  weeklyGoal: { ...settingsData.trainingSettings.weeklyGoal, target: parseInt(e.target.value) || 0 }
                })}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            checked={settingsData.trainingSettings.restDayAlerts}
            onCheckedChange={(checked) => saveSettings('trainingSettings', { restDayAlerts: checked })}
          />
          <Label>Rest Day Alerts</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={settingsData.trainingSettings.adaptationEnabled}
            onCheckedChange={(checked) => saveSettings('trainingSettings', { adaptationEnabled: checked })}
          />
          <Label>Enable Training Adaptation</Label>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">In-App Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={settingsData.notificationSettings.sessionReminders}
                onCheckedChange={(checked) => saveSettings('notificationSettings', { sessionReminders: checked })}
              />
              <Label>Session Reminders</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={settingsData.notificationSettings.weeklyProgress}
                onCheckedChange={(checked) => saveSettings('notificationSettings', { weeklyProgress: checked })}
              />
              <Label>Weekly Progress Reports</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={settingsData.notificationSettings.achievementAlerts}
                onCheckedChange={(checked) => saveSettings('notificationSettings', { achievementAlerts: checked })}
              />
              <Label>Achievement Alerts</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={settingsData.notificationSettings.planReminders}
                onCheckedChange={(checked) => saveSettings('notificationSettings', { planReminders: checked })}
              />
              <Label>Training Plan Reminders</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={settingsData.notificationSettings.adherenceAlerts}
                onCheckedChange={(checked) => saveSettings('notificationSettings', { adherenceAlerts: checked })}
              />
              <Label>Adherence Alerts</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={settingsData.notificationSettings.emailNotifications.enabled}
                onCheckedChange={(checked) => saveSettings('notificationSettings', {
                  emailNotifications: { ...settingsData.notificationSettings.emailNotifications, enabled: checked }
                })}
              />
              <Label>Enable Email Notifications</Label>
            </div>

            {settingsData.notificationSettings.emailNotifications.enabled && (
              <>
                <div>
                  <Label htmlFor="emailAddress">Email Address</Label>
                  <Input
                    id="emailAddress"
                    type="email"
                    value={settingsData.notificationSettings.emailNotifications.address}
                    onChange={(e) => saveSettings('notificationSettings', {
                      emailNotifications: { ...settingsData.notificationSettings.emailNotifications, address: e.target.value }
                    })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="emailFrequency">Frequency</Label>
                  <select
                    id="emailFrequency"
                    value={settingsData.notificationSettings.emailNotifications.frequency}
                    onChange={(e) => saveSettings('notificationSettings', {
                      emailNotifications: { ...settingsData.notificationSettings.emailNotifications, frequency: e.target.value as any }
                    })}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderPrivacySettings = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Sharing & Analytics</CardTitle>
          <CardDescription>Control how your data is used</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={settingsData.privacySettings.dataSharing}
              onCheckedChange={(checked) => saveSettings('privacySettings', { dataSharing: checked })}
            />
            <Label>Share anonymous usage data</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={settingsData.privacySettings.analyticsEnabled}
              onCheckedChange={(checked) => saveSettings('privacySettings', { analyticsEnabled: checked })}
            />
            <Label>Enable analytics</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={settingsData.privacySettings.crashReports}
              onCheckedChange={(checked) => saveSettings('privacySettings', { crashReports: checked })}
            />
            <Label>Send crash reports</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={settingsData.privacySettings.localStorageOnly}
              onCheckedChange={(checked) => saveSettings('privacySettings', { localStorageOnly: checked })}
            />
            <Label>Local storage only (no cloud sync)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Retention</CardTitle>
          <CardDescription>How long to keep your data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sessionRetention">Session Retention (days)</Label>
              <Input
                id="sessionRetention"
                type="number"
                min="1"
                max="3650"
                value={settingsData.privacySettings.sessionRetention}
                onChange={(e) => saveSettings('privacySettings', { sessionRetention: parseInt(e.target.value) || 365 })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="chatRetention">Chat History Retention (days)</Label>
              <Input
                id="chatRetention"
                type="number"
                min="1"
                max="3650"
                value={settingsData.privacySettings.chatRetention}
                onChange={(e) => saveSettings('privacySettings', { chatRetention: parseInt(e.target.value) || 90 })}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAISettings = () => {
    // ✅ No hooks here - moved to component level
    // Conditional logic is safe now
    if (!settingsData?.aiSettings) {
      return (
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium mb-2">AI Settings Not Available</h3>
          <p className="text-sm text-muted-foreground">
            Please refresh the page to load AI settings.
          </p>
        </div>
      );
    }

    // ✅ Test connection function uses component-level state
    const testConnection = async () => {
      setIsTestingConnection(true);
      setConnectionStatus('testing');

      try {
        // Configure cloudAI with current settings
        if (settingsData.aiSettings.openaiApiKey) {
          cloudAI.initialize(settingsData.aiSettings.openaiApiKey);

          const success = await cloudAI.testConnection();
          setConnectionStatus(success ? 'success' : 'error');
        } else {
          setConnectionStatus('error');
        }
      } catch (error) {
        setConnectionStatus('error');
      } finally {
        setIsTestingConnection(false);
      }
    };

    const getConnectionStatusDisplay = () => {
      switch (connectionStatus) {
        case 'testing':
          return (
            <span
              className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1"
              style={{
                color: '#1e40af',
                backgroundColor: '#dbeafe',
                borderColor: '#93c5fd'
              }}
            >
              <RotateCcw className="h-3 w-3 mr-1 animate-spin" />
              Testing...
            </span>
          );
        case 'success':
          return (
            <span
              className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1"
              style={{
                color: '#166534',
                backgroundColor: '#dcfce7',
                borderColor: '#86efac'
              }}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </span>
          );
        case 'error':
          return (
            <span
              className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1"
              style={{
                color: '#dc2626',
                backgroundColor: '#fee2e2',
                borderColor: '#fca5a5'
              }}
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Failed
            </span>
          );
        default:
          return (
            <span
              className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1"
              style={{
                color: '#6b7280',
                backgroundColor: '#f9fafb',
                borderColor: '#d1d5db'
              }}
            >
              Not tested
            </span>
          );
      }
    };

    const isConfigured = settingsData.aiSettings.cloudAIEnabled &&
      settingsData.aiSettings.openaiApiKey &&
      connectionStatus === 'success';

    return (
      <div className="space-y-6">
        <Card>

          <CardContent className="space-y-6">
            {/* Configuration Status - Moved to top */}
            {isConfigured && (
              <Alert className="border-green-200 bg-green-50">
                <Brain className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>AI Coach is ready!</strong> You&apos;ll now receive advanced AI-powered insights
                  based on your training data. These insights will appear alongside local analysis
                  in your dashboard and chat.
                </AlertDescription>
              </Alert>
            )}
            {/* Cloud AI Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Enable Cloud AI Features</Label>
                <p className="text-sm text-muted-foreground">
                  Enable advanced AI insights using OpenAI GPT models
                </p>
              </div>
              <Switch
                checked={settingsData.aiSettings.cloudAIEnabled}
                onCheckedChange={(checked) => saveSettings('aiSettings', { cloudAIEnabled: checked })}
              />
            </div>

            {settingsData.aiSettings.cloudAIEnabled && (
              <>
                {/* API Key Input */}
                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    OpenAI API Key
                  </Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk-..."
                    value={settingsData.aiSettings.openaiApiKey}
                    onChange={(e) => saveSettings('aiSettings', { openaiApiKey: e.target.value })}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your API key is stored locally and never shared with third parties.
                    Get your key from{' '}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      OpenAI Platform
                    </a>
                  </p>
                </div>

                {/* Connection Status */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Connection Status</Label>
                    <p className="text-sm text-muted-foreground">
                      Test your API key to ensure it works correctly
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getConnectionStatusDisplay()}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testConnection}
                      disabled={!settingsData.aiSettings.openaiApiKey || isTestingConnection}
                      className="flex items-center gap-1"
                    >
                      <RotateCcw className={`h-3 w-3 ${isTestingConnection ? 'animate-spin' : ''}`} />
                      Test
                    </Button>
                  </div>
                </div>

                {/* Per-Use-Case Configuration */}
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Brain className="h-4 w-4" />
                      <h3 className="text-lg font-semibold">AI Configuration per Use Case</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure reasoning levels and verbosity for each AI feature.
                      All features use GPT-5.1 for optimal performance and quality.
                    </p>
                  </div>

                  {/* Chat Configuration */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Chat & Conversation
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Real-time conversation with your AI coach
                      </CardDescription>
                    </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label>AI Model</Label>
                        <select
                          value={settingsData.aiSettings.chat?.model || 'gpt-5-mini'}
                          onChange={(e) => saveSettings('aiSettings', {
                            chat: { ...settingsData.aiSettings.chat, model: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_TEXT_MODEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Choose model based on speed vs quality preference
                        </p>
                      </div>
                      <div>
                        <Label>Reasoning Effort</Label>
                        <select
                          value={settingsData.aiSettings.chat?.reasoning || 'none'}
                          onChange={(e) => saveSettings('aiSettings', {
                            chat: { ...settingsData.aiSettings.chat, reasoning: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_REASONING_EFFORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Response Verbosity</Label>
                        <select
                          value={settingsData.aiSettings.chat?.verbosity || 'medium'}
                          onChange={(e) => saveSettings('aiSettings', {
                            chat: { ...settingsData.aiSettings.chat, verbosity: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_RESPONSE_VERBOSITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Insights Configuration */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Performance Insights
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Analysis of your workout data and trends
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label>AI Model</Label>
                        <select
                          value={settingsData.aiSettings.insights?.model || 'gpt-5-mini'}
                          onChange={(e) => saveSettings('aiSettings', {
                            insights: { ...settingsData.aiSettings.insights, model: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_TEXT_MODEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Analysis tasks work well with balanced models
                        </p>
                      </div>
                      <div>
                        <Label>Reasoning Effort</Label>
                        <select
                          value={settingsData.aiSettings.insights?.reasoning || 'medium'}
                          onChange={(e) => saveSettings('aiSettings', {
                            insights: { ...settingsData.aiSettings.insights, reasoning: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_REASONING_EFFORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Response Verbosity</Label>
                        <select
                          value={settingsData.aiSettings.insights?.verbosity || 'low'}
                          onChange={(e) => saveSettings('aiSettings', {
                            insights: { ...settingsData.aiSettings.insights, verbosity: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_RESPONSE_VERBOSITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Training Plans Configuration */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        Training Plans
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Personalized training plan generation and modification
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label>AI Model</Label>
                        <select
                          value={settingsData.aiSettings.trainingPlans?.model || 'gpt-5.1'}
                          onChange={(e) => saveSettings('aiSettings', {
                            trainingPlans: { ...settingsData.aiSettings.trainingPlans, model: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_TEXT_MODEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Complex planning benefits from the most capable model
                        </p>
                      </div>
                      <div>
                        <Label>Reasoning Effort</Label>
                        <select
                          value={settingsData.aiSettings.trainingPlans?.reasoning || 'high'}
                          onChange={(e) => saveSettings('aiSettings', {
                            trainingPlans: { ...settingsData.aiSettings.trainingPlans, reasoning: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_REASONING_EFFORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Response Verbosity</Label>
                        <select
                          value={settingsData.aiSettings.trainingPlans?.verbosity || 'high'}
                          onChange={(e) => saveSettings('aiSettings', {
                            trainingPlans: { ...settingsData.aiSettings.trainingPlans, verbosity: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_RESPONSE_VERBOSITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Personal Context Generation Configuration */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                        Personal Context Generation
                      </CardTitle>
                      <CardDescription className="text-sm">
                        AI-generated context from your personal information for coaching personalization
                      </CardDescription>
                    </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label>AI Model</Label>
                        <select
                          value={settingsData.aiSettings.userProfileGeneration?.model || 'gpt-5-mini'}
                          onChange={(e) => saveSettings('aiSettings', {
                            userProfileGeneration: { ...settingsData.aiSettings.userProfileGeneration, model: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_TEXT_MODEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Condensing personal info works well with balanced models
                        </p>
                      </div>
                      <div>
                        <Label>Reasoning Effort</Label>
                        <select
                          value={settingsData.aiSettings.userProfileGeneration?.reasoning || 'low'}
                          onChange={(e) => saveSettings('aiSettings', {
                            userProfileGeneration: { ...settingsData.aiSettings.userProfileGeneration, reasoning: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_REASONING_EFFORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Response Verbosity</Label>
                        <select
                          value={settingsData.aiSettings.userProfileGeneration?.verbosity || 'low'}
                          onChange={(e) => saveSettings('aiSettings', {
                            userProfileGeneration: { ...settingsData.aiSettings.userProfileGeneration, verbosity: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_RESPONSE_VERBOSITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Achievement Text Configuration */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        Achievement Stories
                      </CardTitle>
                      <CardDescription className="text-sm">
                        AI-generated celebratory stories for achievement certificates
                      </CardDescription>
                    </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label>AI Model</Label>
                        <select
                          value={settingsData.aiSettings.achievementText?.model || 'gpt-5-mini'}
                          onChange={(e) => saveSettings('aiSettings', {
                            achievementText: { ...settingsData.aiSettings.achievementText, model: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_TEXT_MODEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Creative writing benefits from balanced models
                        </p>
                      </div>
                      <div>
                        <Label>Reasoning Effort</Label>
                        <select
                          value={settingsData.aiSettings.achievementText?.reasoning || 'low'}
                          onChange={(e) => saveSettings('aiSettings', {
                            achievementText: { ...settingsData.aiSettings.achievementText, reasoning: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_REASONING_EFFORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Response Verbosity</Label>
                        <select
                          value={settingsData.aiSettings.achievementText?.verbosity || 'medium'}
                          onChange={(e) => saveSettings('aiSettings', {
                            achievementText: { ...settingsData.aiSettings.achievementText, verbosity: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_RESPONSE_VERBOSITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Achievement Images Configuration */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        Achievement Images
                      </CardTitle>
                      <CardDescription className="text-sm">
                        AI-generated images for achievement certificates
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label>Image Model</Label>
                        <select
                          value={settingsData.aiSettings.achievementImageModel}
                          onChange={(e) =>
                            saveSettings('aiSettings', { achievementImageModel: e.target.value as any })
                          }
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_ACHIEVEMENT_IMAGE_MODEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Image Quality</Label>
                        <select
                          value={settingsData.aiSettings.achievementImageQuality}
                          onChange={(e) =>
                            saveSettings('aiSettings', { achievementImageQuality: e.target.value as any })
                          }
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_ACHIEVEMENT_IMAGE_QUALITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Image Size</Label>
                        <select
                          value={settingsData.aiSettings.achievementImageSize}
                          onChange={(e) =>
                            saveSettings('aiSettings', { achievementImageSize: e.target.value as any })
                          }
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_ACHIEVEMENT_IMAGE_SIZE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Achievement Image Colors */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        Color Palette
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Choose the color scheme for achievement certificate images
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {ACHIEVEMENT_COLOR_PALETTES.map((palette) => (
                          <button
                            key={palette.value}
                            onClick={() => saveSettings('aiSettings', { achievementImageColors: palette.value })}
                            className={`relative p-4 border-2 rounded-lg text-left transition-all hover:shadow-md ${
                              settingsData.aiSettings.achievementImageColors === palette.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex gap-1 mt-1">
                                {palette.colors.map((color, idx) => (
                                  <div
                                    key={idx}
                                    className="w-4 h-4 rounded-full border border-gray-300"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm mb-1">{palette.label}</div>
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {palette.description}
                                </div>
                              </div>
                            </div>
                            {settingsData.aiSettings.achievementImageColors === palette.value && (
                              <div className="absolute top-2 right-2">
                                <div className="w-2 h-2 bg-primary rounded-full"></div>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Award Suggestions Configuration */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        Award Suggestions
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Suggest upcoming achievements based on your recent sessions
                      </CardDescription>
                    </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label>AI Model</Label>
                        <select
                          value={settingsData.aiSettings.awardSuggestions?.model || 'gpt-5-mini'}
                          onChange={(e) => saveSettings('aiSettings', {
                            awardSuggestions: { ...settingsData.aiSettings.awardSuggestions, model: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_TEXT_MODEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Balanced models work well for quick, realistic milestone suggestions
                        </p>
                      </div>
                      <div>
                        <Label>Reasoning Effort</Label>
                        <select
                          value={settingsData.aiSettings.awardSuggestions?.reasoning || 'medium'}
                          onChange={(e) => saveSettings('aiSettings', {
                            awardSuggestions: { ...settingsData.aiSettings.awardSuggestions, reasoning: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_REASONING_EFFORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Response Verbosity</Label>
                        <select
                          value={settingsData.aiSettings.awardSuggestions?.verbosity || 'low'}
                          onChange={(e) => saveSettings('aiSettings', {
                            awardSuggestions: { ...settingsData.aiSettings.awardSuggestions, verbosity: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          {AI_RESPONSE_VERBOSITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Global Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="maxTokens">Global Max Tokens</Label>
                      <Input
                        id="maxTokens"
                        type="number"
                        min="100"
                        max="16000"
                        value={settingsData.aiSettings.maxTokens}
                        onChange={(e) => saveSettings('aiSettings', { maxTokens: parseInt(e.target.value) || 4000 })}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum number of tokens in AI responses (applies to all use cases)
                      </p>
                    </div>
                  </div>
                </div>

              </>
            )}

            {/* Local AI Info */}
            {!settingsData.aiSettings.cloudAIEnabled && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Local Analysis Only:</strong> You&apos;ll receive insights based on statistical
                  analysis of your training data. Enable Cloud AI for more advanced, personalized recommendations.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Personal Context */}
        {settingsData.aiSettings.cloudAIEnabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                Personal Context
              </CardTitle>
              <CardDescription>
                Share information about yourself to personalize AI advice (medical conditions, goals, preferences)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-slate-700 bg-slate-900 text-slate-100 dark:border-slate-600 dark:bg-slate-900">
                <Info className="h-4 w-4 text-blue-400 dark:text-blue-300" />
                <AlertDescription className="text-slate-100 dark:text-slate-100">
                  <strong className="font-semibold text-blue-300 dark:text-blue-200">
                    Why add personal context?
                  </strong>{" "}
                  If you have medical conditions, injuries, or specific needs, sharing this
                  information helps the AI coach provide safer and more appropriate
                  recommendations. Your data stays private and is only used locally.
                </AlertDescription>
              </Alert>

              {/* Raw Input Area */}
              <div>
                <button
                  onClick={() => openPromptEditor(
                    'userProfileRawInput',
                    'Your Information',
                    'Describe any relevant information about yourself that should influence AI coaching advice. Write freely or paste from documents.',
                    profileRawInput,
                    '' // No default
                  )}
                  className="w-full text-left p-3 border rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Your Information
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                    {profileRawInput ? profileRawInput.substring(0, 150) + (profileRawInput.length > 150 ? '...' : '') : 'Click to add your personal information...'}
                  </p>
                </button>
                <p className="text-xs text-muted-foreground mt-1">
                  Write freely or paste from documents. The AI will condense this into actionable coaching context.
                </p>
              </div>

              {/* Document Selector from Memory */}
              {memoryDocuments.length > 0 && (
                <div>
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Select Documents from Memory (Optional)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    Choose documents from your memory to include in your personal context
                  </p>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {memoryDocuments.map(doc => (
                      <label
                        key={doc.id}
                        className="flex items-start gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocIds.includes(doc.id)}
                          onChange={async (e) => {
                            const isChecked = e.target.checked;
                            if (isChecked) {
                              setSelectedDocIds(prev => [...prev, doc.id]);
                              // Add document content to input
                              const content = doc.extractedText || doc.description || '';
                              if (content) {
                                setProfileRawInput(prev => 
                                  prev 
                                    ? `${prev}\n\n--- From ${doc.name} ---\n${content}` 
                                    : `--- From ${doc.name} ---\n${content}`
                                );
                              }
                            } else {
                              setSelectedDocIds(prev => prev.filter(id => id !== doc.id));
                              // Remove document content from input (simplified approach)
                              setProfileRawInput(prev => {
                                const marker = `--- From ${doc.name} ---`;
                                const startIdx = prev.indexOf(marker);
                                if (startIdx === -1) return prev;
                                
                                // Find the next document marker or end of string
                                const nextMarkerIdx = prev.indexOf('--- From ', startIdx + marker.length);
                                const endIdx = nextMarkerIdx === -1 ? prev.length : nextMarkerIdx;
                                
                                return (prev.slice(0, startIdx) + prev.slice(endIdx)).trim();
                              });
                            }
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{doc.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {doc.type}
                            </Badge>
                          </div>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {doc.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate/Condense Button */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={async () => {
                    if (!profileRawInput.trim()) {
                      setErrorMessage('Please enter some information first');
                      return;
                    }
                    
                    setIsCondensingProfile(true);
                    try {
                      // Initialize cloudAI with API key before use
                      if (!cloudAI.isConfigured()) {
                        cloudAI.initialize(settingsData.aiSettings.openaiApiKey);
                      }
                      const condensed = await cloudAI.condenseUserProfile(profileRawInput);
                      saveSettings('aiSettings', { 
                        userProfileContext: condensed,
                        userProfileRawInput: profileRawInput 
                      });
                      setSuccessMessage('Personal context generated and saved');
                    } catch (error) {
                      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                      setErrorMessage(`Failed to generate context: ${errorMsg}`);
                      console.error('Condensation error:', error);
                    } finally {
                      setIsCondensingProfile(false);
                    }
                  }}
                  disabled={isCondensingProfile || !profileRawInput.trim()}
                  className="flex items-center gap-2"
                >
                  {isCondensingProfile ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isCondensingProfile ? 'Generating...' : 'Generate AI Context'}
                </Button>

                {settingsData.aiSettings.userProfileContext && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setProfileRawInput('');
                      setSelectedDocIds([]);
                      saveSettings('aiSettings', { 
                        userProfileContext: '',
                        userProfileRawInput: '' 
                      });
                      setSuccessMessage('Personal context cleared');
                    }}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Generated Context (Editable) */}
              {settingsData.aiSettings.userProfileContext && (
                <div className="mt-4 pt-4 border-t">
                  <button
                    onClick={() => openPromptEditor(
                      'userProfileContext',
                      'Generated AI Context',
                      'This context is automatically injected into AI prompts for chat, insights, and training plans. You can edit it directly if needed.',
                      settingsData.aiSettings.userProfileContext,
                      '' // No default - regenerate instead
                    )}
                    className="w-full text-left p-3 border rounded-md hover:bg-muted/50 transition-colors bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                  >
                    <div className="font-medium text-sm flex items-center gap-2 text-green-900 dark:text-green-100">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Generated AI Context (Editable)
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                      {settingsData.aiSettings.userProfileContext.substring(0, 150)}...
                    </p>
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Prompts */}
        {settingsData.aiSettings.cloudAIEnabled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prompts</CardTitle>
              <CardDescription>Customize AI prompts and behavior. Click on any prompt to edit in full-screen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => openPromptEditor(
                  'systemPrompt',
                  'System Prompt',
                  'Base system prompt used for all AI interactions. Sets the AI\'s personality and expertise level.',
                  settingsData.aiSettings.systemPrompt,
                  DEFAULT_SYSTEM_PROMPT
                )}
                className="w-full text-left p-3 border rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium text-sm">System Prompt</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                  {settingsData.aiSettings.systemPrompt.substring(0, 150)}...
                </p>
              </button>

              <button
                onClick={() => openPromptEditor(
                  'chatSystemPrompt',
                  'Chat System Prompt',
                  'Specific system prompt for chat interactions. Defines how the AI coach behaves in conversations.',
                  settingsData.aiSettings.chatSystemPrompt,
                  DEFAULT_CHAT_SYSTEM_PROMPT
                )}
                className="w-full text-left p-3 border rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium text-sm">Chat System Prompt</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                  {settingsData.aiSettings.chatSystemPrompt.substring(0, 150)}...
                </p>
              </button>

              <button
                onClick={() => openPromptEditor(
                  'planGenerationPrompt',
                  'Training Plan Generation Prompt',
                  'Controls how the AI generates personalized training plans based on your goals and fitness level.',
                  settingsData.aiSettings.planGenerationPrompt,
                  DEFAULT_PLAN_GENERATION_PROMPT
                )}
                className="w-full text-left p-3 border rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium text-sm">Training Plan Generation Prompt</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                  {settingsData.aiSettings.planGenerationPrompt.substring(0, 150)}...
                </p>
              </button>

              <button
                onClick={() => openPromptEditor(
                  'insightsPrompt',
                  'AI Insights Prompt',
                  'This prompt controls how the AI analyzes your rowing data and generates insights. Use {sessionData} as a placeholder.',
                  settingsData.aiSettings.insightsPrompt,
                  DEFAULT_INSIGHTS_PROMPT
                )}
                className="w-full text-left p-3 border rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium text-sm">AI Insights Prompt</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                  {settingsData.aiSettings.insightsPrompt.substring(0, 150)}...
                </p>
              </button>

              <button
                onClick={() => openPromptEditor(
                  'awardSuggestionsPrompt',
                  'Award Suggestions Prompt',
                  'Controls how the AI proposes upcoming achievements you might reach soon.',
                  settingsData.aiSettings.awardSuggestionsPrompt || DEFAULT_AWARD_SUGGESTIONS_PROMPT,
                  DEFAULT_AWARD_SUGGESTIONS_PROMPT
                )}
                className="w-full text-left p-3 border rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium text-sm">Award Suggestions Prompt</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                  {(settingsData.aiSettings.awardSuggestionsPrompt || DEFAULT_AWARD_SUGGESTIONS_PROMPT).substring(0, 150)}...
                </p>
              </button>

              <button
                onClick={() => openPromptEditor(
                  'explainChartPrompt',
                  'Chart Explanation Prompt',
                  'This prompt is appended to chart explanation requests. Include a "TOOLTIP SUMMARY" section for the info tooltip display.',
                  settingsData.aiSettings.explainChartPrompt || DEFAULT_EXPLAIN_CHART_PROMPT,
                  DEFAULT_EXPLAIN_CHART_PROMPT
                )}
                className="w-full text-left p-3 border rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium text-sm">Chart Explanation Prompt</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                  {(settingsData.aiSettings.explainChartPrompt || DEFAULT_EXPLAIN_CHART_PROMPT).substring(0, 150)}...
                </p>
              </button>

              <button
                onClick={() => openPromptEditor(
                  'achievementStoryPrompt',
                  'Achievement Story Prompt',
                  'Controls how the AI generates celebratory stories for your achievements.',
                  settingsData.aiSettings.achievementStoryPrompt,
                  DEFAULT_ACHIEVEMENT_STORY_PROMPT
                )}
                className="w-full text-left p-3 border rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium text-sm">Achievement Story Prompt</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                  {settingsData.aiSettings.achievementStoryPrompt.substring(0, 150)}...
                </p>
              </button>

              <button
                onClick={() => openPromptEditor(
                  'achievementImagePrompt',
                  'Achievement Image Prompt',
                  'Controls how the AI generates images for achievement certificates.',
                  settingsData.aiSettings.achievementImagePrompt,
                  DEFAULT_ACHIEVEMENT_IMAGE_PROMPT
                )}
                className="w-full text-left p-3 border rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium text-sm">Achievement Image Prompt</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                  {settingsData.aiSettings.achievementImagePrompt.substring(0, 150)}...
                </p>
              </button>

              <button
                onClick={() => openPromptEditor(
                  'userProfilePrompt',
                  'Personal Context Generation Prompt',
                  'Controls how the AI condenses your personal information into context for coaching. Use {userInput} as a placeholder for the user\'s input.',
                  settingsData.aiSettings.userProfilePrompt || DEFAULT_USER_PROFILE_PROMPT,
                  DEFAULT_USER_PROFILE_PROMPT
                )}
                className="w-full text-left p-3 border rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium text-sm">Personal Context Generation Prompt</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                  {(settingsData.aiSettings.userProfilePrompt || DEFAULT_USER_PROFILE_PROMPT).substring(0, 150)}...
                </p>
              </button>
            </CardContent>
          </Card>
        )}

        {/* Image Migration Card - only show if there are images to migrate */}
        {settingsData.aiSettings.cloudAIEnabled && indexedDBImageCount !== null && indexedDBImageCount > 0 && (
          <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                Image Migration Required
              </CardTitle>
              <CardDescription>
                {indexedDBImageCount} award image(s) found in browser storage (IndexedDB). 
                Migrate them to the filesystem for better persistence and performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleMigrateImages}
                  disabled={isMigrating}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Migrating...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Migrate {indexedDBImageCount} Image(s)
                    </>
                  )}
                </Button>
                {migrationResult && (
                  <div className="text-sm">
                    {migrationResult.migrated > 0 && (
                      <span className="text-green-600 dark:text-green-400">
                        ✓ {migrationResult.migrated} migrated
                      </span>
                    )}
                    {migrationResult.failed.length > 0 && (
                      <span className="text-red-600 dark:text-red-400 ml-2">
                        ✗ {migrationResult.failed.length} failed
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const handleMigrateImages = async () => {
    setIsMigrating(true);
    setMigrationResult(null);
    try {
      const result = await migrateImagesFromIndexedDB();
      setMigrationResult(result);
      setIndexedDBImageCount(0);
      if (result.migrated > 0) {
        setSuccessMessage(`Successfully migrated ${result.migrated} image(s) to filesystem`);
      }
    } catch (error) {
      setErrorMessage('Failed to migrate images');
      console.error('Migration error:', error);
    } finally {
      setIsMigrating(false);
    }
  };

  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'userPreferences':
        return renderUserPreferences();
      case 'dataManagement':
        return renderDataManagement();
      case 'trainingSettings':
        return renderTrainingSettings();
      case 'notificationSettings':
        return renderNotificationSettings();
      case 'privacySettings':
        return renderPrivacySettings();
      case 'aiSettings':
        return renderAISettings();
      default:
        return renderUserPreferences();
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Customize your rowing experience
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => resetCategory(activeCategory)}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Category
          </Button>
        </div>
      </div>

      {/* Toast Overlays */}
      {successMessage && (
        <Toast
          message={successMessage}
          type="success"
          onExit={() => setSuccessMessage(null)}
        />
      )}
      {errorMessage && (
        <Toast
          message={errorMessage}
          type="error"
          onExit={() => setErrorMessage(null)}
        />
      )}

      <div className="flex gap-6">
        {/* Category Navigation */}
        <div className="w-80 flex-shrink-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Categories</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id as SettingsCategory)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${activeCategory === category.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{category.name}</div>
                          <div className="text-xs opacity-70">{category.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          <Card>
            <CardHeader>
              <CardTitle>
                {categories.find(c => c.id === activeCategory)?.name}
              </CardTitle>
              <CardDescription>
                {categories.find(c => c.id === activeCategory)?.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                renderCategoryContent()
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Prompt Editor Modal */}
      <Dialog open={promptEditorOpen} onOpenChange={setPromptEditorOpen}>
        <DialogContent className="w-[80vw] max-w-none h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingPrompt?.label}</DialogTitle>
            <DialogDescription>{editingPrompt?.description}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <textarea
              value={promptEditorValue}
              onChange={(e) => setPromptEditorValue(e.target.value)}
              className="w-full h-full p-4 border rounded-md resize-none font-mono text-sm bg-muted/50"
              placeholder="Enter your prompt..."
            />
          </div>
          <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
            <Button variant="outline" onClick={resetPromptInEditor}>
              Reset to default
            </Button>
            <Button variant="outline" onClick={() => setPromptEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePromptFromEditor}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Data Confirmation Dialog */}
      <ConfirmDialog
        open={showClearDataConfirm}
        onOpenChange={setShowClearDataConfirm}
        title={`Clear ${dataCategoryToClear}?`}
        description={`Are you sure you want to clear all ${dataCategoryToClear}? This action cannot be undone and will permanently remove all stored data.`}
        confirmLabel="Clear"
        cancelLabel="Cancel"
        onConfirm={executeClearDataCategory}
        variant="destructive"
      />
    </div>
  );
}
