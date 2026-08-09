"use client";

import { use } from "react";
import { AppShell } from "@/components/zhizhi/app-shell";
import { WriteScreen } from "@/components/screens/write-screen";

export default function WritePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell>
      <WriteScreen draftId={id} />
    </AppShell>
  );
}
