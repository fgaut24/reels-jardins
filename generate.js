// generate.js — Génère un Reel MP4 (1080x1920) par soirée listée dans soirees.json
// Usage : node generate.js
// Prérequis : Node 18+, `npm install`, et ffmpeg installé (ex. `brew install ffmpeg`).

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const puppeteer = require("puppeteer");

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, "out");
const TEMPLATE = "file://" + path.join(ROOT, "template.html");

function ffmpegPath() {
  // Utilise ffmpeg du système (PATH). Adaptez si besoin.
  return "ffmpeg";
}

(async () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "soirees.json"), "utf8"));
  const fps = cfg.fps || 30;
  const scale = cfg.scale || 2;             // 2 = capture en 2160x3840 puis réduction (plus net)
  const defaultDuration = cfg.duration || 8; // secondes

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  });

  try {
    for (const s of cfg.soirees) {
      const data = Object.assign({}, cfg.common, s);
      const duration = s.duration || defaultDuration;
      const frames = Math.round(fps * duration);
      const label = s.out || `reel_${s.day}.mp4`;
      console.log(`\n▶ ${label} — ${frames} images (${duration}s @ ${fps}fps)`);

      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: scale });
      await page.goto(TEMPLATE, { waitUntil: "networkidle0" });

      // Données de la soirée
      await page.evaluate((d) => window.applyData(d), data);
      // Police chargée + petit délai de mise en page
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await new Promise((r) => setTimeout(r, 300));
      // Démarre les animations puis les met en pause (capture déterministe)
      await page.evaluate(() => window.startCapture());

      // Dossier temporaire d'images
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));
      for (let i = 0; i < frames; i++) {
        const t = (i / fps) * 1000; // ms
        await page.evaluate((t) => window.seek(t), t);
        const file = path.join(tmp, `f${String(i).padStart(4, "0")}.png`);
        await page.screenshot({ path: file });
        if (i % 30 === 0) process.stdout.write(`  ${i}/${frames}\r`);
      }
      await page.close();

      // Assemblage MP4 (réduction à 1080x1920, compatible Instagram/Facebook)
      const outFile = path.join(OUT_DIR, label);
      execFileSync(
        ffmpegPath(),
        [
          "-y",
          "-framerate", String(fps),
          "-i", path.join(tmp, "f%04d.png"),
          "-vf", "scale=1080:1920:flags=lanczos",
          "-c:v", "libx264",
          "-pix_fmt", "yuv420p",
          "-crf", "18",
          "-movflags", "+faststart",
          outFile,
        ],
        { stdio: "inherit" }
      );

      // Nettoyage des images
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log(`✔ ${outFile}`);
    }
  } finally {
    await browser.close();
  }

  console.log(`\nTerminé. Vidéos dans : ${OUT_DIR}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
