// assemble.js — Reel = intro animée + VOS vidéos (fond flou + nom du groupe) + carton « Réserver »
// Chaque vidéo est remplie en 9:16 par un fond flou, et porte en bas le nom du groupe.
// Usage : node assemble.js   |   Prérequis : Node 18+, `npm install`, ffmpeg + ffprobe.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync, spawnSync } = require("child_process");
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
function videoList(s){ if(Array.isArray(s.videos)) return s.videos; if(s.video) return [s.video]; return []; }
function existingVideos(s){ return videoList(s).map(v => path.join(ROOT, v)).filter(p => fs.existsSync(p)); }
function labelFor(s, i){
  if(Array.isArray(s.labels) && s.labels[i] != null) return s.labels[i];
  return [s.a1, s.a2, s.a3][i] || "";
}

async function renderCardFrames(page, mode, frames, fps, tmpDir){
  await page.evaluate((m)=>window.setMode(m), mode);
  await page.evaluate((m)=>window.startCapture(m), mode);
  for(let i=0;i<frames;i++){
    await page.evaluate((t)=>window.seek(t), (i/fps)*1000);
    await page.screenshot({ path: path.join(tmpDir, `f${String(i).padStart(4,"0")}.png`) });
  }
}
async function renderLabelPng(page, text, outPng){
  await page.setViewport({ width:1080, height:1920, deviceScaleFactor:1 });
  await page.evaluate((t)=>{ window.setMode('label'); window.setLabel(t); }, text);
  await page.screenshot({ path: outPng, omitBackground: true });
}
function probeSize(file){
  try{
    const out = execFileSync("ffprobe", ["-v","error","-select_streams","v:0",
      "-show_entries","stream=width,height","-of","csv=p=0:s=x", file]).toString().trim();
    const [w,h] = out.split("x").map(Number);
    return { w, h };
  }catch(e){ return { w:0, h:0 }; }
}
// Détecte des bandes noires haut/bas et renvoie la bande de contenu {y,h} en pleine largeur (ou null).
function detectBars(videoPath){
  const r = spawnSync("ffmpeg", ["-hide_banner","-ss","0.5","-i",videoPath,
    "-vf","cropdetect=limit=24:round=2","-t","5","-f","null","-"], { encoding:"utf8" });
  const out = (r.stderr||"") + (r.stdout||"");
  const ms = [...out.matchAll(/crop=\d+:(\d+):\d+:(\d+)/g)];
  if(!ms.length) return null;
  let top = Infinity, bot = -Infinity;
  for(const m of ms){ const h=+m[1], y=+m[2]; if(y<top) top=y; if(y+h>bot) bot=y+h; }
  let y = top - (top%2); if(y<0) y=0;
  let h = bot - y; h -= h%2;
  return { y, h };
}
function musicOk(p){
  try{ return !!p && fs.existsSync(p) && fs.statSync(p).size > 10000; }catch(e){ return false; }
}
function buildCard(tmpDir, fps, outFile, durSec, musicPath, musicStart, vol){
  const f = 0.4;
  const vfade = durSec && durSec>2*f
    ? ",fade=t=in:st=0:d="+f+",fade=t=out:st="+(durSec-f).toFixed(2)+":d="+f
    : "";
  const base = ["-y","-framerate",String(fps),"-i",path.join(tmpDir,"f%04d.png")];
  if(musicOk(musicPath)){
    const fo = Math.max(0, durSec-0.5).toFixed(2);
    const af = "volume="+(vol||0.85)+",afade=t=in:st=0:d=0.6,afade=t=out:st="+fo+":d=0.5";
    ff([...base,"-ss",String(musicStart||0),"-t",String(durSec),"-i",musicPath,
        "-map","0:v:0","-map","1:a:0",
        "-vf","scale=1080:1920:flags=lanczos"+vfade,"-r",String(fps),"-af",af,
        "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-ar","48000","-ac","2",
        "-t",String(durSec), outFile]);
  }else{
    if(musicPath) console.log("  ⚠ musique ignorée (absente/invalide) : "+musicPath);
    ff([...base,"-f","lavfi","-i","anullsrc=channel_layout=stereo:sample_rate=48000",
        "-vf","scale=1080:1920:flags=lanczos"+vfade,"-r",String(fps),
        "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-t",String(durSec), outFile]);
  }
}
// Vidéo -> 1080x1920 avec fond flou + nom du groupe incrusté en bas
function buildSegment(videoPath, labelPng, fps, outFile, start, dur){
  const { w:iw, h:ih } = probeSize(videoPath);
  let pre = "";
  const bars = detectBars(videoPath);
  if(bars && iw>0 && ih>0 && bars.h>0 && bars.h < ih*0.97){
    pre = "crop="+iw+":"+bars.h+":0:"+bars.y+",";   // retire les bandes noires haut/bas
  }
  const trim = [];                                   // limite la portion de clip utilisée
  if(start && start>0) trim.push("-ss", String(start));
  if(dur && dur>0)     trim.push("-t",  String(dur));
  const f = 0.4;                                      // durée des fondus
  const fo = Math.max(0, (dur||10) - f).toFixed(2);   // début du fondu sortant
  const vfade = ",fade=t=in:st=0:d="+f+",fade=t=out:st="+fo+":d="+f;
  const afIn  = "afade=t=in:st=0:d="+f+",afade=t=out:st="+fo+":d="+f;
  const vf =
    "[0:v]"+pre+"split=2[bg][fg];"+
    "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:1,eq=brightness=-0.06,setsar=1[bgb];"+
    "[fg]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1[fgs];"+
    "[bgb][fgs]overlay=(W-w)/2:(H-h)/2[base];"+
    "[base][1:v]overlay=0:0[ov];"+
    "[ov]fps="+fps+",format=yuv420p,setsar=1"+vfade+"[outv]";
  if(hasAudio(videoPath)){
    const af = "loudnorm=I=-16:TP=-1.5:LRA=11,"+afIn;   // harmonise le niveau sonore entre clips
    ff(["-y",...trim,"-i",videoPath,"-loop","1","-i",labelPng,"-filter_complex",vf,
        "-map","[outv]","-map","0:a","-af",af,"-c:v","libx264","-pix_fmt","yuv420p",
        "-c:a","aac","-ar","48000","-ac","2","-t",String(dur||10), outFile]);
  }else{
    ff(["-y",...trim,"-i",videoPath,"-loop","1","-i",labelPng,
        "-f","lavfi","-i","anullsrc=channel_layout=stereo:sample_rate=48000",
        "-filter_complex",vf,"-map","[outv]","-map","2:a",
        "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-t",String(dur||10), outFile]);
  }
}

