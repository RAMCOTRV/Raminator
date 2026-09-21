"use client";

import { useEffect, useMemo, useState } from "react";

type TripDay = { id: number; date: string; location: string; title: string; description: string; details: string };
type Trip = { title: string; destination: string; startDate: string; endDate: string; travellers: string; arrival: string; returnDetails: string; welcome: string; tone: string; days: TripDay[] };
type User = { login: string };
type AuthResponse = { authenticated?: boolean; configured?: boolean; user?: User };

const tones: Record<string, string> = {
  "Chaleureux & complice": "On part ? Les valises peuvent suivre, elles ont l’habitude.",
  "Élégant & inspirant": "Un itinéraire pensé comme une collection de moments précieux.",
  "Dynamique & solaire": "Des couleurs, du mouvement et juste ce qu’il faut de dépaysement.",
};

const initialTrip: Trip = {
  title: "Marrakech, Atlas & Atlantique", destination: "Maroc", startDate: "2026-10-12", endDate: "2026-10-17", travellers: "2 voyageurs",
  arrival: "Arrivée à Marrakech · 12 octobre, 10h40 · Vol depuis Tunis", returnDetails: "Retour depuis Marrakech · 17 octobre, 19h20",
  welcome: "Une parenthèse marocaine imaginée pour prendre le temps : assez de découvertes pour raconter de belles histoires, assez de pauses pour en profiter.", tone: "Chaleureux & complice",
  days: [
    { id: 1, date: "2026-10-12", location: "Marrakech", title: "Premiers pas dans la Ville Rouge", description: "Accueil à l’aéroport puis installation dans un riad au cœur de la médina. Une première promenade douce pour apprivoiser les couleurs et les ruelles.", details: "Transfert privé · Riad avec petit-déjeuner · Promenade d’orientation" },
    { id: 2, date: "2026-10-13", location: "Marrakech", title: "Jardins, palais et thé à la menthe", description: "Les jardins Majorelle et le musée Yves Saint Laurent, puis les palais Bahia et El Badi avant un dîner marocain.", details: "Guide francophone · Entrées incluses · Dîner traditionnel" },
    { id: 3, date: "2026-10-14", location: "Vallée de l’Ourika", title: "Une échappée fraîche dans l’Atlas", description: "Une journée de paysages ouverts, de villages berbères et de cuisine familiale dans la vallée de l’Ourika.", details: "Excursion privée · Déjeuner chez l’habitant · Retour en fin de journée" },
    { id: 4, date: "2026-10-15", location: "Agafay", title: "Le désert sans attendre le désert", description: "Paysages lunaires du désert d’Agafay, balade au coucher du soleil, dîner sous tente et ciel étoilé.", details: "Transfert · Balade à dos de dromadaire · Dîner sous les étoiles" },
    { id: 5, date: "2026-10-16", location: "Essaouira", title: "Vent d’Atlantique et médina blanche", description: "Route vers Essaouira, ses remparts, ses ateliers et ses terrasses face à l’océan.", details: "Transfert privé · Visite de la médina · Temps libre au port" },
    { id: 6, date: "2026-10-17", location: "Marrakech", title: "Derniers souvenirs, retour vers Tunis", description: "Dernier café, quelques achats, puis transfert vers l’aéroport.", details: "Temps libre · Transfert aéroport · Assistance Ramco" },
  ],
};

function dateLabel(value: string, year = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", ...(year ? { year: "numeric" } : {}) }).format(new Date(`${value}T12:00:00`));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7c9296]">{label}</span>{children}</label>;
}

