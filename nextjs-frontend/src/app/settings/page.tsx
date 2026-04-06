import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { SettingsContent } from "@/components/settings/settings-content";
import { ProtectedRoute } from "@/contexts/auth-context";

export default function SettingsPage() {
    return (
        <ProtectedRoute
            requiredPermissions={[
                { module: 'settings', action: 'READ' }
            ]}
        >
            <DashboardLayout>
                <SettingsContent />
            </DashboardLayout>
        </ProtectedRoute>
    );
}
