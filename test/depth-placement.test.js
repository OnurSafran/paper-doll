import test from 'node:test';
import assert from 'node:assert/strict';
import { getAsset } from '../js/core/asset-catalog.js';
import { createEmptyScene, addEntity, moveEntity, flipEntity, scaleEntity, deleteEntity } from '../js/domain/scene-rules.js';
import { placeEntity, setPlacementMode, getPlacementRegions, projectLocal, unprojectLocal, orderedSceneEntities } from '../js/domain/scene-placement.js';
import { validPolygon, surfacePreset } from '../js/domain/placement-geometry.js';
import { sanitizeScene, cloneScene, createDefaultEnvelope, sanitizeEnvelope, SCHEMA_VERSION } from '../js/core/state-schema.js';
import { createAppStore } from '../js/core/app-store.js';
function furnished() {
 let s = setPlacementMode(createEmptyScene('test'), 'room', getAsset);
 s = addEntity(s, { instanceId:'table', kind:'prop',sourceId:'prop_table', x:800,y:780 }, getAsset);
 s = addEntity(s, { instanceId:'tea',kind:'prop',sourceId:'prop_tea_set',x:900,y:800 },getAsset);
 return s;
}
test('Floor clamps footprints rather than tall artwork; wall fits whole art', () => {
 let s=furnished(); s=moveEntity(s,'table',800,100,getAsset);
 assert(s.entities[0].y >= 648 && s.entities[0].y < 652);
 s=addEntity(s,{instanceId:'picture',kind:'prop',sourceId:'prop_painting',x:800,y:900},getAsset);
 const picture=s.entities.find(e=>e.instanceId==='picture');
 assert(picture.y + getAsset('prop_painting').displayHeight / 2 <= 646);
});
test('Surface follows host move, scale, flip; child nudge stays on support; delete preserves child',()=>{
 let s=furnished();
 s=placeEntity(s,'tea',{x:790,y:640},getAsset,{target:{kind:'surface',hostId:'table',surfaceId:'tabletop'}});
 const child=s.entities[1]; assert.equal(child.placement.kind,'surface');
 s=moveEntity(s,'tea',200,850,getAsset);assert.equal(s.entities[1].attachedTo,'table');
 s=moveEntity(s,'table',1100,800,getAsset);assert.equal(s.entities[1].attachedTo,'table');
 let projected=projectLocal(s.entities[0],s.entities[1].placement.localPoint,getAsset); assert(Math.hypot(projected.x-s.entities[1].x,projected.y-s.entities[1].y)<1e-8);
 s=scaleEntity(s,'table',1.2,getAsset);assert.equal(s.entities[0].scale,1.2);
 s=flipEntity(s,'table',getAsset);assert(s.entities[0].flipped);assert(!s.entities[1].flipped);
 projected=projectLocal(s.entities[0],s.entities[1].placement.localPoint,getAsset);assert(Math.hypot(projected.x-s.entities[1].x,projected.y-s.entities[1].y)<1e-8);
 const before={x:s.entities[1].x,y:s.entities[1].y};s=deleteEntity(s,'table');assert.deepEqual({x:s.entities[0].x,y:s.entities[0].y},before);assert.equal(s.entities[0].placement.reason,'support-missing');
});
test('Drag transfer and invalid targets are safe',()=>{
 let s=furnished();s=placeEntity(s,'tea',{x:800,y:640},getAsset,{transfer:true});assert.equal(s.entities[1].placement.kind,'surface');
 s=placeEntity(s,'tea',{x:1000,y:800},getAsset,{transfer:true});assert.equal(s.entities[1].placement.kind,'floor');
 assert.equal(placeEntity(s,'table',{x:800,y:640},getAsset,{target:{kind:'surface',hostId:'table',surfaceId:'tabletop'}}),s);
});
test('Projection round trips with asymmetric anchor and mirrored artwork',()=>{
 const lookup=()=>({displayWidth:200,displayHeight:300,groundAnchor:{x:.2,y:.8}});
 for(const flipped of [false,true]) {const host={kind:'prop',instanceId:'host',x:100,y:500,scale:1.5,flipped}; const p={x:.7,y:.3};const round=unprojectLocal(host,projectLocal(host,p,lookup),lookup); assert(Math.abs(round.x-p.x)<1e-9&&Math.abs(round.y-p.y)<1e-9);}
});
test('Continuous room planes span mirrored native tiles in panoramas',()=>{
 const s={...furnished(),stageWidth:4800};const r=getPlacementRegions(s,getAsset);assert.equal(r.length,2);assert.equal(r[0].regionId,'floor:0');assert.equal(Math.max(...r[0].polygon.map(p=>p[0])),4800);
});
test('Depth keeps assemblies together and ground decorations below furniture',()=>{
 let s=furnished();s=placeEntity(s,'tea',{x:800,y:640},getAsset,{transfer:true});s=addEntity(s,{instanceId:'rug',kind:'prop',sourceId:'prop_rug',x:800,y:850},getAsset);
 assert.deepEqual(orderedSceneEntities(s,getAsset).map(e=>e.instanceId),['rug','table','tea']);
});
test('Persistence regenerates local support outputs; unavailable support stays a free exception',()=>{
 let s=furnished();s=placeEntity(s,'tea',{x:800,y:640},getAsset,{transfer:true});const stored=cloneScene(s);stored.entities[1].x+=40;
 const loaded=sanitizeScene(stored,getAsset);assert.equal(loaded.entities[1].x,s.entities[1].x);assert.equal(loaded.placementMode,'room');
 const missing=sanitizeScene({...s,entities:[s.entities[1]]},getAsset);assert.equal(missing.entities[0].placement.reason,'support-missing');
});
test('Schema 6 arrangements reset for the new paper stage',()=>{
 const old={...createDefaultEnvelope(),schemaVersion:6,currentScene:furnished()};
 const restored=sanitizeEnvelope(old,getAsset);
 assert.equal(restored.envelope.schemaVersion,SCHEMA_VERSION);
 assert.equal(restored.resetRequired,true);
 assert.equal(restored.envelope.currentScene,null);
});

