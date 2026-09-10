/** Selected entity inspector, rail tabs, and dropdown lifecycle. */
import { DEFAULT_ATTACH_JOINT, DEFAULT_EXPRESSION, DEFAULT_EXPRESSION_INTENSITY, DEFAULT_MOTION_INTENSITY, DEFAULT_PHASE_OFFSET, DEFAULT_PLAYBACK_RATE } from '../../domain/vocabulary.js';
import { MOTION_PROFILES_CONFIG, resolveMotionProfile } from '../../domain/animation-clips.js';
import { resolveEffectiveMotion } from '../../domain/motion-evaluator.js';
import { t } from '../../core/i18n.js';

export function createSelectionInspectorController(context) {
  let activeInspectorTab = 'expressions';

  let activeRailTab = 'spawn';

  let prevHasSelection = false;

  function renderSelectedActions(state = context.store.getState()) {
    initInspectorTabs();
    const selectedIds = state.ui.selectedEntityIds || (state.ui.selectedEntityId ? [state.ui.selectedEntityId] : []);
    const isMulti = selectedIds.length >= 2;
    const selected = state.currentScene.entities.find((entity) => entity.instanceId === state.ui.selectedEntityId);
    const isCharacter = !isMulti && selected?.kind === 'character';
    const isBubble = !isMulti && selected?.kind === 'bubble';
    const hasSelection = selectedIds.length > 0;

    const targetCharacters = isMulti
      ? state.currentScene.entities.filter((e) => selectedIds.includes(e.instanceId) && e.kind === 'character')
      : (isCharacter && selected ? [selected] : []);
    const hasCharactersSelected = targetCharacters.length > 0;
    const isAttached = !isMulti && Boolean(selected?.attachedTo);

    const expressionGroup = context.$('#character-expression-controls');
    if (expressionGroup) {
      expressionGroup.hidden = !hasCharactersSelected;
      if (hasCharactersSelected) {
        const allSameExpr = targetCharacters.every((c) => (c.expression || DEFAULT_EXPRESSION) === (targetCharacters[0].expression || DEFAULT_EXPRESSION));
        const currentExpr = allSameExpr ? (targetCharacters[0].expression || DEFAULT_EXPRESSION) : null;
        for (const btn of context.$$('button[data-expression]', expressionGroup)) {
          const isSelected = Boolean(currentExpr && btn.dataset.expression === currentExpr);
          btn.classList.toggle('is-selected-expression', isSelected);
          btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
      }
    }

    const exprIntensityGroup = context.$('#character-expression-intensity-controls');
    if (exprIntensityGroup) {
      exprIntensityGroup.hidden = !hasCharactersSelected;
      if (hasCharactersSelected) {
        const allSameIntensity = targetCharacters.every((c) => (c.expressionIntensity ?? DEFAULT_EXPRESSION_INTENSITY) === (targetCharacters[0].expressionIntensity ?? DEFAULT_EXPRESSION_INTENSITY));
        const currentIntensity = allSameIntensity ? (targetCharacters[0].expressionIntensity ?? DEFAULT_EXPRESSION_INTENSITY) : null;
        for (const btn of context.$$('button[data-expression-intensity]', exprIntensityGroup)) {
          const val = Number(btn.dataset.expressionIntensity);
          const isSelected = Boolean(currentIntensity !== null && Math.abs(val - currentIntensity) < 0.05);
          btn.classList.toggle('is-selected-intensity', isSelected);
          btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
      }
    }

    const poseGroup = context.$('#character-pose-controls');
    if (poseGroup) {
      poseGroup.hidden = !hasCharactersSelected;
      if (hasCharactersSelected) {
        const safePosesSets = targetCharacters.map((c) => {
          const profile = resolveMotionProfile(c);
          return MOTION_PROFILES_CONFIG[profile]?.safePoses || [];
        });
        const allSamePose = targetCharacters.every((c) => c.pose === targetCharacters[0].pose);
        const currentPose = allSamePose ? targetCharacters[0].pose : null;
        for (const btn of context.$$('button[data-pose]', poseGroup)) {
          const poseId = btn.dataset.pose;
          const isAllowed = safePosesSets.some((set) => set.includes(poseId));
          btn.hidden = !isAllowed;
          const isSelected = Boolean(currentPose && poseId === currentPose);
          btn.classList.toggle('is-selected-pose', isSelected);
          btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
      }
    }

    const clipGroup = context.$('#character-animation-clip-controls');
    if (clipGroup) {
      clipGroup.hidden = !hasCharactersSelected;
      if (hasCharactersSelected) {
        const safeClipsSets = targetCharacters.map((c) => {
          const profile = resolveMotionProfile(c);
          return MOTION_PROFILES_CONFIG[profile]?.safeClips || [];
        });
        const allSameClip = targetCharacters.every((c) => (c.animation?.clipId || 'none') === (targetCharacters[0].animation?.clipId || 'none'));
        const currentClip = allSameClip ? (targetCharacters[0].animation?.clipId || 'none') : null;
        for (const btn of context.$$('button[data-clip-id]', clipGroup)) {
          const clipId = btn.dataset.clipId;
          const isAllowed = safeClipsSets.some((set) => set.includes(clipId));
          btn.hidden = !isAllowed;
          const isSelected = Boolean(currentClip && clipId === currentClip);
          btn.classList.toggle('is-selected-clip', isSelected);
          btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
      }
    }

    const motionIntensityGroup = context.$('#character-motion-intensity-controls');
    if (motionIntensityGroup) {
      motionIntensityGroup.hidden = !hasCharactersSelected;
      if (hasCharactersSelected) {
        const allSameMotionIntensity = targetCharacters.every((c) => (c.animation?.intensity ?? DEFAULT_MOTION_INTENSITY) === (targetCharacters[0].animation?.intensity ?? DEFAULT_MOTION_INTENSITY));
        const currentMotionIntensity = allSameMotionIntensity ? (targetCharacters[0].animation?.intensity ?? DEFAULT_MOTION_INTENSITY) : null;
        for (const btn of context.$$('button[data-motion-intensity]', motionIntensityGroup)) {
          const val = Number(btn.dataset.motionIntensity);
          const isSelected = Boolean(currentMotionIntensity !== null && Math.abs(val - currentMotionIntensity) < 0.05);
          btn.classList.toggle('is-selected-intensity', isSelected);
          btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
      }
    }

    const phaseOffsetGroup = context.$('#character-phase-offset-controls');
    if (phaseOffsetGroup) {
      phaseOffsetGroup.hidden = !hasCharactersSelected;
      if (hasCharactersSelected) {
        const allSamePhase = targetCharacters.every((c) => (c.animation?.phaseOffset ?? DEFAULT_PHASE_OFFSET) === (targetCharacters[0].animation?.phaseOffset ?? DEFAULT_PHASE_OFFSET));
        const currentPhase = allSamePhase ? (targetCharacters[0].animation?.phaseOffset ?? DEFAULT_PHASE_OFFSET) : null;
        for (const btn of context.$$('button[data-phase-offset]', phaseOffsetGroup)) {
          const val = Number(btn.dataset.phaseOffset);
          const isSelected = Boolean(currentPhase !== null && Math.abs(val - currentPhase) < 0.05);
          btn.classList.toggle('is-selected-phase-offset', isSelected);
          btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
      }
    }

    const bubbleGroup = context.$('#bubble-controls');
    if (bubbleGroup) {
      bubbleGroup.hidden = !isBubble;
      if (isBubble) {
        const currentStyle = selected.bubbleStyle || 'speech';
        for (const btn of context.$$('button[data-bubble-style]', bubbleGroup)) {
          const isSelected = btn.dataset.bubbleStyle === currentStyle;
          btn.classList.toggle('is-selected-bubble-style', isSelected);
          btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
      }
    }

    const attachJointGroup = context.$('#attach-joint-controls');
    if (attachJointGroup) {
      attachJointGroup.hidden = !isAttached;
      if (isAttached) {
        const parentEntity = state.currentScene.entities.find((e) => e.instanceId === selected.attachedTo);
        const parentProfile = parentEntity?.kind === 'character' ? resolveMotionProfile(parentEntity) : 'root';
        const currentJoint = selected.attachJoint || DEFAULT_ATTACH_JOINT;
        for (const btn of context.$$('button[data-attach-joint]', attachJointGroup)) {
          const joint = btn.dataset.attachJoint;
          const isAllowed = parentProfile === 'root' ? (joint === 'root') : true;
          btn.hidden = !isAllowed;
          const isSelected = btn.dataset.attachJoint === currentJoint;
          btn.classList.toggle('is-selected-joint', isSelected);
          btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
      }
    }

    const rhythmGroup = context.$('#rhythm-sync-controls');
    if (rhythmGroup) {
      rhythmGroup.hidden = !hasCharactersSelected;
      if (hasCharactersSelected) {
        let activeRhythmMode = null;
        if (targetCharacters.length > 0) {
          let isSync = true;
          let isAlternate = true;
          let isWave = true;
          targetCharacters.forEach((char, idx) => {
            const phase = char.animation?.phaseOffset ?? DEFAULT_PHASE_OFFSET;
            if (phase !== 0) isSync = false;
            const expectedAlt = (idx % 2 === 1) ? 0.5 : 0;
            if (Math.abs(phase - expectedAlt) > 0.01) isAlternate = false;
            const expectedWave = (idx * 0.25) % 1.0;
            if (Math.abs(phase - expectedWave) > 0.01) isWave = false;
          });
          if (isSync) activeRhythmMode = 'sync';
          else if (isAlternate) activeRhythmMode = 'alternate';
          else if (isWave) activeRhythmMode = 'wave';
        }

        for (const btn of context.$$('button[data-rhythm-mode]', rhythmGroup)) {
          const isSelected = Boolean(activeRhythmMode && btn.dataset.rhythmMode === activeRhythmMode);
          btn.classList.toggle('is-selected-rhythm', isSelected);
          btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
      }
    }

    const hasAnyInspectorControls = hasCharactersSelected || isBubble || (isAttached && attachJointGroup && !attachJointGroup.hidden);

    if (hasSelection && !prevHasSelection && hasAnyInspectorControls) {
      activeRailTab = 'inspector';
    } else if (!hasSelection) {
      activeRailTab = 'spawn';
    }
    prevHasSelection = hasSelection;
    renderRailTabs();

    const tabExpressions = context.$('#inspector-tab-expressions');
    const tabMotion = context.$('#inspector-tab-motion');
    const tabJoints = context.$('#inspector-tab-joints');
    const tabBubble = context.$('#inspector-tab-bubble');

    if (tabExpressions) tabExpressions.hidden = !hasCharactersSelected;
    if (tabMotion) tabMotion.hidden = !hasCharactersSelected;
    if (tabJoints) tabJoints.hidden = !isAttached;
    if (tabBubble) tabBubble.hidden = !isBubble;

    // Validate activeInspectorTab: keep current tab if valid for current selection, else fallback
    const isTabValid =
      (activeInspectorTab === 'expressions' && hasCharactersSelected) ||
      (activeInspectorTab === 'motion' && hasCharactersSelected) ||
      (activeInspectorTab === 'joints' && isAttached) ||
      (activeInspectorTab === 'bubble' && isBubble);

    if (!isTabValid) {
      if (isBubble) {
        activeInspectorTab = 'bubble';
      } else if (hasCharactersSelected) {
        activeInspectorTab = 'expressions';
      } else if (isAttached) {
        activeInspectorTab = 'joints';
      } else {
        activeInspectorTab = 'expressions';
      }
    }

    // Update active tab buttons and panels
    const tabButtons = context.$$('#inspector-tabs > button[data-inspector-tab]');
    for (const btn of tabButtons) {
      const isTabActive = btn.dataset.inspectorTab === activeInspectorTab;
      btn.classList.toggle('active', isTabActive);
      btn.setAttribute('aria-selected', isTabActive ? 'true' : 'false');
      btn.setAttribute('tabindex', isTabActive && !btn.hidden ? '0' : '-1');
    }

    const secExpressions = context.$('#inspector-section-expressions');
    const secMotion = context.$('#inspector-section-motion');
    const secJoints = context.$('#inspector-section-joints');
    const secBubble = context.$('#inspector-section-bubble');

    if (secExpressions) secExpressions.hidden = activeInspectorTab !== 'expressions';
    if (secMotion) secMotion.hidden = activeInspectorTab !== 'motion';
    if (secJoints) secJoints.hidden = activeInspectorTab !== 'joints';
    if (secBubble) secBubble.hidden = activeInspectorTab !== 'bubble';

    // Transport & speed buttons state sync
    const animSettings = state.currentScene?.animationSettings || {};
    const playBtn = context.$('#play-animation-btn');
    if (playBtn) {
      const userReducedMotion = state.settings?.reducedMotion || 'system';
      const systemPrefersReducedMotion = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
      const motionAllowed = resolveEffectiveMotion(userReducedMotion, systemPrefersReducedMotion);
      const isPlaying = Boolean(animSettings.enabled) && motionAllowed;
      playBtn.classList.toggle('is-playing', isPlaying);
      playBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
      const textSpan = playBtn.querySelector('span');
      if (textSpan) {
        textSpan.textContent = isPlaying ? t('play.pauseBtn') : t('play.playBtn');
      }
    }

    const loopBtn = context.$('#loop-animation-btn');
    if (loopBtn) {
      const isLooping = animSettings.loop !== false;
      loopBtn.classList.toggle('is-looping', isLooping);
      loopBtn.setAttribute('aria-pressed', isLooping ? 'true' : 'false');
    }

    const currentRate = animSettings.playbackRate ?? DEFAULT_PLAYBACK_RATE;
    for (const btn of context.$$('button[data-playback-rate]')) {
      const val = Number(btn.dataset.playbackRate);
      const isSelected = Math.abs(val - currentRate) < 0.01;
      btn.classList.toggle('is-selected-rate', isSelected);
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    }
  }

  function renderRailTabs() {
    initRailTabs();
    const tabSpawn = context.$('#rail-tab-spawn');
    const tabInspector = context.$('#rail-tab-inspector');
    const spawnSection = context.$('#spawn-panel-section');
    const inspectorPanel = context.$('#play-inspector-panel');

    if (tabSpawn) {
      tabSpawn.classList.toggle('is-active', activeRailTab === 'spawn');
      tabSpawn.setAttribute('aria-selected', activeRailTab === 'spawn' ? 'true' : 'false');
    }
    if (tabInspector) {
      tabInspector.classList.toggle('is-active', activeRailTab === 'inspector');
      tabInspector.setAttribute('aria-selected', activeRailTab === 'inspector' ? 'true' : 'false');
    }
    if (spawnSection) spawnSection.hidden = activeRailTab !== 'spawn';
    if (inspectorPanel) inspectorPanel.hidden = activeRailTab !== 'inspector';
  }

  function handleDropdownOutsideClick(event) {
    if (!event.target?.closest?.('#play-scene-dropdown')) {
      const el = /** @type {HTMLDetailsElement} */ (document.getElementById('play-scene-dropdown'));
      if (el && el.open) el.open = false;
    }
    if (!event.target?.closest?.('#play-export-dropdown')) {
      const el = /** @type {HTMLDetailsElement} */ (document.getElementById('play-export-dropdown'));
      if (el && el.open) el.open = false;
    }
  }

  function initRailTabs() {
    const railTabs = context.$('#play-rail-tabs');
    if (railTabs && !railTabs.dataset.bound) {
      railTabs.dataset.bound = 'true';
      railTabs.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-rail-tab]');
        if (btn && btn.dataset.railTab) {
          activeRailTab = btn.dataset.railTab;
          renderRailTabs();
        }
      });
    }

    if (!context.dropdownsBound && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      context.dropdownsBound = true;
      document.addEventListener('click', handleDropdownOutsideClick);
    }
  }

  function initInspectorTabs() {
    const tabsList = context.$('#inspector-tabs');
    if (tabsList && !tabsList.dataset.bound) {
      tabsList.dataset.bound = 'true';
      tabsList.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-inspector-tab]');
        if (btn && btn.dataset.inspectorTab) {
          activeInspectorTab = btn.dataset.inspectorTab;
          renderSelectedActions(context.store.getState());
        }
      });
    }
  }

  return { renderSelectedActions, renderRailTabs, handleDropdownOutsideClick, initRailTabs, initInspectorTabs };
}
