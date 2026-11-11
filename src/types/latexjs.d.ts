declare module 'latex.js' {
  export interface HtmlGeneratorOptions {
    documentClass?: string;
    CustomMacros?: new (generator: HtmlGenerator) => unknown;
    hyphenate?: boolean;
    languagePatterns?: unknown;
    styles?: string[];
  }

  export class Generator {
    documentClass: string;
  }

  export class HtmlGenerator extends Generator {
    constructor(options?: HtmlGeneratorOptions);
    domFragment(): DocumentFragment;
    htmlDocument(baseURL?: string): Document;
    stylesAndScripts(baseURL?: string): DocumentFragment;
    documentTitle(): string;
    reset(): void;
  }

  export class SyntaxError extends Error {}

  export function parse(latex: string, options: { generator: HtmlGenerator }): HtmlGenerator;

  export const LaTeXJSComponent: CustomElementConstructor;
  export const he: unknown;
}
