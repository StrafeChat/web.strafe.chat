import type { Component, JSX } from 'solid-js';

interface CardProps {
  class?: string;
  children?: JSX.Element;
}

export const Card: Component<CardProps> = (props) => (
  <div
    class={`rounded-lg border border-border bg-card text-card-foreground shadow-sm ${props.class ?? ''}`}
  >
    {props.children}
  </div>
);

interface CardHeaderProps {
  class?: string;
  children?: JSX.Element;
}

export const CardHeader: Component<CardHeaderProps> = (props) => (
  <div class={`flex flex-col space-y-1.5 p-6 ${props.class ?? ''}`}>
    {props.children}
  </div>
);

interface CardTitleProps {
  class?: string;
  children?: JSX.Element;
}

export const CardTitle: Component<CardTitleProps> = (props) => (
  <h2 class={`text-xl font-semibold leading-none tracking-tight ${props.class ?? ''}`}>
    {props.children}
  </h2>
);

interface CardDescriptionProps {
  class?: string;
  children?: JSX.Element;
}

export const CardDescription: Component<CardDescriptionProps> = (props) => (
  <p class={`text-sm text-muted-foreground ${props.class ?? ''}`}>
    {props.children}
  </p>
);

interface CardContentProps {
  class?: string;
  children?: JSX.Element;
}

export const CardContent: Component<CardContentProps> = (props) => (
  <div class={`p-6 pt-0 ${props.class ?? ''}`}>{props.children}</div>
);

interface CardFooterProps {
  class?: string;
  children?: JSX.Element;
}

export const CardFooter: Component<CardFooterProps> = (props) => (
  <div class={`flex items-center p-6 pt-0 ${props.class ?? ''}`}>
    {props.children}
  </div>
);
