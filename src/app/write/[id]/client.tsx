"use client";

import { AppShell } from "@/components/zhizhi/app-shell";
import { WriteScreen } from "@/components/screens/write-screen";

export function WritePageClient({ id }: { id: string }) {
  return (
    <AppShell>
      <WriteScreen draftId={id} />
    </AppShell>
  );
}
