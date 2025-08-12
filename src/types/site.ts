export type HeroSection = {
  type: "hero";
  headline: string;
  subheadline?: string;
  ctaLabel?: string;
};

export type FeaturesSection = {
  type: "features";
  title?: string;
  items: { title: string; description: string; icon?: string }[];
};

export type TestimonialSection = {
  type: "testimonial";
  quote: string;
  author: string;
};

export type CtaSection = {
  type: "cta";
  headline: string;
  ctaLabel?: string;
};

export type GeneratedSite = {
  title: string;
  theme?: "green" | "light" | "dark";
  sections: Array<HeroSection | FeaturesSection | TestimonialSection | CtaSection>;
};

export type GeneratedWebsite = {
  title: string;
  description: string;
  theme?: "green" | "light" | "dark";
  framework?: string;
  files: {
    html: string;
    css: string;
    js?: string;
    nodejs?: {
      packageJson: string;
      serverJs: string;
      routes?: Record<string, string>;
    };
  };
  additionalFiles?: Record<string, string>;
  features: string[];
  responsive: boolean;
  interactive: boolean;
};

export type GeneratedReactProject = {
  title: string;
  description: string;
  theme?: "green" | "light" | "dark";
  framework: "react-vite-typescript";
  files: {
    packageJson: string;
    viteConfig: string;
    tsConfig: string;
    tailwindConfig: string;
    postcssConfig: string;
    indexHtml: string;
    mainTsx: string;
    appTsx: string;
    appCss: string;
    components: Record<string, string>;
    pages: Record<string, string>;
    lib: Record<string, string>;
  };
  additionalFiles?: Record<string, string>;
  features: string[];
  responsive: boolean;
  interactive: boolean;
  shadcnComponents: string[];
};