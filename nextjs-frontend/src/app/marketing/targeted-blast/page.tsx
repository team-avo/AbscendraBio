import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { TargetedBlastContent } from "@/components/marketing/targeted-blast-content";
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Targeted Marketing Blast | Centre Research',
    description: 'Send targeted marketing emails to selected customers.',
};

export default function TargetedBlastPage() {
    return (
        <DashboardLayout>
            <TargetedBlastContent />
        </DashboardLayout>
    );
}
