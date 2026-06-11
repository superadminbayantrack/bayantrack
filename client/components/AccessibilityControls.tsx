import { useEffect, useState } from "react";
import { Accessibility, Contrast, Minus, Plus, RotateCcw, X } from "lucide-react";

const STORAGE_KEY = "bayantrack-accessibility";
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.2;

type AccessibilityState = {
  highContrast: boolean;
  scale: number;
};

function readInitialState(): AccessibilityState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      highContrast: Boolean(saved.highContrast),
      scale: Number(saved.scale) || 1,
    };
  } catch {
    return { highContrast: false, scale: 1 };
  }
}

export function AccessibilityControls() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AccessibilityState>(() => readInitialState());

  useEffect(() => {
    document.documentElement.classList.toggle("bt-high-contrast", settings.highContrast);
    document.documentElement.style.setProperty("--bt-font-scale", String(settings.scale));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const setScale = (next: number) => {
    setSettings((current) => ({
      ...current,
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(next.toFixed(2)))),
    }));
  };

  return (
    <div className="fixed bottom-4 left-4 z-[70]">
      {open ? (
        <div className="mb-3 w-72 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">Accessibility</p>
              <h2 className="text-sm font-bold">Display Controls</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Close accessibility controls">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSettings((current) => ({ ...current, highContrast: !current.highContrast }))}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              <span className="inline-flex items-center gap-2"><Contrast size={16} /> High contrast</span>
              <span className={settings.highContrast ? "text-blue-700" : "text-slate-400"}>{settings.highContrast ? "On" : "Off"}</span>
            </button>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-xs font-bold text-slate-500">Font size</p>
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setScale(settings.scale - 0.05)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50" aria-label="Decrease font size">
                  <Minus size={16} />
                </button>
                <span className="text-sm font-bold">{Math.round(settings.scale * 100)}%</span>
                <button type="button" onClick={() => setScale(settings.scale + 0.05)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50" aria-label="Increase font size">
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ highContrast: false, scale: 1 })}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              <RotateCcw size={15} /> Reset
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-700 shadow-xl transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-200"
        aria-label="Open accessibility controls"
        title="Accessibility controls"
      >
        <Accessibility size={22} />
      </button>
    </div>
  );
}
