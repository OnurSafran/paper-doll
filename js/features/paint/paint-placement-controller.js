import { moveEntity } from '../../domain/scene-rules.js';
import { surfacePreset } from '../../domain/placement-geometry.js';
import { SURFACE_PRESETS } from '../../domain/placement-vocabulary.js';
import { defaultPaintPlacement, cropPaintPlacement } from './paint-placement-model.js';
import { computeNonTransparentBounds, calculatePropDisplayDimensions } from './paint-raster.js';
import { placeEntity, projectLocal } from '../../domain/scene-placement.js';
import { t } from '../../core/i18n.js';

/** Placement overlays never touch the raster. Each completed edit adds one history entry. */
export function createPaintPlacementController(context) {
  const doc = context.rootElement.ownerDocument || document;
  let keepProportions = false;
  let panel = null, overlay = null, selectedId = null, drag = null, previewMetadata = null;
  const ns = 'http://www.w3.org/2000/svg';
  const svgNode = (tag, attrs = {}) => { const node = doc.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value)); return node; };
  const metadata = () => previewMetadata || context.getSession().getState().placementMetadata || defaultPaintPlacement();
  function commit(value) {
    if (context.getSession().setPlacementMetadata(value)) {
      context.updateHistoryButtons(); context.scheduleCheckpoint();
    }
    render();
  }
  function button(key, action) { const node = doc.createElement('button'); node.type = 'button'; node.className = 'button secondary compact-action'; node.textContent = t(key); node.dataset.placementField = key; node.addEventListener('click', action); return node; }
  function field(key, value, onChange, { min = 0, max = 500, step = 1 } = {}) {
    const label = doc.createElement('label'); label.textContent = t(key);
    const input = doc.createElement('input'); input.type = 'number'; input.dataset.placementField = key; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(Math.round(value * 1000) / 1000);
    input.addEventListener('change', () => { const n = Number(input.value); if (Number.isFinite(n) && n >= min && n <= max) onChange(n); else input.value = String(value); });
    label.append(input); return label;
  }
  function bounds(surface) {
    const xs = surface.polygon.map(p => p[0]), ys = surface.polygon.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, depth: Math.max(...ys) - y };
  }
  function trapezoidRatio(surface) {
    return surface.authoringPreset === 'trapezoid' ? (surface.polygon[1][0] - surface.polygon[0][0]) / bounds(surface).width : .7;
  }
  function changeSurface(changes) {
    const value = metadata(), surface = value.supportSurfaces.find(s => s.id === selectedId); if (!surface) return;
    const oldBox = bounds(surface);
    const box = { ...oldBox, ...changes };
    if (keepProportions && changes.width != null) box.depth = box.width * oldBox.depth / oldBox.width;
    if (keepProportions && changes.depth != null) box.width = box.depth * oldBox.width / oldBox.depth;
    surface.polygon = surfacePreset(surface.authoringPreset || 'rectangle', box.x, box.y, box.width, box.depth, changes.rearWidth ?? trapezoidRatio(surface));
    commit(value);
  }
  function addPreset(preset, point = { x: .5, y: .35 }) {
    const next = metadata();
    if (next.supportSurfaces.length >= 4 || next.placementRules.allowedTargets.join(',') !== 'floor') return;
    const id = `surface_${globalThis.crypto.randomUUID()}`; selectedId = id;
    next.placementRules.tags = ['furniture'];
    const x = Math.max(0, Math.min(.4, point.x - .3)), y = Math.max(0, Math.min(.9, point.y - .05));
    next.supportSurfaces.push({ id, name: t('placement.tabletop'), authoringPreset: preset, polygon: surfacePreset(preset, x, y, .6, .1), acceptsTags: ['small-prop'] });
    commit(next);
  }
  function ensureElements() {
    if (panel || !context.canvasStage?.parentElement) return;
    panel = doc.createElement('div'); panel.className = 'paint-placement-panel';
    const sidebar = context.rootElement.querySelector('.paint-sidebar');
    if (sidebar) sidebar.prepend(panel);
    else context.canvasStage.parentElement.parentElement.insertBefore(panel, context.canvasStage.parentElement);
    overlay = svgNode('svg', { viewBox: '0 0 500 500', class: 'paint-placement-overlay', 'aria-label': t('placement.surfaceEditor') });
    context.canvasStage.append(overlay);
    overlay.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('application/x-paper-surface')) event.preventDefault(); });
    overlay.addEventListener('drop', event => { const preset = event.dataTransfer.getData('application/x-paper-surface'); if (!SURFACE_PRESETS.includes(preset)) return; event.preventDefault(); addPreset(preset, pointerPoint(event)); });
    overlay.addEventListener('pointerdown', onPointerDown);
    overlay.addEventListener('pointermove', onPointerMove);
    overlay.addEventListener('pointerup', onPointerUp);
    overlay.addEventListener('pointercancel', cancel);
    overlay.addEventListener('lostpointercapture', cancel);
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); cancel(); }
      if (!event.key.startsWith('Arrow')) return;
      const step = event.shiftKey ? .002 : .02; const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0; const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      event.preventDefault(); const value = metadata();
      if (event.target.dataset.anchor) { value.groundAnchor.x += dx; value.groundAnchor.y += dy; value.anchorAuthored = true; commit(value); }
      else { const surface = value.supportSurfaces.find(s => s.id === event.target.dataset.surface); if (surface) { selectedId = surface.id; const box = bounds(surface); changeSurface({ x: box.x + dx, y: box.y + dy }); } }
    });
  }
  function render() {
    ensureElements(); if (!panel) return;
    const focusedField = doc.activeElement?.dataset?.placementField;
    const session = context.getSession(), state = session.getState();
    panel.hidden = state.itemType !== 'prop';
    const active = state.itemType === 'prop' && state.placementMode === 'placement';
    overlay.setAttribute('aria-label', t('placement.surfaceEditor'));
    context.rootElement.querySelector('#paint-screen')?.classList.toggle('is-placement-mode', active);
    const tools = context.rootElement.querySelector('#paint-tools-toolbar'); if (tools) tools.inert = active;
    for (const id of ['#paint-clear-btn', '#paint-mirror-btn']) { const control = context.rootElement.querySelector(id); if (control) control.disabled = active; }
    overlay.style.display = active ? 'block' : 'none';
    context.canvasStage.classList.toggle('is-placement-mode', active);
    const old = context.rootElement.querySelector('#paint-prop-placement-select'); if (old) { old.hidden = true; const label = context.rootElement.querySelector('label[for="paint-prop-placement-select"]'); if (label) label.hidden = true; }
    panel.replaceChildren(button(active ? 'placement.draw' : 'placement.edit', () => { cancel(); context.cancelTransientOperation(); session.setPlacementMode(active ? 'draw' : 'placement'); render(); }));
    if (!active) return;
    const value = metadata();
    const targets = doc.createElement('select'); targets.setAttribute('aria-label', t('placement.destinations')); targets.dataset.placementField='destinations';
    for (const name of ['floor','wall','floorSurface']) {
      const option = doc.createElement('option'); option.value = name; option.textContent = t(`placement.${name}`); option.selected = value.placementRules.allowedTargets.join(',') === (name === 'wall' ? 'wall' : name === 'floorSurface' ? 'floor,surface' : 'floor'); option.disabled = value.supportSurfaces.length > 0 && name !== 'floor'; targets.append(option);
    }
    targets.addEventListener('change', () => { const next = metadata(); next.placementRules.allowedTargets = targets.value === 'wall' ? ['wall'] : targets.value === 'floorSurface' ? ['floor','surface'] : ['floor']; next.placementRules.tags = targets.value === 'floorSurface' ? ['small-prop'] : next.supportSurfaces.length ? ['furniture'] : []; if (!next.anchorAuthored) next.groundAnchor = { x: .5, y: targets.value === 'wall' ? .5 : 1 }; commit(next); });
    panel.append(targets);
    for (const [key, axis] of [['anchorX','x'],['anchorY','y']]) panel.append(field(`placement.${key}`, value.groundAnchor[axis] * 500, n => { const next=metadata(); next.groundAnchor[axis]=n/500; next.anchorAuthored=true; commit(next); }));
    for (const [key, axis] of [['baseWidth','width'],['baseDepth','depth']]) panel.append(field(`placement.${key}`, value.placementRules.contactFootprint[axis] * 500, n => { const next=metadata(); next.placementRules.contactFootprint[axis]=n/500; next.footprintAuthored=true; commit(next); }, { min: 1 }));
    for (const preset of SURFACE_PRESETS) {
      const add = button(`placement.${preset}`, () => addPreset(preset));
      add.disabled = value.supportSurfaces.length >= 4 || value.placementRules.allowedTargets.join(',') !== 'floor';
      add.draggable = !add.disabled;
      add.addEventListener('dragstart', event => { event.dataTransfer.setData('application/x-paper-surface', preset); event.dataTransfer.effectAllowed = 'copy'; });
      panel.append(add);
    }
    const list = doc.createElement('select'); list.setAttribute('aria-label',t('placement.surfaces')); list.dataset.placementField='surfaces';
    for(const surface of value.supportSurfaces) {const option=doc.createElement('option');option.value=surface.id;option.textContent=surface.name;option.selected=surface.id===selectedId;list.append(option);}
    list.addEventListener('change',()=>{selectedId=list.value;render();});panel.append(list);
    const surface=value.supportSurfaces.find(s=>s.id===selectedId);
    if(surface) {
      const name=doc.createElement('input');name.type='text';name.maxLength=30;name.value=surface.name;name.setAttribute('aria-label',t('placement.surfaceName')); name.dataset.placementField='surfaceName';
      name.addEventListener('change',()=>{if(name.value.trim()){const next=metadata();next.supportSurfaces.find(s=>s.id===selectedId).name=name.value.trim();commit(next);}});panel.append(name);
      const proportions = doc.createElement('label'); const check = doc.createElement('input'); check.type='checkbox'; check.checked=keepProportions; check.addEventListener('change',()=>{keepProportions=check.checked;}); proportions.append(check,doc.createTextNode(t('placement.keepProportions'))); panel.append(proportions);
      const box=bounds(surface);
      for(const [key,label] of [['x','surfaceX'],['y','surfaceY'],['width','width'],['depth','depth']]) panel.append(field(`placement.${label}`,box[key]*500,n=>changeSurface({[key]:n/500}),{min:['width','depth'].includes(key)?1:0}));
      if (surface.authoringPreset === 'trapezoid') panel.append(field('placement.rearWidth', trapezoidRatio(surface) * box.width * 500, n => changeSurface({ rearWidth: n / (box.width * 500) }), { min: 1, max: box.width * 500 }));
      for (const [key, amount] of [['moveLeft', {x:box.x-.01}],['moveRight',{x:box.x+.01}],['moveUp',{y:box.y-.01}],['moveDown',{y:box.y+.01}],['wider',{width:box.width+.01}],['narrower',{width:box.width-.01}],['deeper',{depth:box.depth+.01}],['shallower',{depth:box.depth-.01}]]) panel.append(button(`placement.${key}`, () => changeSurface(amount)));
      panel.append(button('placement.duplicate',()=>{const next=metadata();if(next.supportSurfaces.length>=4)return;const copy=globalThis.structuredClone(surface);copy.id=`surface_${globalThis.crypto.randomUUID()}`;next.supportSurfaces.push(copy);selectedId=copy.id;commit(next);}));
      panel.append(button('placement.magnify', () => {
        let detail = panel.querySelector('.placement-surface-detail');
        if (!detail) { detail = doc.createElement('div'); detail.className = 'placement-surface-detail'; panel.append(detail); }
        const current = metadata().supportSurfaces.find(s => s.id === selectedId);
        const b = bounds(current); const zoom = svgNode('svg', { viewBox: `${b.x*500-10} ${b.y*500-10} ${b.width*500+20} ${b.depth*500+20}`, role: 'img', 'aria-label': current.name });
        const backdrop = svgNode('image', { href: context.getCanvas().toDataURL(), x: 0, y: 0, width: 500, height: 500 });
        zoom.append(backdrop, svgNode('polygon', { points: current.polygon.map(p => p.map(n => n*500).join(',')).join(' '), fill: '#2a9d8f44', stroke: '#237d71', 'stroke-width': 2 })); detail.replaceChildren(zoom);
      }));
      panel.append(button('placement.remove',()=>{const next=metadata();next.supportSurfaces=next.supportSurfaces.filter(s=>s.id!==selectedId);selectedId=null;commit(next);}));
    }
    const hint=doc.createElement('p');hint.textContent=t('placement.authorHint');panel.append(hint);
    panel.append(button('placement.tryIt',tryPreview));
    renderOverlay();
    if (focusedField) [...panel.querySelectorAll('[data-placement-field]')].find(node => node.dataset.placementField === focusedField)?.focus();
  }
  function renderOverlay() {
    if(!overlay)return;
    const focused = doc.activeElement?.closest?.('[data-surface],[data-anchor]');
    const focusedSurface = focused?.dataset?.surface, focusedAnchor = focused?.dataset?.anchor;
    overlay.replaceChildren();const value=metadata();
    const hitSize = 44 * 500 / (overlay.getBoundingClientRect().width || 500);
    for(const surface of value.supportSurfaces) {
      const polygon=svgNode('polygon',{points:surface.polygon.map(p=>p.map(n=>n*500).join(',')).join(' '),tabindex:0,role:'button','aria-label':surface.name,'data-surface':surface.id});overlay.append(polygon);
      if(surface.id===selectedId) {const b=bounds(surface);for(const [hx,hy] of [[0,0],[.5,0],[1,0],[1,.5],[1,1],[.5,1],[0,1],[0,.5]])overlay.append(svgNode('rect',{x:(b.x+b.width*hx)*500-hitSize/2,y:(b.y+b.depth*hy)*500-hitSize/2,width:hitSize,height:hitSize,class:'surface-resize-handle','data-surface':surface.id,'data-hx':hx,'data-hy':hy}));}
    }
    const f=value.placementRules.contactFootprint;
    overlay.append(svgNode('rect',{x:(value.groundAnchor.x-f.width/2)*500,y:(value.groundAnchor.y-f.depth/2)*500,width:f.width*500,height:f.depth*500,class:'contact-footprint'}));
    overlay.append(svgNode('circle',{cx:value.groundAnchor.x*500,cy:value.groundAnchor.y*500,r:hitSize/2,tabindex:0,role:'button','aria-label':t('placement.contact'),'data-anchor':'true'}));
    if (focusedAnchor) overlay.querySelector('[data-anchor]')?.focus();
    else if (focusedSurface) overlay.querySelector(`polygon[data-surface="${focusedSurface}"]`)?.focus();
  }
  function pointerPoint(event) {const rect=overlay.getBoundingClientRect();return{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height};}
  function onPointerDown(event) {
    const node=event.target.closest('[data-surface],[data-anchor]');if(!node)return;
    event.preventDefault();event.stopPropagation();selectedId=node.dataset.surface||selectedId;
    drag={pointerId:event.pointerId,start:pointerPoint(event),before:metadata(),anchor:Boolean(node.dataset.anchor),surfaceId:node.dataset.surface,hx:node.dataset.hx==null?null:Number(node.dataset.hx),hy:node.dataset.hy==null?null:Number(node.dataset.hy)};
    overlay.setPointerCapture(event.pointerId);render();
  }
  function onPointerMove(event) {
    if(!drag||event.pointerId!==drag.pointerId)return;
    const point=pointerPoint(event),dx=point.x-drag.start.x,dy=point.y-drag.start.y;const next=globalThis.structuredClone(drag.before);
    if(drag.anchor){next.groundAnchor={x:Math.max(0,Math.min(1,next.groundAnchor.x+dx)),y:Math.max(0,Math.min(1,next.groundAnchor.y+dy))};next.anchorAuthored=true;}
    else {const surface=next.supportSurfaces.find(s=>s.id===drag.surfaceId);const b=bounds(surface);if(drag.hx==null){b.x=Math.max(0,Math.min(1-b.width,b.x+dx));b.y=Math.max(0,Math.min(1-b.depth,b.y+dy));}else{
      const right=b.x+b.width,bottom=b.y+b.depth;
      if(drag.hx===0){b.x=Math.max(0,Math.min(right-.01,b.x+dx));b.width=right-b.x;}if(drag.hx===1)b.width=Math.max(.01,Math.min(1-b.x,b.width+dx));
      if(drag.hy===0){b.y=Math.max(0,Math.min(bottom-.01,b.y+dy));b.depth=bottom-b.y;}if(drag.hy===1)b.depth=Math.max(.01,Math.min(1-b.y,b.depth+dy));
      if (keepProportions) { const ratio = bounds(surface).depth / bounds(surface).width; if (drag.hx !== .5) b.depth = Math.min(1 - b.y, b.width * ratio); else b.width = Math.min(1 - b.x, b.depth / ratio); }
    }surface.polygon=surfacePreset(surface.authoringPreset,b.x,b.y,b.width,b.depth,trapezoidRatio(surface));}
    previewMetadata=next;renderOverlay();
  }
  function onPointerUp(event) {if(!drag||event.pointerId!==drag.pointerId)return;const next=previewMetadata;drag=null;previewMetadata=null;overlay.releasePointerCapture(event.pointerId);if(next)commit(next);else render();}
  function cancel() {if(!drag)return;const id=drag.pointerId;drag=null;previewMetadata=null;if(overlay.hasPointerCapture(id))overlay.releasePointerCapture(id);render();}
  function tryPreview() {
    const canvas=context.getCanvas();const ctx=canvas.getContext('2d');const crop=computeNonTransparentBounds(ctx.getImageData(0,0,canvas.width,canvas.height));
    if(crop.empty){context.announceStatus(t('placement.emptyDrawing'));return;}
    let value;try{value=cropPaintPlacement(metadata(),crop,canvas.width,canvas.height);}catch{context.announceStatus(t('placement.cropInvalid'));return;}
    const dims=calculatePropDisplayDimensions(crop.aspectRatio,context.getSession().getState().propSize);
    const assets={host:{...dims,...value},lamp:{displayWidth:55,displayHeight:85,groundAnchor:{x:.5,y:1},placementRules:{allowedTargets:['floor','surface'],tags:['small-prop'],contactFootprint:{width:.25,depth:.02},renderClass:'upright'}}};
    const lookup=id=>assets[id];let scene={placementMode:'free',stageWidth:1600,backgroundId:'',entities:[{instanceId:'host',kind:'prop',sourceId:'host',x:800,y:750,scale:1,flipped:false,order:1},{instanceId:'lamp',kind:'prop',sourceId:'lamp',x:800,y:750,scale:1,flipped:false,order:2}]};
    if(!value.supportSurfaces.length){context.announceStatus(t('placement.addSurfaceFirst'));return;}
    scene=placeEntity(scene,'lamp',projectLocal(scene.entities[0],{x:.5,y:.35},lookup),lookup,{target:{kind:'surface',hostId:'host',surfaceId:value.supportSurfaces.find(s=>s.id===selectedId)?.id||value.supportSurfaces[0].id}});
    if(scene.entities[1].placement?.kind!=='surface'){context.announceStatus(t('placement.sampleNoFit'));return;}
    let preview=panel.querySelector('.placement-test-preview');if(!preview){preview=doc.createElement('div');preview.className='placement-test-preview';panel.append(preview);}
    const image=doc.createElement('canvas');image.width=crop.width;image.height=crop.height;image.getContext('2d').drawImage(canvas,crop.x,crop.y,crop.width,crop.height,0,0,crop.width,crop.height);
    const svg=svgNode('svg',{viewBox:'550 350 500 500',role:'img','aria-label':t('placement.tryIt')});svg.append(svgNode('rect',{x:550,y:350,width:500,height:500,fill:'#fff4e9'}));svg.append(svgNode('rect',{x:550,y:700,width:500,height:150,fill:'#e6cba8'}));
    const hostArt = svgNode('image', { href: image.toDataURL(), width: dims.displayWidth, height: dims.displayHeight, tabindex: 0, role: 'button', 'aria-label': t('placement.movePreviewHost') });
    const lampArt = svgNode('g'); lampArt.append(svgNode('path', { d: 'M-25 -55 L-14 -85 H14 L25 -55 Z M0 -55 V-5 M-16 -5 H16', fill: '#f4c76b', stroke: '#493c34', 'stroke-width': 5 }));
    function update() { const host = scene.entities[0], lamp = scene.entities[1]; hostArt.setAttribute('x', String(host.x-value.groundAnchor.x*dims.displayWidth)); hostArt.setAttribute('y', String(host.y-value.groundAnchor.y*dims.displayHeight)); lampArt.setAttribute('transform', `translate(${lamp.x},${lamp.y})`); }
    svg.append(hostArt, lampArt); update(); preview.replaceChildren(svg);
    let grab = null;
    hostArt.addEventListener('pointerdown', event => { event.preventDefault(); const rect=svg.getBoundingClientRect(); grab={id:event.pointerId,x:event.clientX,y:event.clientY,hostX:scene.entities[0].x,hostY:scene.entities[0].y,scale:500/rect.width}; svg.setPointerCapture(event.pointerId); });
    svg.addEventListener('pointermove', event => { if(!grab||event.pointerId!==grab.id)return; scene=moveEntity(scene,'host',grab.hostX+(event.clientX-grab.x)*grab.scale,grab.hostY+(event.clientY-grab.y)*grab.scale,lookup);update(); });
    svg.addEventListener('pointerup', () => { grab=null; }); svg.addEventListener('pointercancel', () => {grab=null;});
    hostArt.addEventListener('keydown', event => { if(!event.key.startsWith('Arrow'))return; event.preventDefault(); const dx=event.key==='ArrowLeft'?-20:event.key==='ArrowRight'?20:0,dy=event.key==='ArrowUp'?-20:event.key==='ArrowDown'?20:0; scene=moveEntity(scene,'host',scene.entities[0].x+dx,scene.entities[0].y+dy,lookup);update(); });
    context.announceStatus(t('placement.sampleFits'));
  }
  return {render,cancel,destroy(){cancel();panel?.remove();overlay?.remove();}};
}
