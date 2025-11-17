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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Coach Settings
            </CardTitle>
            <CardDescription>
              Configure AI-powered insights and analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Reasoning Effort</Label>
                        <select
                          value={settingsData.aiSettings.chat?.reasoning || 'none'}
                          onChange={(e) => saveSettings('aiSettings', { 
                            chat: { ...settingsData.aiSettings.chat, reasoning: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          <option value="none">None (Ultra-fast)</option>
                          <option value="low">Low (Fast)</option>
                          <option value="medium">Medium (Balanced)</option>
                          <option value="high">High (Quality)</option>
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
                          <option value="low">Low (Concise)</option>
                          <option value="medium">Medium (Natural)</option>
                          <option value="high">High (Detailed)</option>
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
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Reasoning Effort</Label>
                        <select
                          value={settingsData.aiSettings.insights?.reasoning || 'medium'}
                          onChange={(e) => saveSettings('aiSettings', { 
                            insights: { ...settingsData.aiSettings.insights, reasoning: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          <option value="none">None (Ultra-fast)</option>
                          <option value="low">Low (Fast)</option>
                          <option value="medium">Medium (Balanced)</option>
                          <option value="high">High (Quality)</option>
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
                          <option value="low">Low (Concise)</option>
                          <option value="medium">Medium (Natural)</option>
                          <option value="high">High (Detailed)</option>
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
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Reasoning Effort</Label>
                        <select
                          value={settingsData.aiSettings.trainingPlans?.reasoning || 'high'}
                          onChange={(e) => saveSettings('aiSettings', { 
                            trainingPlans: { ...settingsData.aiSettings.trainingPlans, reasoning: e.target.value as any }
                          })}
                          className="w-full mt-1 p-2 border rounded-md"
                        >
                          <option value="none">None (Ultra-fast)</option>
                          <option value="low">Low (Fast)</option>
                          <option value="medium">Medium (Balanced)</option>
                          <option value="high">High (Quality)</option>
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
                          <option value="low">Low (Concise)</option>
                          <option value="medium">Medium (Natural)</option>
                          <option value="high">High (Detailed)</option>
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
                        max="4000"
                        value={settingsData.aiSettings.maxTokens}
                        onChange={(e) => saveSettings('aiSettings', { maxTokens: parseInt(e.target.value) || 1500 })}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum number of tokens in AI responses (applies to all use cases)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Privacy Notice */}
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Privacy & Data:</strong> Your workout data is anonymized before sending to AI services. 
                    Only metrics like pace, power, and distance are shared - no personal information is transmitted.
                  </AlertDescription>
                </Alert>

                {/* Configuration Status */}
                {isConfigured && (
                  <Alert className="border-green-200 bg-green-50">
                    <Brain className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>AI Coach is ready!</strong> You'll now receive advanced AI-powered insights 
                      based on your training data. These insights will appear alongside local analysis 
                      in your dashboard and chat.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Local AI Info */}
            {!settingsData.aiSettings.cloudAIEnabled && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Local Analysis Only:</strong> You'll receive insights based on statistical 
                  analysis of your training data. Enable Cloud AI for more advanced, personalized recommendations.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Advanced Configuration */}
        {settingsData.aiSettings.cloudAIEnabled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Advanced Configuration</CardTitle>
              <CardDescription>Customize AI prompts and behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <textarea
                  id="systemPrompt"
                  rows={4}
                  value={settingsData.aiSettings.systemPrompt}
                  onChange={(e) => saveSettings('aiSettings', { systemPrompt: e.target.value })}
                  className="w-full mt-1 p-2 border rounded-md resize-none font-mono text-sm"
                  placeholder="Configure the base system prompt for AI interactions..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Base system prompt used for all AI interactions. Sets the AI's personality and expertise level.
                </p>
              </div>

              <div>
                <Label htmlFor="chatSystemPrompt">Chat System Prompt</Label>
                <textarea
                  id="chatSystemPrompt"
                  rows={4}
                  value={settingsData.aiSettings.chatSystemPrompt}
                  onChange={(e) => saveSettings('aiSettings', { chatSystemPrompt: e.target.value })}
                  className="w-full mt-1 p-2 border rounded-md resize-none font-mono text-sm"
                  placeholder="Configure the chat-specific system prompt for AI coach conversations..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Specific system prompt for chat interactions. Defines how the AI coach behaves in conversations.
                </p>
              </div>

              <div>
                <Label htmlFor="planGenerationPrompt">Training Plan Generation Prompt</Label>
                <textarea
                  id="planGenerationPrompt"
                  rows={4}
                  value={settingsData.aiSettings.planGenerationPrompt}
                  onChange={(e) => saveSettings('aiSettings', { planGenerationPrompt: e.target.value })}
                  className="w-full mt-1 p-2 border rounded-md resize-none font-mono text-sm"
                  placeholder="Configure the prompt used for generating training plans..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Controls how the AI generates personalized training plans based on your goals and fitness level.
                </p>
              </div>

              <div>
                <Label htmlFor="insightsPrompt">AI Insights Prompt</Label>
                <textarea
                  id="insightsPrompt"
                  rows={8}
                  value={settingsData.aiSettings.insightsPrompt}
                  onChange={(e) => saveSettings('aiSettings', { insightsPrompt: e.target.value })}
                  className="w-full mt-1 p-2 border rounded-md resize-none font-mono text-sm"
                  placeholder="Configure the prompt used for generating AI insights in the dashboard..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This prompt controls how the AI analyzes your rowing data and generates insights. 
                  Use {`{sessionData}`} as a placeholder for the actual session data.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
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
