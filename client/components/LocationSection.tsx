import { MapPin, Clock, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function LocationSection() {
  const mapsQuery = "Mambog II, Bacoor, Cavite, Philippines";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  const mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed`;

  return (
    <section className="py-24 bg-[#f8faff]">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="bg-white rounded-[40px] shadow-sm border border-gray-50 overflow-hidden flex flex-col lg:flex-row">
          {/* Map Side */}
          <div className="relative min-h-[320px] lg:w-2/3 lg:min-h-[400px]">
            <div className="absolute inset-0 overflow-hidden bg-slate-100">
              <iframe
                src={mapsEmbedUrl}
                width="100%"
                height="100%"
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Map of Mambog II, Bacoor, Cavite"
              />
              <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center sm:justify-start">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white/95 px-4 py-3 text-sm font-bold text-[#2f4380] shadow-lg ring-1 ring-slate-200 transition hover:bg-white"
                >
                  <Navigation className="h-4 w-4" />
                  Open Google Maps
                </a>
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
