import React, { useEffect, useRef } from 'react';
import type { MessageEmbed } from '@strafechat/strafe.js';
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";
import { emojis } from "@/assets/emojjs";
import twemoji from "twemoji";
import { DateTime } from 'luxon';
import Link from 'next/link';
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';
import remarkParse from 'remark-parse';

export function MessageEmbed({ embed }: {embed: MessageEmbed }) {
  const borderColor = embed.color ? embed.color : "gray";

  function formatTimestamp(timestamp: number) {
    const now = DateTime.now();
    const date = DateTime.fromMillis(timestamp);

    switch (true) {
      case date.hasSame(now, 'day'):
        return `Today at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
      case date.plus({ days: 1 }).hasSame(now, 'day'):
        return `Yesterday at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
      case date.hasSame(now, 'week'):
        return "Last " + date.toFormat('EEEE') + ` at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
      default:
        return date.toLocaleString(DateTime.DATETIME_SHORT);
    }
  }
  
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

  return (
    <div className="message-embed" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="embed-content">
       {embed.author && (
          <div className="embed-author">
            {embed.author.icon_url && <img src={embed.author.icon_url} alt="Author Icon" className="author-icon" />}
            {embed.author.url ? (
             <Link href={embed.author.url}>
                <span className="author-name">{embed.author.name}</span>
             </Link>
            ) : (
             <span className="author-name">{embed.author.name}</span>
            )}
          </div>
        )}
        {embed.title && <div className="embed-title">{embed.title}</div>}
        {embed.description && <div className="embed-description">
        <ReactMarkdown
            components={{ a: CustomLink }}
            remarkPlugins={[gfm, remarkFrontmatter, remarkParse]}
          >
            {transformMessage(embed.description!)}
          </ReactMarkdown>
          </div>}
      {embed.fields && embed.fields.map((field: { name: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | React.PromiseLikeOfReactNode | Iterable<React.ReactNode> | null | undefined; value: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | React.PromiseLikeOfReactNode | Iterable<React.ReactNode> | null | undefined; inline: boolean | null | undefined; }, index: React.Key | null | undefined) => (
          <div key={index} className={`embed-field ${field.inline === false || field.inline === null ? 'field-block' : ''}`}>
            <span className="field-name">{field.name}</span> {!field.inline && <br />}
            {field.value && <span className={`field-value ${field.inline && "pl-2"}`}>{field.value}</span>}
          </div>
        ))}
        {embed.footer && (
          <div className="embed-footer">
            {embed.footer.icon_url && <img src={embed.footer.icon_url} alt="Footer Icon" className="footer-icon" />}
            {embed.footer.text && <span className="footer-text">{embed.footer.text}</span>}
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