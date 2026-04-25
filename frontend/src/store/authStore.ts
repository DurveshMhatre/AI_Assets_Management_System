import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    roleId?: string;
    organizationId: string;
    organization?: { id: string; name: string; logo?: string };
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    permissions: string[];
    login: (user: User, accessToken: string, refreshToken: string) => void;
    logout: () => void;
    setTokens: (accessToken: string, refreshToken: string) => void;
    setPermissions: (permissions: string[]) => void;
    hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            permissions: [],
            login: (user, accessToken, refreshToken) =>
                set({ user, accessToken, refreshToken, isAuthenticated: true }),
            logout: () =>
                set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, permissions: [] }),
            setTokens: (accessToken, refreshToken) =>
                set({ accessToken, refreshToken }),
            setPermissions: (permissions) =>
                set({ permissions }),
            hasPermission: (permission) => {
                const state = get();
                // ADMIN always has all permissions (fallback)
                if (state.user?.role === 'ADMIN') return true;
                return state.permissions.includes(permission);
            },
        }),
        { name: 'ams-auth' }
    )
);
