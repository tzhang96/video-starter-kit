import {
  type PromptAnalysis as PromptAnalysisType,
  getModelName,
} from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import {
  LightbulbIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ModelPrompts {
  modelId: string;
  positivePrompts: string[];
  negativePrompts: string[];
}

interface PromptAnalysisProps {
  data: ModelPrompts[];
  onAnalyze: (modelId: string) => Promise<PromptAnalysisType>;
}

export function PromptAnalysis({ data, onAnalyze }: PromptAnalysisProps) {
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

  const handleAnalyze = async (modelId: string) => {
    setAnalyzing((prev) => ({ ...prev, [modelId]: true }));
    try {
      const result = await onAnalyze(modelId);
      setAnalysisResults((prev) => ({ ...prev, [modelId]: result }));
    } finally {
      setAnalyzing((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {data.map((model) => (
        <div
          key={model.modelId}
          className="rounded-lg border bg-card text-card-foreground shadow-sm"
        >
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="text-2xl font-semibold leading-none tracking-tight">
              {getModelName(model.modelId)}
            </h3>
            <p className="text-sm text-muted-foreground">
              {model.positivePrompts.length + model.negativePrompts.length}{" "}
              rated prompts available ({model.positivePrompts.length} positive,{" "}
              {model.negativePrompts.length} negative)
            </p>
          </div>
          <div className="p-6 pt-0">
            {analysisResults[model.modelId] ? (
              <div className="grid gap-4">
                {/* Analysis Section */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-green-600 dark:text-green-500 mb-2 flex items-center gap-1">
                      <CheckCircleIcon className="w-4 h-4" />
                      Successful Patterns
                    </h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {analysisResults[
                        model.modelId
                      ].analysis.positivePatterns.map((pattern, i) => (
                        <li key={i}>{pattern}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-red-600 dark:text-red-500 mb-2 flex items-center gap-1">
                      <XCircleIcon className="w-4 h-4" />
                      Unsuccessful Patterns
                    </h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {analysisResults[
                        model.modelId
                      ].analysis.negativePatterns.map((pattern, i) => (
                        <li key={i}>{pattern}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <LightbulbIcon className="w-4 h-4" />
                      Recommendations
                    </h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {analysisResults[
                        model.modelId
                      ].analysis.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Example Prompts */}
                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-green-600 dark:text-green-500">
                      Example Successful Prompts
                    </h4>
                    <ScrollArea className="h-32 rounded border p-2">
                      {model.positivePrompts.slice(0, 5).map((prompt, i) => (
                        <p key={i} className="text-sm mb-2">
                          {prompt}
                        </p>
                      ))}
                    </ScrollArea>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-red-600 dark:text-red-500">
                      Example Unsuccessful Prompts
                    </h4>
                    <ScrollArea className="h-32 rounded border p-2">
                      {model.negativePrompts.slice(0, 5).map((prompt, i) => (
                        <p key={i} className="text-sm mb-2">
                          {prompt}
                        </p>
                      ))}
                    </ScrollArea>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  onClick={() => handleAnalyze(model.modelId)}
                  disabled={analyzing[model.modelId]}
                >
                  <SparklesIcon className="w-4 h-4 mr-2" />
                  {analyzing[model.modelId]
                    ? "Analyzing Prompts..."
                    : "Get Prompting Insights"}
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
