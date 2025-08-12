import { Button } from "@/components/ui/button";
import { GeneratedSite } from "@/types/site";

type Props = {
  site: GeneratedSite;
};

export function PageRenderer({ site }: Props) {
  return (
    <main>
      {site.sections.map((section, i) => {
        if (section.type === "hero") {
          return (
            <section
              key={i}
              className="relative overflow-hidden py-16 sm:py-24"
            >
              <div
                className="absolute inset-0 pointer-events-none"
                aria-hidden
              >
                <div
                  className="absolute -inset-32 opacity-50 blur-3xl"
                  style={{
                    backgroundImage:
                      "var(--gradient-primary)",
                    maskImage:
                      "radial-gradient(closest-side, rgba(0,0,0,0.35), transparent)",
                    WebkitMaskImage:
                      "radial-gradient(closest-side, rgba(0,0,0,0.35), transparent)",
                  }}
                />
              </div>
              <div className="section-container relative">
                <div className="mx-auto max-w-3xl text-center">
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent"
                    style={{ backgroundImage: "var(--gradient-primary)" }}
                  >
                    {section.headline}
                  </h1>
                  {section.subheadline && (
                    <p className="mt-6 text-lg text-muted-foreground">
                      {section.subheadline}
                    </p>
                  )}
                  {section.ctaLabel && (
                    <div className="mt-10 flex items-center justify-center gap-4">
                      <Button variant="hero" size="lg">
                        {section.ctaLabel}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        }
        if (section.type === "features") {
          return (
            <section key={i} className="py-16 sm:py-24">
              <div className="section-container">
                {section.title && (
                  <h2 className="text-2xl sm:text-3xl font-semibold mb-8">
                    {section.title}
                  </h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {section.items.map((item, idx) => (
                    <article key={idx} className="card-elevated p-6">
                      <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          );
        }
        if (section.type === "testimonial") {
          return (
            <section key={i} className="py-16">
              <div className="section-container">
                <figure className="mx-auto max-w-3xl card-elevated p-8">
                  <blockquote className="text-xl sm:text-2xl font-medium">
                    “{section.quote}”
                  </blockquote>
                  <figcaption className="mt-4 text-muted-foreground">
                    — {section.author}
                  </figcaption>
                </figure>
              </div>
            </section>
          );
        }
        if (section.type === "cta") {
          return (
            <section key={i} className="py-20">
              <div className="section-container text-center">
                <h2 className="text-3xl sm:text-4xl font-bold">
                  {section.headline}
                </h2>
                {section.ctaLabel && (
                  <Button className="mt-8" variant="hero" size="lg">
                    {section.ctaLabel}
                  </Button>
                )}
              </div>
            </section>
          );
        }
        return null;
      })}
    </main>
  );
}
