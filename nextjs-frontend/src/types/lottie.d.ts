import * as React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lottie-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        autoplay?: boolean | '';
        loop?: boolean | '';
        mode?: string;
        src?: string;
        background?: string;
        speed?: number;
        style?: React.CSSProperties;
      };
    }
  }
}

export {};


