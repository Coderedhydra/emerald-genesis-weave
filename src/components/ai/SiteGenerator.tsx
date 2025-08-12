import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { PageRenderer } from "./PageRenderer";
import type { GeneratedProject, ProjectPage, Section } from "@/types/site";
import { z } from "zod";
import { buildStandaloneHtml } from "@/lib/exportSite";
import { buildProjectZip, buildMultiPageZip } from "@/lib/exportSite";
import JSON5 from "json5";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

const SectionSchema = z.discriminatedUnion("type", [
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
]);

const ProjectSchema = z.object({
  siteName: z.string(),
  theme: z.enum(["green", "light", "dark"]).optional(),
  pages: z
    .array(
      z.object({
        slug: z.string().regex(/^[a-z0-9-]+$/),
        title: z.string(),
        sections: z.array(SectionSchema).min(1),
      })
    )
    .min(1),
});

// Fallback single-page shape for legacy generations
const SingleSiteSchema = z.object({
  title: z.string(),
  theme: z.enum(["green", "light", "dark"]).optional(),
  sections: z.array(SectionSchema).min(1),
});

const DEFAULT_MODEL = "gemini-2.5-flash"; // configurable

function cleanToJson(text: string) {
  return text
    .replace(/^```json\n?/i, "")
    .replace(/^```\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

function extractJsonLike(raw: string): string {
  let text = cleanToJson(raw)
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[`]/g, '"');
  const braceIndex = text.indexOf("{");
  const bracketIndex = text.indexOf("[");
  const start = braceIndex === -1 ? bracketIndex : bracketIndex === -1 ? braceIndex : Math.min(braceIndex, bracketIndex);
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let stringQuote: string | null = null;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (!escaped && ch === stringQuote) {
        inString = false;
        stringQuote = null;
      }
      escaped = !escaped && ch === '\\';
    } else {
      if (ch === '"' || ch === "'") {
        inString = true;
        stringQuote = ch;
        escaped = false;
      } else if (ch === '{' || ch === '[') {
        depth++;
      } else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }
  }
  return text.slice(start);
}

function robustJsonParse(raw: string): any {
  let text = extractJsonLike(raw);
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {}
  // Remove trailing commas before } or ]
  text = text.replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(text);
  } catch {}
  // Last resort: JSON5
  try {
    return JSON5.parse(text);
  } catch {}
  throw new Error("Model returned invalid JSON. Try simplifying the prompt or regenerating.");
}

type Viewport = "desktop" | "tablet" | "mobile";

export function SiteGenerator() {
  const [apiKey, setApiKey] = useState<string>("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [prompt, setPrompt] = useState<string>(
    "Create a full multi-page website for an AI integration services company named 'root dev'. Include Home, Services, Pricing, About, and Contact pages. Each page should have appropriate sections."
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<GeneratedProject | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [activePageSlug, setActivePageSlug] = useState<string | null>(null);

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

  const systemPrompt = useMemo(
    () =>
      `You are an expert product designer and front-end architect. Generate only JSON, no prose. The JSON must conform to this TypeScript type without extra fields:

 type HeroSection = { type: "hero"; headline: string; subheadline?: string; ctaLabel?: string };
 type FeaturesSection = { type: "features"; title?: string; items: { title: string; description: string; icon?: string }[] };
 type TestimonialSection = { type: "testimonial"; quote: string; author: string };
 type CtaSection = { type: "cta"; headline: string; ctaLabel?: string };
 type Section = HeroSection | FeaturesSection | TestimonialSection | CtaSection;
 type ProjectPage = { slug: string; title: string; sections: Section[] };
 export type GeneratedProject = { siteName: string; theme?: "green"|"light"|"dark"; pages: ProjectPage[] };

 Constraints:
 - siteName must be short and brandable
 - theme should be "green" by default
 - Provide 4-6 pages, for example: Home (hero, features, testimonial, cta), Services (features list), Pricing (features and cta), About (hero/testimonial), Contact (cta)
 - Each page must include 1-3 sections appropriate to the page
 - Slugs must be lowercase kebab-case
 - Output pure JSON, no markdown fences, no comments, no trailing commas, no backticks.`,
    []
  );

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      if (!apiKey) {
        throw new Error(
          "Missing API key. For security, enter your Gemini API key locally."
        );
      }

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
              temperature: 0.2,
              maxOutputTokens: 1600,
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

      const parsedRaw = robustJsonParse(text);
      // Try multi-page first
      const multi = ProjectSchema.safeParse(parsedRaw);
      if (multi.success) {
        const proj = multi.data as GeneratedProject;
        setProject(proj);
        setActivePageSlug(proj.pages[0]?.slug || null);
      } else {
        // Fallback to single-page and wrap into a project
        const single = SingleSiteSchema.safeParse(parsedRaw);
        if (single.success) {
          const s = single.data;
          const wrapped: GeneratedProject = {
            siteName: s.title,
            theme: s.theme,
            pages: [
              { slug: "index", title: s.title, sections: s.sections as Section[] },
            ],
          };
          setProject(wrapped);
          setActivePageSlug("index");
        } else {
          throw new Error("The AI response did not match the expected schema. Please regenerate.");
        }
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate site. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!project) return;
    const activePage = project.pages.find((p) => p.slug === activePageSlug) || project.pages[0];
    const siteShape = { title: activePage.title, theme: project.theme, sections: activePage.sections } as { title: string; theme?: string; sections: Section[] };
    const html = buildStandaloneHtml(siteShape as any);
    const filename = `${(activePage.slug || "page").toLowerCase()}.html`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadZip() {
    if (!project) return;
    const zipBlob = await buildMultiPageZip(project);
    const a = document.createElement("a");
    const url = URL.createObjectURL(zipBlob);
    a.href = url;
    a.download = `${(project.siteName || "site").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "site"}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const frameWidthClass =
    viewport === "mobile"
      ? "w-[375px]"
      : viewport === "tablet"
      ? "w-[768px]"
      : "w-full max-w-5xl";

  const activePage = project?.pages.find((p) => p.slug === activePageSlug) || project?.pages[0] || null;

  return (
    <section className="py-6">
      <div className="section-container">
        <ResizablePanelGroup direction="horizontal" className="rounded-lg border">
          <ResizablePanel defaultSize={38} minSize={28} className="bg-card">
            <div className="h-full overflow-auto p-4 sm:p-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Project</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Prompt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    rows={8}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your site: purpose, audience, features..."
                    aria-label="Website description"
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="hero"
                      size="lg"
                      onClick={handleGenerate}
                      disabled={loading}
                      aria-label="Generate website"
                    >
                      {loading ? "Generating..." : "Generate Website"}
                    </Button>
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={62} minSize={40} className="bg-muted/20">
            <div className="h-full flex flex-col">
              {/* Preview top bar */}
              <div className="border-b px-3 sm:px-4 h-12 flex items-center justify-between gap-3 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-6 rounded" style={{ backgroundImage: "var(--gradient-primary)" }} />
                  <span className="font-medium truncate">
                    {project?.siteName ?? "Preview"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {project && (
                    <Select value={activePageSlug ?? project.pages[0]?.slug} onValueChange={setActivePageSlug}>
                      <SelectTrigger className="h-8 w-[200px]">
                        <SelectValue placeholder="Select page" />
                      </SelectTrigger>
                      <SelectContent>
                        {project.pages.map((p) => (
                          <SelectItem key={p.slug} value={p.slug}>{p.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant={viewport === "mobile" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setViewport("mobile")}
                    aria-label="Mobile preview"
                  >
                    Mobile
                  </Button>
                  <Button
                    variant={viewport === "tablet" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setViewport("tablet")}
                    aria-label="Tablet preview"
                  >
                    Tablet
                  </Button>
                  <Button
                    variant={viewport === "desktop" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setViewport("desktop")}
                    aria-label="Desktop preview"
                  >
                    Desktop
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={loading}
                    aria-label="Regenerate"
                  >
                    {loading ? "…" : "Regenerate"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={!project}
                    aria-label="Download website"
                  >
                    Download
                  </Button>
                  <Button
                    variant="hero"
                    size="sm"
                    onClick={handleDownloadZip}
                    disabled={!project}
                    aria-label="Download project ZIP"
                  >
                    Download ZIP
                  </Button>
                </div>
              </div>

              {/* Preview canvas */}
              <div className="flex-1 overflow-auto p-4 sm:p-6">
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
                      {!loading && project && activePage && (
                        <PageRenderer title={activePage.title} sections={activePage.sections as Section[]} />
                      )}
                      {!loading && !project && (
                        <div className="p-10 text-center">
                          <h2 className="text-xl font-semibold">Your live preview</h2>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Generate a site to see it here. Adjust the viewport to test responsiveness.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </section>
  );
}
