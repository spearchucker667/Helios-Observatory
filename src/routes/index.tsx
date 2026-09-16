import { createFileRoute } from "@tanstack/react-router";
import { SolarApp } from "@/components/solar/solar-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="h-dvh overflow-hidden bg-bg text-fg">
      <SolarApp />
    </main>
  );
}
