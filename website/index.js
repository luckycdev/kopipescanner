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

function clearOutput() {
  [successSection, filteredSection, failSection, lockedSection, imagesSection].forEach(section => {
    section.innerHTML = `<h3>${section.querySelector("h3").textContent}</h3>`;
  });

  for (const key in displayed) {
    displayed[key].clear();
  }
}

function createLink(id, message, isError, locked, imgUrl) {
  const a = document.createElement("a");
  a.href = baseUrl + id;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "inline-flex";
  a.style.alignItems = "center";

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
    img.style.maxWidth = "100%";
    img.style.marginTop = "4px";
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
}

function populateImagesSection(items) {
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif"];

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
    a.style.display = "inline-block";
    a.style.textAlign = "center";

    const img = document.createElement("img");
    img.src = item.imgUrl;
    img.alt = item.message;
    img.style.maxWidth = "120px";
    img.style.borderRadius = "6px";
    img.style.marginBottom = "6px";
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

async function loadCachedData() {
  try {
    const res = await fetch(`/scanData`);
    if (res.status === 204) {
      document.getElementById("timestamp").textContent = "Data not yet available";
      clearOutput();
      return;
    }
    const data = await res.json();

    document.getElementById("timestamp").textContent = `Data from: ${new Date(data.timestamp).toLocaleString()}`;
    document.getElementById("scanned").textContent = data.scanned;
    document.getElementById("success").textContent = data.success.length;
    document.getElementById("locked").textContent = data.locked.length;
    document.getElementById("images").textContent = data.images.length;
    document.getElementById("filtered").textContent = data.filtered.length;
    document.getElementById("fail").textContent = data.fail.length;

    clearOutput();

    populateSection(lockedSection, data.locked, "locked", false, true);
    populateSection(successSection, data.success, "success", false, false);
    populateSection(filteredSection, data.filtered, "filtered", true);
    populateSection(failSection, data.fail, "fail", true);
    populateImagesSection(data.images);

  } catch (e) {
    document.getElementById("timestamp").textContent = "Error loading cached data.";
    clearOutput();
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
  document.getElementById("success").textContent = (data.success || []).length;
  document.getElementById("filtered").textContent = (data.filtered || []).length;
  document.getElementById("fail").textContent = (data.fail || []).length;
  document.getElementById("locked").textContent = (data.locked || []).length;
  document.getElementById("images").textContent = (data.images || []).length;

  populateSection(lockedSection, data.locked || [], "locked", false, true);
  populateSection(successSection, data.success || [], "success", false);
  populateSection(filteredSection, data.filtered || [], "filtered", true);
  populateSection(failSection, data.fail || [], "fail", true);
  populateImagesSection(data.images || []);
}

const evtSource = new EventSource(`/scanProgress`);
evtSource.onmessage = e => {
  const data = JSON.parse(e.data);

  if (data.message === "No scan running") {
    loadCachedData();
    return;
  }
  if (data.done) {
    loadCachedData();
    return;
  }

  updateUIWithLiveData(data);
};

evtSource.onerror = () => {
  loadCachedData();
};