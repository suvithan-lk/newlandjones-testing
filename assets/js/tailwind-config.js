/* =========================================================
   Newland Jones — design tokens
   Quiet-luxury editorial system in the two logo colours:
   navy #002C58 and blue #0064DC, on white.
   Token names are kept stable so page markup never changes.
   ========================================================= */

tailwind.config = {
  theme: {
    extend: {
      colors: {
        /* brand navy (logo "Newland") */
        navy: "#002C58",
        "navy-hover": "#0064DC",

        /* brand blue (logo "Jones") */
        brand: "#0064DC",

        /* navy tint surface */
        tint: "#F3F5F8",

        ink: "rgba(0, 44, 88, 0.85)",
        muted: "rgba(0, 44, 88, 0.66)",
        eyebrow: "rgba(0, 44, 88, 0.48)"
      },
      fontFamily: {
        sans: ["Manrope", "Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Cormorant Garamond", "Georgia", "serif"]
      },
      boxShadow: {
        glass: "0 30px 60px -30px rgba(0, 44, 88, 0.22)"
      }
    }
  }
};
