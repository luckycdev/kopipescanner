import fetch from "node-fetch";
import express from "express";
import cors from "cors";

const app = express();
const port = 3000;
const baseUrl = "https://kopipe.net/up/";

app.use(cors());

const getTimestamp = () => { // timestamp for logging
  return new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

const genChars = (start, end) => {
  const arr = [];
  for (let i = start.charCodeAt(0); i <= end.charCodeAt(0); i++) {
    arr.push(String.fromCharCode(i));
  }
  return arr;
};

const lowerLetters = genChars('a', 'z');
const upperLetters = genChars('A', 'Z');
const digits = Array.from({ length: 10 }, (_, i) => i.toString());

const generateUrlsToScan = () => {
  const urlsToScan = [];

  // 44x and 44X
  lowerLetters.forEach(ch => urlsToScan.push(`44${ch}`));
  upperLetters.forEach(ch => urlsToScan.push(`44${ch}`));

  // 42x and 42X
  lowerLetters.forEach(ch => urlsToScan.push(`42${ch}`));
  upperLetters.forEach(ch => urlsToScan.push(`42${ch}`));
  urlsToScan.push("42");

  // 3xx
  lowerLetters.forEach(ch1 => {
    lowerLetters.forEach(ch2 => {
      urlsToScan.push(`3${ch1}${ch2}`);
    });
  });
  // 3xX
  lowerLetters.forEach(ch1 => {
    upperLetters.forEach(ch2 => {
      urlsToScan.push(`3${ch1}${ch2}`);
    });
  });
  // 3x*
  lowerLetters.forEach(ch1 => {
    digits.forEach(d => {
      urlsToScan.push(`3${ch1}${d}`);
    });
  });

  // 420–460
  for (let n = 420; n <= 460; n++) {
    urlsToScan.push(n.toString());
  }

  return urlsToScan;
};

let cache = { // current scan
  timestamp: null,
  scanned: 0,
  success: [],
  filtered: [],
  fail: [],
  locked: [],
  images: []
};

let finishedCache = {
  timestamp: null,
  scanned: 0,
  success: [],
  filtered: [],
  fail: [],
  locked: [],
  images: []
};

let clients = [];
let scanRunning = false;

const sendToClients = (data) => {
  const str = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => {
    try {
      res.write(str);
    } catch {

    }
  });
};

app.get("/api/scanProgress", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  res.write("\n");

  clients.push(res);

  req.on("close", () => {
    clients = clients.filter(c => c !== res);
  });

  if (scanRunning) {
    if (!firstScanDone) {
      res.write(`data: ${JSON.stringify({ live: true })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({
        live: false,
        timestamp: finishedCache.timestamp,
        scanned: finishedCache.scanned,
        successCount: finishedCache.success.length,
        filteredCount: finishedCache.filtered.length,
        failCount: finishedCache.fail.length,
        lockedCount: finishedCache.locked.length,
        imagesCount: finishedCache.images.length,
        success: finishedCache.success,
        locked: finishedCache.locked,
        filtered: finishedCache.filtered,
        fail: finishedCache.fail,
        images: finishedCache.images
      })}\n\n`);
    }
  } else if (finishedCache.timestamp) {
    res.write(`data: ${JSON.stringify({
      live: false,
      timestamp: finishedCache.timestamp,
      scanned: finishedCache.scanned,
      successCount: finishedCache.success.length,
      filteredCount: finishedCache.filtered.length,
      failCount: finishedCache.fail.length,
      lockedCount: finishedCache.locked.length,
      imagesCount: finishedCache.images.length,
      success: finishedCache.success,
      locked: finishedCache.locked,
      filtered: finishedCache.filtered,
      fail: finishedCache.fail,
      images: finishedCache.images
    })}\n\n`);
  } else {
    res.write(`data: ${JSON.stringify({ message: "No scan running yet" })}\n\n`);
  }
});

app.get("/api/scanData", (req, res) => {
  if (!finishedCache.timestamp) return res.status(204).send();
  res.json({
    timestamp: finishedCache.timestamp,
    scanned: finishedCache.scanned,
    success: finishedCache.success,
    filtered: finishedCache.filtered,
    fail: finishedCache.fail,
    locked: finishedCache.locked,
    images: finishedCache.images,
    successCount: finishedCache.success.length,
    filteredCount: finishedCache.filtered.length,
    failCount: finishedCache.fail.length,
    lockedCount: finishedCache.locked.length,
    imagesCount: finishedCache.images.length
  });
});

const delay = (ms) => new Promise(r => setTimeout(r, ms));

let firstScanDone = false;

async function doScan() {
  console.log(`[${getTimestamp()}] Scanning KOPIPE links...`);
  scanRunning = true;

  const urlsToScan = generateUrlsToScan();

  const newCache = {
    timestamp: null, //null for now
    scanned: 0,
    success: [],
    filtered: [],
    fail: [],
    locked: [],
    images: []
  };

  for (const code of urlsToScan) {
    const url = baseUrl + code;
    try {
      const response = await fetch(url);
      const status = response.status;

      if (status === 404) {
        newCache.filtered.push({ id: code, message: "No file found", url });
      } else if (status >= 500) {
        newCache.fail.push({ id: code, message: `Server Error (${status})`, url });
      } else {
        const text = await response.text();
        const titleMatch = text.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : "";

        const locked = /<img src="\/\/static-up\.kopipe\.net\/locked\.png"/i.test(text);
        const cleanTitle = title.replace(/ Download$/, "");

        if (/\.(png|jpg|jpeg|gif)/i.test(cleanTitle)) {
          const imgMatch = text.match(/<img\s+src="(https:\/\/pc286\.kopipe\.net\/[^"]+)"/i);
          const imgUrl = imgMatch ? imgMatch[1] : null;

          if (imgUrl) {
            newCache.images.push({ id: code, message: cleanTitle, url, imgUrl, locked });
          } else {
            newCache.success.push({ id: code, message: cleanTitle, url, locked });
          }
        } else if (title.toLowerCase() === "kopipe error") {
          newCache.filtered.push({ id: code, message: "No file found", url });
        } else {
          if (locked) {
            newCache.locked.push({ id: code, message: cleanTitle, url, locked });
          } else {
            newCache.success.push({ id: code, message: cleanTitle, url });
          }
        }
      }
    } catch (e) {
      newCache.fail.push({ id: code, message: `Fetch failed: ${e.message}`, url });
    }

    newCache.scanned++;

    if (!firstScanDone) {
      // only show live results if it is the first ever scan, every scan after that will be from finished cache
      sendToClients({
        live: true,
        scanned: newCache.scanned,
        successCount: newCache.success.length,
        filteredCount: newCache.filtered.length,
        failCount: newCache.fail.length,
        lockedCount: newCache.locked.length,
        imagesCount: newCache.images.length,
        success: newCache.success,
        locked: newCache.locked,
        filtered: newCache.filtered,
        fail: newCache.fail,
        images: newCache.images
      });
    }

    await delay(100);
  }

  newCache.timestamp = Date.now();
  cache = newCache;
  finishedCache = { ...newCache }; // update finished cache
  scanRunning = false;

  if (!firstScanDone) firstScanDone = true;

  sendToClients({ done: true, message: "Scan complete" });
  console.log(`[${getTimestamp()}] Scan finished`);
}

app.use(express.static("."));

app.listen(port, () => {
  console.log(`[${getTimestamp()}] Server running at http://localhost:${port}`);
  doScan();
  setInterval(async () => {
  if (!scanRunning) await doScan();
  }, 10/*min*/ * 60 * 1000);
});