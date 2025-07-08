import { Component } from "solid-js";
// import { useTransContext } from "@mbarzda/solid-i18next";

interface DateDividerProps {
  date: Date;
}

const DateDivider: Component<DateDividerProps> = (props) => {
  // const [t] = useTransContext();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  return (
    <div class="flex items-center justify-center my-1.5 pt-3 px-4">
      <div class="flex-grow h-[1px] bg-text-secondary opacity-20"></div>
      <div class="mx-4 text-sm text-text-secondary font-medium">
        {formatDate(props.date)}
      </div>
      <div class="flex-grow h-[1px] bg-text-secondary opacity-20"></div>
    </div>
  );
};

export default DateDivider;