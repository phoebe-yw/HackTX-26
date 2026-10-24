import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import QRCode from "qrcode";
import { io } from "socket.io-client";
import {
  addDomain,
  ask,
  challenge,
  createRoom,
  demoMad,
  flashcards,
  getState,
  joinRoom,
  see,
  setFocus,
  unlock,
} from "./api";
import { Egg } from "./Egg";
import type { Pet, RoomState } from "./types";

function roomCodeFromPath() {
  const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9]+)/);
  return match?.[1]?.toUpperCase() ?? "";
}

function sessionKey(code: string) {
  return `eggward:${code}`;
}

function headlineFor(challenge: string | null) {
  if (!challenge || /egg/i.test(challenge)) return "The economy is crashing and you are broke. Show me an egg.";
  return "I did not want it to come to this.";
}

export function App() {
  const [code, setCode] = useState(roomCodeFromPath);
  if (!code) return <Home onOpen={setCode} />;
  return <Room code={code} onLeave={() => setCode("")} />;
}

function Home({ onOpen }: { onOpen: (code: string) => void }) {
  const [joinCode, setJoinCode] = useState("EGG1");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function go(next: string) {
    const code = next.trim().toUpperCase();
    window.history.pushState({}, "", `/room/${code}`);
    onOpen(code);
  }

  return (
    <main className="shell">
      <section className="hero card">
        <Egg mood="sideeye" />
        <div>
          <p className="eyebrow">Study pet, bad influence on procrastination</p>
          <h1>Eggward</h1>
          <p className="lede">
            The buddy lives in the Chrome extension, bottom left of your tabs. This page is the phone room: camera, chat, and the code your friends scan.
          </p>
          <div className="row">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const created = await createRoom();
                  go(created.code);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not create a room");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Start a room
            </button>
            <form
              className="row"
              onSubmit={(event) => {
                event.preventDefault();
                if (joinCode.trim()) go(joinCode);
              }}
            >
              <input aria-label="Room code" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} />
              <button className="ghost" type="submit">
                Join
              </button>
            </form>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      </section>
    </main>
  );
}

