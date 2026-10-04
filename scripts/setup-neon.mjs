import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env first.");
const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
const schema = await readFile(new URL("../database/schema.sql", import.meta.url), "utf8");
for (const statement of schema.replace(/--[^\r\n]*/g, "").split(";").filter(part => part.trim())) {
  await sql.query(statement);
}
console.log("Neon tables and pgvector are ready.");
