import { createFileRoute } from "@tanstack/react-router";
import { SimulationApp } from "@/components/simulation/simulation-app";

export const Route = createFileRoute("/sandbox")({ component: SandboxPage });

function SandboxPage() {
  return (
    <main className="h-dvh overflow-hidden bg-bg text-fg">
      <SimulationApp />
    </main>
  );
}
