import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { api, authHeaders } from "@/lib/api";
import { FeedbackModal } from "@/components/FeedbackModal";

export function EmergencySafetyRouteCard({ compact = false }: { compact?: boolean }) {
  const [finding, setFinding] = useState(false);
  const [evacResult, setEvacResult] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ isOpen: boolean; title: string; message: string; type: "success" | "error" }>({
    isOpen: false,
    title: "",
    message: "",
    type: "success",
  });

  const fetchNearest = async (latitude: number, longitude: number, useFallback = false) => {
    try {
      const res = await api.get("/api/services/evacuation/nearest", {
        params: { lat: latitude, lng: longitude },
        headers: authHeaders(),
      });
      setEvacResult(res.data || null);
      setFeedback({
        isOpen: true,
        title: "Evacuation Center Found",
        message: useFallback ? "GPS was unavailable. We used default Mambog II location." : "Nearest evacuation center has been suggested.",
        type: "success",
      });
    } catch (err: any) {
      setFeedback({
        isOpen: true,
        title: "Lookup Failed",
        message: err?.response?.data?.msg || "Unable to find evacuation center right now.",
        type: "error",
      });
    } finally {
      setFinding(false);
    }
  };

  const findNearestEvacuationCenter = () => {
    setFinding(true);
    if (!navigator.geolocation) {
      void fetchNearest(14.4149, 120.9526, true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await fetchNearest(position.coords.latitude, position.coords.longitude, false);
      },
      async () => {
        await fetchNearest(14.4149, 120.9526, true);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <>
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 md:p-6">
        <div className={`flex ${compact ? "flex-col gap-3" : "flex-col gap-4 md:flex-row md:items-center md:justify-between"}`}>
          <div>
            <h3 className="text-lg font-bold text-[#395886]">Emergency Safety Route</h3>
            <p className="text-sm text-slate-600">Find the nearest evacuation center and suggested safe route during disasters.</p>
          </div>
          <button
            onClick={findNearestEvacuationCenter}
            type="button"
            disabled={finding}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#395886] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <LocateFixed size={16} /> {finding ? "Locating..." : "Find Nearest Evacuation Center"}
          </button>
        </div>
        {evacResult?.nearest ? (
          <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4 text-sm">
            <p className="font-bold text-slate-900">{evacResult.nearest.name}</p>
            <p className="text-slate-600">{evacResult.nearest.address}</p>
            <p className="mt-1 text-slate-700">Distance: {evacResult.nearest.distanceKm} km</p>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${evacResult.nearest.location.lat},${evacResult.nearest.location.lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-semibold text-[#395886] underline"
            >
              Open Route in Maps
            </a>
          </div>
        ) : null}
      </div>
      <FeedbackModal
        isOpen={feedback.isOpen}
        onClose={() => setFeedback((prev) => ({ ...prev, isOpen: false }))}
        title={feedback.title}
        message={feedback.message}
        type={feedback.type}
      />
    </>
  );
}

