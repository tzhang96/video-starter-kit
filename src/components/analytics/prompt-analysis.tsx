import {
  type PromptAnalysis as PromptAnalysisType,
  getModelName,
} from "@/lib/analytics";
import {
  LightbulbIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  FilmIcon,
  ImageIcon,
  MusicIcon,
  MicIcon,
  LayersIcon,
  TrendingUpIcon,
  ClockIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MediaType } from "@/data/store";

interface PromptAnalysisProps {
  data: Array<{
    category: MediaType;
    promptHistory: Array<{
      prompt: string;
      rating: "positive" | "negative";
      timestamp: number;
      modelId: string;
    }>;
  }>;
  onAnalyze: (category: MediaType) => Promise<PromptAnalysisType>;
}

type FilterType = MediaType | "all";

export function PromptAnalysis({ data, onAnalyze }: PromptAnalysisProps) {
  const [selectedType, setSelectedType] = useState<FilterType>("video");
  const [analysisResults, setAnalysisResults] = useState<
    Record<string, PromptAnalysisType>
  >({});
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});

  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No rated prompts available for analysis. Try rating some prompts as
        positive or negative first.
      </div>
    );
  }

  const handleAnalyze = async (category: MediaType) => {
    setAnalyzing((prev) => ({ ...prev, [category]: true }));
    try {
      const result = await onAnalyze(category);
      setAnalysisResults((prev) => ({ ...prev, [category]: result }));
    } finally {
      setAnalyzing((prev) => ({ ...prev, [category]: false }));
    }
  };

  const handleFilterChange = (value: string) => {
    setSelectedType(value as FilterType);
  };

  const filteredData = data.filter(
    (item) => selectedType === "all" || item.category === selectedType,
  );

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <ToggleGroup
          type="single"
          value={selectedType}
          onValueChange={handleFilterChange}
          className="justify-start"
        >
          <ToggleGroupItem value="video" aria-label="Video models">
            <FilmIcon className="w-4 h-4 mr-2" />
            Video
          </ToggleGroupItem>
          <ToggleGroupItem value="image" aria-label="Image models">
            <ImageIcon className="w-4 h-4 mr-2" />
            Image
          </ToggleGroupItem>
          <ToggleGroupItem value="music" aria-label="Music models">
            <MusicIcon className="w-4 h-4 mr-2" />
            Music
          </ToggleGroupItem>
          <ToggleGroupItem value="voiceover" aria-label="Voiceover models">
            <MicIcon className="w-4 h-4 mr-2" />
            Voice
          </ToggleGroupItem>
          <ToggleGroupItem value="all" aria-label="All models">
            <LayersIcon className="w-4 h-4 mr-2" />
            All
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filteredData.map((categoryData) => (
        <div
          key={categoryData.category}
          className="rounded-lg border bg-card text-card-foreground shadow-sm"
        >
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="text-2xl font-semibold leading-none tracking-tight capitalize">
              {categoryData.category} Generation Analysis
            </h3>
            <p className="text-sm text-muted-foreground">
              {categoryData.promptHistory.length} prompts analyzed
            </p>
          </div>
          <div className="p-6 pt-0">
            {analysisResults[categoryData.category] ? (
              <div className="grid gap-6">
                {/* Analysis Section */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-green-600 dark:text-green-500 mb-2 flex items-center gap-1">
                      <CheckCircleIcon className="w-4 h-4" />
                      Success Patterns
                    </h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {analysisResults[
                        categoryData.category
                      ].analysis.successPatterns.map((pattern, i) => (
                        <li key={i}>{pattern}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-blue-600 dark:text-blue-500 mb-2 flex items-center gap-1">
                      <TrendingUpIcon className="w-4 h-4" />
                      Evolution Insights
                    </h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {analysisResults[
                        categoryData.category
                      ].analysis.evolutionInsights.map((insight, i) => (
                        <li key={i}>{insight}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <LightbulbIcon className="w-4 h-4" />
                      Strategic Recommendations
                    </h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {analysisResults[
                        categoryData.category
                      ].analysis.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Prompt Timeline */}
                <div className="space-y-2 border-t pt-4">
                  <h4 className="text-sm font-medium mb-4 flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    Prompt Evolution Timeline
                  </h4>
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {categoryData.promptHistory.map((item, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg text-sm ${
                            item.rating === "positive"
                              ? "bg-green-500/10 border border-green-500/20"
                              : "bg-red-500/10 border border-red-500/20"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <p className="font-mono whitespace-pre-wrap">
                                {item.prompt}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Model: {getModelName(item.modelId)}
                              </p>
                            </div>
                            <time className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatTimestamp(item.timestamp)}
                            </time>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => handleAnalyze(categoryData.category)}
                  disabled={analyzing[categoryData.category]}
                >
                  <SparklesIcon className="w-4 h-4 mr-2" />
                  {analyzing[categoryData.category]
                    ? "Analyzing Prompts..."
                    : "Analyze Prompt Evolution"}
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
