"use client";
import { useEffect, useRef, useState } from "react";
import {
  Flag,
  Globe2,
  Map,
  Compass,
  ArrowUpRight,
  ArrowLeft,
  BookOpen,
  UserRound,
  Heart,
  Trophy,
  Check,
  Search,
  ChevronRight,
  Flame,
  Cloud,
  ShieldCheck,
  X,
  Sparkles,
  Landmark,
  MapPinned,
  Route,
} from "lucide-react";
import WorldMap from "@/components/world-map";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  countries,
  byId,
  continents,
  modeNames,
  skillNames,
  contentVersion,
  type Mode,
  type Skill,
  type Country,
} from "@/lib/content";
import {
  emptyStore,
  createGame,
  submit,
  advance,
  correction,
  completed,
  retry,
  streak,
  type Store,
} from "@/lib/game";
import { load, save, localDay, STORAGE_KEY } from "@/lib/persistence";
import { normalize, validate } from "@/lib/validation";
import { cloud, uploadProgress, downloadProgress } from "@/lib/sync";

function ModeMark({ kind }: { kind: "flag" | "capital" | "map" | "expedition" }) {
  if (kind === "flag") return <span className="mode-mark flag-mark"><Flag /><Sparkles className="mark-spark" /></span>;
  if (kind === "capital") return <span className="mode-mark capital-mark"><Landmark /><Sparkles className="mark-spark" /></span>;
  if (kind === "map") return <span className="mode-mark map-mark"><MapPinned /><span className="map-dot" /></span>;
  return <span className="mode-mark expedition-mark"><Route /><Sparkles className="mark-spark" /></span>;
}
const modes = [
  {
    id: "flag",
    name: "Banderas",
    text: "Un símbolo, mil historias. ¿De qué país es?",
    icon: "flag",
    color: "mint",
  },
  {
    id: "capital",
    name: "Capitales",
    text: "Conecta cada país con su capital.",
    icon: "capital",
    color: "blue",
  },
  {
    id: "map",
    name: "Mapa",
    text: "Encuentra tu lugar en el mundo.",
    icon: "map",
    color: "peach",
  },
  {
    id: "expedition",
    name: "Expedición",
    text: "Banderas, capitales y mapa. El reto completo.",
    icon: "expedition",
    color: "night",
  },
] as const;
function flag(c: Country, hidden = false) {
  return (
    <img
      className="country-flag"
      src={`/flags/${c.code.toLowerCase()}.svg`}
      alt={
        hidden
          ? "Bandera del país que debes identificar"
          : `Bandera de ${c.name}`
      }
      draggable={false}
    />
  );
}
function choices(id: string, skill: Skill, seed: number) {
  const correct = byId[id],
    key = skill === "capital" ? "capital" : "name";
  let options = countries.filter((c) => c.id !== id && c[key] !== correct[key]);
  options.sort(
    (a, b) =>
      (a.continent === correct.continent ? 0 : 1) -
        (b.continent === correct.continent ? 0 : 1) ||
      hash(a.id + seed) - hash(b.id + seed),
  );
  const seen = new Set([normalize(correct[key])]);
  const picked = [correct];
  for (const c of options) {
    if (!seen.has(normalize(c[key]))) {
      picked.push(c);
      seen.add(normalize(c[key]));
    }
    if (picked.length === 4) break;
  }
  return picked.sort(
    (a, b) => hash(a.id + (seed + 7)) - hash(b.id + (seed + 7)),
  );
}
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++)
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
export default function Home() {
  const [screen, setScreen] = useState("home"),
    [store, setStore] = useState<Store>(emptyStore),
    ref = useRef(store),
    [loaded, setLoaded] = useState(false),
    [notice, setNotice] = useState(""),
    [storageError, setStorageError] = useState(false),
    [config, setConfig] = useState<Mode | null>(null),
    [continent, setContinent] = useState("Europa"),
    [difficulty, setDifficulty] = useState<"normal" | "advanced">("normal"),
    [answer, setAnswer] = useState(""),
    [mapSelection, setMapSelection] = useState<string | null>(null),
    [hint, setHint] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("Todo el mundo"),
    [detail, setDetail] = useState<Country | null>(null),
    [email, setEmail] = useState(""),
    [account, setAccount] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [replaceCloud, setReplaceCloud] = useState<"upload" | "download" | null>(
      null,
    );
  function commit(next: Store) {
    if (next === ref.current) return;
    try {
      save(next);
      setStorageError(false);
    } catch {
      setStorageError(true);
      setNotice(
        "No se pudo guardar en este navegador. Exporta tu progreso desde Mi perfil para conservarlo.",
      );
    }
    ref.current = next;
    setStore(next);
  }
  useEffect(() => {
    try {
      const s = load();
      ref.current = s;
      setStore(s);
    } catch (e) {
      setStorageError(true);
      setNotice(
        (e as Error).message +
          " Puedes exportar el guardado original antes de iniciar otra partida.",
      );
    }
    setLoaded(true);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    const listener = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          const s = load();
          ref.current = s;
          setStore(s);
          setAnswer("");
          setMapSelection(null);
          setHint("");
          setNotice("Progreso actualizado desde otra pestaña.");
        } catch {
          setNotice("No se pudo recuperar el cambio de otra pestaña.");
        }
      }
    };
    window.addEventListener("storage", listener);
    const subscription = cloud?.auth.onAuthStateChange((_event, session) =>
      setAccount(session?.user.email ?? null),
    );
    cloud?.auth
      .getSession()
      .then(({ data }) => setAccount(data.session?.user.email ?? null));
    return () => {
      window.removeEventListener("storage", listener);
      subscription?.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "geora_open_study",
          title: "Estudiar países",
          description:
            "Abre el catálogo de países y aplica una búsqueda; no inicia ni altera partidas.",
          inputSchema: {
            type: "object",
            properties: { search: { type: "string" } },
            required: ["search"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: unknown) => {
            if (!input || typeof (input as any).search !== "string")
              throw Error("Se requiere una búsqueda de texto");
            setSearch((input as any).search);
            setScreen("study");
            return { screen: "study", search: (input as any).search };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, []);
  const g = store.game,
    current = g?.feedback?.task ?? g?.queue[0],
    country = current ? byId[current.country] : null,
    skill = current?.skill,
    done = g ? completed(g) : 0,
    total = g?.ids.length ?? 0;
  function navigate(to: string) {
    setScreen(to);
    setHint("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function begin() {
    if (!config) return;
    const ids = countries
      .filter((c) => continent === "Todo el mundo" || c.continent === continent)
      .map((c) => c.id);
    commit({
      ...ref.current,
      game: createGame(ids, config, continent, difficulty, contentVersion),
    });
    setConfig(null);
    setAnswer("");
    setMapSelection(null);
    navigate("game");
  }
  const submitLock = useRef(0);
  function confirm() {
    if (Date.now() - submitLock.current < 400) return;
    submitLock.current = Date.now();
    const state = ref.current,
      game = state.game;
    if (!game || game.feedback || game.status !== "playing") return;
    const task = game.queue[0],
      c = byId[task.country];
    let correct = false;
    if (task.skill === "map") {
      if (!mapSelection) return;
      correct = mapSelection === c.id;
    } else if (game.difficulty === "normal") {
      if (!answer) return;
      correct = answer === c.id;
    } else {
      if (!answer.trim()) return;
      const accepted = task.skill === "flag" ? c.aliases : c.capitalAliases;
      const other = countries
        .filter((x) => x.id !== c.id)
        .flatMap((x) => (task.skill === "flag" ? x.aliases : x.capitalAliases));
      const result = validate(answer, accepted, other, game.correctionUsed);
      if (result === "correction") {
        commit(correction(state, game.sequence));
        setHint(
          "¡Casi! Revisa cómo lo has escrito. Tienes una oportunidad para corregirlo sin perder una vida.",
        );
        return;
      }
      correct = result === "correct";
    }
    const text =
      task.skill === "map"
        ? (byId[mapSelection!]?.name ?? "")
        : game.difficulty === "normal"
          ? ((task.skill === "flag"
              ? byId[answer]?.name
              : byId[answer]?.capital) ?? answer)
          : answer;
    commit(submit(state, game.sequence, correct, text, localDay()));
    setHint("");
  }
  function next() {
    if (!ref.current.game) return;
    commit(advance(ref.current, ref.current.game.sequence));
    setAnswer("");
    setMapSelection(null);
    setHint("");
  }
  function again() {
    commit(retry(ref.current, contentVersion));
    setAnswer("");
    setMapSelection(null);
    setHint("");
    navigate("game");
  }
  function exportSave() {
    const raw = storageError
      ? localStorage.getItem(STORAGE_KEY)
      : JSON.stringify(ref.current, null, 2);
    const url = URL.createObjectURL(
      new Blob([raw ?? "{}"], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "geora-progreso.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function signIn() {
    if (!cloud || !email.includes("@")) return;
    setBusy(true);
    try {
      const { error } = await cloud.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setNotice(
        "Te hemos enviado un enlace para iniciar sesión. Revisa tu correo.",
      );
    } catch (e) {
      setNotice("No se pudo enviar el enlace: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    const action = replaceCloud;
    if (!action) return;
    setBusy(true);
    try {
      if (action === "upload") await uploadProgress(ref.current);
      else commit(await downloadProgress());
      setNotice(
        action === "upload"
          ? "Progreso guardado en tu cuenta."
          : "Progreso recuperado desde tu cuenta.",
      );
      setReplaceCloud(null);
    } catch (e) {
      setNotice("No se pudo sincronizar: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = countries.filter(
    (c) =>
      (filter === "Todo el mundo" || c.continent === filter) &&
      normalize(c.name + " " + c.capital + " " + c.aliases.join(" ")).includes(
        normalize(search),
      ),
  );
  return (
    <>
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
          aria-label="Geora, inicio"
        >
          <img src="/geora.svg" alt="" />
          geora<span>EL MUNDO TE ESPERA</span>
        </a>
        <nav aria-label="Navegación principal">
          <button
            className={screen === "home" || screen === "game" ? "active" : ""}
            onClick={() => navigate("home")}
          >
            Jugar
          </button>
          <button
            className={screen === "study" ? "active" : ""}
            onClick={() => navigate("study")}
          >
            <BookOpen size={17} />
            Estudiar
          </button>
          <button
            className={screen === "profile" ? "active" : ""}
            onClick={() => navigate("profile")}
          >
            <UserRound size={17} />
            Mi perfil
          </button>
        </nav>
        <span className="guest">
          {account ? "Cuenta conectada" : "Modo invitado"}
        </span>
      </header>
      <main>
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Cerrar aviso">
              <X size={18} />
            </button>
          </div>
        )}
        {screen === "home" && (
          <>
            <div className="intro">
              <div>
                <p className="eyebrow">TU PRÓXIMA AVENTURA EMPIEZA AQUÍ</p>
                <h1>
                  El mundo es grande.
                  <br />
                  <span>Tu curiosidad, más.</span>
                </h1>
                <p>
                  Descubre el mundo, país a país. Elige un reto y empieza a
                  explorar.
                </p>
              </div>
              <div className="passport">
                <Compass size={52} />
                <small>PASAPORTE DE EXPLORADOR</small>
                <strong>
                  195 países.
                  <br />
                  Infinitas historias.
                </strong>
              </div>
            </div>
            {!loaded ? (
              <p role="status">Recuperando tu pasaporte…</p>
            ) : (
              g?.status === "playing" && (
                <div className="resume">
                  <div>
                    <strong>Tu aventura sigue aquí</strong>
                    <span>
                      {modeNames[g.mode]} · {g.continent} · {done} de {total}{" "}
                      países · {g.lives} vidas
                    </span>
                  </div>
                  <button className="primary" onClick={() => navigate("game")}>
                    Continuar partida <ChevronRight size={18} />
                  </button>
                </div>
              )
            )}
            <div className="section-title">
              <h2>¿Cómo quieres explorar?</h2>
              <span>Cuatro maneras de descubrir el mundo</span>
            </div>
            <div className="modes">
              {modes.map((m, i) => (
                <button
                  disabled={!loaded}
                  onClick={() => setConfig(m.id)}
                  className={"mode " + m.color}
                  key={m.name}
                >
                  <div className="mode-top">
                    <ModeMark kind={m.icon} />
                    <span>0{i + 1}</span>
                  </div>
                  <h2>{m.name}</h2>
                  <p>{m.text}</p>
                  <div className="mode-bottom">
                    <span>
                      {i === 3 ? "6 VIDAS · 3 ETAPAS" : "3 VIDAS · A TU RITMO"}
                    </span>
                    <ArrowUpRight />
                  </div>
                </button>
              ))}
            </div>
            <div className="study-banner">
              <div>
                <BookOpen />
                <h3>Primero descubrir. Después conquistar.</h3>
                <p>
                  Explora las banderas, capitales y ubicaciones antes de
                  ponerlas a prueba.
                </p>
              </div>
              <button onClick={() => navigate("study")}>
                Explorar países <ArrowUpRight size={18} />
              </button>
            </div>
          </>
        )}
        {screen === "game" && g && (
          <>
            <div className="game-top">
              <button className="text-button" onClick={() => navigate("home")}>
                <ArrowLeft size={17} />
                Guardar y salir
              </button>
              <span>
                {modeNames[g.mode]} · {g.continent}
              </span>
              <div className="lives" aria-label={`${g.lives} vidas restantes`}>
                <Heart size={20} fill="currentColor" />
                {g.lives} <small>vidas</small>
              </div>
            </div>
            <div className="progress-caption">
              <strong>
                {done} de {total} países completados
              </strong>
              <span>{Math.round((done / total) * 100)} %</span>
            </div>
            <Progress
              value={(done / total) * 100}
              aria-label="Países completados"
            />
            {g.status !== "playing" ? (
              <section
                className={"result " + (g.status === "won" ? "victory" : "")}
              >
                <div className="result-icon">
                  {g.status === "won" ? (
                    <Trophy size={46} />
                  ) : (
                    <Compass size={46} />
                  )}
                </div>
                <p className="eyebrow">
                  {g.status === "won"
                    ? "EXPEDICIÓN COMPLETADA"
                    : "CADA INTENTO TE LLEVA MÁS LEJOS"}
                </p>
                <h1>
                  {g.status === "won"
                    ? "¡El mundo es un poco más tuyo!"
                    : "El viaje continúa aprendiendo."}
                </h1>
                <p>
                  {g.status === "won"
                    ? "Has completado todos los países del reto."
                    : "Te has quedado sin vidas. Ya sabes un poco más que al empezar."}
                </p>
                <div className="result-stats">
                  <div>
                    <strong>
                      {done} / {total}
                    </strong>
                    <span>países completados</span>
                  </div>
                  <div>
                    <strong>{g.errors.length}</strong>
                    <span>respuestas por repasar</span>
                  </div>
                </div>
                {g.feedback?.task.skill === "map" && (
                  <WorldMap
                    selected={null}
                    onSelect={() => {}}
                    reveal={g.feedback.task.country}
                    disabled
                  />
                )}
                <div className="actions">
                  <button className="primary" onClick={again}>
                    Volver a intentarlo
                  </button>
                  <button
                    className="secondary"
                    onClick={() => navigate("home")}
                  >
                    Elegir otro reto
                  </button>
                </div>
                {g.errors.length > 0 && (
                  <div className="error-review">
                    <h2>Lo que te llevas de este viaje</h2>
                    {g.errors.map((e, i) => (
                      <div key={i}>
                        <strong>
                          {byId[e.task.country].name} ·{" "}
                          {skillNames[e.task.skill]}
                        </strong>
                        <p>
                          Tu respuesta: {e.answer}. Solución:{" "}
                          {e.task.skill === "capital"
                            ? byId[e.task.country].capital
                            : byId[e.task.country].name}
                          .
                        </p>
                        {e.task.skill === "capital" &&
                          byId[e.task.country].note && (
                            <p>{byId[e.task.country].note}</p>
                          )}
                        <button
                          className="text-button"
                          onClick={() => setDetail(byId[e.task.country])}
                        >
                          Repasar país
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              country && (
                <section
                  className="game-card"
                  key={g.sequence + (g.feedback ? "feedback" : "question")}
                >
                  {g.mode === "expedition" && (
                    <div className="stages">
                      {(["flag", "capital", "map"] as Skill[]).map((s, i) => (
                        <span
                          key={s}
                          className={
                            (g.passed[country.id] ?? []).includes(s)
                              ? "passed"
                              : skill === s
                                ? "current"
                                : ""
                          }
                        >
                          {(g.passed[country.id] ?? []).includes(s) ? (
                            <Check size={14} />
                          ) : (
                            i + 1
                          )}{" "}
                          {skillNames[s]}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="eyebrow">
                    {g.difficulty === "advanced" && skill !== "map"
                      ? "ESCRIBE TU RESPUESTA"
                      : "EXPLORA · RECUERDA · DESCUBRE"}
                  </p>
                  <h1 className="question-title">
                    {skill === "flag"
                      ? "¿A qué país pertenece esta bandera?"
                      : skill === "capital"
                        ? `¿Cuál es ${country.id === "NRU" ? "la sede del Gobierno" : country.id === "PSE" ? "la sede administrativa" : country.id === "IDN" ? "la capital anterior a Nusantara" : "la capital"} de ${country.name}?`
                        : `¿Dónde está ${country.name}?`}
                  </h1>
                  {skill === "capital" && country.note && (
                    <p className="capital-note">{country.note}</p>
                  )}
                  {skill !== "map" ? (
                    <div
                      className={
                        "flag-stage " +
                        (skill === "capital" ? "compact-flag" : "")
                      }
                    >
                      {flag(country, skill === "flag" && !g.feedback)}
                    </div>
                  ) : (
                    <div className="map-country">
                      {flag(country)}
                      <span>
                        Selecciona su ubicación y confirma cuando estés listo.
                      </span>
                    </div>
                  )}
                  {skill === "map" ? (
                    <WorldMap
                      selected={mapSelection}
                      onSelect={setMapSelection}
                      disabled={!!g.feedback}
                      reveal={g.feedback ? country.id : undefined}
                    />
                  ) : g.difficulty === "normal" ? (
                    <RadioGroup
                      aria-label="Opciones de respuesta"
                      className="answers"
                      value={answer}
                      onValueChange={setAnswer}
                      disabled={!!g.feedback}
                    >
                      {choices(
                        country.id,
                        skill!,
                        hash(g.id) + g.sequence - (g.feedback ? 1 : 0),
                      ).map((c, i) => (
                        <label
                          key={c.id}
                          className={
                            "answer " +
                            (answer === c.id ? "chosen " : "") +
                            (g.feedback && country.id === c.id ? "right" : "")
                          }
                        >
                          <RadioGroupItem
                            value={c.id}
                            aria-label={skill === "flag" ? c.name : c.capital}
                          />
                          <span className="option-letter">{"ABCD"[i]}</span>
                          <span>{skill === "flag" ? c.name : c.capital}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        confirm();
                      }}
                      className="written-answer"
                    >
                      <label htmlFor="typed-answer">
                        {skill === "flag"
                          ? "Nombre del país"
                          : "Nombre de la capital"}
                      </label>
                      <input
                        id="typed-answer"
                        autoComplete="off"
                        autoFocus
                        spellCheck={false}
                        disabled={!!g.feedback}
                        placeholder={
                          skill === "flag"
                            ? "Escribe el país…"
                            : "Escribe la capital…"
                        }
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                      />
                    </form>
                  )}
                  {hint && (
                    <p className="correction" role="status">
                      {hint}
                    </p>
                  )}
                  {g.feedback ? (
                    <div
                      className={
                        "feedback " +
                        (g.feedback.correct ? "correct" : "incorrect")
                      }
                      role="status"
                    >
                      <strong>
                        {g.feedback.correct
                          ? "¡Bien encontrado!"
                          : "Una nueva oportunidad para aprender."}
                      </strong>
                      <p>
                        {g.feedback.correct
                          ? "Esta etapa ya es tuya."
                          : `La respuesta es ${skill === "capital" ? country.capital : country.name}. −1 vida. Volverá más adelante.`}
                      </p>
                      {skill === "capital" && country.note && (
                        <small>{country.note}</small>
                      )}
                      <button className="primary" onClick={next}>
                        Continuar <ChevronRight size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="confirm-row">
                      <span>
                        <ShieldCheck size={16} />
                        {storageError
                          ? "Guardado no disponible"
                          : "Tu progreso se guarda automáticamente"}
                      </span>
                      <button
                        className="primary"
                        disabled={
                          skill === "map" ? !mapSelection : !answer.trim()
                        }
                        onClick={confirm}
                      >
                        Confirmar <Check size={17} />
                      </button>
                    </div>
                  )}
                </section>
              )
            )}
          </>
        )}
        {screen === "study" && (
          <>
            <p className="eyebrow">TU ATLAS PERSONAL</p>
            <h1>Conocer es el primer paso.</h1>
            <p className="subheading">
              195 países. Banderas, capitales y lugares por descubrir. Sin vidas
              ni puntuación.
            </p>
            <div className="catalog-tools">
              <label className="search">
                <Search size={19} />
                <input
                  aria-label="Buscar país o capital"
                  placeholder="Busca un país o una capital…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <RadioGroup
              className="continent-filter"
              value={filter}
              onValueChange={setFilter}
              aria-label="Filtrar por continente"
            >
              {continents.map((c) => (
                <label className={filter === c ? "selected" : ""} key={c}>
                  <RadioGroupItem value={c} />
                  {c}
                </label>
              ))}
            </RadioGroup>
            <p className="muted">{filtered.length} países para explorar</p>
            <div className="catalog">
              {filtered.map((c) => (
                <button
                  className="country-card"
                  key={c.id}
                  onClick={() => setDetail(c)}
                >
                  {flag(c)}
                  <h3>{c.name}</h3>
                  <p>{c.capital}</p>
                  <span>
                    {c.continent}
                    <ArrowUpRight size={15} />
                  </span>
                </button>
              ))}
            </div>
            {!filtered.length && (
              <div className="empty">
                <Search size={32} />
                <h2>No encontramos ese lugar</h2>
                <p>Prueba con otro nombre o cambia el continente.</p>
                <button
                  className="secondary"
                  onClick={() => {
                    setSearch("");
                    setFilter("Todo el mundo");
                  }}
                >
                  Ver todos los países
                </button>
              </div>
            )}
          </>
        )}
        {screen === "profile" && (
          <>
            <p className="eyebrow">TU PASAPORTE DE EXPLORADOR</p>
            <h1>Cada país cuenta.</h1>
            <p className="subheading">
              Este es tu aprendizaje histórico. Se conserva al empezar un nuevo
              intento.
            </p>
            <div className="profile-stats">
              <article>
                <Trophy />
                <strong>{store.history.filter((h) => h.won).length}</strong>
                <span>retos completados</span>
              </article>
              <article>
                <Flame />
                <strong>{streak(store.days, localDay())}</strong>
                <span>días de racha</span>
              </article>
              <article>
                <Globe2 />
                <strong>{Object.keys(store.knowledge).length}</strong>
                <span>países practicados</span>
              </article>
            </div>
            <div className="profile-grid">
              <section className="panel">
                <h2>Tu mundo, habilidad a habilidad</h2>
                <p className="muted">
                  Países con al menos un acierto en cada habilidad.
                </p>
                {(["flag", "capital", "map"] as Skill[]).map((s) => {
                  const n = Object.values(store.knowledge).filter(
                    (k) => (k[s]?.correct ?? 0) > 0,
                  ).length;
                  return (
                    <div className="skill-progress" key={s}>
                      <div>
                        <strong>{skillNames[s]}</strong>
                        <span>{n} de 195</span>
                      </div>
                      <Progress
                        value={(n / 195) * 100}
                        aria-label={skillNames[s]}
                      />
                    </div>
                  );
                })}
                <h3 className="achievement-title">Logros</h3>
                <div className="achievements">
                  <span className={store.days.length ? "earned" : ""}>
                    Primer paso
                    <br />
                    <small>Practica un día</small>
                  </span>
                  <span
                    className={store.history.some((h) => h.won) ? "earned" : ""}
                  >
                    Explorador
                    <br />
                    <small>Completa un reto</small>
                  </span>
                  <span
                    className={
                      streak(store.days, localDay()) >= 3 ? "earned" : ""
                    }
                  >
                    Constancia
                    <br />
                    <small>Racha de 3 días</small>
                  </span>
                </div>
              </section>
              <section className="panel">
                <Cloud />
                <h2>Tu progreso, contigo</h2>
                {!cloud ? (
                  <>
                    <p>
                      Juegas como invitado. Tu progreso está guardado en este
                      navegador.
                    </p>
                    <p className="muted">
                      Las cuentas y la sincronización estarán disponibles cuando
                      se configure el servicio. Puedes exportar una copia de
                      seguridad.
                    </p>
                  </>
                ) : account ? (
                  <>
                    <p>Sesión iniciada: {account}</p>
                    <div className="actions">
                      <button
                        className="primary"
                        onClick={() => setReplaceCloud("upload")}
                      >
                        Guardar en mi cuenta
                      </button>
                      <button
                        className="secondary"
                        onClick={() => setReplaceCloud("download")}
                      >
                        Recuperar de mi cuenta
                      </button>
                      <button
                        className="text-button"
                        onClick={() => cloud?.auth.signOut()}
                      >
                        Cerrar sesión
                      </button>
                    </div>
                    <p className="muted">
                      La sincronización es manual: elige qué copia conservar.
                    </p>
                  </>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      signIn();
                    }}
                  >
                    <label htmlFor="email">Tu correo electrónico</label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                    />
                    <button className="primary" disabled={busy}>
                      {busy ? "Enviando…" : "Recibir enlace de acceso"}
                    </button>
                  </form>
                )}
                <button className="text-button" onClick={exportSave}>
                  Exportar copia de seguridad
                </button>
                <label className="text-button import-label">
                  Importar copia
                  <input
                    type="file"
                    accept="application/json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const { parseStore } =
                          await import("@/lib/persistence");
                        const incoming = parseStore(await file.text());
                        if (
                          window.confirm(
                            "¿Reemplazar el progreso de este navegador por la copia seleccionada?",
                          )
                        ) {
                          commit(incoming);
                          setNotice("Copia recuperada.");
                        }
                      } catch {
                        setNotice(
                          "No se puede importar este archivo. Debe ser una copia válida de Geora.",
                        );
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </section>
            </div>
            <section className="panel history">
              <h2>Tus viajes anteriores</h2>
              {!store.history.length ? (
                <p className="muted">
                  Todavía no has terminado ningún reto. Tu primera aventura te
                  espera.
                </p>
              ) : (
                store.history.map((h) => (
                  <div className="history-row" key={h.id}>
                    <span className={h.won ? "win-badge" : "try-badge"}>
                      {h.won ? <Trophy size={18} /> : <Compass size={18} />}
                    </span>
                    <div>
                      <strong>
                        {modeNames[h.mode]} · {h.continent}
                      </strong>
                      <small>
                        {new Date(h.date).toLocaleDateString("es")} · {h.errors}{" "}
                        errores
                      </small>
                    </div>
                    <span>
                      {h.completed} / {h.total}
                      <small>
                        {h.won ? "Completado" : "Intento finalizado"}
                      </small>
                    </span>
                  </div>
                ))
              )}
            </section>
          </>
        )}
        <footer>
          <span>GEORA · HECHO PARA MENTES CURIOSAS</span>
          <button className="text-button" onClick={() => navigate("sources")}>
            Datos y criterios
          </button>
          <span>Sin prisas. Sin fronteras para aprender.</span>
        </footer>
        {screen === "sources" && (
          <section className="panel sources">
            <h1>Un mundo, criterios claros.</h1>
            <p>
              Contenido {contentVersion}: 193 Estados miembros de Naciones
              Unidas y los dos Estados observadores (Santa Sede y Palestina). No
              se incluyen territorios dependientes, Kosovo, Taiwán ni Antártida
              en el juego. Los límites del mapa no expresan una posición sobre
              soberanía.
            </p>
            <p>
              América se trata como un solo continente. Cada país pertenece a
              uno: Rusia a Europa; Turquía, Kazajistán, Armenia, Azerbaiyán,
              Georgia y Chipre a Asia; Egipto a África; Indonesia a Asia. Se
              conserva la clasificación regional de la fuente para los demás
              países.
            </p>
            <p>
              El catálogo explica capitales múltiples, sedes de gobierno y casos
              disputados. Para Indonesia se pregunta expresamente por la capital
              anterior a Nusantara. Guinea Ecuatorial usa Ciudad de la Paz,
              proclamada en enero de 2026.
            </p>
            <ul>
              <li>
                <a href="https://github.com/mledoze/countries">
                  mledoze/countries
                </a>
                : países, coordenadas y nombres. ODbL; base derivada incluida en
                el código y <a href="/data/countries-LICENSE.txt">licencia</a>.
              </li>
              <li>
                <a href="https://github.com/datasets/geo-countries">
                  Natural Earth / geo-countries
                </a>
                : geometrías simplificadas, dominio público (PDDL). Países
                pequeños también disponen de puntos ampliados.
              </li>
              <li>
                <a href="https://github.com/lipis/flag-icons">flag-icons</a>:
                banderas SVG, <a href="/data/flags-LICENSE.txt">licencia MIT</a>
                .
              </li>
              <li>
                <a href="https://www.guineaecuatorialpress.com/index.php/noticias/el_presidente_de_la_republica_proclama_la_ciudad_de_la_paz_como_capital_de_la_republica_de_guinea_ecuatorial_con_la_firma_de_un_decreto_ley">
                  Gobierno de Guinea Ecuatorial
                </a>
                : cambio de capital.
              </li>
            </ul>
            <p>
              Las respuestas no dependen de una API externa. Las variantes
              aceptadas están definidas en la base de contenido. Una solución
              revelada nunca suma un acierto.
            </p>
          </section>
        )}
      </main>
      <Dialog
        open={!!config}
        onOpenChange={(open) => {
          if (!open) setConfig(null);
        }}
      >
        <DialogContent className="setup-dialog" showCloseButton={false}>
          <DialogClose className="dialog-x" aria-label="Cerrar configuración">
            <X size={19} />
          </DialogClose>
          <DialogTitle className="dialog-heading">
            {config ? modeNames[config] : ""}: elige tu destino
          </DialogTitle>
          <DialogDescription>
            Completa todos los países de la región para ganar. Sin límite de
            tiempo.
          </DialogDescription>
          <h3>¿Hasta dónde viajamos?</h3>
          <RadioGroup
            className="region-options"
            value={continent}
            onValueChange={setContinent}
            aria-label="Continente"
          >
            {continents.map((c) => (
              <label className={continent === c ? "selected" : ""} key={c}>
                <RadioGroupItem value={c} />
                <span>
                  {c}
                  <small>
                    {
                      countries.filter(
                        (x) => c === "Todo el mundo" || x.continent === c,
                      ).length
                    }{" "}
                    países
                  </small>
                </span>
              </label>
            ))}
          </RadioGroup>
          {config !== "map" && (
            <>
              <h3>Elige tu dificultad</h3>
              <RadioGroup
                className="difficulty-options"
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as "normal" | "advanced")}
                aria-label="Dificultad"
              >
                <label className={difficulty === "normal" ? "selected" : ""}>
                  <RadioGroupItem value="normal" />
                  <span>
                    Normal<small>Elige entre 4 opciones</small>
                  </span>
                </label>
                <label className={difficulty === "advanced" ? "selected" : ""}>
                  <RadioGroupItem value="advanced" />
                  <span>
                    Avanzada<small>Escribe la respuesta</small>
                  </span>
                </label>
              </RadioGroup>
            </>
          )}
          <div className="setup-summary">
            <Heart size={17} />
            {config === "expedition" ? 6 : 3} vidas<span>·</span>
            {
              countries.filter(
                (c) =>
                  continent === "Todo el mundo" || c.continent === continent,
              ).length
            }{" "}
            países{config === "expedition" ? " · 3 etapas por país" : ""}
          </div>
          {g?.status === "playing" && (
            <p className="warning">
              Al empezar, reemplazarás tu partida pendiente. Tu aprendizaje
              histórico se conserva.
            </p>
          )}
          <button className="primary wide" onClick={begin}>
            Comenzar aventura <ArrowUpRight size={19} />
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="country-dialog" showCloseButton={false}>
          <DialogClose className="dialog-x" aria-label="Cerrar ficha">
            <X size={19} />
          </DialogClose>
          <DialogTitle className="dialog-heading">{detail?.name}</DialogTitle>
          <DialogDescription>
            {detail?.continent} · Atlas de Geora
          </DialogDescription>
          {detail && (
            <>
              {flag(detail)}
              <h3>Capital: {detail.capital}</h3>
              {detail.note && <p>{detail.note}</p>}
              <WorldMap
                selected={detail.id}
                reveal={detail.id}
                onSelect={() => {}}
                disabled
                study
              />
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!replaceCloud}
        onOpenChange={(open) => {
          if (!open) setReplaceCloud(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogTitle>Elige la copia que quieres conservar</DialogTitle>
          <DialogDescription>
            {replaceCloud === "upload"
              ? "La copia de este navegador reemplazará la guardada en tu cuenta."
              : "La copia de tu cuenta reemplazará el progreso de este navegador."}{" "}
            Puedes exportar una copia antes de continuar.
          </DialogDescription>
          <button className="primary" disabled={busy} onClick={sync}>
            {busy ? "Sincronizando…" : "Confirmar sincronización"}
          </button>
          <DialogClose className="secondary">Cancelar</DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}
