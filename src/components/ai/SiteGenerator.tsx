import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { PageRenderer } from "./PageRenderer";
import { GeneratedSite, GeneratedWebsite } from "@/types/site";
import { z } from "zod";
import { Download, Code, Globe, Server, Smartphone, Tablet, Monitor } from "lucide-react";

const SiteSchema = z.object({
  title: z.string(),
  theme: z.enum(["green", "light", "dark"]).optional(),
  sections: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("hero"),
          headline: z.string(),
          subheadline: z.string().optional(),
          ctaLabel: z.string().optional(),
        }),
        z.object({
          type: z.literal("features"),
          title: z.string().optional(),
          items: z.array(
            z.object({
              title: z.string(),
              description: z.string(),
              icon: z.string().optional(),
            })
          ),
        }),
        z.object({
          type: z.literal("testimonial"),
          quote: z.string(),
          author: z.string(),
        }),
        z.object({
          type: z.literal("cta"),
          headline: z.string(),
          ctaLabel: z.string().optional(),
        }),
      ])
    )
    .min(1),
});

const WebsiteSchema = z.object({
  title: z.string(),
  description: z.string(),
  theme: z.enum(["green", "light", "dark"]).optional(),
  framework: z.string().optional(),
  files: z.object({
    html: z.string(),
    css: z.string(),
    js: z.string().optional(),
    nodejs: z.object({
      packageJson: z.string(),
      serverJs: z.string(),
      routes: z.record(z.string()).optional(),
    }).optional(),
  }),
  additionalFiles: z.record(z.string()).optional(),
  features: z.array(z.string()),
  responsive: z.boolean(),
  interactive: z.boolean(),
});

const DEFAULT_MODEL = "gemini-2.5-flash";

