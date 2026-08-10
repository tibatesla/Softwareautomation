export function formatPrice(value: string, currency: string): string {
  const amount = Number(value);
  if (!amount) return "Price on request";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPriceRange(min: string | null, max: string | null, currency: string): string | null {
  if (!min && !max) return null;
  const fmt = (v: string) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(v));
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt(min || max!);
}

/** Builds a prefilled wa.me link so an "Enquire" click on the public site
 * flows straight into the existing WhatsApp qualification bot. */
export function whatsappEnquiryLink(propertyTitle: string): string {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "254726111133";
  const text = encodeURIComponent(`Hi, I'm interested in ${propertyTitle} on the Chestone Properties website.`);
  return `https://wa.me/${phone}?text=${text}`;
}

/** Same idea as whatsappEnquiryLink, but for the site-wide floating widget --
 * not tied to any one property, so the opening line stays general. */
export function whatsappGeneralEnquiryLink(): string {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "254726111133";
  const text = encodeURIComponent("Hi! I'd like to know more about Chestone Properties.");
  return `https://wa.me/${phone}?text=${text}`;
}
