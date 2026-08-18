import type { Metadata } from "next";
import Link from "next/link";
import { FOCUS_AREAS } from "@/lib/types";
import { whatsappGeneralEnquiryLink } from "@/lib/format";

export const metadata: Metadata = {
  title: "FAQ | Chestone Properties",
  description:
    "Answers to common questions about browsing, enquiring, and reserving a property with Chestone Properties in Nairobi.",
};

const FAQS: { question: string; answer: string }[] = [
  {
    question: "How do I enquire about a property?",
    answer:
      "Every listing has an \"Enquire\" button that opens WhatsApp with your message pre-filled. A dedicated Chestone consultant picks it up from there — no forms, no waiting for a callback.",
  },
  {
    question: "Are your listings verified and kept up to date?",
    answer:
      "Yes. Every property on this site is reviewed and managed directly by our team, not pulled in from a third-party feed, so you won't find stale or duplicate listings.",
  },
  {
    question: `Which areas does Chestone cover?`,
    answer: `We focus on ${FOCUS_AREAS.join(", ")} — Nairobi's most established and fastest-growing residential neighborhoods. You can filter listings by area on the Properties page.`,
  },
  {
    question: "Can I schedule a viewing?",
    answer:
      "Yes — once you reach out on WhatsApp, your consultant will arrange a viewing time that works for you, whether that's an in-person visit or a virtual walkthrough.",
  },
  {
    question: "Do properties come with a payment plan?",
    answer:
      "Some do. Where a developer offers a structured payment plan, it's noted on the property's own page. Your consultant can walk you through the specific terms for any listing you're interested in.",
  },
  {
    question: "What currency are prices listed in?",
    answer:
      "Prices are shown in the currency set for each listing — almost always Kenyan Shillings (KES). If a price isn't listed, it means the property is priced on request; ask your consultant for current figures.",
  },
  {
    question: "Are off-plan (pre-completion) properties available?",
    answer:
      "Yes, alongside ready/move-in properties. Where a listing is still under construction, its expected completion timeline is shown on the property page.",
  },
  {
    question: "How do I reserve a property once I've decided?",
    answer:
      "Your consultant guides you through reservation and payment directly — there's no separate online checkout. This keeps every step transparent and lets you ask questions in real time.",
  },
  {
    question: "I have a question that isn't answered here — who do I ask?",
    answer:
      "Message us on WhatsApp any time, or email info@chestoneproperties.com. A real person from the Chestone team will respond, not an automated queue.",
  },
];

export default function FaqPage() {
  return (
    <div>
      <section className="border-b border-black/5 bg-navy-dark text-white">
        <div className="container-page flex flex-col items-center gap-4 py-16 text-center md:py-24">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Support</span>
          <h1 className="font-serif text-3xl font-semibold md:text-5xl">Frequently Asked Questions</h1>
          <p className="max-w-xl text-sm text-white/70 md:text-base">
            Everything you need to know about browsing, enquiring, and reserving a property with Chestone.
          </p>
        </div>
      </section>

      <section className="container-page py-16 md:py-24">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-md border border-black/5 bg-white px-6 py-1 open:pb-5 open:shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-serif text-lg font-semibold text-navy marker:content-none">
                {faq.question}
                <span className="shrink-0 text-xl font-normal text-gold transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-sm leading-relaxed text-stone">{faq.answer}</p>
            </details>
          ))}
        </div>

        <div className="mx-auto mt-14 flex max-w-3xl flex-col items-center gap-4 rounded-md bg-navy px-8 py-10 text-center text-white">
          <h2 className="font-serif text-2xl font-semibold">Still have questions?</h2>
          <p className="max-w-md text-sm text-white/70">
            Chat with a Chestone consultant on WhatsApp — real answers, no automated queue.
          </p>
          <a
            href={whatsappGeneralEnquiryLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm bg-gold px-8 py-3.5 text-sm font-semibold uppercase tracking-wider text-navy-dark transition-colors hover:bg-gold-light"
          >
            Chat on WhatsApp
          </a>
          <Link href="/properties" className="text-sm text-white/60 underline-offset-4 hover:text-gold hover:underline">
            Or browse properties →
          </Link>
        </div>
      </section>
    </div>
  );
}
