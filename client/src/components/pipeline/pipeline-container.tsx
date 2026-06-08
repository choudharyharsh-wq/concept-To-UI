import React from "react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { PRDStage } from "./prd-stage";
import { IAStage } from "./ia-stage";
import { CopyStage } from "./copy-stage";
import { LayoutStage } from "./layout-stage";
import { RenderStage } from "./render-stage";

interface PipelineContainerProps {
  stages: PipelineStage[];
}

export function PipelineContainer({ stages }: PipelineContainerProps) {
  return (
    <div className="w-full max-w-4xl mx-auto mt-12 space-y-8 pb-20">
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-800" />
        
        <div className="space-y-12">
          {stages.map((stage) => {
            switch (stage.id) {
              case "prd_node":
                return <PRDStage key={stage.id} stage={stage} />;
              case "ia_node":
                return <IAStage key={stage.id} stage={stage} />;
              case "copy_node":
                return <CopyStage key={stage.id} stage={stage} />;
              case "layout_node":
                return <LayoutStage key={stage.id} stage={stage} />;
              case "render_node":
                return <RenderStage key={stage.id} stage={stage} />;
              default:
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
}
