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
import { GeneratedSite, GeneratedWebsite, GeneratedReactProject } from "@/types/site";
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

const ReactProjectSchema = z.object({
  title: z.string(),
  description: z.string(),
  theme: z.enum(["green", "light", "dark"]).optional(),
  framework: z.literal("react-vite-typescript"),
  files: z.object({
    packageJson: z.string(),
    viteConfig: z.string(),
    tsConfig: z.string(),
    tailwindConfig: z.string(),
    postcssConfig: z.string(),
    indexHtml: z.string(),
    mainTsx: z.string(),
    appTsx: z.string(),
    appCss: z.string(),
    components: z.record(z.string()),
    pages: z.record(z.string()),
    lib: z.record(z.string()),
  }),
  additionalFiles: z.record(z.string()).optional(),
  features: z.array(z.string()),
  responsive: z.boolean(),
  interactive: z.boolean(),
  shadcnComponents: z.array(z.string()),
});

const DEFAULT_MODEL = "gemini-1.5-flash";

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
    const errorData = JSON.parse(txt);
    
    if (res.status === 503 && errorData?.error?.status === "UNAVAILABLE") {
      throw new Error("Model is currently overloaded. Please try a different model or try again later.");
    }
    
    throw new Error(`Gemini fixer error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
  if (!text) throw new Error("No fixer content returned by model");
  return cleanToJson(text);
}

type Viewport = "desktop" | "tablet" | "mobile";
type GenerationType = "preview" | "fullstack" | "react-vite";

export function SiteGenerator() {
  const [apiKey, setApiKey] = useState<string>("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [prompt, setPrompt] = useState<string>(
    "Create a modern React application for a sustainable fashion e-commerce site with product gallery, shopping cart, and user authentication. Use shadcn-ui components and include TypeScript types."
  );
  const [generationType, setGenerationType] = useState<GenerationType>("preview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [site, setSite] = useState<GeneratedSite | null>(null);
  const [website, setWebsite] = useState<GeneratedWebsite | null>(null);
  const [reactProject, setReactProject] = useState<GeneratedReactProject | null>(null);
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
    const storedViewport = localStorage.getItem("preview_viewport") as Viewport | null;
    if (storedViewport) setViewport(storedViewport);
    const storedType = localStorage.getItem("generation_type") as GenerationType | null;
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
      `Generate a website preview. Return JSON:\n` +
      `{\n  "title": "Website Title",\n  "theme": "green",\n  "sections": [\n    { "type": "hero", "headline": "Main headline", "subheadline": "Subtitle", "ctaLabel": "Get Started" },\n    { "type": "features", "title": "Features", "items": [\n      { "title": "Feature 1", "description": "Description", "icon": "✨" },\n      { "title": "Feature 2", "description": "Description", "icon": "🚀" },\n      { "title": "Feature 3", "description": "Description", "icon": "💡" }\n    ]},\n    { "type": "cta", "headline": "Call to action", "ctaLabel": "Learn More" }\n  ]\n}`,
    []
  );

  const fullstackSystemPrompt = useMemo(
    () =>
      `Generate a complete website with HTML, CSS, JS, and Node.js backend. Return JSON:\n` +
      `{\n  "title": "Website Title",\n  "description": "Brief description",\n  "theme": "green",\n  "files": {\n    "html": "Complete HTML with semantic structure",\n    "css": "Modern CSS with responsive design",\n    "js": "Interactive JavaScript",\n    "nodejs": {\n      "packageJson": "package.json with dependencies",\n      "serverJs": "Express.js server",\n      "routes": { "routeName": "route handler code" }\n    }\n  },\n  "features": ["responsive", "interactive"],\n  "responsive": true,\n  "interactive": true\n}`,
    []
  );

  const reactSystemPrompt = useMemo(
    () =>
      `Generate a Vite+React+TypeScript project with shadcn-ui. Return JSON:\n` +
      `{\n  "title": "Project Title",\n  "description": "Brief description",\n  "theme": "green",\n  "framework": "react-vite-typescript",\n  "files": {\n    "packageJson": "package.json with React, Vite, TypeScript, Tailwind, shadcn-ui",\n    "viteConfig": "vite.config.ts",\n    "tsConfig": "tsconfig.json",\n    "tailwindConfig": "tailwind.config.js",\n    "postcssConfig": "postcss.config.js",\n    "indexHtml": "index.html",\n    "mainTsx": "main.tsx",\n    "appTsx": "App.tsx",\n    "appCss": "app.css",\n    "components": { "Component.tsx": "component code" },\n    "pages": { "Page.tsx": "page code" },\n    "lib": { "utils.ts": "utilities" }\n  },\n  "features": ["responsive", "interactive"],\n  "responsive": true,\n  "interactive": true,\n  "shadcnComponents": ["button", "card", "input"]\n}`,
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

  const downloadReactProject = () => {
    if (!reactProject) return;

    const files = [
      { name: 'package.json', content: reactProject.files.packageJson },
      { name: 'vite.config.ts', content: reactProject.files.viteConfig },
      { name: 'tsconfig.json', content: reactProject.files.tsConfig },
      { name: 'tailwind.config.js', content: reactProject.files.tailwindConfig },
      { name: 'postcss.config.js', content: reactProject.files.postcssConfig },
      { name: 'index.html', content: reactProject.files.indexHtml },
      { name: 'src/main.tsx', content: reactProject.files.mainTsx },
      { name: 'src/App.tsx', content: reactProject.files.appTsx },
      { name: 'src/App.css', content: reactProject.files.appCss },
    ];

    // Add components
    Object.entries(reactProject.files.components).forEach(([name, content]) => {
      files.push({ name: `src/components/${name}`, content });
    });

    // Add pages
    Object.entries(reactProject.files.pages).forEach(([name, content]) => {
      files.push({ name: `src/pages/${name}`, content });
    });

    // Add lib files
    Object.entries(reactProject.files.lib).forEach(([name, content]) => {
      files.push({ name: `src/lib/${name}`, content });
    });

    // Add additional files
    if (reactProject.additionalFiles) {
      Object.entries(reactProject.additionalFiles).forEach(([path, content]) => {
        files.push({ name: path, content });
      });
    }

    // Create and download files
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
    try {
      setLoading(true);
      setError(null);
      setSite(null);
      setWebsite(null);
      setReactProject(null);
      setLastRawText(null);
      
      if (!apiKey) {
        throw new Error("Missing API key. For security, enter your Gemini API key locally.");
      }

      if (!prompt.trim()) {
        throw new Error("Please enter a description for what you want to generate.");
      }

      const systemPrompt = generationType === "preview" 
        ? previewSystemPrompt 
        : generationType === "react-vite" 
        ? reactSystemPrompt 
        : fullstackSystemPrompt;
      const userInstruction = `${prompt}`;

      // Try different models if one is overloaded
      const modelsToTry = [
        model, // Try user's selected model first
        "gemini-1.5-flash", // Most reliable fallback
        "gemini-1.5-pro", // Pro model fallback
        "gemini-2.0-flash", // Stable fallback
        "gemini-2.0-flash-exp", // Experimental fallback
        "gemini-1.0-pro" // Legacy pro fallback
      ];

      let lastError = null;
      const maxRetries = 2;
      
      for (const currentModel of modelsToTry) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            // Add delay between retries
            if (attempt > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 1s, 2s delay
            }

            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
                currentModel
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
                    maxOutputTokens: generationType === "react-vite" ? 8000 : generationType === "fullstack" ? 6000 : 800,
                  },
                }),
              }
            );

            if (!res.ok) {
              const txt = await res.text();
              const errorData = JSON.parse(txt);
              
              if (res.status === 503 && errorData?.error?.status === "UNAVAILABLE") {
                lastError = `Model ${currentModel} is overloaded.`;
                if (attempt < maxRetries) {
                  continue; // Retry same model
                }
                break; // Try next model
              }
              
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
              } else if (generationType === "react-vite") {
                const parsed = ReactProjectSchema.parse(JSON.parse(jsonText)) as GeneratedReactProject;
                setReactProject(parsed);
                setActiveTab("app");
              } else {
                const parsed = WebsiteSchema.parse(JSON.parse(jsonText)) as GeneratedWebsite;
                setWebsite(parsed);
                setActiveTab("html");
              }
              return; // Success! Exit the retry loop
            } catch (parseErr: any) {
              // Attempt auto-fix once
              const schemaDesc = generationType === "preview"
                ? `{"title": "Title", "theme": "green", "sections": [{"type": "hero", "headline": "Headline", "subheadline": "Subtitle", "ctaLabel": "CTA"}, {"type": "features", "title": "Features", "items": [{"title": "Feature", "description": "Desc", "icon": "✨"}]}, {"type": "cta", "headline": "CTA", "ctaLabel": "Button"}]}`
                : generationType === "react-vite"
                ? `{"title": "Title", "description": "Desc", "theme": "green", "framework": "react-vite-typescript", "files": {"packageJson": "pkg", "viteConfig": "vite", "tsConfig": "ts", "tailwindConfig": "tw", "postcssConfig": "pc", "indexHtml": "html", "mainTsx": "main", "appTsx": "app", "appCss": "css", "components": {"comp.tsx": "code"}, "pages": {"page.tsx": "code"}, "lib": {"utils.ts": "code"}}, "features": ["responsive"], "responsive": true, "interactive": true, "shadcnComponents": ["button"]}`
                : `{"title": "Title", "description": "Desc", "theme": "green", "files": {"html": "html", "css": "css", "js": "js", "nodejs": {"packageJson": "pkg", "serverJs": "server", "routes": {"route": "code"}}}, "features": ["responsive"], "responsive": true, "interactive": true}`;

              try {
                const fixed = await attemptAutoFix({
                  apiKey,
                  model: currentModel,
                  schemaDescription: schemaDesc,
                  badText: jsonText,
                  maxOutputTokens: generationType === "react-vite" ? 4000 : generationType === "fullstack" ? 3000 : 600,
                });
                if (generationType === "preview") {
                  const parsed = SiteSchema.parse(JSON.parse(fixed)) as GeneratedSite;
                  setSite(parsed);
                  setActiveTab("preview");
                } else if (generationType === "react-vite") {
                  const parsed = ReactProjectSchema.parse(JSON.parse(fixed)) as GeneratedReactProject;
                  setReactProject(parsed);
                  setActiveTab("app");
                } else {
                  const parsed = WebsiteSchema.parse(JSON.parse(fixed)) as GeneratedWebsite;
                  setWebsite(parsed);
                  setActiveTab("html");
                }
                return; // Success! Exit the retry loop
              } catch (fixErr: any) {
                lastError = `Generation returned invalid JSON and auto-fix failed: ${fixErr?.message || "unknown error"}`;
                if (attempt < maxRetries) {
                  continue; // Retry same model
                }
                break; // Try next model
              }
            }
          } catch (modelError: any) {
            lastError = modelError.message;
            if (attempt < maxRetries) {
              continue; // Retry same model
            }
            break; // Try next model
          }
        }
      }
      
      // If we get here, all models failed
      throw new Error(`All Gemini models are currently overloaded. This is a temporary issue. Please try again in a few minutes, or check the Gemini API status. Last error: ${lastError || "Unknown error"}`);
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
        ? `{"title": "Title", "theme": "green", "sections": [{"type": "hero", "headline": "Headline", "subheadline": "Subtitle", "ctaLabel": "CTA"}, {"type": "features", "title": "Features", "items": [{"title": "Feature", "description": "Desc", "icon": "✨"}]}, {"type": "cta", "headline": "CTA", "ctaLabel": "Button"}]}`
        : generationType === "react-vite"
        ? `{"title": "Title", "description": "Desc", "theme": "green", "framework": "react-vite-typescript", "files": {"packageJson": "pkg", "viteConfig": "vite", "tsConfig": "ts", "tailwindConfig": "tw", "postcssConfig": "pc", "indexHtml": "html", "mainTsx": "main", "appTsx": "app", "appCss": "css", "components": {"comp.tsx": "code"}, "pages": {"page.tsx": "code"}, "lib": {"utils.ts": "code"}}, "features": ["responsive"], "responsive": true, "interactive": true, "shadcnComponents": ["button"]}`
        : `{"title": "Title", "description": "Desc", "theme": "green", "files": {"html": "html", "css": "css", "js": "js", "nodejs": {"packageJson": "pkg", "serverJs": "server", "routes": {"route": "code"}}}, "features": ["responsive"], "responsive": true, "interactive": true}`;

      const fixed = await attemptAutoFix({
        apiKey,
        model,
        schemaDescription: schemaDesc,
        badText: lastRawText,
        maxOutputTokens: generationType === "react-vite" ? 4000 : generationType === "fullstack" ? 3000 : 600,
      });
      if (generationType === "preview") {
        const parsed = SiteSchema.parse(JSON.parse(fixed)) as GeneratedSite;
        setSite(parsed);
        setActiveTab("preview");
      } else if (generationType === "react-vite") {
        const parsed = ReactProjectSchema.parse(JSON.parse(fixed)) as GeneratedReactProject;
        setReactProject(parsed);
        setActiveTab("app");
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
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        <ResizablePanelGroup direction="horizontal" className="rounded-lg border">
          <ResizablePanel defaultSize={40} minSize={30} className="bg-card">
            <div className="h-full overflow-auto p-6 space-y-6">
              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="apiKey">Gemini API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              {/* Model */}
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-1.5-flash">gemini-1.5-flash (Most Reliable)</SelectItem>
                    <SelectItem value="gemini-1.5-pro">gemini-1.5-pro (Pro)</SelectItem>
                    <SelectItem value="gemini-2.0-flash">gemini-2.0-flash (Stable)</SelectItem>
                    <SelectItem value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (Experimental)</SelectItem>
                    <SelectItem value="gemini-2.5-flash">gemini-2.5-flash (Latest)</SelectItem>
                    <SelectItem value="gemini-1.0-pro">gemini-1.0-pro (Legacy)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Use gemini-1.5-flash for best reliability
                </p>
              </div>

              {/* Generation Type */}
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={generationType} onValueChange={(value: GenerationType) => setGenerationType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preview">Quick Preview</SelectItem>
                    <SelectItem value="fullstack">Full Stack</SelectItem>
                    <SelectItem value="react-vite">React Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={6}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what you want to build..."
                />
              </div>

              {/* Generate Button */}
              <Button
                type="button"
                variant="hero"
                size="lg"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleGenerate();
                }}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Generating..." : "Generate"}
              </Button>

              {/* Download Button */}
              {(website || reactProject) && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={website ? downloadWebsite : downloadReactProject}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              )}

              {/* Error */}
              {error && (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleGenerate();
                    }}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? "Retrying..." : "Try Again"}
                  </Button>
                </div>
              )}

              {/* Features */}
              {(website || reactProject) && (
                <div className="space-y-2">
                  <Label>Features</Label>
                  <div className="flex flex-wrap gap-1">
                    {(website || reactProject)?.features.map((feature, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                  {reactProject && (
                    <div className="mt-2">
                      <Label className="text-xs">shadcn-ui:</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {reactProject.shadcnComponents.map((component, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {component}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={60} minSize={40} className="bg-muted/20">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="border-b px-4 h-12 flex items-center justify-between bg-background">
                <span className="font-medium">
                  {site?.title || website?.title || reactProject?.title || "Preview"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewport === "mobile" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setViewport("mobile")}
                  >
                    <Smartphone className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewport === "tablet" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setViewport("tablet")}
                  >
                    <Tablet className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewport === "desktop" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setViewport("desktop")}
                  >
                    <Monitor className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto">
                {website ? (
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                    <div className="border-b px-4 py-2">
                      <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                        <TabsTrigger value="html">HTML</TabsTrigger>
                        <TabsTrigger value="css">CSS</TabsTrigger>
                        <TabsTrigger value="js">JS</TabsTrigger>
                        <TabsTrigger value="files">Files</TabsTrigger>
                      </TabsList>
                    </div>
                    
                    <TabsContent value="preview" className="p-4 h-full">
                      <div className="mx-auto flex justify-center">
                        <div className={`${frameWidthClass} min-h-[480px] overflow-hidden border rounded-lg`}>
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
                          <div className="text-sm">
                            <span className="font-medium">Framework:</span> {website.framework}
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
                          <p className="text-sm text-muted-foreground">No additional files.</p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : reactProject ? (
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                    <div className="border-b px-4 py-2">
                      <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                        <TabsTrigger value="app">App.tsx</TabsTrigger>
                        <TabsTrigger value="components">Components</TabsTrigger>
                        <TabsTrigger value="config">Config</TabsTrigger>
                        <TabsTrigger value="package">Package</TabsTrigger>
                        <TabsTrigger value="files">Files</TabsTrigger>
                      </TabsList>
                    </div>
                    
                    <TabsContent value="preview" className="p-4 h-full">
                      <div className="mx-auto flex justify-center">
                        <div className={`${frameWidthClass} min-h-[480px] overflow-hidden border rounded-lg bg-background p-6`}>
                          <h3 className="text-lg font-semibold mb-4">React Project</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Vite + React + TypeScript + shadcn-ui
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Code className="w-4 h-4 text-primary" />
                              <span>Ready to download and run</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Palette className="w-4 h-4 text-primary" />
                              <span>Includes all dependencies</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="app" className="p-4 h-full">
                      <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm h-full">
                        <code>{reactProject.files.appTsx}</code>
                      </pre>
                    </TabsContent>
                    
                    <TabsContent value="components" className="p-4 h-full">
                      <div className="space-y-4">
                        {Object.entries(reactProject.files.components).map(([name, content]) => (
                          <details key={name} className="rounded-lg border bg-card">
                            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{name}</summary>
                            <pre className="bg-muted m-3 p-3 rounded-lg overflow-auto text-xs max-h-80">
                              <code>{content}</code>
                            </pre>
                          </details>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="config" className="p-4 h-full">
                      <div className="space-y-4">
                        <details className="rounded-lg border bg-card">
                          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">vite.config.ts</summary>
                          <pre className="bg-muted m-3 p-3 rounded-lg overflow-auto text-xs max-h-80">
                            <code>{reactProject.files.viteConfig}</code>
                          </pre>
                        </details>
                        <details className="rounded-lg border bg-card">
                          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">tailwind.config.js</summary>
                          <pre className="bg-muted m-3 p-3 rounded-lg overflow-auto text-xs max-h-80">
                            <code>{reactProject.files.tailwindConfig}</code>
                          </pre>
                        </details>
                        <details className="rounded-lg border bg-card">
                          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">tsconfig.json</summary>
                          <pre className="bg-muted m-3 p-3 rounded-lg overflow-auto text-xs max-h-80">
                            <code>{reactProject.files.tsConfig}</code>
                          </pre>
                        </details>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="package" className="p-4 h-full">
                      <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm h-full">
                        <code>{reactProject.files.packageJson}</code>
                      </pre>
                    </TabsContent>
                    
                    <TabsContent value="files" className="p-4 h-full">
                      <div className="space-y-3">
                        {reactProject.additionalFiles ? (
                          <div className="space-y-2">
                            {Object.entries(reactProject.additionalFiles).map(([path, content]) => (
                              <details key={path} className="rounded-lg border bg-card">
                                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{path}</summary>
                                <pre className="bg-muted m-3 p-3 rounded-lg overflow-auto text-xs max-h-80">
                                  <code>{content}</code>
                                </pre>
                              </details>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No additional files.</p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="p-8">
                    <div className="mx-auto flex justify-center">
                      <div className={`${frameWidthClass} min-h-[480px] overflow-hidden border rounded-lg bg-background p-8`}> 
                        {loading ? (
                          <div className="space-y-4">
                            <Skeleton className="h-8 w-1/3" />
                            <Skeleton className="h-4 w-2/3" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                              <Skeleton className="h-24" />
                              <Skeleton className="h-24" />
                            </div>
                          </div>
                        ) : site ? (
                          <PageRenderer site={site} />
                        ) : (
                          <div className="text-center">
                            <h2 className="text-xl font-semibold">Preview</h2>
                            <p className="mt-2 text-sm text-muted-foreground">
                              Generate something to see it here.
                            </p>
                          </div>
                        )}
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