export default function Home() {
  const [trip, setTrip] = useState(initialTrip);
  const [openDay, setOpenDay] = useState(1);
  const [auth, setAuth] = useState<"loading" | "authenticated" | "unauthenticated" | "error">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void fetch("/api/auth/github/me", { credentials: "include", cache: "no-store" }).then(async (response) => {
      const result = await response.json() as AuthResponse;
      if (result.authenticated && result.user) { setUser(result.user); setAuth("authenticated"); }
      else setAuth(response.ok || result.configured !== false ? "unauthenticated" : "error");
    }).catch(() => setAuth("error"));
  }, []);

  const duration = useMemo(() => {
    const start = new Date(`${trip.startDate}T12:00:00`).getTime();
    const end = new Date(`${trip.endDate}T12:00:00`).getTime();
    return Number.isFinite(start) && Number.isFinite(end) ? Math.max(1, Math.round((end - start) / 86400000) + 1) : trip.days.length;
  }, [trip.startDate, trip.endDate, trip.days.length]);

  const updateTrip = <K extends keyof Trip>(key: K, value: Trip[K]) => setTrip((current) => ({ ...current, [key]: value }));
  const updateDay = (id: number, key: keyof TripDay, value: string) => setTrip((current) => ({ ...current, days: current.days.map((day) => day.id === id ? { ...day, [key]: value } : day) }));
  const addDay = () => setTrip((current) => ({ ...current, days: [...current.days, { id: current.days.length + 1, date: current.endDate, location: "Nouvelle étape", title: "Nouvelle journée", description: "Ajoutez le programme de cette étape.", details: "À préciser" }] }));

  const downloadPdf = () => {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) { setNotice("Autorisez les fenêtres popup pour télécharger le PDF."); return; }
    const rows = trip.days.map((day) => `<article><h2>${day.id}. ${escapeHtml(day.title)}</h2><p><strong>${escapeHtml(dateLabel(day.date))} · ${escapeHtml(day.location)}</strong></p><p>${escapeHtml(day.description)}</p><p><strong>Détails :</strong> ${escapeHtml(day.details)}</p></article>`).join("");
    printWindow.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(trip.title)}</title><style>body{font-family:Arial,sans-serif;color:#123446;max-width:800px;margin:40px auto;line-height:1.55}h1{font-size:38px}h2{margin-bottom:4px}header{border-bottom:2px solid #e36e5a;padding-bottom:20px;margin-bottom:28px}article{border-bottom:1px solid #ddd9d1;padding:0 0 20px;margin-bottom:20px}small{color:#52707a}@media print{body{margin:12mm}}</style></head><body><header><small>RAMCO · PROGRAMME DE VOYAGE</small><h1>${escapeHtml(trip.title)}</h1><p>${escapeHtml(trip.destination)} · ${duration} jours · ${escapeHtml(trip.travellers)}</p><p>${escapeHtml(trip.welcome)}</p><p>${escapeHtml(dateLabel(trip.startDate, true))} — ${escapeHtml(dateLabel(trip.endDate, true))}</p></header>${rows}<footer><p><strong>Arrivée :</strong> ${escapeHtml(trip.arrival)}</p><p><strong>Retour :</strong> ${escapeHtml(trip.returnDetails)}</p></footer><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    printWindow.document.close();
  };

  if (auth !== "authenticated") return <main className="flex min-h-screen items-center justify-center bg-[#eef1f3] p-5"><section className="w-full max-w-[520px] rounded-[28px] bg-[#123446] p-8 text-white"><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#f6bb65]">Ramco · Tunis</p><h1 className="mt-4 font-serif text-4xl">Votre programme de voyage</h1>{auth === "loading" ? <p className="mt-6">Vérification de la connexion…</p> : auth === "error" ? <p className="mt-6 text-[#ffe4ad]">L’authentification GitHub doit encore être configurée.</p> : <a href="/api/auth/github/start" className="mt-6 block rounded-xl bg-[#f6bb65] p-3 text-center font-bold text-[#123446]">Se connecter avec GitHub</a>}</section></main>;

  return <main className="min-h-screen bg-[#eef1f3] text-[#132b3c]"><header className="sticky top-0 z-40 flex h-[72px] items-center justify-between bg-[#102c3d] px-5 text-white"><div><p className="font-serif text-[21px]">ramco</p><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#a9c6d0]">Travel atelier · Tunis</p></div><div className="flex items-center gap-3">{user && <span className="hidden text-xs sm:inline">{user.login}</span>}<button onClick={downloadPdf} className="rounded-xl bg-[#f6bb65] px-4 py-2 text-sm font-bold text-[#102c3d]">Télécharger le PDF</button></div></header><div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 p-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:p-6"><aside className="space-y-4 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto"><section className="panel-card space-y-4 p-5"><h1 className="font-serif text-2xl">Construire le programme</h1><Field label="Titre"><input value={trip.title} onChange={(e) => updateTrip("title", e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Destination"><input value={trip.destination} onChange={(e) => updateTrip("destination", e.target.value)} /></Field><Field label="Voyageurs"><input value={trip.travellers} onChange={(e) => updateTrip("travellers", e.target.value)} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Départ"><input type="date" value={trip.startDate} onChange={(e) => updateTrip("startDate", e.target.value)} /></Field><Field label="Retour"><input type="date" value={trip.endDate} onChange={(e) => updateTrip("endDate", e.target.value)} /></Field></div></section><section className="panel-card space-y-4 p-5"><Field label="Arrivée"><textarea value={trip.arrival} onChange={(e) => updateTrip("arrival", e.target.value)} /></Field><Field label="Retour / fin du voyage"><textarea value={trip.returnDetails} onChange={(e) => updateTrip("returnDetails", e.target.value)} /></Field><Field label="Message d’accueil"><textarea value={trip.welcome} onChange={(e) => updateTrip("welcome", e.target.value)} /></Field><Field label="Ton"><select value={trip.tone} onChange={(e) => updateTrip("tone", e.target.value)}>{Object.keys(tones).map((tone) => <option key={tone}>{tone}</option>)}</select></Field></section><section className="panel-card p-3"><p className="eyebrow px-2 pb-3">Programme jour par jour · {trip.days.length} étapes</p>{trip.days.map((day) => <div key={day.id} className="mb-2 rounded-2xl border border-[#dce7e5] bg-[#f8fbfa]"><button onClick={() => setOpenDay(openDay === day.id ? 0 : day.id)} className="flex w-full items-center gap-3 p-3 text-left"><b className="flex size-8 items-center justify-center rounded-xl bg-[#e36e5a] text-white">{day.id}</b><span><strong className="block text-sm">{day.location}</strong><small>{dateLabel(day.date)} · {day.title}</small></span></button>{openDay === day.id && <div className="space-y-3 px-3 pb-3"><Field label="Date"><input type="date" value={day.date} onChange={(e) => updateDay(day.id, "date", e.target.value)} /></Field><Field label="Lieu"><input value={day.location} onChange={(e) => updateDay(day.id, "location", e.target.value)} /></Field><Field label="Titre"><input value={day.title} onChange={(e) => updateDay(day.id, "title", e.target.value)} /></Field><Field label="Programme"><textarea value={day.description} onChange={(e) => updateDay(day.id, "description", e.target.value)} /></Field><Field label="Détails inclus"><input value={day.details} onChange={(e) => updateDay(day.id, "details", e.target.value)} /></Field></div>}</div>)}<button onClick={addDay} className="w-full py-3 font-bold text-[#3d7772]">+ Ajouter une étape</button></section></aside><section><p className="eyebrow mb-4">Aperçu du programme {notice && `· ${notice}`}</p><div className="preview-stage rounded-[28px] p-3 sm:p-8"><div id="brochure-canvas" className="brochure-paper mx-auto max-w-[820px] overflow-hidden rounded-[18px] bg-[#f6f0e8] shadow-xl"><div className="bg-[#123446] px-7 py-12 text-white sm:px-12"><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#f6bb65]">{trip.destination} · {duration} jours · {trip.travellers}</p><h2 className="mt-10 font-serif text-[clamp(42px,7vw,82px)] leading-[0.9]">{trip.title}</h2><p className="mt-7 max-w-[560px] text-lg leading-7 text-[#d3e1e2]">{trip.welcome}</p><p className="mt-10 border-t border-white/20 pt-4">{dateLabel(trip.startDate, true)} — {dateLabel(trip.endDate, true)}</p></div><div className="px-5 py-8 sm:px-12 sm:py-12"><p className="eyebrow text-[#df715d]">Le fil du voyage</p><div className="mt-8 space-y-8">{trip.days.map((day) => <article key={day.id} className="break-inside-avoid border-b border-[#ddd9d1] pb-7 last:border-0"><div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6705e]"><span className="flex size-7 items-center justify-center rounded-full bg-[#e36e5a] text-white">{day.id}</span><span>{dateLabel(day.date)}</span><span className="text-[#7e8d92]">{day.location}</span></div><h3 className="mt-3 font-serif text-[28px] text-[#123446]">{day.title}</h3><p className="mt-2.5 text-[14px] leading-6 text-[#5d747a]">{day.description}</p><p className="mt-3 text-[11px] font-semibold leading-5 text-[#34716c]">• {day.details}</p></article>)}</div></div><div className="grid gap-6 bg-[#dfeae5] px-5 py-7 sm:grid-cols-2 sm:px-12"><p className="text-sm leading-6 text-[#34565f]"><strong>Arrivée :</strong><br />{trip.arrival}</p><p className="text-sm leading-6 text-[#34565f]"><strong>Retour :</strong><br />{trip.returnDetails}</p></div></div></div></section></div></main>;
}

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] || character)); }
