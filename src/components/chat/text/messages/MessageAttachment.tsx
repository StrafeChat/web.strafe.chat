import React, { useState, useEffect } from "react";
import {
  FaDownload,
  FaFile,
  FaFileAudio,
} from "react-icons/fa6";

export function MessageAttachment({ attachment }: { attachment: any }) {
  const [videoDimensions, setVideoDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

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

  useEffect(() => {
    if (attachment.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = attachment.url;
      video.onloadedmetadata = () => {
        setVideoDimensions({
          width: video.videoWidth,
          height: video.videoHeight,
        });
      };
    }
  }, [attachment]);

  const renderAttachment = () => {
    const { name, type, url, width, height } = attachment;

    if (type.startsWith("image/")) {
      return (
        <img
          src={url}
          alt="attachment"
          loading="lazy"
          style={getMaxDimensions(width, height)}
          className="rounded-[10px]"
        />
      );
    } else if (type.startsWith("audio/") || type.startsWith("video/ogg")) {
      return (
        <div className="bg-[#1e1e1e] p-4 rounded-[5px] w-fit max-w-[100%]">
          <div className="flex items-center overflow-hidden">
            <div>
              <FaFileAudio size={30} />
            </div>
            <div className="attachment-meta ml-3 flex-1 overflow-hidden">
              <span className="block overflow-hidden whitespace-nowrap overflow-ellipsis">
                {name}
              </span>
              <span className="block overflow-hidden text-sm text-gray-400 whitespace-nowrap overflow-ellipsis">
                {type}
              </span>
            </div>
          </div>
          <div className="ml-auto w-full mt-3">
            <audio className="w-full" controls>
              <source src={url} type={type} />
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>
      );
    } else if (type.startsWith("video/")) {
      if (videoDimensions) {
        return (
          <video
            src={url}
            controls
            style={getMaxDimensions(
              videoDimensions.width,
              videoDimensions.height
            )}
            className="rounded-[10px]"
          />
        );
      } else {
        return (
          <div className="text-sm text-gray-400">
            Loading video<span className="typing-indicator"></span>
          </div>
        );
      }
    } else {
      return (
        <div className="bg-[#1e1e1e] p-4 rounded-[5px] w-fit max-w-[100%] flex items-center overflow-hidden">
          <div>
            <FaFile size={30} />
          </div>
          <div className="attachment-meta ml-3 flex-1 overflow-hidden">
            <span className="block overflow-hidden whitespace-nowrap overflow-ellipsis">
              {name}
            </span>
            <span className="block overflow-hidden text-sm text-gray-400 whitespace-nowrap overflow-ellipsis">
              {type}
            </span>
          </div>
          <div className="ml-auto pl-4 mr-2">
            <a href={url} download target="_blank" rel="noopener noreferrer">
              <FaDownload size={20} name="Download" />
            </a>
          </div>
        </div>
      );
    }
  };

  const formatDuration = (duration: number | null): string => {
    if (!duration) return "";
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return <div className="message-attachment">{renderAttachment()}</div>;
}