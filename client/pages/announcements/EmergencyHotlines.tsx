import React, { useEffect, useState } from 'react';
import { Phone, MapPin, Info, Map, Siren, Flame, Waves, TriangleAlert } from 'lucide-react';
import { Chatbot } from "@/components/Chatbot";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { api } from "@/lib/api";
import { EmergencySafetyRouteCard } from "@/components/EmergencySafetyRouteCard";

export default function EmergencyHotlines() {
  const [evacCenters, setEvacCenters] = useState<any[]>([]);
  const [hotlines, setHotlines] = useState<any[]>([]);
  const [content, setContent] = useState<{ emergencyHotlinesTitle: string; emergencyHotlinesSubtitle: string }>({
    emergencyHotlinesTitle: "Emergency Hotlines",
    emergencyHotlinesSubtitle: "Keep these numbers saved. Know what to do before you call.",
  });

  useEffect(() => {
    const loadCenters = async () => {
      try {
        const res = await api.get('/api/services/evacuation-centers/public');
        setEvacCenters((res.data || []).filter((x: any) => x.active !== false));
      } catch (_err) {
        setEvacCenters([]);
      }
    };
    const loadHotlines = async () => {
      try {
        const res = await api.get('/api/services/emergency-hotlines');
        setHotlines((res.data || []).filter((x: any) => x.active !== false));
      } catch (_err) {
        setHotlines([]);
      }
    };
    const loadContent = async () => {
      try {
        const res = await api.get('/api/content/site');
        setContent((prev) => ({
          emergencyHotlinesTitle: res?.data?.emergencyHotlinesTitle || prev.emergencyHotlinesTitle,
          emergencyHotlinesSubtitle: res?.data?.emergencyHotlinesSubtitle || prev.emergencyHotlinesSubtitle,
        }));
      } catch (_err) {
        setContent((prev) => prev);
      }
    };
    void loadCenters();
    void loadHotlines();
    void loadContent();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#f1f5f9]">
      <Header />

      <main className="container mx-auto max-w-6xl flex-grow px-6 py-10">
        <Reveal>
          <div className="relative mb-10 overflow-hidden rounded-[20px] bg-gradient-to-r from-[#de2a2a] to-[#c62828] p-8 text-white shadow-md md:p-10">
            <div className="relative z-10">
              <h1 className="mb-3 flex items-center gap-3 text-3xl font-bold md:text-4xl">
                <Siren size={36} /> {content.emergencyHotlinesTitle}
              </h1>
              <p className="text-sm text-red-100 md:text-base">{content.emergencyHotlinesSubtitle}</p>
            </div>
            <div className="absolute -right-20 -top-40 h-96 w-96 rotate-45 rounded-full bg-white opacity-5"></div>
          </div>
        </Reveal>

        <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {hotlines.map((hotline) => (
            <Reveal key={hotline.name}>
              <div className="relative flex h-full flex-col rounded-xl border border-gray-100 border-l-[6px] border-l-[#de2a2a] bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:p-8">
                <div className="absolute right-6 top-6 text-[#de2a2a]">
                  <Phone size={24} strokeWidth={2} />
                </div>

                <div className="mb-4">
                  <h2 className="text-xl font-bold leading-tight text-gray-900">{hotline.name}</h2>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{hotline.type}</span>
                </div>

                <div className="mb-3 text-[28px] font-bold tracking-tight text-[#de2a2a]">{hotline.number}</div>
                <p className="mb-6 text-[13px] italic text-gray-600">{hotline.desc}</p>

                <div className="mt-auto grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-[#fff1f2] p-4">
                    <h4 className="mb-2 text-[11px] font-bold uppercase text-[#9f1239]">When to call</h4>
                    <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-gray-800">
                      {hotline.when.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-4">
                    <h4 className="mb-2 text-[11px] font-bold uppercase text-gray-700">Prepare info:</h4>
                    <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-gray-700">
                      {hotline.prepare.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        {hotlines.length === 0 ? (
          <div className="mb-10 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No emergency hotline records available yet.</div>
        ) : null}

        <Reveal>
          <div className="mb-6">
            <h2 className="mb-6 text-2xl font-bold text-[#395886]">Evacuation & Safety</h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-[14px] border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
                  <MapPin className="text-[#395886]" size={18} /> Evacuation Centers
                </h3>
                <div className="space-y-3">
                  {evacCenters.slice(0, 3).map((center) => (
                    <div key={center._id} className="rounded-lg bg-[#f0f4f8] p-3">
                      <div className="text-[14px] font-bold text-[#395886]">{center.name}</div>
                      <div className="mt-1 text-[11px] text-gray-500">Cap: {center.capacity || 0} Families • {center.address}</div>
                      {center.location?.lat && center.location?.lng ? (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${center.location.lat},${center.location.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-[11px] font-semibold text-[#395886] underline"
                        >
                          Open route
                        </a>
                      ) : null}
                    </div>
                  ))}
                  {evacCenters.length === 0 ? <p className="text-sm text-slate-500">No active evacuation centers yet.</p> : null}
                </div>
              </div>

              <div className="rounded-[14px] border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
                  <Info className="text-[#395886]" size={18} /> Emergency Steps
                </h3>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-[40px,1fr] items-start gap-3 rounded-xl border border-orange-100 bg-orange-50 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-200 text-orange-800"><Flame size={16} /></div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-orange-800">Fire</p>
                      <p className="text-[13px] leading-relaxed text-slate-700">Evacuate immediately. Do not re-enter. Crawl low if there is smoke.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-[40px,1fr] items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-200 text-blue-800"><Waves size={16} /></div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Flood</p>
                      <p className="text-[13px] leading-relaxed text-slate-700">Turn off main power. Move to higher ground. Bring your Go-Bag.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-[40px,1fr] items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-200 text-amber-800"><TriangleAlert size={16} /></div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Quake</p>
                      <p className="text-[13px] leading-relaxed text-slate-700">Duck, Cover, and Hold. Move to open area only after shaking stops.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center rounded-[14px] bg-[#1e293b] p-6 text-center text-white shadow-md">
                <Map className="mb-4 text-[#638ECB]" size={42} strokeWidth={1.5} />
                <h3 className="mb-2 text-lg font-bold">View Safe Zones</h3>
                <p className="mb-6 px-4 text-[12px] text-slate-300">Open the digital map to see evacuation routes and pick-up points.</p>
                <a
                  href="https://www.google.com/maps/search/evacuation+center+near+Mambog+II+Bacoor+Cavite"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full max-w-[240px] rounded-lg bg-[#638ECB] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#4b6f9f]"
                >
                  Open Google Maps
                </a>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="mb-8">
            <EmergencySafetyRouteCard />
          </div>
        </Reveal>
      </main>

      <Footer />
      <Chatbot />
    </div>
  );
}