(async () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT,"soirees.json"),"utf8"));
  const fps = cfg.fps || 30;
  const scale = cfg.scale || 2;
  const introDur = cfg.introDuration || 4;
  const outroDur = cfg.outroDuration || 4;
  if(!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR,{recursive:true});

  const todo = cfg.soirees.filter(s => existingVideos(s).length > 0);
  if(!todo.length){ console.log("Aucune soirée avec des vidéos existantes (champ \"videos\")."); return; }

  const browser = await puppeteer.launch({ headless:"new", args:["--no-sandbox","--disable-setuid-sandbox","--hide-scrollbars"] });
  try{
    for(const s of todo){
      const data = Object.assign({}, cfg.common, s);
      const out = path.join(OUT_DIR, s.out || `reel_${s.day}.mp4`);
      // garde l'ordre des vidéos déclarées, en ne conservant que celles présentes
      const decl = videoList(s);
      const items = decl.map((v,i)=>({ file: path.join(ROOT,v), label: labelFor(s,i) }))
                        .filter(it => fs.existsSync(it.file));
      console.log(`\n▶ ${path.basename(out)}  (intro + ${items.length} vidéo(s) + outro)`);

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
      await renderCardFrames(page, "intro", Math.round(fps*introDur), fps, introFrames);
      console.log("  • outro…");
      await renderCardFrames(page, "outro", Math.round(fps*outroDur), fps, outroFrames);

      // un PNG de bandeau par vidéo
      for(let i=0;i<items.length;i++){
        items[i].png = path.join(work, `label_${i}.png`);
        await renderLabelPng(page, items[i].label, items[i].png);
      }
      await page.close();

      const introMp4 = path.join(work,"intro.mp4");
      const outroMp4 = path.join(work,"outro.mp4");
      const musicPath = data.music ? path.join(ROOT, data.music) : null;
      const musicVol  = data.musicVolume || 0.85;
      const mIntroStart = (data.musicIntroStart != null) ? data.musicIntroStart : 0;
      const mOutroStart = (data.musicOutroStart != null) ? data.musicOutroStart : introDur;
      if(musicPath && !fs.existsSync(musicPath)) console.log("  ⚠ musique introuvable : "+musicPath);
      buildCard(introFrames, fps, introMp4, introDur, musicPath, mIntroStart, musicVol);
      buildCard(outroFrames, fps, outroMp4, outroDur, musicPath, mOutroStart, musicVol);

      const clipSeconds = data.clipSeconds || 10;        // durée utilisée par clip
      const starts = Array.isArray(s.starts) ? s.starts : [];
      const mids = [];
      items.forEach((it, i) => {
        const mid = path.join(work, `mid_${i}.mp4`);
        const start = starts[i] || 0;
        console.log(`  • vidéo ${i+1}/${items.length} (${path.basename(it.file)}) — « ${it.label} » [${start}s → +${clipSeconds}s]…`);
        buildSegment(it.file, it.png, fps, mid, start, clipSeconds);
        mids.push(mid);
      });

      const list = path.join(work,"list.txt");
      fs.writeFileSync(list, [introMp4, ...mids, outroMp4].map(f=>`file '${f}'`).join("\n")+"\n");
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
