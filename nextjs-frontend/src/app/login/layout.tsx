import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Login | Ascendra Bio",
    description: "Sign in or create an account at Ascendra Bio",
};

// Simple layout for login page - no SEO scripts needed
export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {/* Preload the logo image for faster LCP */}
            <link
                rel="preload"
                href="/Centre-Labs-logo-sm.png"
                as="image"
                type="image/png"
            />
            {children}
        </>
    );
}
