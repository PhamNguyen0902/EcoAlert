import gsap from "gsap";
import { useGSAP } from "@gsap/react";

// Register useGSAP plugin once for React integration
gsap.registerPlugin(useGSAP);

export const GSAP_EASE = {
  power1Out: "power1.out",
  power2Out: "power2.out",
  power3Out: "power3.out",
  power4Out: "power4.out",
  expoOut: "expo.out",
  backOut: "back.out(1.4)",
} as const;

export const GSAP_DURATION = {
  instant: 0.15,
  fast: 0.25,
  normal: 0.4,
  smooth: 0.5,
  hero: 0.6,
} as const;

export { gsap, useGSAP };
