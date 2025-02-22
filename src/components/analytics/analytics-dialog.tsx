import { useVideoProjectStore } from "@/data/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BarChart2Icon } from "lucide-react";
import { useProjectId } from "@/data/store";
import { useProjectMediaItems } from "@/data/queries";
import { calculateModelStats, analyzePrompts } from "@/lib/analytics";
import { ModelPerformance } from "./model-performance";
import { PromptAnalysis } from "./prompt-analysis";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCallback } from "react";
import type { MediaItem } from "@/data/schema";
import type { PromptAnalysis as PromptAnalysisType } from "@/lib/analytics";
import type { MediaType } from "@/data/store";

interface AnalyticsDialogProps {
  onOpenChange?: (open: boolean) => void;
}

function preparePromptData(mediaItems: MediaItem[]) {
  // Group rated prompts by category
  const byCategory = new Map<
    MediaType,
    Array<{
      prompt: string;
      rating: "positive" | "negative";
      timestamp: number;
      modelId: string;
    }>
  >();

  for (const item of mediaItems) {
    if (
      item.kind !== "generated" ||
      !item.input?.prompt ||
      !item.rating ||
      !item.endpointId
    )
      continue;

    const category = item.mediaType;
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push({
      prompt: item.input.prompt,
      rating: item.rating,
      timestamp: item.createdAt,
      modelId: item.endpointId,
    });
  }

  // Convert to array format and sort by timestamp
  return Array.from(byCategory.entries()).map(([category, promptHistory]) => ({
    category,
    promptHistory: promptHistory.sort((a, b) => a.timestamp - b.timestamp),
  }));
}

export function AnalyticsDialog({ onOpenChange }: AnalyticsDialogProps) {
  const projectId = useProjectId();
  const analyticsDialogOpen = useVideoProjectStore(
    (s) => s.analyticsDialogOpen,
  );
  const setAnalyticsDialogOpen = useVideoProjectStore(
    (s) => s.setAnalyticsDialogOpen,
  );
  const { data: mediaItems = [] } = useProjectMediaItems(projectId);

  const modelStats = calculateModelStats(mediaItems);
  const promptData = preparePromptData(mediaItems);

  const handleAnalyzePrompts = useCallback(
    async (category: MediaType): Promise<PromptAnalysisType> => {
      const categoryItems = mediaItems.filter(
        (item) =>
          item.kind === "generated" &&
          item.mediaType === category &&
          item.input?.prompt &&
          item.rating,
      );
      const [analysis] = await analyzePrompts(categoryItems);
      return analysis;
    },
    [mediaItems],
  );

  const handleOnOpenChange = (isOpen: boolean) => {
    onOpenChange?.(isOpen);
    setAnalyticsDialogOpen(isOpen);
  };

  return (
    <Dialog open={analyticsDialogOpen} onOpenChange={handleOnOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2Icon className="w-5 h-5" />
            <span>Analytics</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="performance">Model Performance</TabsTrigger>
            <TabsTrigger value="prompts">Prompt Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Compare the performance of different AI models
            </p>

            {modelStats.length > 0 ? (
              <ModelPerformance data={modelStats} />
            ) : (
              <div className="min-h-[300px] flex items-center justify-center text-muted-foreground">
                No model data available yet
              </div>
            )}
          </TabsContent>

          <TabsContent value="prompts" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Analyze the evolution of prompts and identify successful patterns
            </p>

            <PromptAnalysis
              data={promptData}
              onAnalyze={handleAnalyzePrompts}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
