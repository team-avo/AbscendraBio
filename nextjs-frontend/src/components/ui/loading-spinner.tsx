import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
    className?: string;
    size?: number;
}

export function LoadingSpinner({ className, size = 24 }: LoadingSpinnerProps) {
    return (
        <Loader2
            size={size}
            className={cn("animate-spin text-primary", className)}
        />
    );
}

export function LoadingPage() {
    return (
        <div className="flex h-[50vh] w-full items-center justify-center">
            <LoadingSpinner size={32} />
        </div>
    );
}

export function LoadingScreen() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <LoadingSpinner size={40} />
        </div>
    );
}
