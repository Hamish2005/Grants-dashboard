import { copyFile, mkdir } from "node:fs/promises";
const destination = new URL("../public/demo-assets/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ["pglite.wasm", "initdb.wasm", "pglite.data"])
  await copyFile(
    new URL(
      `../node_modules/@electric-sql/pglite/dist/${name}`,
      import.meta.url,
    ),
    new URL(name, destination),
  );
await copyFile(
  new URL("../migrations/postgres/0001_initial.sql", import.meta.url),
  new URL("schema.sql", destination),
);
