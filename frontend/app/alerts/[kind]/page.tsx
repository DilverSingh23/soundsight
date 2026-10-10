import { Suspense } from "react";
import { notFound } from "next/navigation";
import AlertDetail from "@/components/alerts/alert-detail";
import { demoSounds, findDemoSound } from "@/components/alerts/demo-sounds";

// Keep the demo detail URLs valid without requiring a backend event store.
export function generateStaticParams() {
  return demoSounds.map(({ kind }) => ({ kind }));
}

type AlertDetailPageProps = {
  params: Promise<{ kind: string }>;
};

/** URL params are resolved inside Suspense for Next.js Cache Components. */
export default function AlertDetailPage({ params }: AlertDetailPageProps) {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="flex min-h-[60vh] flex-1 items-center justify-center bg-plum px-6 text-center text-light-on-dark"
        >
          Loading alert details…
        </main>
      }
    >
      <AlertDetailContent params={params} />
    </Suspense>
  );
}

async function AlertDetailContent({ params }: AlertDetailPageProps) {
  const { kind } = await params;
  const sound = findDemoSound(kind);

  if (!sound) notFound();

  return <AlertDetail sound={sound} />;
}
