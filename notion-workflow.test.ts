import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { NotionClient, pushNotion, pullNotion, type NotionPage } from "../lib/notion";
import { readStore, mutateStore } from "../lib/store";
import { analyzeVenueChange } from "../lib/dependency";
import { applyVenueChange, markPending } from "../lib/operations";
import { DEMO_EVENT_ID } from "../lib/seed";

// End-to-end connector orchestration against an in-memory fake Notion API.
// This validates push/pull behavior, not a real credentialed workspace.
test("mocked Notion workflow creates records, updates relocation, pulls source edits and preserves local changes", async () => {
  await mkdir(path.join(process.cwd(),".cache"),{recursive:true});
  const directory=await mkdtemp(path.join(process.cwd(),".cache","notion-flow-"));
  process.env.EVENTOS_DATA_FILE=path.join(directory,"state.json");
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  for(const kind of ["EVENTS","TASKS","RESOURCES","PEOPLE"]) process.env[`NOTION_${kind}_DATA_SOURCE_ID`]=kind.toLowerCase();
  const pages=new Map<string,NotionPage & {source:string;archived?:boolean}>();
  let creates=0,patches=0;
  const fetcher=(async (url,options)=>{
    const endpoint=new URL(String(url)).pathname.slice(3);
    const body=options?.body?JSON.parse(options.body as string):{};
    const response=(value:unknown)=>new Response(JSON.stringify(value),{headers:{"Content-Type":"application/json"}});
    if(endpoint.endsWith("/query")) {
      const source=endpoint.split("/")[2];
      return response({results:[...pages.values()].filter(p=>p.source===source&&!p.archived),has_more:false,next_cursor:null});
    }
    if(endpoint==="/pages"&&options?.method==="POST") {
      const id=`mock-page-${++creates}`;
      const page={id,url:`https://notion.so/${id}`,properties:body.properties,last_edited_time:new Date().toISOString(),source:body.parent.data_source_id};
      pages.set(id,page); return response(page);
    }
    if(endpoint.startsWith("/pages/")&&options?.method==="PATCH") {
      patches++; const page=pages.get(endpoint.split("/")[2])!;
      if(body.properties) page.properties=body.properties;
      if(body.archived) page.archived=true;
      page.last_edited_time=new Date().toISOString(); return response(page);
    }
    throw new Error(`Unexpected mock request: ${options?.method} ${endpoint}`);
  }) as typeof fetch;
  const client=new NotionClient("mock-token",fetcher,0);
  try {
    const first=await pushNotion(client); assert.equal(first.synced,59); assert.deepEqual(first.failures,[]); assert.equal(creates,59); assert.equal(patches,0);
    let data=await readStore(); assert(data.tasks.every(t=>t.syncState==="synced")); assert(data.sessions.every(s=>s.syncState==="synced"));
    const report=analyzeVenueChange(data,DEMO_EVENT_ID,"Seminar Hall B","mock-change"); assert.equal(report.source,"Notion-synchronized data");
    await mutateStore(data=>applyVenueChange(data,{eventId:report.eventId,newVenue:report.newVenue,oldVenue:report.oldVenue,revision:report.revision,changeId:report.id,createFollowups:true}));
    const second=await pushNotion(client); assert.equal(second.synced,15); assert.equal(creates,64); assert.equal(patches,10); assert.equal(pages.size,64);
    const remoteEvent=[...pages.values()].find(p=>p.source==="events")!;
    assert.equal(remoteEvent.properties.Venue.rich_text[0].text.content,"Seminar Hall B");
    data=await readStore(); const projector=data.tasks.find(t=>t.id==="task-projector")!;
    const remote=pages.get(projector.notionPageId!)!; remote.properties.Status={select:{name:"Done"}}; remote.properties.Task={title:[{text:{content:"AV setup verified in Notion"}}]};
    await mutateStore(data=>{const task=data.tasks.find(t=>t.id==="task-volunteers")!;task.description="Keep this local edit";markPending(task);});
    const pulled=await pullNotion(client); assert.equal(pulled.imported,63); assert.equal(pulled.skipped,1);
    data=await readStore(); assert.equal(data.tasks.find(t=>t.id==="task-projector")?.title,"AV setup verified in Notion"); assert.equal(data.tasks.find(t=>t.id==="task-projector")?.status,"Done"); assert.equal(data.tasks.find(t=>t.id==="task-volunteers")?.description,"Keep this local edit"); assert.equal(data.tasks.find(t=>t.id==="task-volunteers")?.syncState,"pending");
    assert.equal(creates,64); assert.equal(data.events[0].venue,"Seminar Hall B"); assert(data.sync.lastPulledAt);
    await mutateStore(data => { data.sync.status="syncing"; data.sync.jobId="another-worker"; data.sync.startedAt=new Date().toISOString(); });
    await assert.rejects(pushNotion(client), /already running/);
    assert.equal((await readStore()).sync.jobId,"another-worker");
    await mutateStore(data => { data.sync.startedAt=new Date(Date.now()-301000).toISOString(); });
    const recovered=await pushNotion(client); assert.equal(recovered.synced,1); assert.equal((await readStore()).sync.status,"idle"); assert.equal((await readStore()).sync.jobId,undefined); assert.equal(creates,64);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