test('Placement commits one undo entry',()=>{
 const store=createAppStore({...createDefaultEnvelope(),currentScene:furnished()},{getAsset});
 store.dispatch({type:'scene/placeEntity',instanceId:'tea',x:800,y:640,transfer:true});assert.equal(store.getState().currentScene.entities[1].placement.kind,'surface');
 store.dispatch({type:'app/undo'});assert.equal(store.getState().currentScene.entities[1].placement.kind,'floor');
 store.dispatch({type:'app/redo'});assert.equal(store.getState().currentScene.entities[1].placement.kind,'surface');
});
test('Convex presets validate; degenerate and self-intersecting geometry is rejected',()=>{
 for(const preset of ['rectangle','oval','trapezoid']) assert(validPolygon(surfacePreset(preset,.1,.2,.6,.1)));
 assert(!validPolygon([[0,0],[1,1],[0,1],[1,0]]));assert(!validPolygon([[0,0],[1,0],[.5,0]]));
});

test('Furnished duplication remaps support references and preserves one assembly',async()=>{
 const { duplicateEntity }=await import('../js/domain/scene-rules.js');
 let s=furnished();s=placeEntity(s,'tea',{x:800,y:640},getAsset,{transfer:true});
 const copied=duplicateEntity(s,'table','table-copy',getAsset,()=> 'tea-copy', true);
 assert.equal(copied.entities.length,4);const child=copied.entities.find(e=>e.instanceId==='tea-copy');
 assert.equal(child.attachedTo,'table-copy');assert.equal(child.placement.kind,'surface');
 assert.deepEqual(child.placement.localPoint,s.entities[1].placement.localPoint);
});
test('Invalid host scale is atomic and preserves its supported child',()=>{
 let s=furnished();s=placeEntity(s,'tea',{x:800,y:640},getAsset,{transfer:true});
 s=scaleEntity(s,'tea',2,getAsset);
 const result=scaleEntity(s,'table',.5,getAsset);assert.equal(result,s);
});
test('Generic parenting cannot turn furnished furniture into a nested support host',async()=>{
 const { attachEntity }=await import('../js/domain/scene-rules.js');
 let s=furnished();s=placeEntity(s,'tea',{x:800,y:640},getAsset,{transfer:true});
 s=addEntity(s,{instanceId:'chair',kind:'prop',sourceId:'prop_chair',x:1100,y:800},getAsset);
 assert.equal(attachEntity(s,'table','chair',getAsset),s);
});
