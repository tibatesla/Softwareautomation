import type { Metadata } from "next";
import Link from "next/link";
import { whatsappGeneralEnquiryLink } from "@/lib/format";

const title = "Privacy Policy | Chestone Properties";
const description =
  "How Chestone Properties Ltd collects, uses, and protects your information when you browse our listings or reach out to a consultant.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy-policy" },
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary", title, description },
};

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "1. Who we are",
    body: (
      <p>
        Chestone Properties Ltd (&quot;Chestone&quot;, &quot;we&quot;, &quot;us&quot;) is a real estate agency
        based in Nairobi, Kenya, offering curated property listings and consultancy services through this
        website, our WhatsApp line, and our Facebook and Instagram pages. This policy explains what
        information we collect across those channels, how we use it, and the choices you have.
      </p>
    ),
  },
  {
    heading: "2. Information we collect",
    body: (
      <>
        <p>We collect information you provide directly to us, including:</p>
        <ul className="mt-3 flex flex-col gap-2 pl-5">
          <li className="list-disc">
            <span className="font-semibold text-ivory">Contact and enquiry details</span> — your name, phone
            number, and the content of your messages when you enquire about a property via WhatsApp, email, or
            a form on this site.
          </li>
          <li className="list-disc">
            <span className="font-semibold text-ivory">Conversation history</span> — messages exchanged with
            our team or our WhatsApp assistant while discussing a listing, scheduling a viewing, or qualifying
            your requirements (budget, preferred area, timeline, and similar details you choose to share).
          </li>
          <li className="list-disc">
            <span className="font-semibold text-ivory">Booking details</span> — when you schedule a property
            viewing, the date, time, and property you selected.
          </li>
          <li className="list-disc">
            <span className="font-semibold text-ivory">Basic usage data</span> — standard technical information
            (such as pages viewed and general device/browser type) collected automatically to keep the site
            running reliably and secure.
          </li>
        </ul>
        <p className="mt-3">
          We do not knowingly collect payment card details, national ID numbers, or other sensitive personal
          data through this site or our WhatsApp line.
        </p>
      </>
    ),
  },
  {
    heading: "3. How we use your information",
    body: (
      <ul className="flex flex-col gap-2 pl-5">
        <li className="list-disc">To respond to your property enquiries and connect you with a consultant.</li>
        <li className="list-disc">To schedule and manage property viewings you request.</li>
        <li className="list-disc">
          To understand what you&apos;re looking for so we can recommend relevant listings, including through
          automated qualification of enquiries received on WhatsApp.
        </li>
        <li className="list-disc">
          To follow up with updates on properties, pricing, or availability you&apos;ve shown interest in.
        </li>
        <li className="list-disc">To maintain the security, performance, and reliability of our website.</li>
      </ul>
    ),
  },
  {
    heading: "4. How we share your information",
    body: (
      <>
        <p>We do not sell your personal information. We share it only with:</p>
        <ul className="mt-3 flex flex-col gap-2 pl-5">
          <li className="list-disc">
            <span className="font-semibold text-ivory">Service providers</span> that help us operate — for
            example, Meta (for WhatsApp, Facebook, and Instagram messaging), our website and image hosting
            infrastructure, and analytics tools — each solely to provide the service we use them for.
          </li>
          <li className="list-disc">
            <span className="font-semibold text-ivory">Property developers or partners</span>, only where
            necessary to progress a specific enquiry or booking you&apos;ve made, and only with your context in
            mind.
          </li>
          <li className="list-disc">Authorities, where required by Kenyan law or a valid legal process.</li>
        </ul>
      </>
    ),
  },
  {
    heading: "5. Cookies and similar technology",
    body: (
      <p>
        This site uses minimal local browser storage to remember simple preferences, such as your chosen
        currency display (KES or USD). This information stays on your device and is not shared with us or any
        third party. We do not use advertising trackers on this site.
      </p>
    ),
  },
  {
    heading: "6. Data retention",
    body: (
      <p>
        We retain enquiry and conversation information for as long as reasonably necessary to assist you and
        maintain a record of our business dealings, and no longer than needed for those purposes or as
        required by law.
      </p>
    ),
  },
  {
    heading: "7. Your rights",
    body: (
      <p>
        You can ask us at any time what information we hold about you, request that we correct it, or request
        that we delete it, by reaching out via WhatsApp or emailing{" "}
        <a href="mailto:info@chestoneproperties.com" className="text-gold hover:underline">
          info@chestoneproperties.com
        </a>
        . We will respond within a reasonable time.
      </p>
    ),
  },
  {
    heading: "8. Children's privacy",
    body: (
      <p>
        Our services are intended for adults seeking property in Kenya. We do not knowingly collect
        information from children.
      </p>
    ),
  },
  {
    heading: "9. Changes to this policy",
    body: (
      <p>
        We may update this policy from time to time to reflect changes in our practices. The &quot;last
        updated&quot; date below will always reflect the most current version.
      </p>
    ),
  },
  {
    heading: "10. Contact us",
    body: (
      <p>
        Questions about this policy or your information can be sent to{" "}
        <a href="mailto:info@chestoneproperties.com" className="text-gold hover:underline">
          info@chestoneproperties.com
        </a>{" "}
        or via WhatsApp at +254 726 111133.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div>
      <section className="border-b border-black/10 bg-onyx-light">
        <div className="container-page flex flex-col items-center gap-4 py-16 text-center md:py-24">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Legal</span>
          <h1 className="font-serif text-3xl font-semibold text-ivory md:text-5xl">Privacy Policy</h1>
          <p className="max-w-xl text-sm text-stone md:text-base">
            Last updated: September 9, 2026
          </p>
        </div>
      </section>

      <section className="container-page py-16 md:py-24">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          {SECTIONS.map((section) => (
            <div key={section.heading} className="card-shine rounded-3xl border border-white/50 px-6 py-6 md:px-8">
              <h2 className="font-serif text-lg font-semibold text-ivory md:text-xl">{section.heading}</h2>
              <div className="mt-3 text-sm leading-relaxed text-stone">{section.body}</div>
            </div>
          ))}
        </div>

        <div className="card-shine mx-auto mt-14 flex max-w-3xl flex-col items-center gap-4 rounded-3xl border border-white/50 px-8 py-10 text-center">
          <h2 className="font-serif text-2xl font-semibold text-ivory">Have a question about your data?</h2>
          <p className="max-w-md text-sm text-stone">
            Reach out to our team directly — we&apos;re happy to help.
          </p>
          <a
            href={whatsappGeneralEnquiryLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold rounded-full px-8 py-3.5 text-sm font-semibold uppercase tracking-wider text-ivory"
          >
            Chat on WhatsApp
          </a>
          <Link href="/" className="text-sm text-stone underline-offset-4 hover:text-gold hover:underline">
            Back to home →
          </Link>
        </div>
      </section>
    </div>
  );
}
