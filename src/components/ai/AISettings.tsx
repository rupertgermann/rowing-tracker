import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cloudAI } from '@/lib/cloudAI';
import { 
  Cloud, 
  Key, 
  CheckCircle, 
  AlertTriangle, 
  Settings,
  RefreshCw,
  Shield
} from 'lucide-react';

interface AISettingsProps {
  onSettingsChange?: (settings: AIUserSettings) => void;
}

interface AIUserSettings {
  useCloudAI: boolean;
  apiKey: string;
  provider: 'openai' | 'anthropic' | 'local';
  model: string;
}

export function AISettings({ onSettingsChange }: AISettingsProps) {
  const [settings, setSettings] = useState<AIUserSettings>({
    useCloudAI: false,
    apiKey: '',
    provider: 'openai',
    model: 'gpt-4-turbo-preview'
  });
  
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [showApiKey, setShowApiKey] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('ai_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        // Initialize cloud AI if API key exists
        if (parsed.apiKey && parsed.useCloudAI) {
          cloudAI.initialize(parsed.apiKey);
        }
      } catch (error) {
        console.error('Failed to load AI settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('ai_settings', JSON.stringify(settings));
    onSettingsChange?.(settings);
    
    // Initialize or deinitialize cloud AI based on settings
    if (settings.useCloudAI && settings.apiKey) {
      cloudAI.initialize(settings.apiKey);
      setConnectionStatus('idle');
    }
  }, [settings, onSettingsChange]);

  const handleApiKeyChange = (value: string) => {
    setSettings(prev => ({ ...prev, apiKey: value }));
    setConnectionStatus('idle');
  };

  const handleUseCloudAIToggle = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, useCloudAI: enabled }));
    if (!enabled) {
      setConnectionStatus('idle');
    }
  };

  const testConnection = async () => {
    if (!settings.apiKey) {
      setConnectionStatus('error');
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('testing');

    try {
      // Initialize with current API key
      const initialized = cloudAI.initialize(settings.apiKey);
      if (!initialized) {
        throw new Error('Failed to initialize Cloud AI');
      }

      const isConnected = await cloudAI.testConnection();
      setConnectionStatus(isConnected ? 'success' : 'error');
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const getConnectionStatusDisplay = () => {
    switch (connectionStatus) {
      case 'testing':
        return (
          <Badge variant="outline" className="text-blue-600">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Testing...
          </Badge>
        );
      case 'success':
        return (
          <Badge variant="outline" className="text-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="text-red-600">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Not tested
          </Badge>
        );
    }
  };

  const isConfigured = settings.useCloudAI && settings.apiKey && connectionStatus === 'success';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          AI Settings
        </CardTitle>
        <CardDescription>
          Configure AI-powered insights and analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cloud AI Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Use Cloud AI</Label>
            <p className="text-sm text-muted-foreground">
              Enable advanced AI insights using OpenAI GPT-4
            </p>
          </div>
          <Switch
            checked={settings.useCloudAI}
            onCheckedChange={handleUseCloudAIToggle}
          />
        </div>

        {settings.useCloudAI && (
          <>
            {/* API Key Input */}
            <div className="space-y-2">
              <Label htmlFor="api-key" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                OpenAI API Key
              </Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={settings.apiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleApiKeyChange(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-3"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </Button>
              </div>
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
                  disabled={!settings.apiKey || isTestingConnection}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${isTestingConnection ? 'animate-spin' : ''}`} />
                  Test
                </Button>
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
                <Cloud className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Cloud AI is ready!</strong> You'll now receive advanced AI-powered insights 
                  based on your training data. These insights will appear alongside local analysis 
                  in your dashboard.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Local AI Info */}
        {!settings.useCloudAI && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Local Analysis Only:</strong> You'll receive insights based on statistical 
              analysis of your training data. Enable Cloud AI for more advanced, personalized recommendations.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
