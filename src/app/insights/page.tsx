'use client';

import { useState, useMemo } from 'react';
import { useAIInsights } from '@/hooks/useAIInsights';
import { InsightCard } from '@/components/ai/InsightCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Insight } from '@/lib/aiAnalysis';
import { CloudInsight } from '@/lib/cloudAI';
import { formatDateOnly } from '@/lib/dateTimeUtils';
import {
  Brain,
  Search,
  Archive,
  Sparkles,
  Filter,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Trophy,
  Lightbulb,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type InsightType = 'all' | 'trend' | 'recommendation' | 'warning' | 'achievement' | 'performance' | 'technique' | 'anomaly';
type SortOption = 'newest' | 'oldest' | 'priority';

export default function InsightsPage() {
  const {
    insights,
    archivedInsights,
    archiveInsight,
    unarchiveInsight,
    deleteInsight,
    refreshInsights,
    lastAnalyzed,
    isAnalyzable,
    isGenerating
  } = useAIInsights();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<InsightType[]>(['all']);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [activeTab, setActiveTab] = useState<'current' | 'archive'>('current');

  const insightTypes: { value: InsightType; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'All Types', icon: <Filter className="h-4 w-4" /> },
    { value: 'trend', label: 'Trends', icon: <TrendingUp className="h-4 w-4" /> },
    { value: 'recommendation', label: 'Recommendations', icon: <Lightbulb className="h-4 w-4" /> },
    { value: 'warning', label: 'Warnings', icon: <AlertTriangle className="h-4 w-4" /> },
    { value: 'achievement', label: 'Achievements', icon: <Trophy className="h-4 w-4" /> },
    { value: 'performance', label: 'Performance', icon: <Brain className="h-4 w-4" /> },
    { value: 'technique', label: 'Technique', icon: <Sparkles className="h-4 w-4" /> },
  ];

  const toggleType = (type: InsightType) => {
    if (type === 'all') {
      setSelectedTypes(['all']);
    } else {
      const newTypes = selectedTypes.filter(t => t !== 'all');
      if (newTypes.includes(type)) {
        const filtered = newTypes.filter(t => t !== type);
        setSelectedTypes(filtered.length === 0 ? ['all'] : filtered);
      } else {
        setSelectedTypes([...newTypes, type]);
      }
    }
  };

  const filterAndSortInsights = (insightList: (Insight | CloudInsight)[]) => {
    let filtered = insightList;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(insight =>
        insight.title.toLowerCase().includes(query) ||
        insight.description.toLowerCase().includes(query)
      );
    }

    // Filter by type
    if (!selectedTypes.includes('all')) {
      filtered = filtered.filter(insight =>
        selectedTypes.includes(insight.type as InsightType)
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.dateGenerated).getTime() - new Date(a.dateGenerated).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.dateGenerated).getTime() - new Date(b.dateGenerated).getTime();
      } else {
        // Priority: high > medium > low
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      }
    });

    return filtered;
  };

  const currentInsights = useMemo(() => filterAndSortInsights(insights || []), [insights, searchQuery, selectedTypes, sortBy]);
  const archivedInsightsList = useMemo(() => filterAndSortInsights(archivedInsights || []), [archivedInsights, searchQuery, selectedTypes, sortBy]);

  // Group insights by date for timeline view
  const groupByDate = (insightList: (Insight | CloudInsight)[]) => {
    const groups: Record<string, (Insight | CloudInsight)[]> = {};
    insightList.forEach(insight => {
      const date = formatDateOnly(new Date(insight.dateGenerated));
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(insight);
    });
    return groups;
  };

  const currentGrouped = useMemo(() => groupByDate(currentInsights), [currentInsights]);
  const archivedGrouped = useMemo(() => groupByDate(archivedInsightsList), [archivedInsightsList]);

  const activeInsights = activeTab === 'current' ? currentInsights : archivedInsightsList;
  const activeGrouped = activeTab === 'current' ? currentGrouped : archivedGrouped;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Brain className="h-8 w-8 text-blue-600" />
              AI Insights
            </h1>
            <p className="text-muted-foreground mt-1">
              Your personalized training recommendations and analysis history
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastAnalyzed && (
              <span className="text-sm text-muted-foreground">
                Last updated: {formatDateOnly(lastAnalyzed)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshInsights}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>



        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'current' | 'archive')} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="grid w-full sm:w-auto grid-cols-2">
              <TabsTrigger value="current" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Current ({currentInsights.length})
              </TabsTrigger>
              <TabsTrigger value="archive" className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Archive ({archivedInsightsList.length})
              </TabsTrigger>
            </TabsList>

            {/* Search and Filters */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search insights..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px] sm:w-[250px]"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Type
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {insightTypes.map(type => (
                    <DropdownMenuCheckboxItem
                      key={type.value}
                      checked={selectedTypes.includes(type.value)}
                      onCheckedChange={() => toggleType(type.value)}
                    >
                      <span className="flex items-center gap-2">
                        {type.icon}
                        {type.label}
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Sort
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem
                    checked={sortBy === 'newest'}
                    onCheckedChange={() => setSortBy('newest')}
                  >
                    Newest First
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortBy === 'oldest'}
                    onCheckedChange={() => setSortBy('oldest')}
                  >
                    Oldest First
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortBy === 'priority'}
                    onCheckedChange={() => setSortBy('priority')}
                  >
                    By Priority
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Active Filters */}
          {(!selectedTypes.includes('all') || searchQuery) && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-destructive">×</button>
                </Badge>
              )}
              {!selectedTypes.includes('all') && selectedTypes.map(type => (
                <Badge key={type} variant="secondary" className="flex items-center gap-1">
                  {insightTypes.find(t => t.value === type)?.label}
                  <button onClick={() => toggleType(type)} className="ml-1 hover:text-destructive">×</button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTypes(['all']);
                }}
                className="text-xs"
              >
                Clear all
              </Button>
            </div>
          )}

          {/* Content */}
          <TabsContent value="current" className="space-y-6">
            {currentInsights.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    {isGenerating ? (
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    ) : (
                      <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <Brain className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <h3 className="text-lg font-semibold mb-2">
                      {searchQuery || !selectedTypes.includes('all')
                        ? 'No Matching Insights'
                        : isGenerating
                          ? 'Generating Insights...'
                          : 'No Current Insights'
                      }
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {searchQuery || !selectedTypes.includes('all')
                        ? 'Try adjusting your search or filters.'
                        : isGenerating
                          ? 'AI is analyzing your training data. This may take a moment.'
                          : 'Complete more sessions to receive personalized AI recommendations.'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {Object.entries(currentGrouped).map(([date, dateInsights]) => (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-4">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium text-muted-foreground">{date}</h3>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {(() => {
                      // Sort by priority to find the highest priority insight
                      const priorityOrder = { high: 0, medium: 1, low: 2 };
                      const sorted = [...dateInsights].sort((a, b) => 
                        (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
                      );
                      const [featured, ...rest] = sorted;
                      
                      return (
                        <div className="space-y-4">
                          {/* Featured (highest priority) insight - full width */}
                          {featured && (
                            <InsightCard
                              key={featured.id || 'featured'}
                              insight={featured}
                              isArchived={false}
                              onArchive={archiveInsight}
                            />
                          )}
                          {/* Remaining insights in 2 columns */}
                          {rest.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {rest.map((insight, index) => (
                                <InsightCard
                                  key={insight.id || `insight-${index}`}
                                  insight={insight}
                                  isArchived={false}
                                  onArchive={archiveInsight}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="archive" className="space-y-6">
            {archivedInsightsList.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <Archive className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {searchQuery || !selectedTypes.includes('all')
                        ? 'No Matching Archived Insights'
                        : 'No Archived Insights'
                      }
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {searchQuery || !selectedTypes.includes('all')
                        ? 'Try adjusting your search or filters.'
                        : 'Insights are automatically archived when new ones are generated, or you can manually archive them.'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {Object.entries(archivedGrouped).map(([date, dateInsights]) => (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-4">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium text-muted-foreground">{date}</h3>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {(() => {
                      // Sort by priority to find the highest priority insight
                      const priorityOrder = { high: 0, medium: 1, low: 2 };
                      const sorted = [...dateInsights].sort((a, b) => 
                        (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
                      );
                      const [featured, ...rest] = sorted;
                      
                      return (
                        <div className="space-y-4">
                          {/* Featured (highest priority) insight - full width */}
                          {featured && (
                            <InsightCard
                              key={featured.id || 'featured-archived'}
                              insight={featured}
                              isArchived={true}
                              onArchive={unarchiveInsight}
                              onDelete={deleteInsight}
                            />
                          )}
                          {/* Remaining insights in 2 columns */}
                          {rest.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {rest.map((insight, index) => (
                                <InsightCard
                                  key={insight.id || `archived-${index}`}
                                  insight={insight}
                                  isArchived={true}
                                  onArchive={unarchiveInsight}
                                  onDelete={deleteInsight}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
