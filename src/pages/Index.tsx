import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SiteGenerator } from "@/components/ai/SiteGenerator";

const Index = () => {
  const heroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // SEO
    document.title = "root dev — Green AI Website Generator (Gemini 2.5 Flash)";
          const desc =
        "root dev is a green-themed AI website generator powered by Gemini 2.5 Flash. Describe your site, get a live page.";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", desc);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    ogTitle?.setAttribute("content", "root dev — AI Website Generator");
    const ogDesc = document.querySelector('meta[property="og:description"]');
    ogDesc?.setAttribute("content", desc);
    let link = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", window.location.href);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="section-container h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2" aria-label="root dev home">
            <div className="size-8 rounded-md" style={{ backgroundImage: "var(--gradient-primary)" }} />
            <span className="font-semibold">root dev</span>
          </a>
          <nav aria-label="Primary">
            <a className="text-sm text-muted-foreground hover:text-foreground" href="#generate">Generate</a>
          </nav>
        </div>
      </header>

      <section ref={heroRef} className="relative overflow-hidden">
        <div className="section-container py-20 sm:py-28">
          <article className="max-w-3xl">
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              AI website builder, powered by Gemini 2.5 Flash
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Describe your idea in plain text and let <strong>root dev</strong> craft a live, beautiful page with a green design system.
            </p>
            <div className="mt-10 flex gap-4">
              <Button variant="hero" size="lg" asChild>
                <a href="#generate">Start generating</a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="#learn">Learn more</a>
              </Button>
            </div>
          </article>
        </div>
        <div className="absolute inset-0 -z-10 opacity-50 blur-3xl" aria-hidden style={{
          backgroundImage: "var(--gradient-primary)",
          maskImage: "radial-gradient(600px 600px at 20% 30%, black, transparent)",
          WebkitMaskImage: "radial-gradient(600px 600px at 20% 30%, black, transparent)",
        }} />
      </section>

      <a id="generate" />
      <SiteGenerator />

      <footer className="border-t mt-12">
        <div className="section-container py-10 text-sm text-muted-foreground">
          <p>
            Built with a green design system. For production API usage, proxy Gemini via a secure backend (e.g., Supabase Edge Functions).
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
