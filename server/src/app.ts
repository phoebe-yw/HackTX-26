import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import QRCode from "qrcode";
import { Server } from "socket.io";
import {
  addDomain,
  addMessage,
  closeDb,
  createRoom,
  demoMad,
  evaluateRoom,
  joinRoom,
  listRoomCodes,
  openDb,
  petFor,
  readState,
  requireMember,
  sendChallenge,
  setFocus,
  setPresence,
  unlockMember,
  unlockRoom,
} from "./db.ts";
import { loadEnv } from "./env.ts";
import { answerQuestion, makeCards, modelConfigured, seeImage } from "./model.ts";
import { extractMarkdown, scholar, searchConfigured } from "./search.ts";

const BLINK = "I blinked. Try again.";
const BLIND = "I blinked. I have no Gemini key, so I can't tell an egg from anything else.";

function flags() {
  return { modelConfigured: modelConfigured(), searchConfigured: searchConfigured() };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createApp() {
  loadEnv();
  openDb();
  const app = Fastify({ logger: true });
  app.log.info({ model: process.env.MODEL_ID || "gemini-3.5-flash-lite" }, "gemini model");
  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } });

  const io = new Server(app.server, { cors: { origin: true } });
  const publish = (code: string) => {
    const state = readState(code, flags());
    if (state) io.to(state.room.code).emit("state", state);
    return state;
  };

  io.on("connection", (socket) => {
    socket.on("join", (code: unknown) => {
      if (typeof code !== "string") return;
      const state = readState(code, flags());
      if (!state) return;
      socket.join(state.room.code);
      socket.emit("state", state);
    });
  });

  const timer = setInterval(() => {
    for (const code of listRoomCodes()) {
      if (evaluateRoom(code)) publish(code);
    }
  }, 1000);
  app.addHook("onClose", async () => {
    clearInterval(timer);
    closeDb();
  });

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/rooms/:code/qr", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const state = readState(code, flags());
    if (!state) return reply.code(404).send({ error: "missing_room" });
    let target: URL;
    try {
      target = new URL(text((request.query as { target?: unknown }).target));
    } catch {
      return reply.code(400).send({ error: "bad_target" });
    }
    const pathName = target.pathname.replace(/\/+$/, "");
    if (!/^https?:$/.test(target.protocol) || pathName !== `/room/${state.room.code}`) {
      return reply.code(400).send({ error: "bad_target" });
    }
    const png = await QRCode.toBuffer(`${target.origin}/room/${state.room.code}`, {
      margin: 1,
      width: 280,
      errorCorrectionLevel: "M",
    });
    return reply.type("image/png").send(png);
  });

  app.post("/api/rooms", async () => {
    const code = createRoom();
    return { code, state: publish(code) };
  });

  app.get("/api/rooms/:code/state", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    if (evaluateRoom(code)) publish(code);
    const state = readState(code, flags());
    if (!state) return reply.code(404).send({ error: "missing_room" });
    return { state };
  });

  app.post("/api/rooms/:code/join", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const body = (request.body ?? {}) as { name?: unknown; deviceLabel?: unknown };
    const memberId = joinRoom(code, text(body.name), text(body.deviceLabel));
    if (!memberId) return reply.code(400).send({ error: "bad_join" });
    return { memberId, state: publish(code) };
  });

  app.post("/api/rooms/:code/presence", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const body = (request.body ?? {}) as { memberId?: unknown; hostname?: unknown };
    const memberId = text(body.memberId);
    const changed = setPresence(code, memberId, text(body.hostname));
    if (!requireMember(code, memberId)) return reply.code(404).send({ error: "missing_member" });
    if (changed) publish(code);
    return { ok: true };
  });

  app.post("/api/rooms/:code/demo-mad", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const memberId = text((request.body as { memberId?: unknown } | undefined)?.memberId);
    if (!demoMad(code, memberId)) return reply.code(404).send({ error: "missing_member" });
    return { state: publish(code) };
  });

  app.post("/api/rooms/:code/focus", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const body = (request.body ?? {}) as { memberId?: unknown; goal?: unknown; sites?: unknown };
    const sites = Array.isArray(body.sites) ? body.sites.join(",") : text(body.sites);
    const result = setFocus(code, text(body.memberId), text(body.goal), sites);
    if (result.error) return reply.code(result.error === "missing_member" ? 404 : 400).send({ error: result.error });
    return { state: publish(code) };
  });

  app.post("/api/rooms/:code/domains", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const domain = text((request.body as { domain?: unknown } | undefined)?.domain);
    const result = addDomain(code, domain);
    if (result.error) return reply.code(400).send({ error: result.error });
    return { state: publish(code) };
  });

  app.post("/api/rooms/:code/challenge", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const body = (request.body ?? {}) as { fromMemberId?: unknown; toMemberId?: unknown; prompt?: unknown };
    const ok = sendChallenge(code, text(body.fromMemberId), text(body.toMemberId), text(body.prompt));
    if (!ok) return reply.code(400).send({ error: "bad_challenge" });
    return { state: publish(code) };
  });

  app.post("/api/rooms/:code/unlock", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const memberId = text((request.body as { memberId?: unknown } | undefined)?.memberId);
    const result = unlockRoom(code, memberId);
    if (result.error) return reply.code(result.error === "not_host" ? 403 : 404).send({ error: result.error });
    return { state: publish(code) };
  });

  app.post("/api/rooms/:code/ask", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const body = (request.body ?? {}) as { memberId?: unknown; question?: unknown };
    const found = requireMember(code, text(body.memberId));
    const question = text(body.question).slice(0, 500);
    if (!found || !question) return reply.code(400).send({ error: "bad_question" });
    addMessage(found.room.id, found.member.name, "chat", question, null);
    if (!searchConfigured()) {
      addMessage(found.room.id, "Eggward", "answer", "I won't invent a citation. Add a SerpApi key.", null);
    } else {
      try {
        const sources = await scholar(question);
        if (sources.length === 0) {
          addMessage(found.room.id, "Eggward", "answer", "I looked and found nothing I trust. Try a sharper question.", null);
        } else if (!modelConfigured()) {
          addMessage(found.room.id, "Eggward", "answer", "I found sources, but my voice is off until you add a Gemini key.", { sources });
        } else {
          const answer = await answerQuestion(question, sources);
          addMessage(found.room.id, "Eggward", "answer", answer, { sources });
        }
      } catch (error) {
        app.log.error({ err: error instanceof Error ? error.message : "ask_failed" }, "ask failed");
        addMessage(found.room.id, "Eggward", "answer", BLINK, null);
      }
    }
    return { state: publish(code) };
  });

  app.post("/api/rooms/:code/flashcards", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const body = (request.body ?? {}) as { memberId?: unknown; url?: unknown };
    const found = requireMember(code, text(body.memberId));
    const pageUrl = text(body.url);
    if (!found || !/^https?:\/\//i.test(pageUrl)) return reply.code(400).send({ error: "bad_url" });
    if (!searchConfigured()) {
      addMessage(found.room.id, "Eggward", "flashcard", "I won't invent flashcards. Add a SerpApi key.", null);
    } else {
      try {
        const markdown = await extractMarkdown(pageUrl);
        if (!markdown) {
          addMessage(found.room.id, "Eggward", "flashcard", "I couldn't read that page.", null);
        } else if (!modelConfigured()) {
          addMessage(found.room.id, "Eggward", "flashcard", "I read the page, but my voice is off until you add a Gemini key.", null);
        } else {
          const cards = await makeCards(markdown);
          addMessage(found.room.id, "Eggward", "flashcard", pageUrl, { cards });
        }
      } catch (error) {
        app.log.error({ err: error instanceof Error ? error.message : "cards_failed" }, "flashcards failed");
        addMessage(found.room.id, "Eggward", "flashcard", "I read the page and then forgot my cards. Try again.", null);
      }
    }
    return { state: publish(code) };
  });

  app.post("/api/rooms/:code/see", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const memberId = text((request.query as { memberId?: unknown }).memberId);
    const found = requireMember(code, memberId);
    const pet = found ? petFor(memberId) : null;
    if (!found || !pet?.locked) return reply.code(400).send({ error: "not_locked", line: "You are not locked." });
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "missing_image", line: BLINK });
    const bytes = await file.toBuffer();
    const challenge = pet.challengeText || "Show me an egg.";
    if (!modelConfigured()) {
      return { match: false, line: BLIND, reason: "missing_key", state: readState(code, flags()) };
    }
    try {
      const result = await seeImage(bytes, challenge);
      if (result.match) unlockMember(code, memberId, result.line);
      else addMessage(found.room.id, "Eggward", "system", result.line, null);
      return {
        match: result.match,
        line: result.line,
        reason: result.match ? "yes" : "no",
        state: publish(code),
      };
    } catch (error) {
      app.log.error({ err: error instanceof Error ? error.message : "see_failed" }, "vision failed");
      return { match: false, line: BLINK, reason: "model_error", state: readState(code, flags()) };
    }
  });

  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "web", "dist");
  if (fs.existsSync(dist)) {
    await app.register(fastifyStatic, { root: dist });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api") || request.url.startsWith("/socket.io")) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}
