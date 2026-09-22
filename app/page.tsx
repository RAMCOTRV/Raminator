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
    { id: 3, date: "2026-10-14", location: "Vallée de l’Ourika", title: "Une échappée fraîche dans l’Atlas", description: "Une journée de paysages ouverts, de villages berbères et de cuisine locale simple et généreuse.", details: "Départ tôt · Village berbère · Déjeuner local" },
    { id: 4, date: "2026-10-15", location: "Agafay", title: "Le désert sans attendre le désert", description: "Paysages lunaires du désert d’Agafay, balade au coucher du soleil, dîner sous les étoiles.", details: "Transfert · Dîner au coucher du soleil · Coucher étoilé" },
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
    try {
      const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
      if (!printWindow) {
        setNotice("Autorisez les fenêtres popup pour télécharger le PDF.");
        return;
      }

      const rows = trip.days.map((day) => `
        <article>
          <h2>${day.id}. ${escapeHtml(day.title)}</h2>
          <p><strong>${escapeHtml(dateLabel(day.date))} · ${escapeHtml(day.location)}</strong></p>
          <p>${escapeHtml(day.description)}</p>
          <p><strong>Détails :</strong> ${escapeHtml(day.details)}</p>
        </article>
      `).join("");

      const html = `<!doctype html>
        <html lang="fr">
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(trip.title)}</title>
            <style>
              body { font-family: Arial, sans-serif; color: #123446; max-width: 800px; margin: 40px auto; line-height: 1.55; }
              h1 { font-size: 38px; margin: 0 0 12px; }
              h2 { margin: 0 0 8px; font-size: 24px; }
              header { border-bottom: 2px solid #e36e5a; padding-bottom: 20px; margin-bottom: 28px; }
              article { border-bottom: 1px solid #ddd9d1; padding: 0 0 20px; margin-bottom: 20px; }
              small { color: #52707a; }
              @media print { body { margin: 12mm; } }
            </style>
          </head>
          <body>
            <header>
              <small>RAMCO · PROGRAMME DE VOYAGE</small>
              <h1>${escapeHtml(trip.title)}</h1>
              <p>${escapeHtml(trip.destination)} · ${duration} jours · ${escapeHtml(trip.travellers)}</p>
              <p>${escapeHtml(trip.arrival)}</p>
            </header>
            <main>${rows}</main>
          </body>
        </html>`;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
          setNotice("Le PDF n’a pas pu être préparé. Réessayez dans un instant !");
        }
      }, 250);
    } catch {
      setNotice("Le PDF n’a pas pu être préparé. Réessayez dans un instant !");
    }
  };

  if (auth !== "authenticated") return <main className="flex min-h-screen items-center justify-center bg-[#eef1f3] p-5"><section className="w-full max-w-[520px] rounded-[28px] bg-[#123446] p-8 text-white"><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#f6bb65]">Ramco · Tunis</p><h1 className="mt-4 font-serif text-4xl">Votre programme de voyage</h1>{auth === "loading" ? <p className="mt-6">Vérification de la connexion…</p> : auth === "error" ? <p className="mt-6 text-[#ffe4ad]">L’authentification GitHub doit encore être configurée.</p> : <a href="/api/auth/github/start" className="mt-6 block rounded-xl bg-[#f6bb65] p-3 text-center font-bold text-[#123446]">Se connecter</a>}</section></main>;

  return <main className="min-h-screen bg-[#eef1f3] text-[#132b3c]"><header className="sticky top-0 z-40 flex h-[72px] items-center justify-between bg-[#102c3d] px-5 text-white"><div><p className="font-serif text-[21px]">ramco</p><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#a9c6d0]">Travel atelier · Tunis</p></div><div className="flex items-center gap-3">{user && <span className="hidden text-xs sm:inline">{user.login}</span>}<button onClick={downloadPdf} className="rounded-xl bg-[#f6bb65] px-4 py-2 text-sm font-bold text-[#102c3d]">Télécharger le PDF</button></div></header><div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 p-4 lg:grid-cols-[420px_minmax(0,1fr)]"><aside className="rounded-[28px] bg-[#f8fafb] p-5 shadow-[0_10px_30px_rgba(18,52,70,0.08)]"><div className="mb-5 flex items-center justify-between"><h2 className="font-serif text-2xl">Votre itinéraire</h2><button onClick={addDay} className="rounded-xl bg-[#123446] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white">+ Jour</button></div><div className="space-y-4"><Field label="Titre"><input value={trip.title} onChange={(event) => updateTrip("title", event.target.value)} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field><Field label="Destination"><input value={trip.destination} onChange={(event) => updateTrip("destination", event.target.value)} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Départ"><input type="date" value={trip.startDate} onChange={(event) => updateTrip("startDate", event.target.value)} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field><Field label="Retour"><input type="date" value={trip.endDate} onChange={(event) => updateTrip("endDate", event.target.value)} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field></div><Field label="Voyageurs"><input value={trip.travellers} onChange={(event) => updateTrip("travellers", event.target.value)} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field><Field label="Arrivée"><input value={trip.arrival} onChange={(event) => updateTrip("arrival", event.target.value)} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field><Field label="Retour / détails"><input value={trip.returnDetails} onChange={(event) => updateTrip("returnDetails", event.target.value)} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field><Field label="Message d’accueil"><textarea value={trip.welcome} onChange={(event) => updateTrip("welcome", event.target.value)} rows={3} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field><Field label="Ambiance"><select value={trip.tone} onChange={(event) => updateTrip("tone", event.target.value)} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5"><option>{trip.tone}</option>{Object.keys(tones).filter((tone) => tone !== trip.tone).map((tone) => <option key={tone}>{tone}</option>)}</select></Field></div></aside><section className="space-y-5 rounded-[28px] bg-[#f8fafb] p-5 shadow-[0_10px_30px_rgba(18,52,70,0.08)]"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7c9296]">Brochure</p><h2 className="font-serif text-3xl">{trip.title}</h2></div><span className="rounded-full bg-[#ebf5f0] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#1e6e4e]">{duration} jours</span></div>{notice && <div className="rounded-xl border border-[#f6d0a3] bg-[#fff8ee] px-3 py-2 text-sm text-[#7d4a16]">{notice}</div>}<div className="rounded-[26px] bg-white p-5 shadow-[0_8px_24px_rgba(18,52,70,0.05)]"><div className="mb-5 border-b border-[#e4eaec] pb-4"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7c9296]">Ramco · Tunis</p><h3 className="mt-2 font-serif text-4xl">{trip.title}</h3><p className="mt-2 text-[#4b6875]">{trip.destination} · {duration} jours · {trip.travellers}</p></div><p className="mb-5 text-[15px] leading-7 text-[#294454]">{trip.welcome}</p><div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-2xl bg-[#eef6f8] p-3"><span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#7c9296]">Arrivée</span><span>{trip.arrival}</span></div><div className="rounded-2xl bg-[#eef6f8] p-3"><span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#7c9296]">Retour</span><span>{trip.returnDetails}</span></div></div></div>{trip.days.map((day) => (<div key={day.id} className={`overflow-hidden rounded-[24px] border ${openDay === day.id ? "border-[#d7e0e3] bg-white" : "border-transparent bg-[#edf2f3]"}`}><button onClick={() => setOpenDay(openDay === day.id ? 0 : day.id)} className="flex w-full items-center justify-between p-4 text-left"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7c9296]">Jour {day.id}</p><h4 className="mt-1 font-serif text-2xl">{day.title}</h4></div><span className="rounded-full bg-[#f6bb65] px-2.5 py-1 text-xs font-bold text-[#123446]">{dateLabel(day.date)}</span></button>{openDay === day.id && <div className="border-t border-[#e4eaec] p-4 space-y-4"><Field label="Date"><input type="date" value={day.date} onChange={(event) => updateDay(day.id, "date", event.target.value)} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field><Field label="Lieu"><input value={day.location} onChange={(event) => updateDay(day.id, "location", event.target.value)} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field><Field label="Titre"><input value={day.title} onChange={(event) => updateDay(day.id, "title", event.target.value)} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field><Field label="Description"><textarea value={day.description} onChange={(event) => updateDay(day.id, "description", event.target.value)} rows={3} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field><Field label="Détails"><textarea value={day.details} onChange={(event) => updateDay(day.id, "details", event.target.value)} rows={2} className="w-full rounded-xl border border-[#d7e0e3] bg-white p-2.5" /></Field></div>}</div>))}</section></div></main>;
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character)); }