function Room({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [memberId, setMemberId] = useState(() => sessionStorage.getItem(sessionKey(code)) ?? "");
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  const [showQr, setShowQr] = useState(false);
  const link = `${window.location.origin}/room/${code}`;

  useEffect(() => {
    let stop = false;
    const pull = async () => {
      try {
        const next = await getState(code);
        if (!stop) setState(next.state);
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : "Room not found");
      }
    };
    void pull();
    const timer = window.setInterval(() => void pull(), 1000);
    const socket = io();
    socket.emit("join", code);
    socket.on("state", (next: RoomState) => {
      if (!stop) setState(next);
    });
    return () => {
      stop = true;
      window.clearInterval(timer);
      socket.close();
    };
  }, [code]);

  useEffect(() => {
    let cancel = false;
    QRCode.toDataURL(link, { margin: 1, width: 280 }).then((url) => {
      if (!cancel) setQr(url);
    });
    return () => {
      cancel = true;
    };
  }, [link]);

  function claim(id: string) {
    sessionStorage.setItem(sessionKey(code), id);
    setMemberId(id);
  }

  if (!state) {
    return (
      <main className="shell">
        <section className="card">
          <h1>Looking for {code}</h1>
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  if (!memberId || !state.members.some((member) => member.id === memberId)) {
    return <NameGate code={code} state={state} onClaim={claim} />;
  }

  return (
    <RoomDesk
      code={code}
      link={link}
      qr={qr}
      showQr={showQr}
      setShowQr={setShowQr}
      state={state}
      setState={setState}
      memberId={memberId}
      onLeave={() => {
        sessionStorage.removeItem(sessionKey(code));
        setMemberId("");
        onLeave();
        window.history.pushState({}, "", "/");
      }}
      onSwitch={() => {
        sessionStorage.removeItem(sessionKey(code));
        setMemberId("");
      }}
    />
  );
}

function NameGate({ code, state, onClaim }: { code: string; state: RoomState; onClaim: (id: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function join(nextName: string) {
    setError("");
    try {
      const result = await joinRoom(code, nextName, /Mobi|iPhone|iPad|Android/i.test(navigator.userAgent) ? "phone" : "browser");
      onClaim(result.memberId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    }
  }

  return (
    <main className="shell narrow">
      <section className="card">
        <Egg mood="fine" />
        <h1>Who's sitting down?</h1>
        <p>Room {code}. Pick a seeded person or use your own name. The room code is the only password.</p>
        <div className="row wrap">
          {state.members.map((member) => (
            <button key={member.id} className="ghost" onClick={() => void join(member.name)}>
              Continue as {member.name}
            </button>
          ))}
        </div>
        <form
          className="row"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) void join(name);
          }}
        >
          <input aria-label="Your name" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
          <button type="submit">Join</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}

function RoomDesk({
  code,
  link,
  qr,
  showQr,
  setShowQr,
  state,
  setState,
  memberId,
  onLeave,
  onSwitch,
}: {
  code: string;
  link: string;
  qr: string;
  showQr: boolean;
  setShowQr: (show: boolean) => void;
  state: RoomState;
  setState: (state: RoomState) => void;
  memberId: string;
  onLeave: () => void;
  onSwitch: () => void;
}) {
  const me = state.members.find((member) => member.id === memberId);
  const myPet = state.pets.find((pet) => pet.memberId === memberId);
  const [question, setQuestion] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [goal, setGoal] = useState("");
  const [sites, setSites] = useState("");
  const [prompt, setPrompt] = useState("Show me an egg.");
  const [targetId, setTargetId] = useState(state.members.find((member) => member.id !== memberId)?.id ?? memberId);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const othersLocked = state.pets.filter((pet) => pet.locked && pet.memberId !== memberId);

  useEffect(() => {
    return () => {
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const targetName = state.members.find((member) => member.id === targetId)?.name ?? "them";
  const myFocus = state.focus?.find((item) => item.memberId === memberId);

  async function run(action: () => Promise<{ state: RoomState }>) {
    setBusy(true);
    setNote("");
    try {
      const result = await action();
      setState(result.state);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="top">
        <div className="brand">
          <Egg mood={myPet?.mood ?? "fine"} />
          <div>
            <p className="eyebrow">Room {code}</p>
            <h1>Eggward</h1>
            <p>
              You are <strong>{me?.name}</strong>
              {me?.isHost ? " · host" : ""}
            </p>
          </div>
        </div>
        <div className="row wrap">
          <button className="ghost" onClick={() => setShowQr(!showQr)}>
            {showQr ? "Hide QR" : "Show QR"}
          </button>
          <button className="ghost" onClick={onSwitch}>
            Switch person
          </button>
          <button className="ghost" onClick={onLeave}>
            Leave
          </button>
        </div>
      </header>

      {!state.modelConfigured || !state.searchConfigured ? (
        <p className="banner">
          Eggward can still glare.
          {!state.searchConfigured && " He will not invent a citation until SERPAPI_KEY is set."}
          {!state.modelConfigured && " He cannot see or talk until GEMINI_API_KEY is set."} Restart the server after you edit .env.
        </p>
      ) : null}

      {othersLocked.map((pet) => {
        const name = state.members.find((member) => member.id === pet.memberId)?.name ?? "Someone";
        return (
          <p className="banner mad" key={pet.memberId}>
            {name} is locked until they show {pet.challengeText ?? "an egg"}.
          </p>
        );
      })}

      {showQr && (
        <section className="card qr">
          <img src={qr} alt={`QR code for room ${code}`} />
          <p>{link}</p>
        </section>
      )}

      <div className="layout">
        <section className="stack">
          {myPet?.locked && (
            <LockPanel
              pet={myPet}
              busy={busy}
              cameraOn={cameraOn}
              videoRef={videoRef}
              note={note}
              canSee={state.modelConfigured}
              onCamera={async () => {
                const attempts = [{ video: { facingMode: "environment" }, audio: false }, { video: true, audio: false }];
                for (const constraints of attempts) {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    if (videoRef.current) videoRef.current.srcObject = stream;
                    setCameraOn(true);
                    return;
                  } catch {
                    /* the laptop often has no rear camera; try the built-in webcam next */
                  }
                }
                setNote("Camera permission failed. Allow it and try again.");
              }}
              onCapture={async () => {
                const video = videoRef.current;
                if (!video || !video.videoWidth) return;
                const scale = Math.min(1, 800 / video.videoWidth);
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(video.videoWidth * scale);
                canvas.height = Math.round(video.videoHeight * scale);
                canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
                const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
                if (!blob) return;
                setBusy(true);
                try {
                  const result = await see(code, memberId, blob);
                  setState(result.state);
                  setNote(result.line);
                } catch (err) {
                  setNote(err instanceof Error ? err.message : "I blinked. Try again.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}

          <section className="card">
            <h2>Study together</h2>
            <form
              className="stack tight"
              onSubmit={(event) => {
                event.preventDefault();
                const value = question.trim();
                if (!value) return;
                setQuestion("");
                void run(() => ask(code, memberId, value));
              }}
            >
              <label>
                Ask the room
                <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What is a hash table?" />
              </label>
              <button disabled={busy} type="submit">
                Ask Eggward
              </button>
            </form>
            <form
              className="stack tight"
              onSubmit={(event) => {
                event.preventDefault();
                if (!pageUrl.trim()) return;
                const url = pageUrl.trim();
                setPageUrl("");
                void run(() => flashcards(code, memberId, url));
              }}
            >
              <label>
                Make 3 flashcards from a link
                <input value={pageUrl} onChange={(event) => setPageUrl(event.target.value)} placeholder="https://..." />
              </label>
              <button className="ghost" disabled={busy} type="submit">
                Pull the page
              </button>
            </form>
            <div className="chat" aria-live="polite">
              {state.messages.map((message) => (
                <article key={message.id} className={`bubble kind-${message.kind}`}>
                  <p className="who">{message.author}</p>
                  <p>{message.body}</p>
                  {message.sources && (
                    <ul>
                      {message.sources.map((source) => (
                        <li key={source.link}>
                          <a href={source.link} target="_blank" rel="noreferrer">
                            {source.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {message.cards && (
                    <ol className="cards">
                      {message.cards.map((card) => (
                        <li key={card.q}>
                          <strong>{card.q}</strong>
                          <span>{card.a}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className="stack">
          <section className="card">
            <h2>Send a challenge</h2>
            <label>
              Who drifts
              <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                {state.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="row wrap">
              <button className="ghost" disabled={busy} onClick={() => void run(() => challenge(code, memberId, targetId, "Show me an egg."))}>
                Egg
              </button>
              <button className="ghost" disabled={busy} onClick={() => void run(() => challenge(code, memberId, targetId, "your shoe"))}>
                Shoe
              </button>
            </div>
            <form
              className="row"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => challenge(code, memberId, targetId, prompt));
              }}
            >
              <input aria-label={`Challenge for ${targetName}`} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              <button disabled={busy} type="submit">
                Send
              </button>
            </form>
          </section>

          <section className="card">
            <h2>What you're working on</h2>
            <p className="fine">
              {myFocus?.sites.length
                ? `Stay on ${myFocus.sites.join(", ")}.${myFocus.goal ? ` Goal: ${myFocus.goal}.` : ""} Anywhere else starts the mad timer.`
                : "No work sites yet. Until you set one, only the block list makes Eggward mad."}
            </p>
            <form
              className="stack tight"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  try {
                    return await setFocus(code, memberId, goal, sites);
                  } catch (err) {
                    if (err instanceof Error && err.message === "bad_domain") {
                      throw new Error("That site looks wrong. Use a domain like docs.google.com.");
                    }
                    throw err;
                  }
                });
              }}
            >
              <label>
                Assignment
                <input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="turn in the essay" maxLength={80} />
              </label>
              <label>
                Work sites
                <input value={sites} onChange={(event) => setSites(event.target.value)} placeholder="docs.google.com, wikipedia.org" />
              </label>
              <div className="row wrap">
                <button disabled={busy} type="submit">
                  Save work
                </button>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => setSites((current) => (current.includes("instructure.com") ? current : current.trim() ? `${current.trim()}, instructure.com` : "instructure.com"))}
                >
                  Add Canvas
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>This browser</h2>
            <button className="danger" disabled={busy} onClick={() => void run(() => demoMad(code, memberId))}>
              Demo: get mad
            </button>
            {me?.isHost && (
              <button className="ghost" disabled={busy} onClick={() => void run(() => unlock(code, memberId))}>
                Host override
              </button>
            )}
            <form
              className="row"
              onSubmit={(event) => {
                event.preventDefault();
                if (!domain.trim()) return;
                const value = domain;
                setDomain("");
                void run(() => addDomain(code, value));
              }}
            >
              <input aria-label="Block a domain" placeholder="tiktok.com" value={domain} onChange={(event) => setDomain(event.target.value)} />
              <button className="ghost" type="submit">
                Block
              </button>
            </form>
            <p className="fine">Blocked: {state.blocklist.join(", ")}</p>
            <MemberList state={state} />
          </section>
          {note && !myPet?.locked && <p className="error">{note}</p>}
        </aside>
      </div>
    </main>
  );
}

function LockPanel({
  pet,
  busy,
  cameraOn,
  videoRef,
  note,
  canSee,
  onCamera,
  onCapture,
}: {
  pet: Pet;
  busy: boolean;
  cameraOn: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  note: string;
  canSee: boolean;
  onCamera: () => Promise<void>;
  onCapture: () => Promise<void>;
}) {
  const headline = headlineFor(pet.challengeText);
  const requirement = pet.challengeText ?? "Show me an egg.";
  const cameraError = useMemo(() => note, [note]);
  return (
    <section className="card lock">
      <Egg mood="mad" />
      <div>
        <p className="eyebrow">You are locked</p>
        <h2>{headline}</h2>
        {!headline.toLowerCase().includes(requirement.toLowerCase()) && <p className="requirement">{requirement}</p>}
        <p>This photo is sent to the model for the check. Our server does not keep it.</p>
        {!canSee && (
          <p className="error">
            I can't see yet. Put GEMINI_API_KEY in .env and restart the server. Until then every photo, egg or not, stays locked.
          </p>
        )}
        <video ref={videoRef} autoPlay playsInline muted hidden={!cameraOn} />
        <div className="row wrap">
          {!cameraOn && (
            <button
              onClick={() => {
                void onCamera().catch(() => undefined);
              }}
            >
              Open camera
            </button>
          )}
          {cameraOn && (
            <button className="danger" disabled={busy} onClick={() => void onCapture()}>
              Check this
            </button>
          )}
        </div>
        {cameraError && <p className="error">{cameraError}</p>}
      </div>
    </section>
  );
}

function MemberList({ state }: { state: RoomState }) {
  return (
    <ul className="members">
      {state.members.map((member) => {
        const pet = state.pets.find((item) => item.memberId === member.id);
        return (
          <li key={member.id}>
            <span>{member.name}</span>
            <span>{pet?.locked ? "locked" : pet?.mood ?? "fine"}</span>
          </li>
        );
      })}
    </ul>
  );
}
