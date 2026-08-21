'use client';

import React, { createContext, useContext } from 'react';
import { useSessionSync } from '@/hooks/use-session-sync';
import { authClient } from '@/lib/auth-client';

type Session = typeof authClient.$Infer.Session;

interface SessionContextType {
    session: Session | null;
    isPending: boolean;
    refetch: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const { data: session, isPending, refetch } = useSessionSync();

    return (
        <SessionContext.Provider value={{ session, isPending, refetch }}>
            {children}
        </SessionContext.Provider>
    );
}

export function useAppSession() {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useAppSession must be used within a SessionProvider');
    }
    return context;
}
