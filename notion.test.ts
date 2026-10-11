import test from "node:test";
import assert from "node:assert/strict";
import { fromPage, NotionClient, NOTION_VERSION, toProperties, type NotionPage } from "../lib/notion";
import { createSeed } from "../lib/seed";

const json = (value: unknown, status=200, headers: Record<string,string>={}) => new Response(JSON.stringify(value), { status, headers: { "Content-Type":"application/json",...headers } });

test("Notion requests use the real data source API and server-side auth", async () => {
  const requests: { url:string; options:RequestInit }[] = [];
  const fetcher = (async (url,options) => { requests.push({ url:String(url), options:options! }); return json({results:[],has_more:false,next_cursor:null}); }) as typeof fetch;
  const client = new NotionClient("private-test-token",fetcher,0);
  assert.deepEqual(await client.queryAll("source-123"),[]);
  assert.equal(requests[0].url,"https://api.notion.com/v1/data_sources/source-123/query");
  const headers = requests[0].options.headers as Record<string,string>;
  assert.equal(headers["Notion-Version"],NOTION_VERSION); assert.equal(headers.Authorization,"Bearer private-test-token");
});
test("query pagination collects all records and follows the next cursor", async () => {
  let count=0;
  const fetcher = (async (_url,options) => { count++; const body=JSON.parse(options?.body as string); if(count===1) { assert.equal(body.page_size,100); return json({results:[{id:"one"}],has_more:true,next_cursor:"next"}); } assert.equal(body.start_cursor,"next"); return json({results:[{id:"two"}],has_more:false,next_cursor:null}); }) as typeof fetch;
  const pages=await new NotionClient("token",fetcher,0).queryAll("source");
  assert.deepEqual(pages.map(p=>p.id),["one","two"]); assert.equal(count,2);
});
test("rate limiting is retried, not represented as a successful sync", async () => {
  let count=0;
  const fetcher=(async()=>++count===1?json({message:"rate limit"},429,{"Retry-After":"1"}):json({ok:true})) as typeof fetch;
  assert.deepEqual(await new NotionClient("token",fetcher,0).request("GET","/users/me"),{ok:true}); assert.equal(count,2);
});
test("Notion authorization failures are surfaced without inventing success", async()=>{
  const fetcher=(async()=>json({message:"Unauthorized"},401)) as typeof fetch;
  await assert.rejects(new NotionClient("token",fetcher,0).request("GET","/users/me"),/Notion \(401\)/);
});
test("network failure leaves a clear retryable error",async()=>{
  const fetcher=(async()=>{throw new Error("network");}) as typeof fetch;
  await assert.rejects(new NotionClient("token",fetcher,0).request("GET","/users/me"),/No sync success was recorded/);
});
test("task properties round-trip owners, deadlines and prerequisite IDs",()=>{
  const data=createSeed(),task=data.tasks[0];
  const page:NotionPage={id:"notion-page",url:"https://notion.so/notion-page",last_edited_time:new Date().toISOString(),properties:toProperties("tasks",task,data)};
  const parsed=fromPage("tasks",page) as typeof task;
  assert.equal(parsed.id,task.id); assert.equal(parsed.ownerId,task.ownerId); assert.equal(parsed.title,task.title); assert.equal(parsed.status,task.status); assert.deepEqual(parsed.dependencies,task.dependencies); assert.equal(parsed.risk,true); assert.equal(parsed.syncState,"synced");
});
test("external records without an EventOS ID are not silently imported",()=>{
  assert.equal(fromPage("tasks",{id:"id",url:"url",last_edited_time:new Date().toISOString(),properties:{}}),null);
});
test("large run-of-show text is split below Notion's per-text limit",()=>{
  const data=createSeed(); data.sessions[0].description="x".repeat(5000);
  const props=toProperties("events",data.events[0],data) as Record<string,any>;
  const parts=props["Run of show"].rich_text as {text:{content:string}}[];
  assert(parts.length>1); assert(parts.every(p=>p.text.content.length<=1900));
  assert.equal(JSON.parse(parts.map(p=>p.text.content).join("")).length,5);
});
