import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const sections = [
  {
    title: "Information Collected",
    body: "BayanTrack may collect account details, contact information, address details, valid identification images, service request data, issue reports, messages, subscription email addresses, and activity records needed for barangay service delivery.",
  },
  {
    title: "Purpose of Processing",
    body: "Personal data is processed to verify residency, manage service requests, respond to reports and messages, send status notifications, protect system integrity, and maintain accountable public service records.",
  },
  {
    title: "Data Access and Sharing",
    body: "Access is limited to authorized barangay personnel, administrators, and technical maintainers with a legitimate operational need. Data may be disclosed only when required by law, lawful order, or official government procedure.",
  },
  {
    title: "Security Measures",
    body: "The system applies authentication, role-based access, activity logging, and controlled administrative permissions. Users should avoid sharing passwords and should report suspected unauthorized access immediately.",
  },
  {
    title: "Retention",
    body: "Records are retained for as long as necessary for public service processing, audit, legal compliance, and barangay documentation. Archived records may remain available to authorized personnel unless lawfully deleted.",
  },
  {
    title: "Resident Rights",
    body: "Residents may request correction of inaccurate information, inquire about their submitted records, and raise privacy concerns through the official barangay contact channels, subject to applicable verification requirements.",
  },
];

export default function Privacy() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <Header />
      <main className="flex-grow px-4 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Barangay Mambog II</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Privacy Policy</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            This policy explains how BayanTrack handles personal data in support of official barangay functions. Processing is guided by lawful purpose, data minimization, accountability, and appropriate protection of resident records.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {sections.map((section) => (
              <article key={section.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{section.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            Privacy concerns, correction requests, and data access inquiries should be directed to the Barangay Mambog II office using the official contact details published in this portal.
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
