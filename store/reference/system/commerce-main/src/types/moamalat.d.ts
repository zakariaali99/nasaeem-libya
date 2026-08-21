// Type declarations for Moamalat Lightbox payment gateway
interface MoamalatCheckout {
  configure: any;
  showLightbox: () => void;
  closeLightbox: () => void;
}

interface MoamalatLightbox {
  Checkout: MoamalatCheckout;
}

declare global {
  interface Window {
    Lightbox?: MoamalatLightbox;
  }
}

export {};