function cleanToJson(text: string) {
  return text
    .replace(/^```json\n?/i, "")
    .replace(/^```\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

// New: helper to ask Gemini to fix invalid JSON into target schema
async function attemptAutoFix({
  apiKey,
  model,
  schemaDescription,
  badText,
  maxOutputTokens,
}: {
  apiKey: string;
  model: string;
  schemaDescription: string;
  badText: string;
  maxOutputTokens: number;
}): Promise<string> {
  const fixerPrompt = `You are a strict JSON fixer. Return only valid JSON matching the schema. No markdown fences, no explanations. If fields are missing, infer sensible defaults. If extra fields exist, remove them. Schema:\n${schemaDescription}\n\nInvalid JSON or text to fix:\n${badText}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: fixerPrompt }] },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens,
        },
      }),
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini fixer error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
  if (!text) throw new Error("No fixer content returned by model");
  return cleanToJson(text);
}

type Viewport = "desktop" | "tablet" | "mobile";
type GenerationType = "preview" | "fullstack";

export function SiteGenerator() {
  const [apiKey, setApiKey] = useState<string>("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [prompt, setPrompt] = useState<string>(
    "Create a modern e-commerce landing page for sustainable fashion with interactive product gallery, contact form, and responsive design. Include Node.js backend for form handling."
  );
  const [generationType, setGenerationType] = useState<GenerationType>("preview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [site, setSite] = useState<GeneratedSite | null>(null);
  const [website, setWebsite] = useState<GeneratedWebsite | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [activeTab, setActiveTab] = useState("preview");
  const [lastRawText, setLastRawText] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const storedKey = localStorage.getItem("gemini_api_key");
    if (storedKey) setApiKey(storedKey);
    const storedModel = localStorage.getItem("gemini_model");
    if (storedModel) setModel(storedModel);
    const storedViewport = localStorage.getItem("preview_viewport") as
      | Viewport
      | null;
    if (storedViewport) setViewport(storedViewport);
    const storedType = localStorage.getItem("generation_type") as
      | GenerationType
      | null;
    if (storedType) setGenerationType(storedType);
  }, []);

  // Persist choices
  useEffect(() => {
    if (apiKey) localStorage.setItem("gemini_api_key", apiKey);
  }, [apiKey]);
  useEffect(() => {
    if (model) localStorage.setItem("gemini_model", model);
  }, [model]);
  useEffect(() => {
    if (viewport) localStorage.setItem("preview_viewport", viewport);
  }, [viewport]);
  useEffect(() => {
    if (generationType) localStorage.setItem("generation_type", generationType);
  }, [generationType]);

  const previewSystemPrompt = useMemo(
    () =>
      `You are an expert product designer and front-end architect. Generate only JSON, no prose. The JSON must conform to this TypeScript type without extra fields:\n\n` +
      `type HeroSection = { type: "hero"; headline: string; subheadline?: string; ctaLabel?: string };\n` +
      `type FeaturesSection = { type: "features"; title?: string; items: { title: string; description: string; icon?: string }[] };\n` +
      `type TestimonialSection = { type: "testimonial"; quote: string; author: string };\n` +
      `type CtaSection = { type: "cta"; headline: string; ctaLabel?: string };\n` +
      `export type GeneratedSite = { title: string; theme?: "green"|"light"|"dark"; sections: Array<HeroSection|FeaturesSection|TestimonialSection|CtaSection> };\n\n` +
      `Constraints:\n` +
      `- title must be short and brandable\n` +
      `- theme should be "green" by default\n` +
      `- Provide EXACTLY one hero, one features section (3 items), optionally one testimonial, and one cta.\n` +
      `- No markdown fences. Output pure JSON.`,
    []
  );

  const fullstackSystemPrompt = useMemo(
    () =>
      `You are a full-stack web developer expert. Generate a complete website with HTML, CSS, JavaScript, and Node.js backend. Return only JSON without markdown fences.\n\n` +
      `The JSON must conform to this structure:\n` +
      `{\n  "title": "Website Title",\n  "description": "Brief description",\n  "theme": "green" | "light" | "dark",\n  "framework": "static|react|next|vue|svelte|astro" (optional),\n  "files": {\n    "html": "Complete HTML with semantic structure, meta tags, and accessibility",\n    "css": "Modern CSS with responsive design, animations, and green theme",\n    "js": "Interactive JavaScript with modern ES6+ features",\n    "nodejs": {\n      "packageJson": "Complete package.json with dependencies",\n      "serverJs": "Express.js server with routes and middleware",\n      "routes": { "routeName": "route handler code" }\n    }\n  },\n  "additionalFiles": { "path/filename": "file content" } (optional),\n  "features": ["responsive", "interactive", "accessible", "seo-optimized"],\n  "responsive": true,\n  "interactive": true\n}\n\n` +
      `Requirements:\n` +
      `- Use modern HTML5 semantic elements\n` +
      `- Implement responsive CSS Grid/Flexbox\n` +
      `- Add smooth animations and transitions\n` +
      `- Include interactive JavaScript features\n` +
      `- Create Node.js backend with Express\n` +
      `- Add form handling and API endpoints\n` +
      `- Ensure accessibility (ARIA labels, semantic HTML)\n` +
      `- Optimize for SEO (meta tags, structured data)\n` +
      `- Use green color scheme by default\n` +
      `- Make it production-ready`,
    []
  );

  const downloadWebsite = () => {
    if (!website) return;

    const files = [
      { name: 'index.html', content: website.files.html },
      { name: 'styles.css', content: website.files.css },
      { name: 'script.js', content: website.files.js || '' },
    ];

    if (website.files.nodejs) {
      files.push(
        { name: 'package.json', content: website.files.nodejs.packageJson },
        { name: 'server.js', content: website.files.nodejs.serverJs }
      );
      
      if (website.files.nodejs.routes) {
        Object.entries(website.files.nodejs.routes).forEach(([name, code]) => {
          files.push({ name: `routes/${name}.js`, content: code });
        });
      }
    }

    if (website.additionalFiles) {
      Object.entries(website.additionalFiles).forEach(([path, content]) => {
        files.push({ name: path, content });
      });
    }

    // Create and download zip-like structure as individual files
    files.forEach(file => {
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSite(null);
    setWebsite(null);
    setLastRawText(null);
    
    try {
      if (!apiKey) {
        throw new Error(
          "Missing API key. For security, enter your Gemini API key locally."
        );
      }

      const systemPrompt = generationType === "preview" ? previewSystemPrompt : fullstackSystemPrompt;
      const userInstruction = `${prompt}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: systemPrompt }] },
              { role: "user", parts: [{ text: userInstruction }] },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: generationType === "fullstack" ? 8000 : 1200,
            },
          }),
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Gemini error: ${res.status} ${txt}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as
        | string
        | undefined;
      if (!text) throw new Error("No content returned by model");

      setLastRawText(text);
      const jsonText = cleanToJson(text);

      try {
        if (generationType === "preview") {
          const parsed = SiteSchema.parse(JSON.parse(jsonText)) as GeneratedSite;
          setSite(parsed);
          setActiveTab("preview");
        } else {
          const parsed = WebsiteSchema.parse(JSON.parse(jsonText)) as GeneratedWebsite;
          setWebsite(parsed);
          setActiveTab("html");
        }
      } catch (parseErr: any) {
        // Attempt auto-fix once
        const schemaDesc = generationType === "preview"
          ? `type HeroSection = { type: "hero"; headline: string; subheadline?: string; ctaLabel?: string };\n` +
            `type FeaturesSection = { type: "features"; title?: string; items: { title: string; description: string; icon?: string }[] };\n` +
            `type TestimonialSection = { type: "testimonial"; quote: string; author: string };\n` +
            `type CtaSection = { type: "cta"; headline: string; ctaLabel?: string };\n` +
            `export type GeneratedSite = { title: string; theme?: "green"|"light"|"dark"; sections: Array<HeroSection|FeaturesSection|TestimonialSection|CtaSection> };`
          : `{
  "title": "Website Title",
  "description": "Brief description",
  "theme": "green" | "light" | "dark",
  "files": {
    "html": "Complete HTML",
    "css": "Modern CSS",
    "js": "Interactive JavaScript",
    "nodejs": {
      "packageJson": "Complete package.json",
      "serverJs": "Express.js server",
      "routes": { "routeName": "route handler code" }
    }
  },
  "features": ["responsive", "interactive", "accessible", "seo-optimized"],
  "responsive": true,
  "interactive": true
}`;

        try {
          const fixed = await attemptAutoFix({
            apiKey,
            model,
            schemaDescription: schemaDesc,
            badText: jsonText,
            maxOutputTokens: generationType === "fullstack" ? 4000 : 800,
          });
          if (generationType === "preview") {
            const parsed = SiteSchema.parse(JSON.parse(fixed)) as GeneratedSite;
            setSite(parsed);
            setActiveTab("preview");
          } else {
            const parsed = WebsiteSchema.parse(JSON.parse(fixed)) as GeneratedWebsite;
            setWebsite(parsed);
            setActiveTab("html");
          }
        } catch (fixErr: any) {
          setError(
            `Generation returned invalid JSON and auto-fix failed: ${fixErr?.message || "unknown error"}`
          );
        }
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate website");
    } finally {
      setLoading(false);
    }
  }

  async function handleManualFix() {
    if (!apiKey || !lastRawText) return;
    setFixing(true);
    setError(null);
    try {
      const schemaDesc = generationType === "preview"
        ? `type HeroSection = { type: "hero"; headline: string; subheadline?: string; ctaLabel?: string };\n` +
          `type FeaturesSection = { type: "features"; title?: string; items: { title: string; description: string; icon?: string }[] };\n` +
          `type TestimonialSection = { type: "testimonial"; quote: string; author: string };\n` +
          `type CtaSection = { type: "cta"; headline: string; ctaLabel?: string };\n` +
          `export type GeneratedSite = { title: string; theme?: "green"|"light"|"dark"; sections: Array<HeroSection|FeaturesSection|TestimonialSection|CtaSection> };`
        : `{
  "title": "Website Title",
  "description": "Brief description",
  "theme": "green" | "light" | "dark",
  "files": {
    "html": "Complete HTML",
    "css": "Modern CSS",
    "js": "Interactive JavaScript",
    "nodejs": {
      "packageJson": "Complete package.json",
      "serverJs": "Express.js server",
      "routes": { "routeName": "route handler code" }
    }
  },
  "features": ["responsive", "interactive", "accessible", "seo-optimized"],
  "responsive": true,
  "interactive": true
}`;

      const fixed = await attemptAutoFix({
        apiKey,
        model,
        schemaDescription: schemaDesc,
        badText: lastRawText,
        maxOutputTokens: generationType === "fullstack" ? 4000 : 800,
      });
      if (generationType === "preview") {
        const parsed = SiteSchema.parse(JSON.parse(fixed)) as GeneratedSite;
        setSite(parsed);
        setActiveTab("preview");
      } else {
        const parsed = WebsiteSchema.parse(JSON.parse(fixed)) as GeneratedWebsite;
        setWebsite(parsed);
        setActiveTab("html");
      }
    } catch (err: any) {
      setError(`Manual fix failed: ${err?.message || "unknown error"}`);
    } finally {
      setFixing(false);
    }
  }

  const frameWidthClass =
    viewport === "mobile"
      ? "w-[375px]"
      : viewport === "tablet"
      ? "w-[768px]"
      : "w-full max-w-5xl";

  return (
    <section className="py-6">
      <div className="section-container">
        <ResizablePanelGroup direction="horizontal" className="rounded-lg border">
          <ResizablePanel defaultSize={38} minSize={28} className="bg-card">
            <div className="h-full overflow-auto p-4 sm:p-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Project Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">Gemini API key (local only)</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="Enter your key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      aria-label="Gemini API key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Stored in your browser. For production, add your own proxy.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      aria-label="Model name"
                    />
                    <p className="text-xs text-muted-foreground">
                      Example: gemini-2.5-flash (default), gemini-2.0-flash
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="generationType">Generation Type</Label>
                    <Select value={generationType} onValueChange={(value: GenerationType) => setGenerationType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preview">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            Quick Preview
                          </div>
                        </SelectItem>
                        <SelectItem value="fullstack">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4" />
                            Full Stack Website
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {generationType === "preview" 
                        ? "Fast preview with basic layout" 
                        : "Complete website with HTML, CSS, JS, and Node.js"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Website Description
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    rows={8}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your website: purpose, features, functionality, design preferences..."
                    aria-label="Website description"
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="hero"
                      size="lg"
                      onClick={handleGenerate}
                      disabled={loading}
                      aria-label="Generate website"
                      className="flex-1"
                    >
                      {loading ? "Generating..." : `Generate ${generationType === "preview" ? "Preview" : "Full Website"}`}
                    </Button>
                    {website && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={downloadWebsite}
                        aria-label="Download website files"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    {lastRawText && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleManualFix}
                        disabled={fixing}
                        aria-label="Attempt auto-fix"
                      >
                        {fixing ? "Fixing..." : "Auto Fix"}
                      </Button>
                    )}
                  </div>
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                </CardContent>
              </Card>

              {website && (
                <Card>
                  <CardHeader>
                    <CardTitle>Generated Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {website.features.map((feature, idx) => (
                        <Badge key={idx} variant="secondary">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={62} minSize={40} className="bg-muted/20">
            <div className="h-full flex flex-col">
              {/* Preview top bar */}
              <div className="border-b px-3 sm:px-4 h-12 flex items-center justify-between gap-3 bg-background/80">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-6 rounded" style={{ backgroundImage: "var(--gradient-primary)" }} />
                  <span className="font-medium truncate">
                    {site?.title || website?.title || "Preview"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewport === "mobile" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setViewport("mobile")}
                    aria-label="Mobile preview"
                  >
                    <Smartphone className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewport === "tablet" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setViewport("tablet")}
                    aria-label="Tablet preview"
                  >
                    <Tablet className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewport === "desktop" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setViewport("desktop")}
                    aria-label="Desktop preview"
                  >
                    <Monitor className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={loading}
                    aria-label="Regenerate"
                  >
                    {loading ? "…" : "Regenerate"}
                  </Button>
                </div>
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-auto">
                {website ? (
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                    <div className="border-b px-4 py-2">
                      <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                        <TabsTrigger value="html">HTML</TabsTrigger>
                        <TabsTrigger value="css">CSS</TabsTrigger>
                        <TabsTrigger value="js">JavaScript</TabsTrigger>
                        <TabsTrigger value="files">Files</TabsTrigger>
                      </TabsList>
                    </div>
                    
                    <TabsContent value="preview" className="p-4 sm:p-6 h-full">
                      <div className="mx-auto flex justify-center">
                        <div className={`surface-glass ${frameWidthClass} min-h-[480px] overflow-hidden`}>
                          <iframe
                            srcDoc={`
                              <!DOCTYPE html>
                              <html>
                                <head>
                                  <style>${website.files.css}</style>
                                </head>
                                <body>
                                  ${website.files.html}
                                  <script>${website.files.js || ''}</script>
                                </body>
                              </html>
                            `}
                            className="w-full h-full border-0"
                            title="Website Preview"
                          />
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="html" className="p-4 h-full">
                      <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm h-full">
                        <code>{website.files.html}</code>
                      </pre>
                    </TabsContent>
                    
                    <TabsContent value="css" className="p-4 h-full">
                      <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm h-full">
                        <code>{website.files.css}</code>
                      </pre>
                    </TabsContent>
                    
                    <TabsContent value="js" className="p-4 h-full">
                      <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm h-full">
                        <code>{website.files.js || '// No JavaScript generated'}</code>
                      </pre>
                    </TabsContent>

                    <TabsContent value="files" className="p-4 h-full">
                      <div className="space-y-3">
                        {website.framework && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Framework:</span> {website.framework}
                          </div>
                        )}
                        {website.additionalFiles ? (
                          <div className="space-y-2">
                            {Object.entries(website.additionalFiles).map(([path, content]) => (
                              <details key={path} className="rounded-lg border bg-card">
                                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{path}</summary>
                                <pre className="bg-muted m-3 p-3 rounded-lg overflow-auto text-xs max-h-80">
                                  <code>{content}</code>
                                </pre>
                              </details>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No additional files generated.</p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="p-4 sm:p-6">
                    <div className="mx-auto flex justify-center">
                      <div className={`surface-glass ${frameWidthClass} min-h-[480px] overflow-hidden`}> 
                        <div className="bg-background">
                          {loading && (
                            <div className="p-6 space-y-4">
                              <Skeleton className="h-8 w-1/3" />
                              <Skeleton className="h-4 w-2/3" />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                                <Skeleton className="h-24" />
                                <Skeleton className="h-24" />
                              </div>
                            </div>
                          )}
                          {!loading && site && <PageRenderer site={site} />}
                          {!loading && !site && !website && (
                            <div className="p-10 text-center">
                              <h2 className="text-xl font-semibold">Your live preview</h2>
                              <p className="mt-2 text-sm text-muted-foreground">
                                Generate a website to see it here. Choose between quick preview or full-stack generation.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </section>
  );
}