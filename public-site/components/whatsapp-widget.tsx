import { whatsappGeneralEnquiryLink } from "@/lib/format";

export function WhatsAppWidget() {
  return (
    <a
      href={whatsappGeneralEnquiryLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Chestone Properties on WhatsApp"
      className="group fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg shadow-black/20 transition-transform hover:scale-105 md:bottom-8 md:right-8"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-75 group-hover:opacity-0" />
      <svg
        viewBox="0 0 32 32"
        width="30"
        height="30"
        fill="white"
        className="relative"
        aria-hidden="true"
      >
        <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.34.664 4.523 1.813 6.375L4 29l7.813-1.75A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm0 21.75a9.68 9.68 0 0 1-4.938-1.352l-.354-.21-4.636 1.04 1.06-4.512-.23-.37A9.7 9.7 0 0 1 5.25 15c0-5.938 4.816-10.75 10.754-10.75S26.75 9.062 26.75 15 21.938 24.75 16.004 24.75Zm5.336-7.297c-.293-.148-1.734-.855-2.004-.953-.27-.098-.465-.148-.66.148-.195.293-.758.953-.93 1.148-.172.195-.34.219-.633.074-.293-.148-1.238-.457-2.36-1.457-.872-.777-1.461-1.738-1.633-2.031-.172-.293-.02-.453.129-.598.132-.132.293-.34.44-.512.148-.172.196-.293.293-.488.098-.195.05-.367-.023-.512-.074-.148-.66-1.594-.906-2.184-.238-.574-.484-.496-.66-.504l-.563-.01c-.195 0-.512.074-.781.367-.27.293-1.024 1-1.024 2.438 0 1.438 1.05 2.828 1.196 3.023.148.195 2.066 3.156 5.008 4.426.7.301 1.246.48 1.672.617.702.223 1.34.191 1.844.117.563-.086 1.734-.71 1.977-1.394.242-.684.242-1.27.172-1.395-.07-.125-.266-.199-.559-.348Z" />
      </svg>
    </a>
  );
}
