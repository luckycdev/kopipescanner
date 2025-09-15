const baseUrl = "https://kopipe.net/up/";
const successSection = document.getElementById("successSection");
const lockedSection = document.getElementById("lockedSection");
const filteredSection = document.getElementById("filteredSection");
const failSection = document.getElementById("failSection");
const imagesSection = document.getElementById("imagesSection");

const displayed = {
  success: new Set(),
  locked: new Set(),
  filtered: new Set(),
  fail: new Set(),
  images: new Set(),
};

function setSectionCounts(data) {
  document.getElementById("success").textContent = (data.success || []).length;
  document.getElementById("locked").textContent = (data.locked || []).length;
  document.getElementById("images").textContent = (data.images || []).length;
  document.getElementById("filtered").textContent = (data.filtered || []).length;
  document.getElementById("fail").textContent = (data.fail || []).length;
}

function createLink(id, message, isError, locked, imgUrl) {
  const a = document.createElement("a");
  a.href = baseUrl + id;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = "createlinklinks";

  const idSpan = document.createElement("span");
  idSpan.className = "id";
  idSpan.textContent = id;

  const msgSpan = document.createElement("span");
  msgSpan.className = "msg";
  if (isError) msgSpan.classList.add("red");
  if (locked) msgSpan.classList.add("gold");
  msgSpan.textContent = message;

  a.appendChild(idSpan);
  a.appendChild(msgSpan);

  if (imgUrl) {
    const br = document.createElement("br");
    a.appendChild(br);
    const img = document.createElement("img");
    img.src = imgUrl;
    img.className = "displayimage";
    a.appendChild(img);
  }

  return a;
}

function populateSection(section, items, setKey, isError = false, onlyLocked = false) {
  items.forEach(item => {
    if (onlyLocked && !item.locked) return;
    if (!onlyLocked && item.locked) return;
    if (displayed[setKey].has(item.id)) return;

    displayed[setKey].add(item.id);

    const div = document.createElement("div");
    div.className = "item";

    const id = item.id || (item.url && item.url.substring(baseUrl.length)) || "";
    const link = createLink(id, item.message, isError, item.locked, item.imgUrl);

    div.appendChild(link);
    section.appendChild(div);
  });
  updateSectionCounts();
}

function populateImagesSection(items) {
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif"];//todo all? could test by uploading

  items.forEach(item => {
    if (!item.message) return;
    const lowerMsg = item.message.toLowerCase();
    const hasImageExt = imageExtensions.some(ext => lowerMsg.includes(ext));
    if (!hasImageExt) return;
    if (!item.imgUrl) return;
    if (displayed.images.has(item.id)) return;

    displayed.images.add(item.id);

    const div = document.createElement("div");
    div.className = "item";

    const id = item.id || (item.url && item.url.substring(baseUrl.length)) || "";
    const a = document.createElement("a");
    a.href = baseUrl + id;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "populateimagelinks";

    const img = document.createElement("img");
    img.src = item.imgUrl;
    img.alt = item.message;
    img.className = "populateimages";
    a.appendChild(img);

    let titleText = item.message.replace(/ Download$/i, "");
    const titleDiv = document.createElement("div");
    titleDiv.className = "title";
    titleDiv.textContent = titleText;
    a.appendChild(titleDiv);

    div.appendChild(a);
    imagesSection.appendChild(div);
  });
}

function updateSectionCounts() {
  document.getElementById("success").textContent = displayed.success.size;
  document.getElementById("locked").textContent = displayed.locked.size;
  document.getElementById("images").textContent = displayed.images.size;
  document.getElementById("filtered").textContent = displayed.filtered.size;
  document.getElementById("fail").textContent = displayed.fail.size;
}

async function loadCachedData() {
  try {
    const res = await fetch(`/api/scanData`);
    if (res.status === 204) {
      document.getElementById("timestamp").textContent = "Data not yet available";
      return;
    }
    const data = await res.json();
    document.getElementById("timestamp").textContent = `Data from: ${new Date(data.timestamp).toLocaleString()}`;
    document.getElementById("scanned").textContent = data.scanned;
    populateSection(lockedSection, data.locked, "locked", false, true);
    populateSection(successSection, data.success, "success", false, false);
    populateSection(filteredSection, data.filtered, "filtered", true);
    populateSection(failSection, data.fail, "fail", true);
    populateImagesSection(data.images);
    updateSectionCounts();
  } catch (e) {
    document.getElementById("timestamp").textContent = "Error loading cached data.";
    console.error(e);
  }
}

function updateUIWithLiveData(data) {
  if (data.live) {
    document.getElementById("timestamp").textContent = `Live scan in progress...`;
  } else if (data.timestamp) {
    document.getElementById("timestamp").textContent = `Cached from: ${new Date(data.timestamp).toLocaleString()}`;
  }

  document.getElementById("scanned").textContent = data.scanned || 0;
  populateSection(lockedSection, data.locked || [], "locked", false, true);
  populateSection(successSection, data.success || [], "success", false);
  populateSection(filteredSection, data.filtered || [], "filtered", true);
  populateSection(failSection, data.fail || [], "fail", true);
  populateImagesSection(data.images || []);
  updateSectionCounts();
}

async function init() {
  try {
    const res = await fetch('/api/scanData');
    if (res.status === 204) {
      // if no finished cache use eventsource for live scan
      openScanProgressStream();
      return;
    }
    const data = await res.json();
    document.getElementById("timestamp").textContent = `Data from: ${new Date(data.timestamp).toLocaleString()}`;
    document.getElementById("scanned").textContent = data.scanned;
    populateSection(lockedSection, data.locked, "locked", false, true);
    populateSection(successSection, data.success, "success", false, false);
    populateSection(filteredSection, data.filtered, "filtered", true);
    populateSection(failSection, data.fail, "fail", true);
    populateImagesSection(data.images);
    updateSectionCounts();
  } catch (e) {
    document.getElementById("timestamp").textContent = "Error loading cached data.";
    console.error(e);
    // if error try the live scan
    openScanProgressStream();
  }
}

function openScanProgressStream() {
  const evtSource = new EventSource(`/api/scanProgress`);
  evtSource.onmessage = e => {
    const data = JSON.parse(e.data);

    if (data.message === "No scan running") {
      loadCachedData();
      evtSource.close();
      return;
    }
    if (data.done) {
      loadCachedData();
      evtSource.close();
      return;
    }

    updateUIWithLiveData(data);
  };
  evtSource.onerror = () => {
    loadCachedData();
    evtSource.close();
  };
}

document.addEventListener('DOMContentLoaded', init);