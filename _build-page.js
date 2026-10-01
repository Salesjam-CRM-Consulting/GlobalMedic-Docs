const fs = require("fs");
const path = require("path");

const md = fs.readFileSync(path.join(__dirname, "instrukciya.md"), "utf8").replace(/\r\n/g, "\n");

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s) {
  let t = esc(s);
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    return `<figure><img src="${esc(src)}" alt="${esc(alt)}" /><figcaption>${esc(alt)}</figcaption></figure>`;
  });
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return t;
}

const lines = md.split("\n");
const sections = [];
let current = { id: "start", title: "С чего начать", level: 2, html: [] };
const toc = [];

function slug(title, n) {
  return "s" + n;
}

function flushList(buf, type) {
  if (!buf.length) return "";
  const tag = type === "ol" ? "ol" : "ul";
  const body = buf.map((item) => `<li>${inline(item)}</li>`).join("");
  buf.length = 0;
  return `<${tag}>${body}</${tag}>`;
}

let ol = [];
let ul = [];
let para = [];
let sectionIndex = 0;

function flushPara() {
  if (!para.length) return;
  const text = para.join(" ").trim();
  para = [];
  if (!text) return;
  if (text.startsWith("<figure>")) current.html.push(text);
  else current.html.push(`<p>${inline(text)}</p>`);
}

function flushLists() {
  if (ol.length) current.html.push(flushList(ol, "ol"));
  if (ul.length) current.html.push(flushList(ul, "ul"));
}

for (const raw of lines) {
  const line = raw.trimEnd();
  const trimmed = line.trim();

  if (!trimmed) {
    flushPara();
    flushLists();
    continue;
  }

  if (trimmed === "---") {
    flushPara();
    flushLists();
    continue;
  }

  const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
  if (heading) {
    flushPara();
    flushLists();
    const level = heading[1].length;
    const title = heading[2].trim();
    if (level === 1) continue;
    if (level === 2) {
      if (current.html.length) sections.push(current);
      sectionIndex += 1;
      current = { id: slug(title, sectionIndex), title, level, html: [] };
      toc.push({ id: current.id, title });
    } else {
      const tag = level === 3 ? "h3" : "h4";
      current.html.push(`<${tag}>${inline(title)}</${tag}>`);
    }
    continue;
  }

  const img = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
  if (img) {
    flushPara();
    flushLists();
    current.html.push(
      `<figure><a href="${esc(img[2])}" target="_blank" rel="noopener"><img src="${esc(img[2])}" alt="${esc(img[1])}" /></a><figcaption>${esc(img[1])}</figcaption></figure>`
    );
    continue;
  }

  const oli = /^\d+\.\s+(.*)$/.exec(trimmed);
  if (oli) {
    flushPara();
    if (ul.length) current.html.push(flushList(ul, "ul"));
    ol.push(oli[1]);
    continue;
  }

  const uli = /^[-*]\s+(.*)$/.exec(trimmed);
  if (uli) {
    flushPara();
    if (ol.length) current.html.push(flushList(ol, "ol"));
    ul.push(uli[1]);
    continue;
  }

  para.push(trimmed);
}

flushPara();
flushLists();
if (current.html.length) sections.push(current);
if (sections[0] && sections[0].id === "start") toc.unshift({ id: "start", title: sections[0].title });

const nav = toc
  .map((item) => `<a href="#${item.id}">${esc(item.title)}</a>`)
  .join("");

const body = sections
  .map(
    (s) => `<section id="${s.id}">
      <h2>${esc(s.title)}</h2>
      ${s.html.join("\n")}
    </section>`
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Как пользоваться — Генератор КП</title>
  <style>
    :root {
      --ink: #1c2b2c;
      --muted: #5c6f70;
      --line: #e3ecec;
      --bg: #f3f7f7;
      --card: #fff;
      --accent: #0f766e;
      --accent-soft: #e7f5f3;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--bg);
      font: 17px/1.55 "Segoe UI", system-ui, sans-serif;
    }
    a { color: var(--accent); }
    header.top {
      background: #0f3d3a;
      color: #fff;
      padding: 28px 24px 22px;
    }
    header.top h1 {
      margin: 0 0 6px;
      font-size: 32px;
      font-weight: 750;
      letter-spacing: -0.03em;
    }
    header.top p { margin: 0; color: #d5ebe8; max-width: 720px; }
    .layout {
      display: grid;
      grid-template-columns: 280px minmax(0, 820px);
      gap: 28px;
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px 20px 80px;
      align-items: start;
    }
    nav {
      position: sticky;
      top: 16px;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px;
      max-height: calc(100vh - 32px);
      overflow: auto;
    }
    nav a {
      display: block;
      text-decoration: none;
      color: var(--ink);
      padding: 8px 10px;
      border-radius: 10px;
      font-size: 14.5px;
      line-height: 1.35;
    }
    nav a:hover { background: var(--accent-soft); color: var(--accent); }
    main {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 8px 36px 40px;
    }
    section { padding-top: 28px; border-top: 1px solid var(--line); }
    section:first-child { border-top: 0; }
    h2 {
      margin: 0 0 14px;
      font-size: 26px;
      letter-spacing: -0.03em;
      scroll-margin-top: 18px;
    }
    h3 { margin: 22px 0 8px; font-size: 20px; }
    h4 { margin: 18px 0 8px; font-size: 17px; }
    p { margin: 0 0 12px; }
    ol, ul { margin: 0 0 14px; padding-left: 1.3em; }
    li { margin: 6px 0; }
    li::marker { color: var(--accent); font-weight: 700; }
    strong { font-weight: 700; }
    figure { margin: 16px 0 20px; }
    img {
      width: 100%;
      height: auto;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: #0e1720;
      display: block;
    }
    figcaption {
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
    }
    @media (max-width: 860px) {
      .layout { grid-template-columns: 1fr; padding: 16px 12px 48px; }
      nav { position: static; max-height: none; }
      main { padding: 4px 16px 28px; }
      header.top h1 { font-size: 26px; }
    }
  </style>
</head>
<body>
  <header class="top">
    <h1>Как пользоваться</h1>
    <p>Настройки контента и генератор коммерческих предложений. Куда нажать, если фото пустое, и откуда программа берёт картинки.</p>
  </header>
  <div class="layout">
    <nav>${nav}</nav>
    <main>${body}</main>
  </div>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, "index.html"), html, "utf8");
console.log("sections", sections.length, "bytes", html.length);
