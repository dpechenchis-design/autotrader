const http = require("http");
const fs = require("fs");
const path = require("path");

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const port = Number(process.env.PORT || 3010);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/files") {
      const files = await loadCsvPayloads();
      return sendJson(response, { files });
    }

    const targetPath = resolvePath(url.pathname);
    if (!targetPath) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const filePath = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()
      ? path.join(targetPath, "index.html")
      : targetPath;

    if (!fs.existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Server error: ${error.message}`);
  }
});

server.listen(port, () => {
  console.log(`Dashboard available at http://localhost:${port}`);
  console.log(`Editable CSV folder: ${dataDir}`);
});

async function loadCsvPayloads() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    return [];
  }

  const entries = fs.readdirSync(dataDir, { withFileTypes: true });
  const csvFiles = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"));

  return Promise.all(
    csvFiles.map(async (entry) => ({
      name: entry.name,
      rows: parseCsv(fs.readFileSync(path.join(dataDir, entry.name), "utf8")),
    }))
  );
}

function resolvePath(urlPath) {
  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const resolved = path.normalize(path.join(rootDir, safePath));
  return resolved.startsWith(rootDir) ? resolved : null;
}

function sendJson(response, payload) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      current = "";
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    row.push(current);
    if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((cell) => String(cell).trim());
  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });
}
