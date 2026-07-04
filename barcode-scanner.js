const qs = (selector) => document.querySelector(selector);
const ZXING_CDN = "https://unpkg.com/@zxing/browser@0.2.0";

let overlay = null;
let video = null;
let statusEl = null;
let zxingControls = null;
let nativeStream = null;
let nativeLoop = 0;
let scannerRunning = false;
let scriptLoading = null;
let observerStarted = false;

function toast(message){
  let t = qs("#nutrition-save-toast");
  if(!t){
    t = document.createElement("div");
    t.id = "nutrition-save-toast";
    t.className = "nutrition-toast";
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.classList.add("active");
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove("active"), 2400);
}

function setStatus(message){
  if(statusEl) statusEl.textContent = message;
}

function ensureScannerButton(){
  const modal = qs("#food-search-modal");
  if(!modal || qs("#food-scan-btn")) return;

  const barcodeRow = qs("#food-barcode-text")?.closest(".food-search-form");
  const button = document.createElement("button");
  button.id = "food-scan-btn";
  button.className = "mini-action scan-action";
  button.type = "button";
  button.textContent = "Scanner 📷";
  button.addEventListener("click", openScanner);

  if(barcodeRow){
    barcodeRow.appendChild(button);
    barcodeRow.classList.add("food-barcode-row");
  }
}

function startButtonObserver(){
  if(observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(() => ensureScannerButton());
  observer.observe(document.body, { childList:true, subtree:true });
}

function ensureOverlay(){
  if(overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "barcode-scanner-modal";
  overlay.className = "nutrition-modal-overlay barcode-scanner-overlay";
  overlay.innerHTML = `
    <section class="nutrition-modal barcode-scanner-modal" role="dialog" aria-modal="true">
      <div class="nutrition-modal-head">
        <div>
          <h3>Scanner un code-barres 📷</h3>
          <p id="barcode-scanner-status">Place le code-barres dans le cadre.</p>
        </div>
        <button class="nutrition-modal-close" id="barcode-close" type="button">×</button>
      </div>
      <div class="barcode-video-wrap">
        <video id="barcode-video" autoplay muted playsinline></video>
        <div class="barcode-frame"><span></span></div>
      </div>
      <div class="barcode-actions">
        <button class="mini-action" id="barcode-stop" type="button">Arrêter</button>
        <button class="mini-action" id="barcode-manual" type="button">Saisie manuelle</button>
      </div>
      <p class="barcode-help">Astuce : approche doucement le téléphone, puis stabilise le code-barres dans le cadre.</p>
    </section>`;
  document.body.appendChild(overlay);

  video = qs("#barcode-video");
  statusEl = qs("#barcode-scanner-status");
  qs("#barcode-close")?.addEventListener("click", closeScanner);
  qs("#barcode-stop")?.addEventListener("click", closeScanner);
  qs("#barcode-manual")?.addEventListener("click", () => {
    closeScanner();
    qs("#food-search-modal")?.classList.add("active");
    setTimeout(() => qs("#food-barcode-text")?.focus(), 100);
  });
  overlay.addEventListener("click", (event) => { if(event.target === overlay) closeScanner(); });
  return overlay;
}

function loadZxing(){
  if(window.ZXingBrowser) return Promise.resolve(window.ZXingBrowser);
  if(scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = ZXING_CDN;
    script.async = true;
    script.onload = () => window.ZXingBrowser ? resolve(window.ZXingBrowser) : reject(new Error("ZXing non disponible"));
    script.onerror = () => reject(new Error("Impossible de charger le scanner"));
    document.head.appendChild(script);
  });
  return scriptLoading;
}

function stopTracks(){
  if(nativeLoop) cancelAnimationFrame(nativeLoop);
  nativeLoop = 0;
  if(zxingControls?.stop) zxingControls.stop();
  zxingControls = null;
  if(nativeStream){
    nativeStream.getTracks().forEach((track) => track.stop());
    nativeStream = null;
  }
  if(video){
    try{ video.pause(); }catch(e){}
    video.srcObject = null;
  }
  scannerRunning = false;
}

function closeScanner(){
  stopTracks();
  overlay?.classList.remove("active");
}

function cleanCode(raw){
  return String(raw || "").replace(/\D/g, "").trim();
}

function searchDetectedCode(code){
  const cleaned = cleanCode(code);
  if(!cleaned || cleaned.length < 6){
    setStatus("Code détecté mais illisible. Réessaie ou saisis-le manuellement.");
    return;
  }
  closeScanner();
  qs("#food-search-modal")?.classList.add("active");
  const input = qs("#food-barcode-text");
  const button = qs("#food-barcode-btn");
  if(input) input.value = cleaned;
  toast(`Code détecté : ${cleaned} ✅`);
  setTimeout(() => button?.click(), 150);
}

async function startZxingScan(){
  const ZXingBrowser = await loadZxing();
  const Reader = ZXingBrowser.BrowserMultiFormatReader || ZXingBrowser.BrowserMultiFormatOneDReader;
  if(!Reader) throw new Error("Lecteur code-barres indisponible");
  const reader = new Reader();
  const constraints = {
    video: {
      facingMode: { ideal:"environment" },
      width: { ideal:1280 },
      height: { ideal:720 }
    },
    audio:false
  };
  zxingControls = await reader.decodeFromConstraints(constraints, video, (result) => {
    if(!scannerRunning || !result) return;
    const text = result.getText?.() || result.text || String(result || "");
    searchDetectedCode(text);
  });
}

async function startNativeScan(){
  if(!("BarcodeDetector" in window)) throw new Error("BarcodeDetector non disponible");
  const detector = new BarcodeDetector({ formats:["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
  nativeStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:"environment" }, width:{ ideal:1280 }, height:{ ideal:720 } }, audio:false });
  video.srcObject = nativeStream;
  await video.play();

  const loop = async () => {
    if(!scannerRunning) return;
    try{
      const codes = await detector.detect(video);
      if(codes?.length){
        searchDetectedCode(codes[0].rawValue || codes[0].rawData || "");
        return;
      }
    }catch(e){}
    nativeLoop = requestAnimationFrame(loop);
  };
  nativeLoop = requestAnimationFrame(loop);
}

async function openScanner(){
  ensureOverlay().classList.add("active");
  stopTracks();
  scannerRunning = true;
  setStatus("Demande d’accès à la caméra…");

  if(!navigator.mediaDevices?.getUserMedia){
    setStatus("La caméra n’est pas disponible dans ce navigateur. Utilise la saisie manuelle.");
    return;
  }

  try{
    setStatus("Ouverture de la caméra…");
    await startZxingScan();
    setStatus("Caméra active. Place le code-barres dans le cadre.");
  }catch(zxingError){
    console.warn("ZXing scanner indisponible", zxingError);
    try{
      await startNativeScan();
      setStatus("Caméra active. Place le code-barres dans le cadre.");
    }catch(nativeError){
      console.warn("Scanner natif indisponible", nativeError);
      stopTracks();
      setStatus("Impossible d’activer le scanner. Tu peux utiliser la saisie manuelle du code-barres.");
      toast("Scanner indisponible, saisie manuelle possible");
    }
  }
}

function init(){
  startButtonObserver();
  ensureScannerButton();
  document.addEventListener("click", (event) => {
    if(event.target.closest("#open-food-search-modal")) setTimeout(ensureScannerButton, 120);
  });
  document.addEventListener("visibilitychange", () => { if(document.hidden) closeScanner(); });
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
