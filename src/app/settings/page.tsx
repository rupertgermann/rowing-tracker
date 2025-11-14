'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { settings, Settings, UserPreferences, DataManagement, TrainingSettings, NotificationSettings, PrivacySettings, AISettings } from '@/lib/settings';
import { cloudAI } from '@/lib/cloudAI';
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
  TestTube
} from 'lucide-react';

type SettingsCategory = 'userPreferences' | 'dataManagement' | 'trainingSettings' | 'notificationSettings' | 'privacySettings' | 'aiSettings';

export default function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('userPreferences');
  const [settingsData, setSettingsData] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // AI Settings state moved to component level (React Rules of Hooks)
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const data = settings.getSettings();
      setSettingsData(data);
    } catch (error) {
      setErrorMessage('Failed to load settings');
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
      setTimeout(() => setSuccessMessage(null), 3000);
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
    if (confirm(`Are you sure you want to reset ${category} to default values?`)) {
      settings.resetCategory(category);
      loadSettings();
      setSuccessMessage('Settings reset to defaults');
    }
  };

  const clearDataCategory = (category: 'sessions' | 'chatHistory' | 'trainingPlans') => {
    if (confirm(`Are you sure you want to clear all ${category}? This cannot be undone.`)) {
      settings.clearDataCategory(category);
      setSuccessMessage(`${category} cleared successfully`);
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
    { id: 'aiSettings', name: 'AI Coach', icon: Brain, description: 'Configure AI assistant and training plan generation' }
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
    </div>
  );

  const renderDataManagement = () => {
    const storageUsage = settings.calculateStorageUsage();
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>{settings.formatBytes(storageUsage.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Auto Save</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={settingsData.dataManagement.autoSave}
                  onCheckedChange={(checked) => saveSettings('dataManagement', { autoSave: checked })}
                />
                <Label>Enable Auto Save</Label>
              </div>
              
              {settingsData.dataManagement.autoSave && (
                <div>
                  <Label htmlFor="autoSaveInterval">Save Interval (minutes)</Label>
                  <Input
                    id="autoSaveInterval"
                    type="number"
                    min="1"
                    max="60"
                    value={settingsData.dataManagement.autoSaveInterval}
                    onChange={(e) => saveSettings('dataManagement', { autoSaveInterval: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              )}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        setTimeout(() => setConnectionStatus('idle'), 3000);
      }
    };

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">OpenAI Configuration</CardTitle>
            <CardDescription>Configure your AI coach with OpenAI API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={settingsData.aiSettings.openaiApiKey}
                onChange={(e) => saveSettings('aiSettings', { openaiApiKey: e.target.value })}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your API key is stored locally and never shared
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={settingsData.aiSettings.cloudAIEnabled}
                onCheckedChange={(checked) => saveSettings('aiSettings', { cloudAIEnabled: checked })}
              />
              <Label>Enable Cloud AI Features</Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="model">Model</Label>
                <select
                  id="model"
                  value={settingsData.aiSettings.model}
                  onChange={(e) => saveSettings('aiSettings', { model: e.target.value })}
                  className="w-full mt-1 p-2 border rounded-md"
                >
                  <optgroup label="Latest Models (GPT-5 Series)">
                    <option value="gpt-5">GPT-5</option>
                    <option value="gpt-5-mini">GPT-5 Mini</option>
                    <option value="gpt-5-nano">GPT-5 Nano</option>
                  </optgroup>
                  <optgroup label="GPT-4 Series">
                    <option value="gpt-4o">GPT-4o (Recommended)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                  </optgroup>
                  <optgroup label="GPT-3.5 Series">
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </optgroup>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {settingsData.aiSettings.model.startsWith('gpt-5') 
                    ? "GPT-5 models use reasoning instead of temperature" 
                    : "Adjust temperature for creativity control"}
                </p>
              </div>

              <div>
                <Label htmlFor="temperature">
                  {settingsData.aiSettings.model.startsWith('gpt-5') 
                    ? `Reasoning Effort (${settingsData.aiSettings.temperature === 0.7 ? 'medium' : settingsData.aiSettings.temperature < 0.5 ? 'minimal' : 'high'})` 
                    : `Temperature (${settingsData.aiSettings.temperature})`
                  }
                </Label>
                <Input
                  id="temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settingsData.aiSettings.temperature}
                  onChange={(e) => saveSettings('aiSettings', { temperature: parseFloat(e.target.value) })}
                  className="mt-1"
                  disabled={settingsData.aiSettings.model.startsWith('gpt-5')}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {settingsData.aiSettings.model.startsWith('gpt-5') 
                    ? "GPT-5 uses reasoning depth instead of temperature" 
                    : "Controls randomness: 0 = focused, 1 = creative"}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                min="100"
                max="4000"
                value={settingsData.aiSettings.maxTokens}
                onChange={(e) => saveSettings('aiSettings', { maxTokens: parseInt(e.target.value) || 1500 })}
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={testConnection}
                disabled={!settingsData.aiSettings.openaiApiKey || isTestingConnection}
                variant="outline"
              >
                {isTestingConnection ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>

              {connectionStatus === 'success' && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
              
              {connectionStatus === 'error' && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Failed
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Prompts</CardTitle>
            <CardDescription>Customize how your AI coach responds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="systemPrompt">Analysis System Prompt</Label>
              <textarea
                id="systemPrompt"
                value={settingsData.aiSettings.systemPrompt}
                onChange={(e) => saveSettings('aiSettings', { systemPrompt: e.target.value })}
                className="w-full mt-1 p-2 border rounded-md h-24 resize-y"
                placeholder="System prompt for training analysis..."
              />
            </div>

            <div>
              <Label htmlFor="chatSystemPrompt">Chat System Prompt</Label>
              <textarea
                id="chatSystemPrompt"
                value={settingsData.aiSettings.chatSystemPrompt}
                onChange={(e) => saveSettings('aiSettings', { chatSystemPrompt: e.target.value })}
                className="w-full mt-1 p-2 border rounded-md h-24 resize-y"
                placeholder="System prompt for chat conversations..."
              />
            </div>

            <div>
              <Label htmlFor="planGenerationPrompt">Plan Generation Prompt</Label>
              <textarea
                id="planGenerationPrompt"
                value={settingsData.aiSettings.planGenerationPrompt}
                onChange={(e) => saveSettings('aiSettings', { planGenerationPrompt: e.target.value })}
                className="w-full mt-1 p-2 border rounded-md h-24 resize-y"
                placeholder="System prompt for training plan generation..."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
        return null;
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

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      
      {errorMessage && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
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
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        activeCategory === category.id
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
    </div>
  );
}
