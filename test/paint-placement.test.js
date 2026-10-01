import test from 'node:test';
import assert from 'node:assert/strict';
import { cropPaintPlacement, defaultPaintPlacement } from '../js/features/paint/paint-placement-model.js';
import { createPaintSession } from '../js/features/paint/paint-session.js';
import { surfacePreset } from '../js/domain/placement-geometry.js';
import { sanitizeCustomAsset } from '../js/core/state-schema.js';
import { customAssetToDescriptor } from '../js/core/asset-registry.js';
function table() {
 const m=defaultPaintPlacement();m.groundAnchor={x:.5,y:.65};m.anchorAuthored=true;m.footprintAuthored=true;
 m.supportSurfaces=[{id:'top',name:'Tabletop',polygon:surfacePreset('trapezoid',.3,.4,.4,.1),acceptsTags:['small-prop'],authoringPreset:'trapezoid'}];return m;
}
test('Crop aligns the contact, footprint, and surface at a non-2x backing scale',()=>{
 const m=cropPaintPlacement(table(),{x:300,y:450,width:900,height:600},1500,1500);
 assert(Math.abs(m.groundAnchor.x-.5)<1e-9);assert(Math.abs(m.groundAnchor.y-.875)<1e-9);
 assert(Math.abs(m.placementRules.contactFootprint.width-.25)<1e-9);
 assert(Math.abs(m.supportSurfaces[0].polygon[0][1]-.25)<1e-9);
});
test('Crop rejects geometry beyond artwork rather than clamping a surface',()=>{
 assert.throws(()=>cropPaintPlacement(table(),{x:600,y:600,width:300,height:300},1500,1500),/PLACEMENT_OUTSIDE_CROP/);
});
test('Suggested ground contact follows cropped art; old custom art can stay free',()=>{
 const m=cropPaintPlacement(defaultPaintPlacement(),{x:100,y:100,width:100,height:100},1000,1000);assert.deepEqual(m.groundAnchor,{x:.5,y:1});
 const session=createPaintSession({itemType:'prop',placementMetadata:null});assert.equal(session.getState().placementMetadata,null);
});
test('One history sequence interleaves raster and lightweight metadata entries',()=>{
 const session=createPaintSession({itemType:'prop'});const before=session.getState().placementMetadata;
 const pixels={width:1,height:1,data:new Uint8ClampedArray([1,2,3,4])};session.pushHistory(pixels);
 assert(session.setPlacementMetadata(table()));const edited=session.getState().placementMetadata;
 const previous=session.undo({placementMetadata:edited});assert(previous.placementMetadata);assert.deepEqual(session.getState().placementMetadata,before);
 assert.equal(session.undo(pixels),pixels);
 assert.equal(session.redo(pixels),pixels);session.redo({placementMetadata:before});assert.deepEqual(session.getState().placementMetadata,edited);
});
test('Metadata is isolated, validates host restrictions, and survives custom registry projection',()=>{
 const session=createPaintSession({itemType:'prop'});const m=table();assert(session.setPlacementMetadata(m));m.supportSurfaces[0].polygon[0][0]=0;assert.notEqual(session.getState().placementMetadata.supportSurfaces[0].polygon[0][0],0);
 const invalid=table();invalid.placementRules.allowedTargets=['floor','surface'];assert(!session.setPlacementMetadata(invalid));
 const asset=sanitizeCustomAsset({assetId:'custom_table',kind:'prop',name:'Table',...table()});assert(asset);assert.equal(customAssetToDescriptor(asset).supportSurfaces[0].id,'top');
});
