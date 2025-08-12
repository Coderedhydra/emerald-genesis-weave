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
import { GeneratedSite } from "@/types/site";
import { z } from "zod";
import { buildStandaloneHtml, filenameForSite } from "@/lib/exportSite";

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

const DEFAULT_MODEL = "gemini-2.5-flash"; // configurable

function cleanToJson(text: string) {
  return text
    .replace(/^```json\n?/i, "")
    .replace(/^```\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

type Viewport = "desktop" | "tablet" | "mobile";

export function SiteGenerator() {
  const [apiKey, setApiKey] = useState<string>("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [prompt, setPrompt] = useState<string>(
    "A clean product landing page for a sustainable AI website builder named 'root'. Focus on clarity, 3 feature cards, one testimonial, and a strong call-to-action."
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [site, setSite] = useState<GeneratedSite | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");

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
 export type GeneratedSite = { title: string; theme?: "green"|"light"|"dark"; sections: Array<HeroSection|FeaturesSection|TestimonialSection|CtaSection> };

 Constraints:
 - title must be short and brandable
 - theme should be "green" by default
 - Provide EXACTLY one hero, one features section (3 items), optionally one testimonial, and one cta.
 - No markdown fences. Output pure JSON.`,
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
              temperature: 0.6,
              maxOutputTokens: 1200,
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

      const jsonText = cleanToJson(text);
      const parsed = SiteSchema.parse(JSON.parse(jsonText)) as GeneratedSite;
      setSite(parsed);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate site");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!site) return;
    const html = buildStandaloneHtml(site);
    const filename = filenameForSite(site);
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
              <div className="border-b px-3 sm:px-4 h-12 flex items-center justify-between gap-3 bg-background/80">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-6 rounded" style={{ backgroundImage: "var(--gradient-primary)" }} />
                  <span className="font-medium truncate">
                    {site?.title ?? "Preview"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
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
                    variant="outline"
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
                    disabled={!site}
                    aria-label="Download website"
                  >
                    Download
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
                      {!loading && site && <PageRenderer site={site} />}
                      {!loading && !site && (
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
