import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
for (const name of [
  "app.js",
  "calculations.js",
  "storage.js",
  "business-data.js",
  "business-calculations.js",
  "business-ui.js",
])
  execFileSync(process.execPath, ["--check", `dist/${name}`], {
    stdio: "inherit",
  });
const html = await readFile("dist/index.html", "utf8");
for (const match of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))
  await readFile(`dist/${match[1]}`);
console.log("Static application ready: deploy the dist directory.");
