import React from "react";

export function MessageAttachment({ attachment }: { attachment: any }) {

  const getMaxDimensions = (
    width: number,
    height: number
  ): React.CSSProperties => {
    const maxWidth = 500;
    const maxHeight = 500;
    const aspectRatio = width / height;

    if (width > maxWidth || height > maxHeight) {
      if (width / maxWidth > height / maxHeight) {
        return {
          width: `${maxWidth}px`,
          height: `${maxWidth / aspectRatio}px`,
        };
      } else {
        return {
          width: `${maxHeight * aspectRatio}px`,
          height: `${maxHeight}px`,
        };
      }
    }

    return { width: `${width}px`, height: `${height}px` };
  };

  return (
    <div
      className="message-attachment">
     
    </div>
  );
}
