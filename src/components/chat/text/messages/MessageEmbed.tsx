import React from "react";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";
import { emojis } from "@/assets/emojis";
import { DateTime } from "luxon";
import Link from "next/link";
import remarkMath from "remark-math";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";

export function MessageEmbed({ embed }: { embed: any }) {
  function formatTimestamp(timestamp: number) {
    const now = DateTime.now();
    const date = DateTime.fromMillis(timestamp);

    switch (true) {
      case date.hasSame(now, "day"):
        return `Today at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
      case date.plus({ days: 1 }).hasSame(now, "day"):
        return `Yesterday at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
      case date.hasSame(now, "week"):
        return (
          "Last " +
          date.toFormat("EEEE") +
          ` at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`
        );
      default:
        return date.toLocaleString(DateTime.DATETIME_SHORT);
    }
  }

  const getBorderColor = (color?: string): string => {
    if (!color) return "gray";
    const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
    const rgbRegex = /^rgb\((\s*\d+\s*,){2}\s*\d+\s*\)$/i;
    const rgbaRegex = /^rgba\((\s*\d+\s*,){3}\s*(0|0\.\d+|1(\.0+)?)\s*\)$/i;

    if (hexRegex.test(color) || rgbRegex.test(color) || rgbaRegex.test(color)) {
      return color;
    }

    return "gray";
  };

  const borderColor = getBorderColor(embed.color);

  const CustomLink = ({ href, children }: { href?: any; children?: any }) => (
    <a
      href={href}
      className="text-blue-500 hover:underline hover:text-blue-600"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );

  const transformMessage = (content: string) => {
    const patterns: Record<
      string,
      (match: string, ...groups: string[]) => string
    > = {
      ":([^:]+):": (match, content) => {
        const emojiValue = emojis[content];
        return emojiValue ?? match;
      },
    };

    let text = content;

    for (const pattern in patterns) {
      const regex = new RegExp(pattern, "g");
      text = text.replace(regex, patterns[pattern]);
    }

    return text;
  };

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

  const isEmbeddableUrl = (url: string): boolean => {
    const embeddableDomains = ["youtube.com", "twitch.tv", "vimeo.com"]; // Add more domains as needed
    try {
      const urlObj = new URL(url);
      return embeddableDomains.some((domain) =>
        urlObj.hostname.includes(domain)
      );
    } catch (e) {
      console.error("Invalid URL:", url);
      return false;
    }
  };

  return (
    <div
      className="message-embed"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="embed-content">
        {embed.author && (
          <div className="embed-author">
            {embed.author.icon_url && (
              <img
                src={embed.author.icon_url}
                alt="Author Icon"
                className="author-icon"
              />
            )}
            {embed.author.url ? (
              <Link href={embed.author.url}>
                <span className="author-name">{embed.author.name}</span>
              </Link>
            ) : (
              <span className="author-name">{embed.author.name}</span>
            )}
          </div>
        )}
        {embed.title && (
          <div className="embed-title">
            {embed.url ? (
              <a href={embed.url} target="_blank" rel="noopener noreferrer">
                {embed.title}
              </a>
            ) : (
              embed.title
            )}
          </div>
        )}
        {embed.description && (
          <div className="embed-description">
            <ReactMarkdown
              components={{ a: CustomLink }}
              remarkPlugins={[gfm, remarkFrontmatter, remarkParse]}
            >
              {transformMessage(embed.description!)}
            </ReactMarkdown>
          </div>
        )}
        {embed.fields &&
          embed.fields.map(
            (
              field: {
                name:
                  | string
                  | number
                  | boolean
                  | React.ReactElement<
                      any,
                      string | React.JSXElementConstructor<any>
                    >
                  | Iterable<React.ReactNode>
                  | React.ReactPortal
                  | Iterable<React.ReactNode>
                  | null
                  | undefined;
                value:
                  | string
                  | number
                  | boolean
                  | React.ReactElement<
                      any,
                      string | React.JSXElementConstructor<any>
                    >
                  | Iterable<React.ReactNode>
                  | React.ReactPortal
                  | Iterable<React.ReactNode>
                  | null
                  | undefined;
                inline: boolean | null | undefined;
              },
              index: React.Key | null | undefined
            ) => (
              <div
                key={index}
                className={`embed-field ${
                  field.inline === false || field.inline === null
                    ? "field-block"
                    : ""
                }`}
              >
                <span className="field-name">{field.name}</span>{" "}
                {!field.inline && <br />}
                {field.value && (
                  <span className={`field-value ${field.inline && "pl-2"}`}>
                    {field.value}
                  </span>
                )}
              </div>
            )
          )}
        {embed.video && (
          <>
            {isEmbeddableUrl(embed.video.url) ? (
              <iframe
                src={embed.video.url}
                className="embed-video"
                style={getMaxDimensions(embed.video.width, embed.video.height)}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              ></iframe>
            ) : (
              <video
                src={embed.video.url}
                className="embed-video"
                style={getMaxDimensions(embed.video.width, embed.video.height)}
                controls
              ></video>
            )}
          </>
        )}

        {!embed.video && (
          <>
            {embed.image && (
              <img
                src={embed.image.url}
                className="embed-image"
                style={getMaxDimensions(embed.image.width, embed.image.height)}
                loading="lazy"
              />
            )}
          </>
        )}
        {embed.footer && (
          <div className="embed-footer">
            {embed.footer.icon_url && (
              <img
                src={embed.footer.icon_url}
                loading="lazy"
                alt="Footer Icon"
                className="footer-icon"
              />
            )}
            {embed.footer.text && (
              <span className="footer-text">{embed.footer.text}</span>
            )}
          </div>
        )}
      </div>
      {embed.timestamp && (
        <div className="embed-timestamp">
          {formatTimestamp(Number(embed.timestamp))}
        </div>
      )}
    </div>
  );
}