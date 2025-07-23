export const formatTimestamp = (
  timestamp: string | undefined,
  t: any,
  appearance: any,
) => {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  // Access the reactive appearance function to get the latest settings
  const use24HourFormat = appearance().use24HourFormat;

  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: !use24HourFormat,
  });

  if (isToday) {
    return t("time.today", { time: time });
  } else if (isYesterday) {
    return t("time.yesterday", { time: time });
  } else {
    // Check if the date is within the past week (2-7 days ago)
    const daysDiff = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDiff >= 2 && daysDiff <= 7) {
      const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
      return `Last ${weekday} at ${time}`;
    } else {
      // For dates older than a week, use standard date format
      const dateStr = date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
      return `${dateStr} ${time}`;
    }
  }
};

export const formatTimeOnly = (
  timestamp: string | undefined,
  appearance: any,
) => {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  // Access the reactive appearance function to get the latest settings
  const use24HourFormat = appearance().use24HourFormat;

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: !use24HourFormat,
  });
};

export const formatFullDate = (
  timestamp: string | undefined,
  appearance: any,
) => {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  // Access the reactive appearance function to get the latest settings
  const use24HourFormat = appearance().use24HourFormat;

  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: !use24HourFormat,
  });

  if (isToday) {
    return `Today at ${time}`;
  } else if (isYesterday) {
    return `Yesterday at ${time}`;
  } else {
    // Check if the date is within the past week (2-7 days ago)
    const daysDiff = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDiff >= 2 && daysDiff <= 7) {
      const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
      return `Last ${weekday} at ${time}`;
    } else {
      // For dates older than a week, use full date format
      return `${date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at ${time}`;
    }
  }
};
