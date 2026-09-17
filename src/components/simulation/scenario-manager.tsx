import React, { useState, useRef } from "react";
import { useSandboxStore } from "@/simulation/state/sandbox-store";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  Save,
  Download,
  Upload,
  Trash2,
  X,
  Check,
  AlertCircle,
} from "lucide-react";

export function ScenarioManager() {
  const {
    scenarioModalOpen,
    closeScenarioModal,
    scenarioName,
    saveCurrentScenario,
    savedScenarios,
    loadScenarioById,
    deleteSavedScenario,
    exportScenarioJson,
    importScenarioJson,
    resetScenario,
  } = useSandboxStore();

  const [nameInput, setNameInput] = useState(scenarioName);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!scenarioModalOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    await saveCurrentScenario(nameInput.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleExport = () => {
    const jsonStr = exportScenarioJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nameInput.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-scenario.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const res = importScenarioJson(text);
      if (!res.success) {
        setImportError(res.error ?? "Failed to import scenario");
      }
    };
    reader.onerror = () => setImportError("Failed to read file");
    reader.readAsText(file);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scenario Management"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/75 p-4 backdrop-blur-md animate-in fade-in duration-150 font-sans text-fg"
    >
      <div className="w-full max-w-xl rounded-2xl bg-surface border border-fg/10 shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-fg/10 pb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="size-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-base">Scenario Manager</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={closeScenarioModal} className="size-8">
            <X className="size-4" />
          </Button>
        </div>

        {importError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{importError}</span>
          </div>
        )}

        {/* Save current scenario */}
        <form onSubmit={handleSave} className="p-3.5 rounded-xl bg-bg/50 border border-fg/5 space-y-2">
          <label htmlFor="scenario-name-input" className="block text-xs font-medium text-muted">
            Save Current Simulation Scenario
          </label>
          <div className="flex items-center gap-2">
            <input
              id="scenario-name-input"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Scenario name…"
              className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-fg/10 text-fg text-xs outline-none focus:border-primary/60 font-sans"
            />
            <Button type="submit" variant="primary" size="sm" className="h-8 px-3 text-xs">
              {saveSuccess ? (
                <>
                  <Check className="size-3.5 text-emerald-400 mr-1" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="size-3.5 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Export and Import Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-9 justify-center text-xs"
          >
            <Download className="size-3.5 mr-1.5" />
            Export JSON
          </Button>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 w-full justify-center text-xs"
            >
              <Upload className="size-3.5 mr-1.5" />
              Import JSON
            </Button>
          </div>
        </div>

        {/* Stored scenarios list */}
        <div className="flex-1 flex flex-col min-h-0 space-y-2">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Saved Scenarios in Browser Storage
          </h4>

          <div className="flex-1 overflow-y-auto helios-scroll space-y-1.5 pr-1">
            {savedScenarios.length === 0 ? (
              <div className="py-8 text-center text-muted text-xs">
                No saved custom scenarios found in local storage.
              </div>
            ) : (
              savedScenarios.map((scen) => (
                <div
                  key={scen.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-bg/40 hover:bg-bg/70 border border-fg/5 transition-all text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-fg truncate">{scen.name}</p>
                    <p className="text-[10px] font-mono text-muted">
                      {new Date(scen.updatedAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenarioById(scen.id)}
                      className="h-7 px-2.5 text-xs"
                    >
                      Load
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSavedScenario(scen.id)}
                      className="size-7 text-muted hover:text-rose-400"
                      aria-label={`Delete ${scen.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Reset to Default Solar System */}
        <div className="pt-2 border-t border-fg/10 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              resetScenario();
              closeScenarioModal();
            }}
            className="text-xs text-muted hover:text-fg"
          >
            Reset to Canonical Solar System
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={closeScenarioModal}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
