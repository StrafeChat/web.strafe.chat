import { Component } from "solid-js";
import { Tooltip } from "../../../common/Tooltip";
import { formatFullDate, formatTimeOnly } from "../utils/date";

interface CompactTimestampProps {
  createdAt: string;
  appearance: any;
}

export const CompactTimestamp: Component<CompactTimestampProps> = (props) => {
  return (
    <div
      class="text-xs text-text-secondary whitespace-nowrap flex-shrink-0 absolute left-[-56px] top-0 leading-[1.5] w-12 text-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
      style="margin-top: 0.25rem;"
    >
      <Tooltip
        position="top"
        content={formatFullDate(props.createdAt, props.appearance)}
      >
        <span>{formatTimeOnly(props.createdAt, props.appearance)}</span>
      </Tooltip>
    </div>
  );
};
