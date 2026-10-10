import ConnectionControls from "@/components/connection-controls";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-3xl font-bold">SoundSight</h1>
        <p className="mt-2">Start listening to stream microphone audio.</p>
      </div>
      <ConnectionControls />
    </main>
  );
}
