'use client';

import { ReactNode } from 'react';
import ClientOnly from "@/components/ClientOnly";
import { OnchainProviders } from "@/components/OnchainProviders";
import { Toaster } from "react-hot-toast";

interface ClientLayoutWrapperProps {
  children: ReactNode;
}

export default function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  return (
    <ClientOnly>
      <OnchainProviders>
        <Toaster position="top-right" />
        {children}
      </OnchainProviders>
    </ClientOnly>
  );
}