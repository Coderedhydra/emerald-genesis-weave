import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SiteGenerator } from "@/components/ai/SiteGenerator";
import { Badge } from "@/components/ui/badge";
import { Code, Globe, Server, Zap, Smartphone, Palette } from "lucide-react";

const Index = () => {
  const heroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // SEO
    document.title = "root — Full Stack AI Website Generator (Gemini 2.5 Flash)";
    const desc =
      "root is a comprehensive AI website generator powered by Gemini 2.5 Flash. Create complete websites with HTML, CSS, JavaScript, and Node.js backend. Made by Amit Jaiswal.";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", desc);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    ogTitle?.setAttribute("content", "root — Full Stack AI Website Generator");
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
          <a href="/" className="flex items-center gap-3" aria-label="root home">
            <div className="size-8 rounded-md" style={{ backgroundImage: "var(--gradient-primary)" }} />
            <div className="flex flex-col">
              <span className="font-semibold text-lg">root dev</span>
              <span className="text-xs text-muted-foreground">by Amit Jaiswal</span>
            </div>
          </a>
          <nav aria-label="Primary" className="flex items-center gap-6">
            <a className="text-sm text-muted-foreground hover:text-foreground transition-colors" href="#features">Features</a>
            <a className="text-sm text-muted-foreground hover:text-foreground transition-colors" href="#generate">Generate</a>
            <a className="text-sm text-muted-foreground hover:text-foreground transition-colors" href="mailto:amitjaiswal044@gmail.com">Contact</a>
          </nav>
        </div>
      </header>

      <section ref={heroRef} className="relative overflow-hidden">
        <div className="section-container py-20 sm:py-28">
          <article className="max-w-4xl">
            <div className="flex items-center gap-2 mb-6">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Powered by Gemini 2.5 Flash
              </Badge>
              <Badge variant="outline">Full Stack Generator</Badge>
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight bg-clip-text text-transparent mb-6"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              Complete AI Website Builder
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Generate complete websites with <strong>HTML, CSS, JavaScript, and Node.js backend</strong>. 
              From simple landing pages to full-stack applications with APIs, forms, and databases.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <div className="flex items-center gap-2 text-sm">
                <Code className="w-4 h-4 text-primary" />
                <span>Full Stack</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Smartphone className="w-4 h-4 text-primary" />
                <span>Responsive</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Server className="w-4 h-4 text-primary" />
                <span>Node.js Backend</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Palette className="w-4 h-4 text-primary" />
                <span>Modern Design</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="lg" asChild>
                <a href="#generate">Start Building</a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="#features">Explore Features</a>
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

      <a id="features" />
      <section className="py-16 sm:py-24">
        <div className="section-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to Build Modern Websites
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From frontend to backend, our AI generates production-ready code with modern best practices.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card-elevated p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Globe className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Frontend Development</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Modern HTML5, responsive CSS with Grid/Flexbox, and interactive JavaScript with ES6+ features.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">HTML5</Badge>
                <Badge variant="secondary">CSS3</Badge>
                <Badge variant="secondary">JavaScript</Badge>
              </div>
            </div>

            <div className="card-elevated p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Server className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Backend Integration</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Complete Node.js backend with Express.js, API routes, middleware, and database integration.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Node.js</Badge>
                <Badge variant="secondary">Express</Badge>
                <Badge variant="secondary">APIs</Badge>
              </div>
            </div>

            <div className="card-elevated p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Responsive Design</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Mobile-first responsive design with smooth animations and modern UI components.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Mobile First</Badge>
                <Badge variant="secondary">Animations</Badge>
                <Badge variant="secondary">Accessibility</Badge>
              </div>
            </div>

            <div className="card-elevated p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Code className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Production Ready</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                SEO optimized, accessible, and performance-focused code ready for deployment.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">SEO</Badge>
                <Badge variant="secondary">Performance</Badge>
                <Badge variant="secondary">Security</Badge>
              </div>
            </div>

            <div className="card-elevated p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">AI Powered</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Leverages Google's Gemini 2.5 Flash for intelligent code generation and optimization.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Gemini 2.5</Badge>
                <Badge variant="secondary">Smart Gen</Badge>
                <Badge variant="secondary">Optimized</Badge>
              </div>
            </div>

            <div className="card-elevated p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Palette className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Design System</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Consistent green-themed design system with modern typography and spacing.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Green Theme</Badge>
                <Badge variant="secondary">Typography</Badge>
                <Badge variant="secondary">Consistent</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      <a id="generate" />
      <SiteGenerator />

      <footer className="border-t mt-12">
        <div className="section-container py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="size-6 rounded" style={{ backgroundImage: "var(--gradient-primary)" }} />
              <div className="text-sm">
                <div className="font-semibold">root dev</div>
                <div className="text-muted-foreground">Full Stack AI Website Generator</div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>Made by <strong>Amit Jaiswal</strong></span>
              <a href="mailto:amitjaiswal044@gmail.com" className="hover:text-foreground transition-colors">
                amitjaiswal044@gmail.com
              </a>
              <span>Powered by Gemini 2.5 Flash</span>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t text-xs text-muted-foreground text-center">
            <p>
              Built with modern web technologies and AI. For production API usage, proxy Gemini via a secure backend (e.g., Supabase Edge Functions).
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;