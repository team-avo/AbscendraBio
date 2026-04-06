'use client';

import React, { useEffect } from 'react';

type LottiePlayerProps = React.HTMLAttributes<HTMLElement> & {
	autoplay?: boolean;
	loop?: boolean;
	mode?: string;
	src?: string;
	background?: string;
	speed?: number;
	style?: React.CSSProperties;
};

export function LottiePlayer(props: LottiePlayerProps) {
	useEffect(() => {
		// Ensure the Lottie web component is registered
		if (typeof window === 'undefined') return;
		const defined = (customElements as any)?.get?.('lottie-player');
		if (!defined) {
			const existing = document.getElementById('lottie-player-loader');
			if (!existing) {
				const script = document.createElement('script');
				script.id = 'lottie-player-loader';
				script.src = 'https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js';
				script.async = true;
				document.head.appendChild(script);
			}
		}
	}, []);

	return React.createElement('lottie-player', {
		autoplay: props.autoplay ?? true,
		loop: props.loop ?? false,
		...props,
	} as any);
}


