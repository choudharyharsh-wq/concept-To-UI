import React from "react";
import { PipelineStage } from "@/hooks/use-generation-stream";
import { PRDStage } from "./prd-stage";
import { IAStage } from "./ia-stage";
import { UserFlowStage } from "./user-flow-stage";
import { UXLayoutStage } from "./ux-layout-stage";
import { RenderStage } from "./render-stage";

interface PipelineContainerProps {
  stages: PipelineStage[];
}

export function PipelineContainer({ stages }: PipelineContainerProps) {
  return (
    <div className="w-full max-w-3xl mx-auto mt-4 pb-24">
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-[22px] top-6 bottom-6 w-px bg-zinc-800" />

        <div className="space-y-10">
          {stages.map((stage) => {
            switch (stage.id) {
              case "prd_node":
                return <PRDStage key={stage.id} stage={stage} />;
              case "ia_node":
                return <IAStage key={stage.id} stage={stage} />;
              case "user_flow_node":
                return <UserFlowStage key={stage.id} stage={stage} />;
              case "ux_layout_node":
                return <UXLayoutStage key={stage.id} stage={stage} />;
              case "render_node":
                return <RenderStage key={stage.id} stage={stage} allStages={stages} />;
              default:
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
}
