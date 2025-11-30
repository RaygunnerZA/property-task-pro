export const DS = {
  // COLOURS — Swiss neutral + soft warmth
  colour: {
    bg: "#F5F3F0",               // warm paper / off-white
    panel: "rgba(255,255,255,0.6)", 
    panelBlur: "backdrop-blur-md",
    text: "#1A1A1A",
    textMuted: "#6F6F6F",
    primary: "#0E8388",          // refined teal
    primaryLight: "#4FB3B6",
    border: "rgba(0,0,0,0.08)",
  },

  // TYPOGRAPHY
  font: {
    family: "Inter, system-ui, sans-serif",
    size: {
      xs: "11px",
      sm: "13px",
      base: "15px",
      lg: "17px",
      xl: "20px",
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    }
  },

  // SPACING
  space: (factor: number) => `${factor * 4}px`,

  // RADII
  radius: {
    sm: "6px",
    md: "10px",
    lg: "16px",
    xl: "22px",
  },

  // NEOMORPHISM (Soft Deboss)
  shadow: {
    soft: `
      inset 1px 1px 2px rgba(0,0,0,0.15),
      inset -1px -1px 2px rgba(255,255,255,0.8)
    `,
    raised: `
      2px 2px 5px rgba(0,0,0,0.12),
      -2px -2px 5px rgba(255,255,255,0.9)
    `
  },

  // COMPONENT WRAPPERS
  panel: `
    bg-white/60 
    backdrop-blur-md 
    rounded-[16px]
    shadow 
    shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.7)]
  `
};

// Optional helper component
export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[17px] font-semibold text-[#1A1A1A] mb-2">
    {children}
  </h2>
);
