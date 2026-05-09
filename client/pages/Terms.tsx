import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const sections = [
  {
    title: "Use of the Portal",
    body: "BayanTrack is provided as an official digital service channel for Barangay Mambog II, Bacoor City, Cavite. Residents shall use the portal only for lawful requests, reports, subscriptions, and communications related to barangay services.",
  },
  {
    title: "Accuracy of Information",
    body: "Users are responsible for submitting complete, truthful, and current information. The barangay may verify submitted records, supporting documents, and contact details before acting on a request or approving an account.",
  },
  {
    title: "Account Responsibility",
    body: "Registered users are responsible for maintaining the confidentiality of their login credentials and for all actions made under their account. Suspected unauthorized access should be reported to the barangay immediately.",
  },
  {
    title: "Service Processing",
    body: "Online submissions are subject to review, validation, office hours, applicable barangay procedures, and documentary requirements. A reference number confirms receipt but does not automatically mean approval.",
  },
  {
    title: "Prohibited Conduct",
    body: "Users shall not submit false reports, abusive messages, fraudulent documents, malicious files, or content that disrupts public service operations. Violations may result in account suspension, record rejection, or referral to the proper authority.",
  },
  {
    title: "Changes to Terms",
    body: "The barangay may update these terms when necessary to comply with law, policy, or operational requirements. Continued use of BayanTrack after publication of updates means acceptance of the revised terms.",
  },
];

export default function Terms() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <Header />
      <main className="flex-grow px-4 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Barangay Mambog II</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Terms of Service</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            These terms govern access to and use of the BayanTrack resident portal. The portal supports official barangay services, public advisories, resident reports, and service request monitoring.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {sections.map((section) => (
              <article key={section.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{section.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            For official concerns about portal access, records, or submitted requests, contact the Barangay Mambog II office through the published contact channels in this website.
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
