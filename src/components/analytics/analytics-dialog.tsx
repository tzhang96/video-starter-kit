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

interface AnalyticsDialogProps {
  onOpenChange?: (open: boolean) => void;
}

function preparePromptData(mediaItems: MediaItem[]) {
  // Group rated prompts by model
  const byModel = new Map<
    string,
    { positivePrompts: string[]; negativePrompts: string[] }
  >();

  for (const item of mediaItems) {
    if (item.kind !== "generated" || !item.input?.prompt || !item.rating)
      continue;
    const modelId = item.endpointId;
    if (!byModel.has(modelId)) {
      byModel.set(modelId, { positivePrompts: [], negativePrompts: [] });
    }
    const modelData = byModel.get(modelId)!;
    if (item.rating === "positive") {
      modelData.positivePrompts.push(item.input.prompt);
    } else {
      modelData.negativePrompts.push(item.input.prompt);
    }
  }

  // Convert to array format
  return Array.from(byModel.entries())
    .filter(
      ([_, data]) =>
        data.positivePrompts.length > 0 || data.negativePrompts.length > 0,
    )
    .map(([modelId, data]) => ({
      modelId,
      ...data,
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
    async (modelId: string): Promise<PromptAnalysisType> => {
      const modelItems = mediaItems.filter(
        (item) =>
          item.kind === "generated" &&
          item.endpointId === modelId &&
          item.input?.prompt &&
          item.rating,
      );
      const [analysis] = await analyzePrompts(modelItems);
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
              Analyze patterns in successful and unsuccessful prompts
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
