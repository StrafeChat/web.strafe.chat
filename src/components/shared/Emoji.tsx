import { Component } from "solid-js";
import {
  getTwemojiUrlFromShortcode,
  getEmojiDataFromShortcode,
} from "../../lib/data/twemojiData";

interface EmojiProps {
  emoji?: string; // For backward compatibility with Unicode
  shortcode?: string; // New shortcode prop
  size?: "small" | "medium" | "large";
  className?: string;
  fallback?: string;
}

export const Emoji: Component<EmojiProps> = (props) => {
  const getSize = () => {
    switch (props.size) {
      case "small":
        return "w-4 h-4";
      case "large":
        return "w-8 h-8";
      case "medium":
      default:
        return "w-5 h-5";
    }
  };

  // Determine the shortcode to use
  const shortcode = () => {
    if (props.shortcode) {
      // Clean shortcode by removing colons if present
      return props.shortcode.replace(/^:|:$/g, "");
    }
    // For backward compatibility, if emoji prop is provided and looks like a shortcode
    if (props.emoji) {
      // Clean emoji prop by removing colons if present
      return props.emoji.replace(/^:|:$/g, "");
    }
    return null;
  };

  const twemojiUrl = () => {
    const sc = shortcode();
    return sc ? getTwemojiUrlFromShortcode(sc) : null;
  };

  const emojiData = () => {
    const sc = shortcode();
    return sc ? getEmojiDataFromShortcode(sc) : null;
  };

  // If we have a valid shortcode and can get Twemoji URL, use the SVG
  const url = twemojiUrl();
  const data = emojiData();

  if (url && data) {
    return (
      <img
        src={url}
        alt={`:${shortcode()}:`}
        class={`inline-block ${getSize()} ${props.className || ""}`}
        style="vertical-align: -0.1em;"
        loading="lazy"
      />
    );
  }

  // Fallback to provided fallback or shortcode text
  return (
    <span
      class={`inline-block ${props.className || ""}`}
      style="font-size: 1.2em;"
      title={`Unknown emoji: ${shortcode() || props.emoji}`}
    >
      {props.fallback || `:${shortcode() || props.emoji}:`}
    </span>
  );
};
