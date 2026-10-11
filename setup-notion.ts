import { NotionClient, NOTION_SCHEMAS, type Collection } from "../lib/notion";

async function main() {
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_PARENT_PAGE_ID) throw new Error("Set NOTION_API_KEY and NOTION_PARENT_PAGE_ID in .env.local first. Share the parent page with your integration.");
  const client = new NotionClient(process.env.NOTION_API_KEY);
  console.log("Creating four NEW EventOS databases under your shared parent page…");
  console.log("Run this setup only once; it intentionally does not reuse arbitrary existing databases.\n");
  for (const kind of ["events", "tasks", "resources", "people"] as Collection[]) {
    const label = kind[0].toUpperCase() + kind.slice(1);
    const database = await client.request<{ id: string; data_sources?: { id: string }[] }>("POST", "/databases", { parent: { type: "page_id", page_id: process.env.NOTION_PARENT_PAGE_ID }, title: [{ type: "text", text: { content: `EventOS · ${label}` } }], initial_data_source: { properties: NOTION_SCHEMAS[kind] } });
    let sourceId = database.data_sources?.[0]?.id;
    if (!sourceId) {
      const result = await client.request<{ data_sources: { id: string }[] }>("GET", `/databases/${database.id}`);
      sourceId = result.data_sources?.[0]?.id;
    }
    if (!sourceId) throw new Error(`Created ${label} database ${database.id}, but no data source was returned. Retrieve its data source ID from Notion before retrying setup.`);
    console.log(`NOTION_${kind.toUpperCase()}_DATA_SOURCE_ID=${sourceId}`);
  }
  console.log("\nCopy these IDs into .env.local, restart the app, check the connection, then explicitly sync your local records.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
