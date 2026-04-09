'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, User, getToken, setToken, removeToken } from '@/lib/api';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, options?: { suppressToasts?: boolean; portal?: 'CUSTOMER' | 'ADMIN'; onError?: (error: string) => void }) => Promise<User | null>;
  logout: (options?: { suppressToasts?: boolean; noRedirect?: boolean }) => void;
  register: (userData: {
    email: string;
    password: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    role?: string;
    mobile?: string;
    customerType?: 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2';
    companyName?: string;
    licenseNumber?: string;
    city?: string;
    zip?: string;
  }) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  hasPermission: (module: string, action: string) => boolean;
  hasRole: (roles: string | string[]) => boolean;
  showPendingApprovalModal: boolean;
  setShowPendingApprovalModal: (show: boolean) => void;
  showEmailVerificationModal: boolean;
  setShowEmailVerificationModal: (show: boolean) => void;
  // Global Auth Modal
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authModalView: 'customer' | 'admin';
  setAuthModalView: (view: 'customer' | 'admin') => void;
  openLoginModal: (view?: 'customer' | 'admin') => void;
  // Email OTP login
  requestEmailOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmailOtp: (email: string, code: string, options?: { portal?: 'CUSTOMER' | 'ADMIN'; onError?: (error: string) => void }) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPendingApprovalModal, setShowPendingApprovalModal] = useState(false);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalView, setAuthModalView] = useState<'customer' | 'admin'>('customer');
  const router = useRouter();

  const isAuthenticated = !!user;

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const response = await api.getProfile();
        if (response.success && response.data) {
          setUser(response.data);
        }
      } catch (error) {
        // Not logged in or error, ignore
        logger.error('Failed to initialize auth:', { error });
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string, options?: { suppressToasts?: boolean; portal?: 'CUSTOMER' | 'ADMIN'; onError?: (error: string) => void }): Promise<User | null> => {
    try {
      setIsLoading(true);
      const response = await api.login(email, password, options?.portal);

      if (response.success && response.data) {
        setToken(response.data.token);
        logger.debug('[Auth] Token set after login:', { token: response.data.token });
        setUser(response.data.user);
        if (!options?.suppressToasts) {
          toast.success('Login successful');
        }
        return response.data.user;
      } else {
        // Check for specific approval/verification errors
        logger.debug('[Auth] Login failed with error:', { error: response.error });
        const err = (response.error || '').toLowerCase();
        if (
          err.includes('pending for approval') ||
          err.includes('pending approval') ||
          err.includes('wait for approval') ||
          err.includes('inactive') ||
          err.includes('account is inactive')
        ) {
          // Show pending approval modal instead of toast
          setShowPendingApprovalModal(true);
        } else if (err.includes('verify your email')) {
          // Backend auto-sent verification email on this path. Show modal instead of toast.
          setShowEmailVerificationModal(true);
        } else {
          if (options?.onError) options.onError(response.error || 'Login failed');
          if (!options?.suppressToasts) {
            toast.error(response.error || 'Login failed');
          }
        }
        return null;
      }
    } catch (error) {
      logger.error('Login error:', { error });
      if (options?.onError) options.onError('Login failed');
      if (!options?.suppressToasts) toast.error('Login failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: {
    email: string;
    password: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    role?: string;
    mobile?: string; // required when role=CUSTOMER
    customerType?: 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2';
    companyName?: string;
    licenseNumber?: string;
    city?: string;
    zip?: string;
  }): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await api.register(userData);

      if (response.success && response.data) {
        if (userData.role === 'CUSTOMER') {
          // Customer registration - no auto-login; UI will handle modal popup
          return true;
        } else {
          // Staff registration - auto-login
          setToken(response.data.token);
          setUser(response.data.user);
          toast.success('Registration successful');
          return true;
        }
      } else {
        toast.error(response.error || 'Registration failed');
        return false;
      }
    } catch (error) {
      logger.error('Registration error:', { error });
      toast.error('Registration failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (options?: { suppressToasts?: boolean; noRedirect?: boolean }) => {
    try {
      // Call logout API (but don't wait for it)
      api.logout().catch(err => logger.error('Logout API failed:', { error: err }));

      // Clear local state
      removeToken();
      setUser(null);

      if (!options?.suppressToasts) {
        toast.success('Logged out successfully');
      }
      if (!options?.noRedirect) {
        router.push('/');
      }
    } catch (error) {
      logger.error('Logout error:', { error });
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const response = await api.getProfile();
      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      logger.error('Failed to refresh user:', { error });
    }
  };

  const hasPermission = (module: string, action: string): boolean => {
    if (!user) return false;

    // Admins have all permissions
    if (user.role === 'ADMIN') return true;

    // SALES_REP implicit read access for key modules (frontend parity with backend fallback)
    if (user.role === 'SALES_REP') {
      // Explicitly deny DELETE access on CUSTOMERS for sales reps
      if (String(action).toUpperCase() === 'DELETE' && String(module).toUpperCase() === 'CUSTOMERS') {
        return false;
      }

      const allowedReadModules = ['CUSTOMERS', 'ORDERS', 'TRANSACTIONS', 'PRODUCTS', 'PAYMENTS'];
      if (String(action).toUpperCase() === 'READ' && allowedReadModules.includes(String(module).toUpperCase())) {
        return true;
      }

      // Allow CREATE access for specific modules for sales reps
      const allowedCreateModules = ['PAYMENTS', 'CUSTOMERS', 'ORDERS'];
      if (String(action).toUpperCase() === 'CREATE' && allowedCreateModules.includes(String(module).toUpperCase())) {
        return true;
      }

      // Allow UPDATE access for PAYMENTS module for sales reps
      const allowedUpdateModules = ['PAYMENTS'];
      if (String(action).toUpperCase() === 'UPDATE' && allowedUpdateModules.includes(String(module).toUpperCase())) {
        return true;
      }
    }

    // Check specific permissions
    if (user.permissions) {
      return user.permissions.some(
        permission =>
          String(permission.module).toUpperCase() === String(module).toUpperCase() &&
          String(permission.action).toUpperCase() === String(action).toUpperCase() &&
          permission.granted
      );
    }

    return false;
  };

  const hasRole = (roles: string | string[]): boolean => {
    if (!user) return false;

    // Admin has access to everything
    if (user.role === 'ADMIN') return true;

    const roleArray = Array.isArray(roles) ? roles : [roles];

    // SALES_MANAGER should have access to anything a SALES_REP can access
    if (user.role === 'SALES_MANAGER' && roleArray.includes('SALES_REP')) {
      return true;
    }

    return roleArray.includes(user.role);
  };

  // Request email OTP for passwordless login
  const requestEmailOtp = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.requestEmailOtp(email);
      if (response.success) {
        return { success: true };
      } else {
        return { success: false, error: response.error || 'Failed to send code' };
      }
    } catch (error) {
      logger.error('Request email OTP error:', { error });
      return { success: false, error: 'Failed to send code' };
    }
  };

  // Login with email OTP
  const loginWithEmailOtp = async (
    email: string,
    code: string,
    options?: { portal?: 'CUSTOMER' | 'ADMIN'; onError?: (error: string) => void }
  ): Promise<User | null> => {
    try {
      setIsLoading(true);
      const response = await api.verifyEmailOtp(email, code, options?.portal);

      if (response.success && response.data) {
        setToken(response.data.token);
        setUser(response.data.user);
        toast.success('Login successful');
        return response.data.user;
      } else {
        const err = (response.error || '').toLowerCase();
        if (
          err.includes('pending for approval') ||
          err.includes('pending approval') ||
          err.includes('wait for approval') ||
          err.includes('inactive') ||
          err.includes('account is inactive')
        ) {
          setShowPendingApprovalModal(true);
        } else if (err.includes('verify your email')) {
          setShowEmailVerificationModal(true);
        } else {
          if (options?.onError) options.onError(response.error || 'Login failed');
          toast.error(response.error || 'Login failed');
        }
        return null;
      }
    } catch (error) {
      logger.error('Email OTP login error:', { error });
      if (options?.onError) options.onError('Login failed');
      toast.error('Login failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    register,
    refreshUser,
    hasPermission,
    hasRole,
    showPendingApprovalModal,
    setShowPendingApprovalModal,
    showEmailVerificationModal,
    setShowEmailVerificationModal,
    requestEmailOtp,
    loginWithEmailOtp,
    showAuthModal,
    setShowAuthModal,
    authModalView,
    setAuthModalView,
    openLoginModal: (view: 'customer' | 'admin' = 'customer') => {
      setAuthModalView(view);
      setShowAuthModal(true);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route Component
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: Array<{ module: string; action: string }>;
  fallback?: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  requiredPermissions,
  fallback,
}) => {
  const { user, isLoading, isAuthenticated, hasRole, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line no-console
    logger.debug('[ProtectedRoute] state', { isLoading, isAuthenticated, hasUser: !!user });
    // Only redirect if we're not loading and the user is definitely not authenticated
    if (!isLoading && !isAuthenticated) {
      // eslint-disable-next-line no-console
      logger.debug('[ProtectedRoute] redirecting to /');
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // If not authenticated and not loading, show fallback or null
  if (!isAuthenticated || !user) {
    return fallback || null;
  }

  // Check role requirements, but allow SALES_REP to view customers/orders pages
  if (requiredRoles && !hasRole(requiredRoles)) {
    const url = pathname || '';
    const isCustomersOrOrders = (url.startsWith('/customers') || url.startsWith('/orders')) &&
      !url.includes('/customers/approvals') &&
      !url.includes('/customers/rejected');
    if ((user.role === 'SALES_REP' || user.role === 'SALES_MANAGER') && isCustomersOrOrders) {
      // allow read-only access regardless of requiredRoles
    } else {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have the required role to access this page.</p>
          </div>
        </div>
      );
    }
  }

  // Check permission requirements
  if (requiredPermissions) {
    const hasAllPermissions = requiredPermissions.every(
      ({ module, action }) => hasPermission(module, action)
    );

    if (!hasAllPermissions) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have the required permissions to access this page.</p>
          </div>
        </div>
      );
    }
  }

  // All checks passed, render the protected content
  return <>{children}</>;
};

// Hook for checking permissions in components
export const usePermissions = () => {
  const { hasPermission, hasRole, user } = useAuth();

  return {
    hasPermission,
    hasRole,
    user,
    canCreate: (module: string) => hasPermission(module, 'CREATE'),
    canRead: (module: string) => hasPermission(module, 'READ'),
    canUpdate: (module: string) => hasPermission(module, 'UPDATE'),
    canDelete: (module: string) => hasPermission(module, 'DELETE'),
    isAdmin: () => hasRole('ADMIN'),
    isManager: () => hasRole(['ADMIN', 'MANAGER']),
    isStaff: () => hasRole(['ADMIN', 'MANAGER', 'STAFF']),
  };
};