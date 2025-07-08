import { Component, For } from "solid-js";

interface MessageSkeletonProps {
  count?: number;
}

const MessageSkeleton: Component<MessageSkeletonProps> = (props) => {
  const count = props.count || 5;
  
  // Generate different skeleton patterns for variety
  const getSkeletonPattern = (index: number) => {
    const patterns = [
      { avatar: true, lines: [80, 60, 40], compact: false },
      { avatar: false, lines: [90, 70], compact: true },
      { avatar: true, lines: [70, 85, 55, 30], compact: false },
      { avatar: false, lines: [60, 45], compact: true },
      { avatar: true, lines: [95, 75, 65], compact: false },
    ];
    return patterns[index % patterns.length];
  };

  return (
    <div class="flex flex-col space-y-4 px-4 py-4">
      <For each={Array(count).fill(0)}>
        {(_, index) => {
          const pattern = getSkeletonPattern(index());
          return (
            <div class={`flex items-start space-x-3 ${pattern.compact ? 'ml-12' : ''}`}>
              {/* Avatar skeleton */}
              {pattern.avatar && (
                <div class="flex-shrink-0">
                  <div class="w-10 h-10 bg-border opacity-90 rounded-full animate-pulse"></div>
                </div>
              )}
              
              {/* Message content skeleton */}
              <div class="flex-1 space-y-2">
                {/* Username and timestamp (only for non-compact messages) */}
                {pattern.avatar && (
                  <div class="flex items-center space-x-2">
                    <div class="h-4 bg-border opacity-90 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}px` }}></div>
                    <div class="h-3 bg-border opacity-85 rounded animate-pulse" style={{ width: `${40 + Math.random() * 20}px` }}></div>
                  </div>
                )}
                
                {/* Message lines */}
                <div class="space-y-2">
                  <For each={pattern.lines}>
                    {(width) => (
                      <div 
                        class="h-4 bg-border opacity-85 rounded animate-pulse"
                        style={{ 
                          width: `${width + Math.random() * 20 - 10}%`,
                          "animation-delay": `${Math.random() * 0.5}s`
                        }}
                      ></div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
};

export default MessageSkeleton;