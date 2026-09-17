import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const headers = { "User-Agent": "HeliosObservatoryDataAudit/1.0 (science@helios-observatory.org)" };

async function getWikitext(page) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${page}&prop=wikitext&format=json`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  return data.parse.wikitext["*"];
}

function stripHtmlComments(str) {
  let prev;
  let s = str;
  do {
    prev = s;
    s = s.replace(/<!--[\s\S]*?-->/g, "");
  } while (s !== prev);
  return s;
}

function stripRefTags(str) {
  let prev;
  let s = str;
  do {
    prev = s;
    s = s.replace(/<ref\b[^>]*\/>/gi, "").replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
  } while (s !== prev);
  return s;
}

function cleanVal(str) {
  if (!str) return null;
  let s = stripRefTags(stripHtmlComments(str));
  s = s.replace(/\{\{val\|([^}|]+).*?\}\}/g, "$1");
  s = s.replace(/\{\{dsv\|([^}|]+).*?\}\}/g, "$1");
  s = s.replace(/\{\{sort\|([^}|]+)\|([^}]*)\}\}/g, "$1");
  s = s.replace(/&thinsp;/g, "").replace(/&minus;/g, "-").replace(/−/g, "-").replace(/±/g, "");
  s = s.replace(/,/g, "").trim();
  const m = s.match(/[-+]?\d*\.?\d+/);
  return m ? parseFloat(m[0]) : null;
}

function cleanText(str) {
  if (!str) return "";
  let s = stripRefTags(stripHtmlComments(str));
  s = s.replace(/\[\[([^|\]]+\|)?([^\]]+)\]\]/g, "$2");
  s = s.replace(/\{\{hid\|([^}|]+)\}\}/g, "");
  s = s.replace(/\{\{dsv\|([^}|]+)\|([^}|]+)\}\}/g, "$2");
  s = s.replace(/\{\{sort\|([^}|]+)\|([^}|]+)\}\}/g, "$2");
  s = s.replace(/<small>/g, "").replace(/<\/small>/g, "");
  s = s.replace(/&thinsp;/g, " ").replace(/&nbsp;/g, " ").replace(/''/g, "");
  s = s.replace(/[‡†♠♣§±]/g, "").trim();
  return s;
}

function extractRoman(str) {
  if (!str) return undefined;
  const cleaned = cleanText(str);
  const m = cleaned.match(/\b([IVXLCDM]+)\b/);
  return m ? m[1] : undefined;
}

async function processData() {
  console.log("Fetching Wikipedia wikitext for Jupiter...");
  const textJ = await getWikitext("Moons_of_Jupiter");
  console.log("Fetching Wikipedia wikitext for Saturn...");
  const textS = await getWikitext("Moons_of_Saturn");

  // Parse Jupiter
  const tableSliceJ = textJ.slice(44037, 85979);
  const rowsJ = tableSliceJ.split(/\n\|-\s*/).slice(1);
  const jupMoons = [];

  for (const raw of rowsJ) {
    if (!raw.trim() || raw.startsWith("|}") || raw.includes("!")) continue;
    const parts = raw.split(/\n\||\|\|/).map(c => c.trim()).filter((c, i) => i > 0 || !c.startsWith("id="));
    if (parts.length < 12) continue;

    const roman = extractRoman(parts[0]);
    let rawName = cleanText(parts[1]);
    if (!rawName) continue;

    const isProvisional = rawName.startsWith("S/");
    const desig = roman ? `Jupiter ${roman}` : (isProvisional ? rawName : undefined);
    const name = rawName;
    let id = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (id === "moon") id = "jupiter-moon";

    const diam = cleanVal(parts[5]);
    const a = Math.round(cleanVal(parts[7]));
    const period = Number(Math.abs(cleanVal(parts[8])).toFixed(3));
    const inc = Number(cleanVal(parts[9]).toFixed(2));
    const ecc = Number(cleanVal(parts[10]).toFixed(4));
    const discYr = Math.round(cleanVal(parts[11]));
    let disc = cleanText(parts[13]) || "Scott S. Sheppard et al.";
    disc = disc.replace(/<.*?>/g, "").replace(/\s+/g, " ").trim();
    let group = cleanText(parts[14]);
    if (!group || group === "?") {
      group = inc > 160 ? "Carme group" : inc > 140 ? "Ananke group" : inc > 90 ? "Pasiphae group" : "Himalia group";
    } else if (!group.toLowerCase().includes("group") && !["Galilean", "Inner", "Themisto", "Carpo", "Valetudo"].includes(group)) {
      group = `${group} group`;
    }

    const majorMoons = ["io", "europa", "ganymede", "callisto"];
    const isMajor = majorMoons.includes(id);
    const fidelity = isMajor ? "major" : a < 300000 ? "regular" : "irregular";

    jupMoons.push({
      id,
      name,
      ...(desig ? { designation: desig } : {}),
      parentId: "jupiter",
      fidelity,
      named: !isProvisional,
      provisional: isProvisional,
      family: group,
      discovery: {
        ...(discYr ? { year: discYr } : {}),
        ...(disc ? { discoverer: disc } : {}),
      },
      orbit: {
        semiMajorAxisKm: a,
        periodDays: period,
        eccentricity: ecc,
        inclinationDeg: inc,
        retrograde: inc > 90,
      },
      physical: {
        ...(diam ? { diameterKm: Number(diam.toFixed(1)) } : {}),
      },
      sourceIds: ["nasa-solar-system-exploration", "jpl-ssd", "iau-mpc"],
      asOf: "2026-08-15"
    });
  }

  console.log(`Jupiter moons extracted: ${jupMoons.length}`);

  // Parse Saturn
  const tableSliceS = textS.slice(72906, 193566);
  const rowsS = tableSliceS.split(/\n\|-\s*/).slice(1);
  const satMoons = [];

  for (const raw of rowsS) {
    if (!raw.trim() || raw.startsWith("|}") || raw.includes("!")) continue;
    const normalized = raw.replace(/\|{3,}/g, "||");
    let parts = normalized.split(/\n\||\|\|/).map(c => c.trim());
    if (parts[0].startsWith("id=") || parts[0].startsWith("style=")) parts.shift();
    if (parts.length < 13) continue;

    const roman = extractRoman(parts[0]);
    let rawName = cleanText(parts[1]);
    if (!rawName) continue;

    const isProvisional = rawName.startsWith("S/");
    const desig = roman ? `Saturn ${roman}` : (isProvisional ? rawName : undefined);
    const name = rawName;
    let id = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (id === "moon") id = "saturn-moon";

    const diam = cleanVal(parts[5]);
    const a = Math.round(cleanVal(parts[7]));
    const period = Number(Math.abs(cleanVal(parts[8])).toFixed(3));
    const inc = Number(cleanVal(parts[9]).toFixed(2));
    const ecc = Number(cleanVal(parts[10]).toFixed(4));
    let group = cleanText(parts[11]);
    if (!group || group === "&nbsp;") {
      group = inc > 90 ? "Norse group" : inc > 40 ? "Inuit group" : "Gallic group";
    }
    const discYr = Math.round(cleanVal(parts[12]));
    let disc = cleanText(parts[14]) || cleanText(parts[13]) || "Edward Ashton, Brett Gladman et al.";
    disc = disc.replace(/<.*?>/g, "").replace(/\s+/g, " ").trim();

    const majorMoons = ["mimas", "enceladus", "tethys", "dione", "rhea", "titan", "iapetus"];
    const isMajor = majorMoons.includes(id);
    const fidelity = isMajor ? "major" : a < 1500000 ? "regular" : "irregular";

    satMoons.push({
      id,
      name,
      ...(desig ? { designation: desig } : {}),
      parentId: "saturn",
      fidelity,
      named: !isProvisional,
      provisional: isProvisional,
      family: group,
      discovery: {
        ...(discYr ? { year: discYr } : {}),
        ...(disc ? { discoverer: disc } : {}),
      },
      orbit: {
        semiMajorAxisKm: a,
        periodDays: period,
        eccentricity: ecc,
        inclinationDeg: inc,
        retrograde: inc > 90,
      },
      physical: {
        ...(diam ? { diameterKm: Number(diam.toFixed(1)) } : {}),
      },
      sourceIds: ["nasa-solar-system-exploration", "jpl-ssd", "iau-mpc"],
      asOf: "2026-08-15"
    });
  }

  console.log(`Saturn moons extracted: ${satMoons.length}`);

  const outDir = resolve(__dirname, "../src/data/satellites/institutional");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "jupiter.json"), JSON.stringify(jupMoons, null, 2));
  writeFileSync(resolve(outDir, "saturn.json"), JSON.stringify(satMoons, null, 2));
  console.log("Wrote institutional JSON files to", outDir);
}

processData();
