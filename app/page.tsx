"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  Check,
  Compass,
  Copy,
  GitBranch,
  ImagePlus,
  LoaderCircle,
  LogOut,
  MapPin,
  MessageCircleHeart,
  Minus,
  Palette,
  Plus,
  Sparkles,
  SunMedium,
  Trash2,
  WandSparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TripDay = {
  id: number;
  date: string;
  location: string;
  title: string;
  description: string;
  details: string;
  imageUrl: string;
  aiImage?: string;
};

type Trip = {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  travellers: string;
  arrival: string;
  returnDetails: string;
  welcome: string;
  tone: string;
  includeAiImages: boolean;
  days: TripDay[];
};

type PageToolContext = {
  registerTool: (
    tool: {
      name: string;
      title?: string;
      description: string;
      inputSchema: Record<string, unknown>;
      execute: (input: unknown) => unknown | Promise<unknown>;
      annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
};

type GitHubAuthResponse = {
  authenticated?: boolean;
  configured?: boolean;
  user?: GitHubUser;
};

const githubErrorMessages: Record<string, string> = {
  cancelled: "La connexion GitHub a été annulée.",
  invalid_callback: "La réponse de GitHub est incomplète. Réessaie.",
  invalid_state: "La session de connexion a expiré. Réessaie.",
  not_allowed: "Ce compte GitHub n’est pas autorisé pour l’atelier Ramco.",
  github_unavailable: "GitHub n’a pas pu confirmer ce compte. Réessaie dans un instant.",
};

const hotelExteriorFallback =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80";

const hotelKeywords = /(hotel|hôtel|riad|resort|residence|suite|hostel|villa|auberge|palace|boutique hotel|luxury hotel)/i;

const demoImages = [
  "https://images.unsplash.com/photo-1539020140153-e8c6a5d9a2d5?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=1200&q=85",
];

function resolveDayImage(location: string, title: string, fallbackIndex = 0) {
  const combined = `${location} ${title}`.toLowerCase();
  if (hotelKeywords.test(combined)) {
    return hotelExteriorFallback;
  }
  return demoImages[fallbackIndex % demoImages.length];
}

const seedDays: TripDay[] = [
  {
    id: 1,
    date: "2026-10-12",
    location: "Marrakech",
    title: "Premiers pas dans la Ville Rouge",
    description:
      "Accueil à l’aéroport puis installation dans un riad au cœur de la médina. Une première promenade douce pour apprivoiser les couleurs, les odeurs et le joyeux ballet des ruelles.",
    details: "Transfert privé · Riad avec petit-déjeuner · Promenade d’orientation",
    imageUrl: resolveDayImage("Marrakech", "Premiers pas dans la Ville Rouge", 0),
  },
  {
    id: 2,
    date: "2026-10-13",
    location: "Marrakech",
    title: "Jardins, palais et thé à la menthe",
    description:
      "Le matin, les jardins Majorelle et le musée Yves Saint Laurent. L’après-midi, les palais Bahia et El Badi, avant une adresse choisie pour un dîner marocain plein de parfums.",
    details: "Guide francophone · Entrées incluses · Dîner traditionnel",
    imageUrl: resolveDayImage("Marrakech", "Jardins, palais et thé à la menthe", 1),
  },
  {
    id: 3,
    date: "2026-10-14",
    location: "Vallée de l’Ourika",
    title: "Une échappée fraîche dans l’Atlas",
    description:
      "Cap au sud, vers les villages berbères et les terrasses de l’Ourika. Une journée de paysages ouverts, de cuisine familiale et de petites pauses où personne ne regarde sa montre.",
    details: "Excursion privée · Déjeuner chez l’habitant · Retour en fin de journée",
    imageUrl: resolveDayImage("Vallée de l’Ourika", "Une échappée fraîche dans l’Atlas", 2),
  },
  {
    id: 4,
    date: "2026-10-15",
    location: "Agafay",
    title: "Le désert sans attendre le désert",
    description:
      "Départ pour les paysages lunaires du désert d’Agafay. Balade au coucher du soleil, dîner sous tente et ciel étoilé : la grande aventure, avec un lit confortable à portée de main.",
    details: "Transfert · Balade à dos de dromadaire · Dîner sous les étoiles",
    imageUrl: resolveDayImage("Agafay", "Le désert sans attendre le désert", 3),
  },
  {
    id: 5,
    date: "2026-10-16",
    location: "Essaouira",
    title: "Vent d’Atlantique et médina blanche",
    description:
      "Route vers Essaouira, ses remparts, ses ateliers de bois de thuya et ses terrasses face à l’océan. Le programme officiel : flâner avec beaucoup de sérieux.",
    details: "Transfert privé · Visite de la médina · Temps libre au port",
    imageUrl: resolveDayImage("Essaouira", "Vent d’Atlantique et médina blanche", 4),
  },
  {
    id: 6,
    date: "2026-10-17",
    location: "Marrakech",
    title: "Derniers souvenirs, retour vers Tunis",
    description:
      "Un dernier café sur la place Jemaa el-Fna, quelques achats choisis avec discernement, puis transfert vers l’aéroport. On repart avec des images plein la tête et, probablement, un peu plus de patience pour la prochaine escapade.",
    details: "Temps libre · Transfert aéroport · Assistance Ramco",
    imageUrl: resolveDayImage("Marrakech", "Derniers souvenirs, retour vers Tunis", 0),
  },
];

const initialTrip: Trip = {
  title: "Marrakech, Atlas & Atlantique",
  destination: "Maroc",
  startDate: "2026-10-12",
  endDate: "2026-10-17",
  travellers: "2 voyageurs",
  arrival: "Arrivée à Marrakech · 12 octobre, 10h40 · Vol depuis Tunis",
  returnDetails: "Retour depuis Marrakech · 17 octobre, 19h20",
  welcome:
    "Une parenthèse marocaine imaginée pour prendre le temps : assez de découvertes pour raconter de belles histoires, assez de pauses pour en profiter.",
  tone: "Chaleureux & complice",
  includeAiImages: true,
  days: seedDays,
};

const toneMessages: Record<string, string> = {
  "Chaleureux & complice": "On part ? Les valises peuvent suivre, elles ont l’habitude.",
  "Élégant & inspirant": "Un itinéraire pensé comme une collection de moments précieux.",
  "Dynamique & solaire": "Des couleurs, du mouvement et juste ce qu’il faut de dépaysement.",
};

function formatDate(value: string, withYear = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(new Date(`${value}T12:00:00`));
}

function shortDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" })
    .format(new Date(`${value}T12:00:00`))
    .replace(".", "");
}

function newDay(id: number, startDate: string): TripDay {
  return {
    id,
    date: startDate,
    location: "Nouvelle étape",
    title: "Une nouvelle journée à imaginer",
    description: "Ajoute ici le rythme, les découvertes et les petites attentions qui rendront cette étape unique.",
    details: "À préciser · À préciser · À préciser",
    imageUrl: resolveDayImage("Nouvelle étape", "Une nouvelle journée à imaginer", id),
  };
}

export default function Home() {
  const [trip, setTrip] = useState<Trip>(initialTrip);
  const [openDay, setOpenDay] = useState<number | null>(1);
  const [generating, setGenerating] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated" | "error">("loading");
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const githubError = params.get("github_error");
    if (githubError) {
      setAuthMessage(githubErrorMessages[githubError] || "La connexion GitHub n’a pas abouti.");
      window.history.replaceState({}, "", window.location.pathname);
    }

    let active = true;
    void fetch("/api/auth/github/me", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as GitHubAuthResponse;
        if (!active) return;
        if (!response.ok && result.configured === false) {
          setAuthState("error");
          setAuthMessage("L’authentification GitHub doit encore être configurée.");
          return;
        }
        if (result.authenticated && result.user) {
          setGithubUser(result.user);
          setAuthState("authenticated");
        } else {
          setAuthState("unauthenticated");
        }
      })
      .catch(() => {
        if (!active) return;
        setAuthState("error");
        setAuthMessage("Impossible de vérifier la connexion GitHub pour le moment.");
      });

    return () => {
      active = false;
    };
  }, []);

  const tripDuration = useMemo(() => {
    const start = new Date(`${trip.startDate}T12:00:00`).getTime();
    const end = new Date(`${trip.endDate}T12:00:00`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return trip.days.length;
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
  }, [trip.startDate, trip.endDate, trip.days.length]);

  const updateTrip = <K extends keyof Trip>(key: K, value: Trip[K]) => {
    setTrip((current) => ({ ...current, [key]: value }));
  };

  const updateDay = (id: number, key: keyof TripDay, value: string) => {
    setTrip((current) => ({
      ...current,
      days: current.days.map((day) => (day.id === id ? { ...day, [key]: value } : day)),
    }));
  };

  const resizeDays = (value: string) => {
    const nextCount = Math.max(1, Math.min(14, Number(value) || 1));
    setTrip((current) => ({
      ...current,
      days: Array.from({ length: nextCount }, (_, index) => current.days[index] ?? newDay(index + 1, current.startDate)),
    }));
  };

  const addDay = () => resizeDays(String(trip.days.length + 1));

  const removeDay = (id: number) => {
    if (trip.days.length === 1) return;
    setTrip((current) => ({ ...current, days: current.days.filter((day) => day.id !== id) }));
    setOpenDay(null);
  };

  const generateImage = (day: TripDay) => {
    if (generating.includes(day.id)) return;
    setGenerating((current) => [...current, day.id]);
    const prompt = [
      "A single editorial travel photograph for a refined client brochure",
      day.title,
      day.location,
      trip.destination,
      "warm Mediterranean light, natural colors, elegant travel magazine composition, no text, no logo",
    ].join(", ");

    void fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    })
      .then(async (response) => {
        const result = await response.json() as { imageData?: string; mimeType?: string; error?: string };
        if (!response.ok || !result.imageData) throw new Error(result.error || "Le visuel n’a pas pu être créé.");
        const generatedUrl = `data:${result.mimeType || "image/jpeg"};base64,${result.imageData}`;
        setTrip((current) => ({
          ...current,
          days: current.days.map((item) => (item.id === day.id ? { ...item, aiImage: generatedUrl } : item)),
        }));
        setNotice(`Visuel IA préparé pour le jour ${day.id}.`);
      })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "Le visuel n’a pas pu être créé.");
      })
      .finally(() => {
        setGenerating((current) => current.filter((item) => item !== day.id));
        window.setTimeout(() => setNotice(""), 3200);
      });
  };

  const resetImage = (day: TripDay) => {
    setTrip((current) => ({
      ...current,
      days: current.days.map((item) => (item.id === day.id ? { ...item, aiImage: undefined } : item)),
    }));
  };

  const downloadPdf = async () => {
    const brochure = document.getElementById("brochure-canvas");
    if (!brochure) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(brochure, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#f6f0e8",
        logging: false,
      });
      const image = canvas.toDataURL("image/jpeg", 0.94);
      const pdf = new jsPDF("p", "mm", "a4");
      const margin = 8;
      const pageWidth = 210 - margin * 2;
      const pageHeight = 297 - margin * 2;
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let remaining = imageHeight;
      let position = margin;
      pdf.addImage(image, "JPEG", margin, position, pageWidth, imageHeight, undefined, "FAST");
      remaining -= pageHeight;
      while (remaining > 0) {
        position = margin - (imageHeight - remaining);
        pdf.addPage();
        pdf.addImage(image, "JPEG", margin, position, pageWidth, imageHeight, undefined, "FAST");
        remaining -= pageHeight;
      }
      const filename = `${trip.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-") || "brochure-ramco"}.pdf`;
      pdf.save(filename);
      setNotice("Brochure PDF téléchargée.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch {
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const context = (typeof document === "undefined" ? undefined : (document as Document & { modelContext?: PageToolContext }).modelContext);
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    const readObject = (input: unknown) => {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Les paramètres doivent être un objet.");
      return input as Record<string, unknown>;
    };
    const readText = (value: unknown, label: string) => {
      if (typeof value !== "string" || !value.trim()) throw new Error(`${label} est requis.`);
      return value.trim().slice(0, 5000);
    };

    void Promise.resolve(context.registerTool({
      name: "configure_ramco_brochure",
      title: "Configurer la brochure Ramco",
      description: "Met à jour les informations générales visibles dans la brochure Ramco : destination, titre, dates, logistique et message d’accueil.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          destination: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          travellers: { type: "string" },
          arrival: { type: "string" },
          returnDetails: { type: "string" },
          welcome: { type: "string" },
          tone: { type: "string", enum: Object.keys(toneMessages) },
          includeAiImages: { type: "boolean" },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const data = readObject(input);
        const allowedTextFields = ["title", "destination", "startDate", "endDate", "travellers", "arrival", "returnDetails", "welcome", "tone"] as const;
        const changed: string[] = [];
        setTrip((current) => {
          const next = { ...current };
          for (const key of allowedTextFields) {
            if (data[key] !== undefined) {
              next[key] = readText(data[key], key) as never;
              changed.push(key);
            }
          }
          if (data.includeAiImages !== undefined) {
            if (typeof data.includeAiImages !== "boolean") throw new Error("includeAiImages doit être un booléen.");
            next.includeAiImages = data.includeAiImages;
            changed.push("includeAiImages");
          }
          return next;
        });
        return { status: "updated", fields: changed };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);

    void Promise.resolve(context.registerTool({
      name: "update_ramco_itinerary_step",
      title: "Modifier une étape du programme",
      description: "Modifie une étape existante du programme Ramco à partir de son numéro, avec sa date, son lieu, son titre, sa description ou ses détails inclus.",
      inputSchema: {
        type: "object",
        properties: {
          day: { type: "integer", minimum: 1 },
          date: { type: "string" },
          location: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          details: { type: "string" },
        },
        required: ["day"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const data = readObject(input);
        const day = Number(data.day);
        if (!Number.isInteger(day) || day < 1) throw new Error("day doit être un entier positif.");
        const changed: string[] = [];
        setTrip((current) => {
          const index = day - 1;
          if (!current.days[index]) throw new Error(`L’étape ${day} n’existe pas.`);
          const nextDays = current.days.map((item, itemIndex) => {
            if (itemIndex !== index) return item;
            const next = { ...item };
            for (const key of ["date", "location", "title", "description", "details"] as const) {
              if (data[key] !== undefined) {
                next[key] = readText(data[key], key);
                changed.push(key);
              }
            }
            if (data.location !== undefined || data.title !== undefined) {
              next.imageUrl = resolveDayImage(next.location, next.title, day);
            }
            return next;
          });
          return { ...current, days: nextDays };
        });
        return { status: "updated", day, fields: changed };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);

    return () => lifecycle.abort();
  }, []);

  if (authState !== "authenticated") {
    return <GitHubGate status={authState} message={authMessage} />;
  }

  return (
    <main className="min-h-screen bg-[#eef1f3] text-[#132b3c]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#102c3d] text-white shadow-[0_12px_30px_rgba(16,44,61,0.16)]">
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center justify-between gap-4 px-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="ramco-mark flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[#f05d4e] text-[#102c3d]">
              <SunMedium className="size-5 stroke-[2.6]" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-serif text-[21px] leading-none tracking-tight">ramco</p>
              <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.24em] text-[#a9c6d0]">Travel atelier · Tunis</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-[#c6d8dd] md:flex">
            <span className="size-2 rounded-full bg-[#f6bb65] shadow-[0_0_0_4px_rgba(246,187,101,0.12)]" />
            Brouillon en cours
          </div>

          <div className="flex items-center gap-2">
            {githubUser && (
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-[#d8e5e6] sm:flex">
                {githubUser.avatarUrl ? <img src={githubUser.avatarUrl} alt="" className="size-5 rounded-full" /> : <GitBranch className="size-4" />}
                <span>{githubUser.login}</span>
                <a href="/api/auth/github/logout" aria-label="Se déconnecter de GitHub" className="ml-1 text-[#a9c6d0] transition hover:text-white"><LogOut className="size-4" /></a>
              </div>
            )}
            <Button
              onClick={downloadPdf}
              disabled={isExporting}
              className="h-10 rounded-xl bg-[#f6bb65] px-3 text-[#102c3d] shadow-[0_8px_18px_rgba(246,187,101,0.18)] hover:bg-[#ffd184] sm:px-4"
            >
              {isExporting ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}
              <span className="hidden sm:inline">{isExporting ? "Préparation…" : "Télécharger le PDF"}</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 p-4 lg:grid-cols-[minmax(310px,360px)_minmax(0,1fr)] lg:p-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-1">
          <section className="panel-card p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow"><Compass className="size-3.5" /> Votre proposition</div>
                <h1 className="mt-2 font-serif text-[27px] leading-[1.05] tracking-tight text-[#102c3d]">Construire le voyage</h1>
              </div>
              <Badge className="rounded-full bg-[#e9f0ef] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#34716c]">Étape 1/2</Badge>
            </div>
            <div className="space-y-4">
              <Field label="Titre de la brochure">
                <Input value={trip.title} onChange={(event) => updateTrip("title", event.target.value)} className="editor-input" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Destination">
                  <Input value={trip.destination} onChange={(event) => updateTrip("destination", event.target.value)} className="editor-input" />
                </Field>
                <Field label="Voyageurs">
                  <Input value={trip.travellers} onChange={(event) => updateTrip("travellers", event.target.value)} className="editor-input" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Départ">
                  <Input type="date" value={trip.startDate} onChange={(event) => updateTrip("startDate", event.target.value)} className="editor-input" />
                </Field>
                <Field label="Retour">
                  <Input type="date" value={trip.endDate} onChange={(event) => updateTrip("endDate", event.target.value)} className="editor-input" />
                </Field>
              </div>
              <Field label="Nombre de jours">
                <Input type="number" min={1} max={14} value={trip.days.length} onChange={(event) => resizeDays(event.target.value)} className="editor-input" />
              </Field>
              <div className="rounded-2xl bg-[#f5f7f6] p-3.5 text-sm text-[#52707a]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium"><CalendarDays className="size-4 text-[#e36e5a]" /> Durée calculée</span>
                  <strong className="text-[#102c3d]">{tripDuration} jours</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="panel-card p-5">
            <div className="eyebrow"><MapPin className="size-3.5" /> Logistique du séjour</div>
            <div className="mt-4 space-y-4">
              <Field label="Arrivée">
                <Textarea value={trip.arrival} onChange={(event) => updateTrip("arrival", event.target.value)} className="editor-input min-h-[76px] resize-none" />
              </Field>
              <Field label="Retour / fin du voyage">
                <Textarea value={trip.returnDetails} onChange={(event) => updateTrip("returnDetails", event.target.value)} className="editor-input min-h-[64px] resize-none" />
              </Field>
            </div>
          </section>

          <section className="panel-card p-5">
            <div className="eyebrow"><MessageCircleHeart className="size-3.5" /> La touche Ramco</div>
            <div className="mt-4 space-y-4">
              <Field label="Message d’accueil">
                <Textarea value={trip.welcome} onChange={(event) => updateTrip("welcome", event.target.value)} className="editor-input min-h-[90px] resize-none" />
              </Field>
              <Field label="Ton du message">
                <select value={trip.tone} onChange={(event) => updateTrip("tone", event.target.value)} className="editor-input h-10 w-full appearance-none rounded-xl px-3 text-sm outline-none">
                  {Object.keys(toneMessages).map((tone) => <option key={tone}>{tone}</option>)}
                </select>
              </Field>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#dce7e5] bg-[#f5faf8] p-3.5">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#173c4b]"><Sparkles className="size-4 text-[#dd725d]" /> Visuels IA</p>
                  <p className="mt-1 text-xs leading-4 text-[#68818a]">Une image éditoriale par étape</p>
                </div>
                <Switch checked={trip.includeAiImages} onCheckedChange={(checked) => updateTrip("includeAiImages", checked)} aria-label="Inclure les visuels IA" />
              </div>
            </div>
          </section>

          <section className="panel-card overflow-hidden">
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <div className="eyebrow"><WandSparkles className="size-3.5" /> Programme jour par jour</div>
              <span className="text-xs font-semibold text-[#8aa1a7]">{trip.days.length} étapes</span>
            </div>
            <div className="space-y-2 px-3 pb-3">
              {trip.days.map((day, index) => {
                const isOpen = openDay === day.id;
                const isGenerating = generating.includes(day.id);
                return (
                  <div key={day.id} className={cn("day-editor rounded-2xl border", isOpen ? "border-[#c8dcd8] bg-[#f8fbfa]" : "border-transparent bg-[#f6f8f7]")}>
                    <button type="button" onClick={() => setOpenDay(isOpen ? null : day.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold", isOpen ? "bg-[#e36e5a] text-white" : "bg-[#dce8e5] text-[#3d7772]")}>{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#183b4a]">{day.location}</span>
                        <span className="mt-0.5 block truncate text-xs text-[#80959a]">{shortDate(day.date)} · {day.title}</span>
                      </span>
                      {isOpen ? <Minus className="size-4 text-[#a0b1b4]" /> : <Plus className="size-4 text-[#a0b1b4]" />}
                    </button>
                    {isOpen && (
                      <div className="space-y-3 px-3 pb-3">
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Date">
                            <Input type="date" value={day.date} onChange={(event) => updateDay(day.id, "date", event.target.value)} className="editor-input" />
                          </Field>
                          <Field label="Lieu">
                            <Input value={day.location} onChange={(event) => updateDay(day.id, "location", event.target.value)} className="editor-input" />
                          </Field>
                        </div>
                        <Field label="Titre de l’étape">
                          <Input value={day.title} onChange={(event) => updateDay(day.id, "title", event.target.value)} className="editor-input" />
                        </Field>
                        <Field label="Programme">
                          <Textarea value={day.description} onChange={(event) => updateDay(day.id, "description", event.target.value)} className="editor-input min-h-[92px] resize-none" />
                        </Field>
                        <Field label="Détails inclus">
                          <Input value={day.details} onChange={(event) => updateDay(day.id, "details", event.target.value)} className="editor-input" />
                        </Field>
                        <div className="flex items-center gap-2 pt-1">
                          {trip.includeAiImages && (
                            <Button type="button" onClick={() => generateImage(day)} disabled={isGenerating} size="sm" className="h-9 flex-1 rounded-xl bg-[#173c4b] text-white hover:bg-[#245365]">
                              {isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : day.aiImage ? <Check className="size-4" /> : <ImagePlus className="size-4" />}
                              {isGenerating ? "Création…" : day.aiImage ? "Visuel prêt" : "Générer le visuel IA"}
                            </Button>
                          )}
                          {day.aiImage && <Button type="button" onClick={() => resetImage(day)} aria-label="Réinitialiser le visuel" variant="outline" size="icon-sm" className="rounded-xl border border-[#d9e3e1] bg-white text-[#173c4b] hover:bg-[#f5faf8]">
                            <Trash2 className="size-4" />
                          </Button>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addDay} className="flex w-full items-center justify-center gap-2 border-t border-[#e4ecea] px-5 py-3.5 text-sm font-semibold text-[#3d7772] transition hover:bg-[#f4faf8]">
              <Plus className="size-4" /> Ajouter une étape
            </button>
          </section>
        </aside>

        <section className="min-w-0">
          <div className="preview-toolbar mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <p className="eyebrow text-[#769096]"><Palette className="size-3.5" /> Aperçu de la brochure</p>
              <p className="mt-1 text-sm text-[#6f878e]">Chaque modification s’affiche instantanément dans le document.</p>
            </div>
            {notice && <div role="status" className="flex items-center gap-2 rounded-full border border-[#c7ddd8] bg-white px-3.5 py-2 text-sm font-semibold text-[#34716c] shadow-sm"><Check className="size-4" /> {notice}</div>}
          </div>

          <div className="preview-stage rounded-[28px] p-3 sm:p-5 xl:p-8">
            <div id="brochure-canvas" className="brochure-paper mx-auto max-w-[820px] overflow-hidden rounded-[18px] bg-[#f6f0e8] shadow-[0_22px_70px_rgba(16,44,61,0.18)]">
              <div className="cover-page relative min-h-[640px] overflow-hidden bg-[#123446] px-7 pb-8 pt-7 text-white sm:px-12 sm:pb-12 sm:pt-10">
                <div className="absolute -right-20 -top-24 size-72 rounded-full border-[34px] border-[#e36e5a]/80 opacity-80" />
                <div className="absolute -bottom-24 -left-16 size-64 rounded-full border-[24px] border-[#f6bb65]/80 opacity-70" />
                <div className="relative z-10 flex items-start justify-between gap-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-[13px] bg-[#f6bb65] text-[#123446]"><SunMedium className="size-5 stroke-[2.5]" /></div>
                    <div><p className="font-serif text-[22px] leading-none">ramco</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-[#bdd3d9]">Travel atelier · Tunis</p></div>
                  </div>
                  <div className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#dbe8e9]">Proposition sur mesure</div>
                </div>
                <div className="relative z-10 mt-28 max-w-[560px] sm:mt-36">
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.25em] text-[#f6bb65]">{trip.destination} · {tripDuration} jours · {trip.travellers}</p>
                  <h2 className="max-w-[650px] font-serif text-[clamp(42px,7vw,82px)] leading-[0.9] tracking-[-0.06em] text-[#fff8f0]">{trip.title}</h2>
                  <p className="mt-7 max-w-[450px] text-base leading-7 text-[#d3e1e2] sm:text-lg">{trip.welcome}</p>
                </div>
                <div className="relative z-10 mt-12 flex flex-wrap items-end justify-between gap-5 border-t border-white/20 pt-5 sm:mt-16">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9fbcc3]">Dates proposées</p><p className="mt-1 text-lg font-semibold text-white">{formatDate(trip.startDate)} au {formatDate(trip.endDate)}</p></div>
                  <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9fbcc3]">Une création</p><p className="mt-1 font-serif text-lg text-[#f6bb65]">Ramco</p></div>
                </div>
              </div>

              <div className="px-5 py-7 sm:px-12 sm:py-12">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#d7d6cf] pb-5">
                  <div><p className="eyebrow text-[#df715d]"><Sparkles className="size-3.5" /> Le fil du voyage</p><h3 className="mt-2 font-serif text-[32px] leading-none tracking-tight text-[#123446]">Programme détaillé</h3></div>
                  <p className="max-w-[230px] text-right text-xs leading-5 text-[#73888d]">Un itinéraire souple, précis et suffisamment vivant pour laisser une place aux surprises.</p>
                </div>

                <div className="space-y-7">
                  {trip.days.map((day, index) => {
                    const image = day.aiImage || day.imageUrl || resolveDayImage(day.location, day.title, index);
                    return (
                      <article key={day.id} className="break-inside-avoid grid gap-5 border-b border-[#ddd9d1] pb-7 last:border-0 sm:grid-cols-[146px_minmax(0,1fr)] sm:gap-7">
                        <div className="relative">
                          <img src={image} alt={`${day.location} — ${day.title}`} crossOrigin="anonymous" className="h-[118px] w-full rounded-[14px] object-cover sm:h-[146px]" />
                          <span className="absolute -left-2 -top-2 flex size-8 items-center justify-center rounded-full bg-[#e36e5a] text-xs font-bold text-white shadow-[0_4px_10px_rgba(227,110,90,0.28)]">{index + 1}</span>
                          {day.aiImage && <span className="absolute bottom-2 left-2 rounded-full bg-[#123446]/90 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#f6bb65]">Visuel IA</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6705e]"><span>{shortDate(day.date)}</span><span className="text-[#a6b8bb]">•</span><span>{day.location}</span></div>
                          <h4 className="mt-2 font-serif text-[25px] leading-[1.02] tracking-tight text-[#123446]">{day.title}</h4>
                          <p className="mt-2.5 text-[14px] leading-6 text-[#5d747a]">{day.description}</p>
                          <p className="mt-3 flex items-start gap-2 text-[11px] font-semibold leading-5 text-[#34716c]"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#34716c]" />{day.details}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-6 bg-[#dfeae5] px-5 py-7 sm:grid-cols-[1.2fr_0.8fr] sm:px-12 sm:py-10">
                <div><p className="eyebrow text-[#34716c]"><ArrowUpRight className="size-3.5" /> Points de départ</p><p className="mt-3 text-sm leading-6 text-[#34565f]"><strong className="font-semibold text-[#123446]">Ramco</strong> insiste sur les points de contact, les petits détails qui calment les voyageurs et les horaires qui laissent de la place au plaisir.</p></div>
                <div className="rounded-[14px] bg-[#123446] p-4 text-[#f6f0e8]"><p className="font-serif text-xl leading-tight">{toneMessages[trip.tone]}</p><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f6bb65]">Ambiance</p></div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f6f0e8] px-5 py-5 text-[10px] font-bold uppercase tracking-[0.17em] text-[#8a9b9d] sm:px-12"><span>ramco voyage studio</span><span>{trip.destination}</span><span>{trip.days.length} étapes</span></div>
            </div>
          </div>

          <div className="preview-meta mt-4 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[#71878d]">
            <p className="flex items-center gap-2"><Copy className="size-3.5" /> Les photos générées peuvent être remplacées étape par étape.</p>
            <p className="flex items-center gap-2"><Check className="size-3.5 text-[#34716c]" /> Mise en page optimisée pour impression A4</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function GitHubGate({ status, message }: { status: "loading" | "unauthenticated" | "error"; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef1f3] px-5 py-10 text-[#132b3c]">
      <section className="w-full max-w-[520px] rounded-[28px] bg-[#123446] p-8 text-white shadow-[0_28px_80px_rgba(16,44,61,0.22)] sm:p-12">
        <div className="flex size-14 items-center justify-center rounded-[18px] bg-[#f6bb65] text-[#123446]"><GitBranch className="size-7" /></div>
        <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.25em] text-[#f6bb65]">Ramco · Tunis</p>
        <h1 className="mt-3 font-serif text-[42px] leading-[0.95] tracking-[-0.04em]">Votre atelier de brochures</h1>
        <p className="mt-5 text-base leading-7 text-[#d3e1e2]">Connectez-vous avec le compte GitHub autorisé pour préparer les propositions de voyage Ramco.</p>
        {status === "loading" ? (
          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-4 text-sm text-[#d3e1e2]"><LoaderCircle className="size-4 animate-spin" /> Vérification de la connexion…</div>
        ) : status === "error" ? (
          <div className="mt-8 rounded-2xl border border-[#f6bb65]/30 bg-[#f6bb65]/10 px-4 py-4 text-sm leading-6 text-[#ffe4ad]">{message}</div>
        ) : (
          <div className="mt-8">
            {message && <p className="mb-4 rounded-2xl border border-[#f6bb65]/30 bg-[#f6bb65]/10 px-4 py-3 text-sm leading-6 text-[#ffe4ad]">{message}</p>}
            <a href="/api/auth/github/start" className="flex h-12 items-center justify-center gap-3 rounded-xl bg-[#f6bb65] px-5 text-sm font-bold text-[#123446] transition hover:bg-[#ffd184]"><GitBranch className="size-4" /> Se connecter avec GitHub</a>
            <p className="mt-4 text-center text-xs leading-5 text-[#a9c6d0]">L’accès est réservé au compte GitHub configuré pour Ramco.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7c9296]">{label}</span>{children}</label>;
}
