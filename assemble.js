// assemble.js — Reel = carte d'intro animée + VOS vidéos (avec son) + carton « Réserver »
// Chaque soirée peut avoir PLUSIEURS vidéos (un clip par groupe), enchaînées dans l'ordre.
// Usage : node assemble.js
// Prérequis : Node 18+, `npm install`, ffmpeg ET ffprobe installés.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const puppeteer = require("puppeteer");

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, "out");
const CARD = "file://" + path.join(ROOT, "card.html");

function ff(args){ execFileSync("ffmpeg", args, { stdio: "inherit" }); }
function hasAudio(file){
  try{
    const out = execFileSync("ffprobe", ["-v","error","-select_streams","a",
      "-show_entries","stream=codec_type","-of","csv=p=0", file]).toString();
    return out.includes("audio");
  }catch(e){ return false; }
}
// Récupère la liste des vidéos d'une soirée (champ "videos" en tableau, ou "video" unique)
function videoList(s){
  if(Array.isArray(s.videos)) return s.videos;
  if(s.video) return [s.video];
  return [];
}
function existingVideos(s){
  return videoList(s).map(v => path.join(ROOT, v)).filter(p => fs.existsSync(p));
}

async function renderCard(page, mode, frames, fps, tmpDir){
  await page.evaluate((m)=>window.setMode(m), mode);
  await page.evaluate((m)=>window.startCapture(m), mode);
  for(let i=0;i<frames;i++){
    const t=(i/fps)*1000;
    await page.evaluate((t)=>window.seek(t), t);
    await page.screenshot({ path: path.join(tmpDir, `f${String(i).padStart(4,"0")}.png`) });
  }
}
function framesToMp4Silent(tmpDir, fps, outFile){
  ff(["-y","-framerate",String(fps),"-i",path.join(tmpDir,"f%04d.png"),
      "-f","lavfi","-i","anullsrc=channel_layout=stereo:sample_rate=48000",
      "-vf","scale=1080:1920:flags=lanczos","-r",String(fps),
      "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest", outFile]);
}
function normalizeVideo(videoPath, fps, outFile){
  const vf = "scale=1080:1920:force_original_aspect_ratio=decrease,"+
             "pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps="+fps+",format=yuv420p,setsar=1";
  if(hasAudio(videoPath)){
    ff(["-y","-i",videoPath,"-vf",vf,"-c:v","libx264","-pix_fmt","yuv420p",
        "-c:a","aac","-ar","48000","-ac","2", outFile]);
  }else{
    ff(["-y","-i",videoPath,"-f","lavfi","-i","anullsrc=channel_layout=stereo:sample_rate=48000",
        "-vf",vf,"-map","0:v","-map","1:a","-c:v","libx264","-pix_fmt","yuv420p",
        "-c:a","aac","-shortest", outFile]);
  }
}

(async () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT,"soirees.json"),"utf8"));
  const fps = cfg.fps || 30;
  const scale = cfg.scale || 2;
  const introDur = cfg.introDuration || 4;
  const outroDur = cfg.outroDuration || 3;
  if(!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR,{recursive:true});

  const todo = cfg.soirees.filter(s => existingVideos(s).length > 0);
  if(!todo.length){
    console.log("Aucune soirée avec des vidéos existantes. Déposez vos clips dans videos/ et renseignez \"videos\": [\"videos/...\", \"videos/...\"] dans soirees.json.");
    return;
  }

  const browser = await puppeteer.launch({ headless:"new", args:["--no-sandbox","--disable-setuid-sandbox","--hide-scrollbars"] });
  try{
    for(const s of todo){
      const data = Object.assign({}, cfg.common, s);
      const out = path.join(OUT_DIR, s.out || `reel_${s.day}.mp4`);
      const vids = existingVideos(s);
      console.log(`\n▶ ${path.basename(out)}  (intro + ${vids.length} vidéo(s) + outro)`);

      const page = await browser.newPage();
      await page.setViewport({ width:1080, height:1920, deviceScaleFactor:scale });
      await page.goto(CARD, { waitUntil:"networkidle0" });
      await page.evaluate((d)=>window.applyData(d), data);
      await page.evaluate(()=>document.fonts && document.fonts.ready);
      await new Promise(r=>setTimeout(r,300));

      const work = fs.mkdtempSync(path.join(os.tmpdir(),"reel-"));
      const introFrames = path.join(work,"intro"); fs.mkdirSync(introFrames);
      const outroFrames = path.join(work,"outro"); fs.mkdirSync(outroFrames);

      console.log("  • intro…");
      await renderCard(page, "intro", Math.round(fps*introDur), fps, introFrames);
      console.log("  • outro…");
      await renderCard(page, "outro", Math.round(fps*outroDur), fps, outroFrames);
      await page.close();

      const introMp4 = path.join(work,"intro.mp4");
      const outroMp4 = path.join(work,"outro.mp4");
      framesToMp4Silent(introFrames, fps, introMp4);
      framesToMp4Silent(outroFrames, fps, outroMp4);

      // Normalise chaque vidéo dans l'ordre
      const mids = [];
      vids.forEach((v, i) => {
        const mid = path.join(work, `mid_${i}.mp4`);
        console.log(`  • normalisation vidéo ${i+1}/${vids.length} (${path.basename(v)})…`);
        normalizeVideo(v, fps, mid);
        mids.push(mid);
      });

      // Concaténation : intro + vidéos… + outro
      const list = path.join(work,"list.txt");
      const lines = [introMp4, ...mids, outroMp4].map(f => `file '${f}'`).join("\n") + "\n";
      fs.writeFileSync(list, lines);
      console.log("  • assemblage final…");
      ff(["-y","-f","concat","-safe","0","-i",list,
          "-c:v","libx264","-pix_fmt","yuv420p","-crf","18",
          "-c:a","aac","-movflags","+faststart", out]);

      fs.rmSync(work,{recursive:true,force:true});
      console.log(`✔ ${out}`);
    }
  } finally { await browser.close(); }
  console.log(`\nTerminé. Vidéos dans : ${OUT_DIR}`);
})().catch(e=>{ console.error(e); process.exit(1); });
