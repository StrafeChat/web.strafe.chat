import { MessageProps } from "../types";

export const getInviteCodes = (props: MessageProps) => {
  const content = props.content;

  const regex = /(?:https?:\/\/[^\/\s]+)?\/invite\/(\w+)/g;
  const matches = [...content.matchAll(regex)];

  return matches
    .filter((match) => {
      const fullMatch = match[0];
      try {
        if (fullMatch.startsWith("http")) {
          const url = new URL(fullMatch);
          return url.hostname === window.location.hostname;
        }

        return fullMatch.startsWith("/invite/");
      } catch {
        return false;
      }
    })
    .map((match) => match[1]);
};
