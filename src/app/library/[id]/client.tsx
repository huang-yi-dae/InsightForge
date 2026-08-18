"use client";

import { AppShell } from "@/components/zhizhi/app-shell";
import { LibraryDetailScreen } from "@/components/screens/library-detail-screen";

export function LibraryDetailPageClient({ id }: { id: string }) {
  return (
    <AppShell>
      <LibraryDetailScreen writingId={id} />
    </AppShell>
  );
}
