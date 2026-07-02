import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, User, Permission } from '@/lib/api';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Loader2, Shield } from 'lucide-react';
import logger from '@/lib/logger';

interface ManagePermissionsDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const MODULES = [
  'products',
  'orders',
  'customers',
  'inventory',
  'collections',
  'categories',
  'shipping',
  'users',
  'settings',
  'analytics'
];

const ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE'];

const ACCESS_LEVELS = {
  NONE: 'No Access',
  READ: 'View Only',
  PARTIAL: 'Partial Access',
  FULL: 'Full Access'
} as const;

export function ManagePermissionsDialog({
  user,
  open,
  onOpenChange,
  onSuccess
}: ManagePermissionsDialogProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [fetchingUser, setFetchingUser] = useState(false);

  useEffect(() => {
    async function fetchUserPermissions() {
      if (user && open) {
        try {
          setFetchingUser(true);
          const response = await api.getUser(user.id);

          if (response.success && response.data) {
            // Normalize backend permissions (modules are uppercase in API)
            const fetched = (response.data.permissions || []).map((p: any) => ({
              id: p.id || `${String(p.module).toLowerCase()}-${p.action}`,
              module: String(p.module).toLowerCase(),
              action: String(p.action).toUpperCase(),
              granted: Boolean(p.granted),
            }));

            // Ensure a complete matrix for all MODULES x ACTIONS
            const completeMatrix: Permission[] = MODULES.flatMap(module =>
              ACTIONS.map(action => {
                const existing = fetched.find((p: any) => p.module === module && p.action === action);
                return existing || {
                  id: `${module}-${action}`,
                  module,
                  action,
                  granted: false,
                };
              })
            );

            setPermissions(completeMatrix);

            // Initialize all modules as expanded
            const initialExpandedState = MODULES.reduce((acc, module) => ({
              ...acc,
              [module]: true
            }), {});
            setExpandedModules(initialExpandedState);
          }
        } catch (error) {
          logger.error('Failed to fetch user permissions:', { error: error });
          toast.error('Failed to load user permissions');
        } finally {
          setFetchingUser(false);
        }
      }
    }

    fetchUserPermissions();
  }, [user, open]);

  const handlePermissionChange = (module: string, action: string, granted: boolean) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.module === module && p.action === action);
      if (existing) {
        return prev.map(p =>
          p.module === module && p.action === action
            ? { ...p, granted }
            : p
        );
      }
      return [...prev, { id: `${module}-${action}`, module, action, granted }];
    });
  };

  const handleModuleSelectAll = (module: string, granted: boolean) => {
    setPermissions(prev => {
      return prev.map(p =>
        p.module === module ? { ...p, granted } : p
      );
    });
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await api.updateUserPermissions(user.id, permissions);

      if (response.success) {
        toast.success('Permissions updated successfully');
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(response.error || 'Failed to update permissions');
      }
    } catch (error) {
      logger.error('Failed to update permissions:', { error: error });
      toast.error('Failed to update permissions');
    } finally {
      setLoading(false);
    }
  };

  const isPermissionGranted = (module: string, action: string) => {
    return permissions.some(p =>
      p.module === module &&
      p.action === action &&
      p.granted
    );
  };

  const getModuleAccessLevel = (module: string) => {
    const modulePermissions = permissions.filter(p => p.module === module);
    const grantedCount = modulePermissions.filter(p => p.granted).length;

    if (grantedCount === 0) return ACCESS_LEVELS.NONE;
    if (grantedCount === ACTIONS.length) return ACCESS_LEVELS.FULL;
    if (modulePermissions.some(p => p.action === 'READ' && p.granted)) return ACCESS_LEVELS.READ;
    return ACCESS_LEVELS.PARTIAL;
  };

  const getAccessLevelBadgeVariant = (accessLevel: string) => {
    switch (accessLevel) {
      case ACCESS_LEVELS.FULL:
        return 'default';
      case ACCESS_LEVELS.PARTIAL:
        return 'secondary';
      case ACCESS_LEVELS.READ:
        return 'outline';
      default:
        return 'destructive';
    }
  };

  const toggleModuleExpansion = (module: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [module]: !prev[module]
    }));
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl p-0 rounded-2xl overflow-hidden border-gray-200 flex flex-col max-h-[90vh]">
        <div className="bg-[#043061] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#5A9ADA]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Manage Permissions</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">Configure access rights for {user.firstName} {user.lastName}</p>
            </div>
          </div>
        </div>

        {fetchingUser ? (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading permissions...</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {MODULES.map(module => {
                const accessLevel = getModuleAccessLevel(module);
                const isExpanded = expandedModules[module];

                return (
                  <Card key={module} className="overflow-hidden">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center space-x-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-8 w-8 shrink-0"
                            onClick={() => toggleModuleExpansion(module)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          <div>
                            <div className="font-semibold capitalize text-sm sm:text-base">{module}</div>
                            <div className="text-xs sm:text-sm text-muted-foreground">
                              Access: <Badge variant={getAccessLevelBadgeVariant(accessLevel)} className="text-[10px] sm:text-xs">{accessLevel}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleModuleSelectAll(module, true)}
                            className="h-8 text-[10px] sm:text-xs flex-1 sm:flex-none"
                          >
                            Grant All
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleModuleSelectAll(module, false)}
                            className="h-8 text-[10px] sm:text-xs flex-1 sm:flex-none"
                          >
                            Revoke All
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-2 pl-2 sm:pl-11">
                          {ACTIONS.map(action => (
                            <div key={`${module}-${action}`} className="flex items-center space-x-2">
                              <Checkbox
                                id={`${module}-${action}`}
                                checked={isPermissionGranted(module, action)}
                                onCheckedChange={(checked) =>
                                  handlePermissionChange(module, action, checked as boolean)
                                }
                              />
                              <label
                                htmlFor={`${module}-${action}`}
                                className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {action.charAt(0) + action.slice(1).toLowerCase()}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <DialogFooter className="p-4 sm:p-6 pt-2 sm:pt-4 border-t bg-muted/5 flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="w-full sm:w-auto order-2 sm:order-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading || fetchingUser}
                className="w-full sm:w-auto order-1 sm:order-2 bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
} 