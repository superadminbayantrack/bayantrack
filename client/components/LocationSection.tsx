import { MapPin, Clock, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function LocationSection() {
  const mapsUrl = "https://www.google.com/maps/search/?api=1&query=Barangay%20Mambog%20II%20Bacoor%20Cavite";

  return (
    <section className="py-24 bg-[#f8faff]">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="bg-white rounded-[40px] shadow-sm border border-gray-50 overflow-hidden flex flex-col lg:flex-row">
          {/* Map Side */}
          <div className="relative min-h-[320px] lg:w-2/3 lg:min-h-[400px]">
            <div className="absolute inset-0 overflow-hidden bg-[#eaf1f8]">
              <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(#c8d7e8_1px,transparent_1px),linear-gradient(90deg,#c8d7e8_1px,transparent_1px)] [background-size:44px_44px]" />
              <div className="absolute left-[18%] top-[22%] h-28 w-44 rounded-full border-8 border-white/70" />
              <div className="absolute bottom-[18%] right-[12%] h-24 w-56 rounded-full border-8 border-blue-200/70" />
              <div className="absolute left-0 right-0 top-1/2 h-6 -translate-y-1/2 bg-white/80 shadow-sm" />
              <div className="absolute bottom-0 left-1/3 top-0 w-5 -rotate-12 bg-white/80 shadow-sm" />
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="w-full max-w-sm rounded-3xl border border-white/80 bg-white/95 p-6 text-center shadow-xl">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <MapPin className="h-7 w-7" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-500">Barangay location</p>
                  <h4 className="mt-2 text-2xl font-extrabold text-primary">Mambog II, Bacoor</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Open the route directly in Google Maps for directions and live map details.</p>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#3b528a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#2e4170]"
                  >
                    <Navigation className="h-4 w-4" />
                    Open Google Maps
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Details Side */}
          <div className="flex flex-col justify-center p-6 sm:p-8 lg:w-1/3 lg:p-12">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-6">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="text-3xl font-extrabold text-primary mb-4 tracking-tight">Locate Us</h3>
            <p className="text-gray-500 text-sm mb-10 leading-relaxed">
              Barangay Mambog II Hall is centrally located to serve all puroks efficiently.
            </p>

            <div className="flex items-start gap-4 mb-10">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-bold text-primary mb-1">Standard Hours</h5>
                <p className="text-sm text-gray-500 font-medium">Mon-Fri, 8AM - 5PM</p>
              </div>
            </div>

            <Link to="/contact" className="block">
              <Button className="w-full h-14 bg-[#3b528a] hover:bg-[#2e4170] text-white rounded-xl font-bold text-lg shadow-lg">
                Contact Details
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
