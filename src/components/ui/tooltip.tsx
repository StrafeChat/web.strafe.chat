"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = ({
  children,
  delayDuration = 250,
  skipDelayDuration,
  disableHoverableContent,
}: {
  children: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
  disableHoverableContent?: boolean;
}) => {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} disableHoverableContent={disableHoverableContent}>{children}</TooltipPrimitive.Provider>;
};

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const BultInTooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "tooltip z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    // custom-side={props.side}
    {...props}
  />
));
BultInTooltipContent.displayName = TooltipPrimitive.Content.displayName;

const TooltipContent = ({
  children,
  side,
  className,
}: {
  children: any;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) => {
  return (
    <BultInTooltipContent className={className} side={side}>
      <TooltipPrimitive.TooltipArrow />
      {children}
    </BultInTooltipContent>
  );
};

export {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  BultInTooltipContent,
  TooltipProvider,
};
