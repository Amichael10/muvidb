import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './index.css';
import { defaultConfig, emptyConfig } from './defaultConfig.js';

const DEFAULT_CANVAS_WIDTH = 1080;
const DEFAULT_CANVAS_HEIGHT = 1920;

function getCanvasSize(config) {
  return {
    width: Math.max(16, Number(config?.width) || DEFAULT_CANVAS_WIDTH),
    height: Math.max(16, Number(config?.height) || DEFAULT_CANVAS_HEIGHT),
  };
}

const FRAME_PRESETS = [
  { id: 'ig-reel', label: 'Instagram Reel', width: 1080, height: 1920, ratio: '9:16' },
  { id: 'tiktok', label: 'TikTok', width: 1080, height: 1920, ratio: '9:16' },
  { id: 'ig-post', label: 'Instagram Post', width: 1080, height: 1080, ratio: '1:1' },
  { id: 'ig-portrait', label: 'Instagram 4:5', width: 1080, height: 1350, ratio: '4:5' },
  { id: 'twitter', label: 'Twitter / X', width: 1600, height: 900, ratio: '16:9' },
];

function matchFramePreset(config) {
  const { width, height } = getCanvasSize(config);
  const preferred = FRAME_PRESETS.find((preset) => preset.id === config?.framePreset);
  if (preferred && preferred.width === width && preferred.height === height) return preferred.id;
  return FRAME_PRESETS.find((preset) => preset.width === width && preset.height === height)?.id
    || config?.framePreset
    || 'custom';
}
const STORAGE_KEY = 'muvidb-video-studio-project';
const SOCIAL_BUCKET = 'social-published-assets';
const SOCIAL_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co';
const SOCIAL_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_fXxu9pH8yK8s6xEvEJWNgw_T3Nbbvdo';
const socialStorage = createClient(SOCIAL_SUPABASE_URL, SOCIAL_SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

const clone = (value) => JSON.parse(JSON.stringify(value));
const sceneDuration = (scene) => Math.max(0, Number((scene?.end || 0) - (scene?.start || 0)));
const sceneTimelineEnd = (config) => Math.max(...(config?.scenes || []).map((scene) => Number(scene.end) || 0), 1);
const timelineDuration = (config) => sceneTimelineEnd(config);

function setProjectDuration(config, value) {
  const scenes = config.scenes || [];
  const last = scenes.at(-1);
  if (!last) {
    config.duration = Math.max(1, Number(value) || 1);
    return;
  }
  const previous = scenes.length > 1 ? scenes.at(-2) : null;
  const minimumEnd = previous ? previous.end + 0.2 : last.start + 0.2;
  last.end = Number(Math.max(minimumEnd, Number(value) || minimumEnd).toFixed(1));
  config.duration = last.end;
}
const families = [
  { id: 'Manrope', label: 'Manrope' },
  { id: 'Inter', label: 'Inter' },
  { id: 'InstrumentSans', label: 'Instrument Sans' },
  { id: 'Georgia', label: 'Georgia' },
  { id: 'Palatino', label: 'Palatino' },
  { id: 'Baskerville', label: 'Baskerville' },
  { id: 'TimesNewRoman', label: 'Times New Roman' },
  { id: 'NewYork', label: 'New York' },
  { id: 'CormorantGaramond', label: 'Cormorant Garamond' },
  { id: 'Cinzel', label: 'Cinzel' },
];

const fontMap = {
  Manrope: 'Manrope',
  Inter: 'Inter',
  InstrumentSans: 'Instrument Sans',
  Georgia: 'Georgia',
  Palatino: 'Palatino',
  Baskerville: 'Baskerville',
  TimesNewRoman: 'Times New Roman',
  NewYork: 'New York',
  CormorantGaramond: 'Cormorant Garamond',
  Cinzel: 'Cinzel',
};

const animationFieldLabels = {
  startX: 'Start left/right',
  startY: 'Start up/down',
  endX: 'End left/right',
  endY: 'End up/down',
  startZoom: 'Start scale',
  endZoom: 'End scale',
};

const selectedLabel = {
  scene: 'Scene timing',
  background: 'Background',
  layer: 'Layer',
};

const initialConfig = {
  ...clone(emptyConfig),
  fonts: {
    defaultFamily: 'Manrope',
    families: families,
  },
};

const initialState = {
  config: initialConfig,
  selectedSceneIndex: 0,
  selectedLayerIndex: 0,
  selectedTarget: 'scene',
  currentTime: 0,
  isPlaying: false,
  past: [],
  future: [],
};

function syncTimelineDuration(config) {
  const actualEnd = sceneTimelineEnd(config);
  // Scene timing is the source of truth. Keeping an old project duration here
  // stretched the final scene straight back after every trim.
  config.duration = Number(actualEnd.toFixed(1));
}

function normalizeTimeline(config) {
  const next = clone(config);
  syncTimelineDuration(next);
  return next;
}

function retimeFrom(config, index) {
  for (let i = Math.max(1, index); i < config.scenes.length; i += 1) {
    const previous = config.scenes[i - 1];
    const item = config.scenes[i];
    const duration = Math.max(0.2, sceneDuration(item));
    item.start = Number(previous.end.toFixed(1));
    item.end = Number((item.start + duration).toFixed(1));
  }
  syncTimelineDuration(config);
}

function withHistory(state, mutate, ui = {}) {
  const config = clone(state.config);
  const next = { ...state, ...ui, config, past: [...state.past.slice(-79), clone(state.config)], future: [] };
  mutate(config, next);
  next.selectedSceneIndex = Math.min(next.selectedSceneIndex, Math.max(0, config.scenes.length - 1));
  const layers = config.scenes[next.selectedSceneIndex]?.layers || [];
  next.selectedLayerIndex = Math.min(next.selectedLayerIndex, Math.max(0, layers.length - 1));
  syncTimelineDuration(config);
  next.currentTime = Math.min(next.currentTime, timelineDuration(config));
  return next;
}

function updateSceneLayer(config, sceneIndex, layerIndex, mutate) {
  const next = clone(config);
  const layer = next.scenes[sceneIndex]?.layers?.[layerIndex];
  if (layer) mutate(layer);
  return next;
}

function updateSceneBackground(config, sceneIndex, mutate) {
  const next = clone(config);
  const scene = next.scenes[sceneIndex];
  if (!scene) return next;
  scene.background = scene.background || {};
  mutate(scene.background);
  return next;
}

function reducer(state, action) {
  switch (action.type) {
    case 'undo': {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        config: previous,
        past: state.past.slice(0, -1),
        future: [clone(state.config), ...state.future].slice(0, 80),
        selectedSceneIndex: Math.min(state.selectedSceneIndex, previous.scenes.length - 1),
        selectedLayerIndex: 0,
      };
    }
    case 'redo': {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        config: next,
        past: [...state.past.slice(-79), clone(state.config)],
        future: state.future.slice(1),
        selectedSceneIndex: Math.min(state.selectedSceneIndex, next.scenes.length - 1),
        selectedLayerIndex: 0,
      };
    }
    case 'reset':
      return { ...initialState, config: clone(initialConfig) };
    case 'begin-interaction':
      return { ...state, past: [...state.past.slice(-79), clone(state.config)], future: [] };
    case 'ui':
      return { ...state, ...action.patch };
    case 'replace-config':
      return { ...state, config: normalizeTimeline(action.config), past: [...state.past, clone(state.config)], future: [], selectedSceneIndex: 0, selectedLayerIndex: 0, currentTime: 0 };
    case 'project':
      return withHistory(state, (config) => {
        config[action.key] = action.value;
        if (action.key === 'duration') setProjectDuration(config, action.value);
        if (action.key === 'fps') config.fps = Math.max(1, Number(action.value) || 30);
      });
    case 'default-font':
      return withHistory(state, (config) => {
        config.fonts = config.fonts || {};
        config.fonts.defaultFamily = action.value;
        config.fonts.families = config.fonts.families || families;
        config.scenes.forEach((scene) => {
          scene.layers?.forEach((layer) => {
            if (layer.type === 'text' || layer.type === 'pill') delete layer.fontFamily;
          });
        });
      });
    case 'scene':
      return withHistory(state, (config) => {
        const item = config.scenes[state.selectedSceneIndex];
        if (!item) return;
        if (action.key === 'duration') {
          item.end = Number((item.start + Math.max(0.2, Number(action.value) || 1)).toFixed(1));
          retimeFrom(config, state.selectedSceneIndex + 1);
          return;
        }
        item[action.key] = ['start', 'end'].includes(action.key) ? Number(action.value) || 0 : action.value;
        if (action.key === 'end') item.end = Math.max(item.start + 0.2, item.end);
        syncTimelineDuration(config);
      });
    case 'transition':
      return withHistory(state, (config) => {
        let item = config.scenes[state.selectedSceneIndex];
        if (!item) return;
        item.transition = item.transition || {};
        item.transition[action.key] = action.key === 'duration' ? Math.max(0, Number(action.value) || 0) : action.value;
      });
    case 'background':
      return withHistory(state, (config) => {
        let item = config.scenes[state.selectedSceneIndex];
        if (!item) {
          item = {
            id: `scene-${Date.now()}`,
            name: 'Scene 1',
            start: 0,
            end: 10,
            background: { color: '#0B0D0E', zoom: 1, x: 0, y: 0 },
            layers: [],
          };
          config.scenes = [item];
        }
        item.background = item.background || {};
        item.background[action.key] = ['x', 'y', 'zoom'].includes(action.key) ? Number(action.value) || 0 : action.value;
      });
    case 'background-animation':
      return withHistory(state, (config) => {
        let item = config.scenes[state.selectedSceneIndex];
        if (!item) return;
        item.background = item.background || {};
        item.background.animation = item.background.animation || {};
        item.background.animation[action.key] = action.key === 'type' ? action.value : Number(action.value) || 0;
      });
    case 'fit-bg':
      return withHistory(state, (config) => {
        let item = config.scenes[state.selectedSceneIndex];
        if (!item) return;
        const bg = item.background || {};
        bg.x = 0;
        bg.y = 0;
        bg.zoom = action.mode === 'fill' ? 1.08 : 1;
        bg.animation = { type: 'none' };
        item.background = bg;
      });
    case 'apply-clip':
      return withHistory(state, (config, next) => {
        const clipIn = Math.max(0, Number(action.clipIn) || 0);
        const clipOut = Math.max(clipIn + 0.2, Number(action.clipOut) || clipIn + 0.2);
        const length = Number((clipOut - clipIn).toFixed(2));
        config.scenes = [{
          id: `clip-${Date.now()}`,
          name: action.title || 'Video Clip',
          start: 0,
          end: length,
          transition: { type: 'none', duration: 0 },
          background: {
            image: action.source,
            mediaKind: 'video',
            clipIn,
            clipOut,
            sourceDuration: action.sourceDuration != null ? Number(action.sourceDuration) : clipOut,
            noOverlay: true,
            zoom: 1,
            x: 0,
            y: 0,
            animation: { type: 'none' },
            color: '#000000',
          },
          layers: [],
        }];
        config.duration = length;
        config.coverSceneId = config.scenes[0].id;
        if (action.outputName) config.outputName = action.outputName;
        next.selectedSceneIndex = 0;
        next.selectedLayerIndex = 0;
        next.selectedTarget = 'background';
        next.currentTime = 0;
        next.isPlaying = false;
      });
    case 'clip-window':
      return withHistory(state, (config, next) => {
        const sceneIndex = action.sceneIndex ?? state.selectedSceneIndex;
        const scene = config.scenes[sceneIndex];
        if (!scene?.background) return;
        const maxOut = Number(scene.background.sourceDuration) || Number(action.clipOut) || 99999;
        const clipIn = action.clipIn != null ? Math.max(0, Number(action.clipIn)) : (scene.background.clipIn ?? 0);
        let clipOut = action.clipOut != null ? Number(action.clipOut) : (scene.background.clipOut ?? clipIn + 1);
        clipOut = Math.min(maxOut, Math.max(clipIn + 0.2, clipOut));
        const safeIn = Math.min(clipIn, clipOut - 0.2);
        scene.background.clipIn = Number(safeIn.toFixed(2));
        scene.background.clipOut = Number(clipOut.toFixed(2));
        const length = Number((clipOut - safeIn).toFixed(2));
        // A trim changes this clip's length, not its position in the edit.
        // Keep every later scene attached to its new end point.
        scene.end = Number((scene.start + length).toFixed(2));
        retimeFrom(config, sceneIndex + 1);
        next.currentTime = Math.min(next.currentTime, scene.end);
        next.isPlaying = false;
      });
    case 'append-clip':
      return withHistory(state, (config, next) => {
        const clipIn = Math.max(0, Number(action.clipIn) || 0);
        const clipOut = Math.max(clipIn + 0.2, Number(action.clipOut) || clipIn + 0.2);
        const start = timelineDuration(config);
        const scene = {
          id: `clip-${Date.now()}`,
          name: action.title || `Clip ${config.scenes.length + 1}`,
          start,
          end: Number((start + clipOut - clipIn).toFixed(2)),
          transition: { type: 'crossfade', duration: 0.2 },
          background: {
            image: action.source, mediaKind: 'video', clipIn, clipOut,
            sourceDuration: Number(action.sourceDuration) || clipOut,
            noOverlay: true, zoom: 1, x: 0, y: 0, color: '#000000', animation: { type: 'none' },
          },
          layers: [],
        };
        config.scenes.push(scene);
        syncTimelineDuration(config);
        next.selectedSceneIndex = config.scenes.length - 1;
        next.selectedLayerIndex = 0;
        next.selectedTarget = 'background';
        next.currentTime = scene.start;
        next.isPlaying = false;
      });
    case 'reorder-scene':
      return withHistory(state, (config, next) => {
        const from = Number(action.fromIndex);
        const to = Number(action.toIndex);
        if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return;
        const [scene] = config.scenes.splice(from, 1);
        config.scenes.splice(to, 0, scene);
        const firstDuration = Math.max(0.2, sceneDuration(config.scenes[0]));
        config.scenes[0].start = 0;
        config.scenes[0].end = Number(firstDuration.toFixed(2));
        retimeFrom(config, 1);
        next.selectedSceneIndex = to;
        next.selectedLayerIndex = 0;
        next.selectedTarget = 'scene';
        next.currentTime = sceneEditTime(config.scenes[to]);
      });
    case 'set-frame':
      return withHistory(state, (config) => {
        const { width: oldW, height: oldH } = getCanvasSize(config);
        const newW = Math.max(16, Number(action.width) || oldW);
        const newH = Math.max(16, Number(action.height) || oldH);
        if (oldW === newW && oldH === newH) {
          config.framePreset = action.id || config.framePreset;
          return;
        }
        const sx = newW / oldW;
        const sy = newH / oldH;
        config.width = newW;
        config.height = newH;
        config.framePreset = action.id || 'custom';
        config.scenes.forEach((scene) => {
          (scene.layers || []).forEach((layer) => {
            layer.x = Math.round((Number(layer.x) || 0) * sx);
            layer.y = Math.round((Number(layer.y) || 0) * sy);
            layer.width = Math.round((Number(layer.width) || 0) * sx);
            layer.height = Math.round((Number(layer.height) || 0) * sy);
          });
        });
      });
    case 'add-scene':
      return withHistory(state, (config, next) => {
        const last = config.scenes.at(-1);
        const start = last ? last.end : 0;
        config.scenes.push({
          id: `scene-${Date.now()}`,
          name: 'New Scene',
          start,
          end: Number((start + 3).toFixed(1)),
          transition: { type: 'crossfade', duration: 0.45 },
          background: clone(last?.background || { image: config.assets?.background, zoom: 1, x: 0, y: 0 }),
          layers: [],
        });
        retimeFrom(config, config.scenes.length - 1);
        next.selectedSceneIndex = config.scenes.length - 1;
        next.selectedLayerIndex = 0;
        next.selectedTarget = 'scene';
      });
    case 'delete-scene':
      return withHistory(state, (config, next) => {
        config.scenes.splice(state.selectedSceneIndex, 1);
        if (!config.scenes.length) {
          config.coverSceneId = null;
          config.duration = 1;
          next.selectedSceneIndex = 0;
          next.selectedLayerIndex = 0;
          next.selectedTarget = 'scene';
          next.currentTime = 0;
          next.isPlaying = false;
          return;
        }
        retimeFrom(config, state.selectedSceneIndex);
        next.selectedSceneIndex = Math.max(0, state.selectedSceneIndex - 1);
        next.selectedLayerIndex = 0;
      });
    case 'split-scene':
      return withHistory(state, (config, next) => {
        const index = action.index ?? state.selectedSceneIndex;
        const scene = config.scenes[index];
        if (!scene) return;
        const splitTime = Number(action.time);
        if (!(splitTime > scene.start + 0.2 && splitTime < scene.end - 0.2)) return;
        const second = clone(scene);
        second.id = `scene-${Date.now()}`;
        second.name = `${scene.name || 'Scene'} B`;
        second.start = Number(splitTime.toFixed(1));
        second.end = scene.end;
        second.transition = { type: 'none', duration: 0 };
        scene.end = Number(splitTime.toFixed(1));
        config.scenes.splice(index + 1, 0, second);
        syncTimelineDuration(config);
        next.selectedSceneIndex = index;
      });
    case 'duplicate-scene':
      return withHistory(state, (config, next) => {
        const index = state.selectedSceneIndex;
        const scene = config.scenes[index];
        if (!scene) return;
        const copy = clone(scene);
        copy.id = `scene-${Date.now()}`;
        copy.name = `${scene.name || 'Scene'} copy`;
        config.scenes.splice(index + 1, 0, copy);
        retimeFrom(config, index + 1);
        next.selectedSceneIndex = index + 1;
      });
    case 'duplicate-layer':
      return withHistory(state, (config, next) => {
        const layers = config.scenes[state.selectedSceneIndex]?.layers;
        const layer = layers?.[state.selectedLayerIndex];
        if (!layer) return;
        const copy = clone(layer);
        copy.id = `${layer.type}-${Date.now()}`;
        copy.x = (copy.x || 0) + 28;
        copy.y = (copy.y || 0) + 28;
        layers.splice(state.selectedLayerIndex + 1, 0, copy);
        next.selectedLayerIndex = state.selectedLayerIndex + 1;
        next.selectedTarget = 'layer';
      });
    case 'toggle-layer-flag':
      return withHistory(state, (config) => {
        const layer = config.scenes[action.sceneIndex ?? state.selectedSceneIndex]?.layers?.[action.layerIndex ?? state.selectedLayerIndex];
        if (layer) layer[action.key] = !layer[action.key];
      });
    case 'layer-window':
      return {
        ...state,
        config: updateSceneLayer(state.config, action.sceneIndex, action.layerIndex, (layer) => {
          if (action.offset != null) layer.offset = Math.max(0, Number(action.offset.toFixed(2)));
          if (action.duration != null) layer.duration = Math.max(0.2, Number(action.duration.toFixed(2)));
        }),
      };
    case 'layer-animation':
      return withHistory(state, (config) => {
        const layer = config.scenes[state.selectedSceneIndex]?.layers?.[state.selectedLayerIndex];
        if (!layer) return;
        layer.animation = layer.animation || {};
        layer.animation[action.key] = action.key === 'duration' ? Math.max(0.05, Number(action.value) || 0.5) : action.value;
      });
    case 'set-audio':
      return withHistory(state, (config) => {
        if (action.audio === null) delete config.audio;
        else config.audio = { ...(config.audio || {}), ...action.audio };
      });
    case 'theme':
      return withHistory(state, (config) => {
        config.theme = config.theme || {};
        config.theme[action.key] = action.value;
      });
    case 'add-layer':
      return withHistory(state, (config, next) => {
        let item = config.scenes[state.selectedSceneIndex];
        if (!item) {
          item = {
            id: `scene-${Date.now()}`,
            name: 'Scene 1',
            start: 0,
            end: 10,
            background: { color: '#0B0D0E', zoom: 1, x: 0, y: 0 },
            layers: [],
          };
          config.scenes = [item];
          next.selectedSceneIndex = 0;
        }
        const { width: canvasW, height: canvasH } = getCanvasSize(config);
        let base;
        if (action.layerType === 'shape') {
          const shapeDef = SHAPE_LIBRARY.find((shape) => shape.id === action.shapeId || shape.shapeKind === action.shapeKind) || SHAPE_LIBRARY[0];
          base = shapeDefaults(shapeDef, canvasW, canvasH);
        } else {
          base = { id: `${action.layerType}-${Date.now()}`, type: action.layerType, x: 120, y: 900, width: 840, height: 120, opacity: 1, rotation: 0 };
          if (action.layerType === 'text') Object.assign(base, { text: 'New text', fontSize: 50, weight: 'bold', color: '#FFFFFF', align: 'center' });
          if (action.layerType === 'image') Object.assign(base, { source: config.assets?.logo, width: 160, height: 160, x: Math.round((canvasW - 160) / 2), y: Math.round((canvasH - 160) / 2) });
          if (action.layerType === 'pill') Object.assign(base, { text: 'now showing', fontSize: 28, weight: 'bold', color: '#FFFFFF', fill: 'rgba(255,92,0,0.18)', stroke: 'rgba(255,92,0,0.45)', width: 360, height: 84, x: Math.round((canvasW - 360) / 2), y: Math.round(canvasH * 0.72) });
          if (action.layerType === 'card') Object.assign(base, { width: 840, height: 420, radius: 36, fill: 'rgba(11,13,14,0.72)', stroke: 'rgba(255,255,255,0.13)', x: Math.round((canvasW - 840) / 2), y: Math.round((canvasH - 420) / 2) });
        }
        if (action.preset) Object.assign(base, action.preset);
        item.layers.push(base);
        next.selectedLayerIndex = item.layers.length - 1;
        next.selectedTarget = 'layer';
      });
    case 'add-media-layer':
      return withHistory(state, (config, next) => {
        let item = config.scenes[state.selectedSceneIndex];
        if (!item) {
          item = {
            id: `scene-${Date.now()}`,
            name: 'Scene 1',
            start: 0,
            end: 10,
            background: { color: '#0B0D0E', zoom: 1, x: 0, y: 0 },
            layers: [],
          };
          config.scenes = [item];
          next.selectedSceneIndex = 0;
        }
        const isVideo = action.layerType === 'video';
        item.layers.push({
          id: `${action.layerType}-${Date.now()}`,
          type: action.layerType,
          source: action.source,
          x: isVideo ? 140 : 240,
          y: 660,
          width: isVideo ? 800 : 600,
          height: isVideo ? 450 : 600,
          opacity: 1,
        });
        next.selectedLayerIndex = item.layers.length - 1;
        next.selectedTarget = 'layer';
      });
    case 'select-layer':
      return {
        ...state,
        selectedSceneIndex: action.sceneIndex ?? state.selectedSceneIndex,
        selectedLayerIndex: action.layerIndex,
        selectedTarget: 'layer',
        isPlaying: false,
      };
    case 'select-background':
      return {
        ...state,
        selectedSceneIndex: action.sceneIndex ?? state.selectedSceneIndex,
        selectedTarget: 'background',
        isPlaying: false,
      };
    case 'drag-layer':
      return {
        ...state,
        config: updateSceneLayer(state.config, action.sceneIndex, action.layerIndex, (layer) => {
          layer.x = Math.round(action.x);
          layer.y = Math.round(action.y);
        }),
      };
    case 'drag-background':
      return {
        ...state,
        config: updateSceneBackground(state.config, action.sceneIndex, (bg) => {
          bg.x = Math.round(action.x);
          bg.y = Math.round(action.y);
          if (bg.animation?.type === 'kenBurns') {
            const dx = bg.x - action.previousX;
            const dy = bg.y - action.previousY;
            bg.animation.startX = Math.round((bg.animation.startX ?? action.previousX) + dx);
            bg.animation.startY = Math.round((bg.animation.startY ?? action.previousY) + dy);
            bg.animation.endX = Math.round((bg.animation.endX ?? action.previousX) + dx);
            bg.animation.endY = Math.round((bg.animation.endY ?? action.previousY) + dy);
          }
        }),
      };
    case 'resize-layer':
      return {
        ...state,
        config: updateSceneLayer(state.config, action.sceneIndex, action.layerIndex, (layer) => {
          layer.x = Math.round(action.x);
          layer.y = Math.round(action.y);
          layer.width = Math.round(action.width);
          layer.height = Math.round(action.height);
        }),
      };
    case 'rotate-layer':
      return {
        ...state,
        config: updateSceneLayer(state.config, action.sceneIndex, action.layerIndex, (layer) => {
          let degrees = Number(action.rotation) || 0;
          degrees = ((degrees % 360) + 360) % 360;
          if (degrees > 180) degrees -= 360;
          layer.rotation = Number(degrees.toFixed(1));
        }),
      };
    case 'delete-layer':
      return withHistory(state, (config, next) => {
        const layers = config.scenes[state.selectedSceneIndex]?.layers || [];
        layers.splice(state.selectedLayerIndex, 1);
        next.selectedLayerIndex = Math.max(0, state.selectedLayerIndex - 1);
      });
    case 'move-layer':
      return withHistory(state, (config, next) => {
        const layers = config.scenes[state.selectedSceneIndex]?.layers || [];
        const target = state.selectedLayerIndex + action.direction;
        if (target < 0 || target >= layers.length) return;
        const [selected] = layers.splice(state.selectedLayerIndex, 1);
        layers.splice(target, 0, selected);
        next.selectedLayerIndex = target;
      });
    case 'reorder-layer':
      return withHistory(state, (config, next) => {
        const layers = config.scenes[state.selectedSceneIndex]?.layers || [];
        const from = Number(action.fromIndex);
        let to = Number(action.toIndex);
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= layers.length) return;
        to = Math.max(0, Math.min(layers.length - 1, to));
        if (from === to) return;
        const [selected] = layers.splice(from, 1);
        layers.splice(to, 0, selected);
        next.selectedLayerIndex = to;
        next.selectedTarget = 'layer';
      });
    case 'align-layer':
      return withHistory(state, (config) => {
        const { width: canvasW, height: canvasH } = getCanvasSize(config);
        const selected = config.scenes[state.selectedSceneIndex]?.layers?.[state.selectedLayerIndex];
        if (!selected || selected.locked) return;
        const w = Number(selected.width) || 0;
        const h = Number(selected.height) || 0;
        if (action.align === 'left') selected.x = 0;
        if (action.align === 'centerX') selected.x = Math.round((canvasW - w) / 2);
        if (action.align === 'right') selected.x = Math.round(canvasW - w);
        if (action.align === 'top') selected.y = 0;
        if (action.align === 'centerY') selected.y = Math.round((canvasH - h) / 2);
        if (action.align === 'bottom') selected.y = Math.round(canvasH - h);
      });
    case 'layer':
      return withHistory(state, (config) => {
        const selected = config.scenes[state.selectedSceneIndex]?.layers?.[state.selectedLayerIndex];
        if (!selected) return;
        if (['x', 'y', 'width', 'height', 'fontSize', 'lineHeight', 'opacity', 'radius', 'paddingX', 'paddingY', 'rotation', 'strokeWidth'].includes(action.key)) {
          selected[action.key] = Number(action.value) || 0;
        } else if (action.key === 'offset') {
          selected.offset = Math.max(0, Number(action.value) || 0);
        } else if (action.key === 'duration') {
          if (action.value === '' || action.value == null) delete selected.duration;
          else selected.duration = Math.max(0.2, Number(action.value) || 0.2);
        } else if (action.key === 'fontFamily') {
          if (action.value) selected.fontFamily = action.value;
          else delete selected.fontFamily;
        } else if (action.key === 'flipX' || action.key === 'flipY') {
          selected[action.key] = Boolean(action.value);
        } else {
          selected[action.key] = action.value;
        }
      });
    default:
      return state;
  }
}

function resolveAssetPath(path) {
  if (!path) return '';
  if (path.startsWith('blob:') || path.startsWith('data:') || /^https?:/.test(path)) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

function loadImage(cache, path) {
  const resolved = resolveAssetPath(path);
  if (!resolved) return Promise.resolve(null);
  const elKey = `image_el:${resolved}`;
  if (cache.has(elKey)) return Promise.resolve(cache.get(elKey));
  const key = `image:${resolved}`;
  if (cache.has(key)) return cache.get(key);
  const promise = new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      cache.set(elKey, image);
      resolve(image);
    };
    image.onerror = () => resolve(null);
    image.src = resolved;
  });
  cache.set(key, promise);
  return promise;
}

function getOrCreateVideoHost() {
  if (typeof document === 'undefined') return null;
  let host = document.getElementById('muvidb-video-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'muvidb-video-host';
    host.style.position = 'fixed';
    host.style.top = '-9999px';
    host.style.left = '-9999px';
    host.style.width = '1px';
    host.style.height = '1px';
    host.style.opacity = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '-1';
    document.body.appendChild(host);
  }
  return host;
}

function loadVideo(cache, path) {
  const resolved = resolveAssetPath(path);
  if (!resolved) return Promise.resolve(null);
  const elKey = `video_el:${resolved}`;
  if (cache.has(elKey)) {
    const existing = cache.get(elKey);
    const host = getOrCreateVideoHost();
    if (host && existing && !existing.parentElement) host.appendChild(existing);
    return Promise.resolve(existing);
  }
  const key = `video:${resolved}`;
  if (cache.has(key)) return cache.get(key);
  const promise = new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = false;
    video.volume = 1.0;
    video.loop = false;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    const host = getOrCreateVideoHost();
    if (host) host.appendChild(video);
    video.onloadeddata = () => {
      cache.set(elKey, video);
      resolve(video);
    };
    video.onerror = () => resolve(null);
    video.src = resolved;
    video.load();
  });
  cache.set(key, promise);
  return promise;
}

/** Avoid seeking every paint frame while playing — that stalls long MP4s. Scrubbing always jumps. */
function syncVideoToTime(video, targetTime, { playing = false, force = false, volume = 1.0, muted = false } = {}) {
  if (!video || !Number.isFinite(targetTime)) return;
  const drift = Math.abs((video.currentTime || 0) - targetTime);

  const applySeek = (time) => {
    video.__seekTarget = time;
    try { video.currentTime = time; } catch { video.__seekLock = false; return; }
    if (video.__seekLock) return;
    video.__seekLock = true;
    const token = (video.__seekToken = (video.__seekToken || 0) + 1);
    const unlock = () => {
      if (video.__seekToken !== token) return;
      video.__seekLock = false;
    };
    video.addEventListener('seeked', unlock, { once: true });
    setTimeout(unlock, 1000);
  };

  if (playing) {
    video.muted = muted;
    video.volume = Math.max(0, Math.min(1, volume));
    if (video.paused) {
      video.play().catch(() => {
        // Fallback for strict browser autoplay policy
        video.muted = true;
        video.play().catch(() => {});
      });
    }
    // While actively playing, only resync if drift exceeds 1.5 seconds to prevent flicker
    if (force || drift > 1.5) {
      applySeek(targetTime);
    }
    return;
  }

  // Paused / scrubbing:
  if (!video.paused) video.pause();
  if (!force && drift <= 0.05) return;
  applySeek(targetTime);
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
const smoothstep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

function backgroundMotion(item, time) {
  const bg = item?.background || {};
  const animation = bg.animation || {};
  const duration = Math.max(0.1, sceneDuration(item));
  const progress = smoothstep(((time || 0) - (item.start || 0)) / duration);
  if (animation.type !== 'kenBurns') return { x: bg.x || 0, y: bg.y || 0, zoom: bg.zoom || 1 };
  return {
    x: lerp(animation.startX ?? bg.x ?? 0, animation.endX ?? bg.x ?? 0, progress),
    y: lerp(animation.startY ?? bg.y ?? 0, animation.endY ?? bg.y ?? 0, progress),
    zoom: lerp(animation.startZoom ?? bg.zoom ?? 1, animation.endZoom ?? bg.zoom ?? 1, progress),
  };
}

function layerFont(item, config, fontSize = item.fontSize || 32) {
  const weights = { regular: 400, medium: 500, semiBold: 700, bold: 800, heavy: 900 };
  const family = item.fontFamily || config.fonts?.defaultFamily || 'Manrope';
  return `${weights[item.weight] || 400} ${fontSize}px "${fontMap[family] || family}", Georgia, Palatino, serif`;
}

const SHAPE_LIBRARY = [
  { id: 'rect', label: 'Rectangle', shapeKind: 'rect', width: 520, height: 320, radius: 28, fill: 'rgba(255,92,0,0.85)', stroke: 'rgba(255,255,255,0.35)' },
  { id: 'round-rect', label: 'Round rect', shapeKind: 'rect', width: 520, height: 280, radius: 80, fill: 'rgba(52,211,153,0.85)', stroke: 'rgba(255,255,255,0.3)' },
  { id: 'ellipse', label: 'Ellipse', shapeKind: 'ellipse', width: 420, height: 420, fill: 'rgba(139,92,246,0.85)', stroke: 'rgba(255,255,255,0.3)' },
  { id: 'triangle', label: 'Triangle', shapeKind: 'triangle', width: 420, height: 380, fill: 'rgba(234,179,8,0.9)', stroke: 'rgba(255,255,255,0.3)' },
  { id: 'diamond', label: 'Diamond', shapeKind: 'diamond', width: 380, height: 380, fill: 'rgba(56,189,248,0.85)', stroke: 'rgba(255,255,255,0.3)' },
  { id: 'hexagon', label: 'Hexagon', shapeKind: 'hexagon', width: 420, height: 380, fill: 'rgba(244,114,182,0.85)', stroke: 'rgba(255,255,255,0.3)' },
  { id: 'star', label: 'Star', shapeKind: 'star', width: 420, height: 420, fill: 'rgba(255,92,0,0.95)', stroke: 'rgba(255,255,255,0.35)' },
  { id: 'line', label: 'Line', shapeKind: 'line', width: 560, height: 36, fill: 'transparent', stroke: '#ffffff', strokeWidth: 10 },
  { id: 'arrow', label: 'Arrow', shapeKind: 'arrow', width: 560, height: 120, fill: 'rgba(255,255,255,0.95)', stroke: 'rgba(255,255,255,0.2)', strokeWidth: 4 },
];

const ELEMENT_EXTRAS = [
  { id: 'pill', label: 'Pill badge', layerType: 'pill', hint: 'Rounded label with text' },
  { id: 'card', label: 'Card', layerType: 'card', hint: 'Rounded panel behind content' },
  { id: 'logo', label: 'Logo', layerType: 'image', hint: 'Project logo as a layer' },
];

function layerRotationRad(layer) {
  return ((Number(layer?.rotation) || 0) * Math.PI) / 180;
}

function layerCenter(layer) {
  return {
    x: (Number(layer?.x) || 0) + (Number(layer?.width) || 0) / 2,
    y: (Number(layer?.y) || 0) + (Number(layer?.height) || 0) / 2,
  };
}

function rotatePoint(point, center, radians) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

function worldToLocal(layer, point) {
  return rotatePoint(point, layerCenter(layer), -layerRotationRad(layer));
}

function localToWorld(layer, point) {
  return rotatePoint(point, layerCenter(layer), layerRotationRad(layer));
}

function applyLayerBoxTransform(ctx, item) {
  const center = layerCenter(item);
  const rotation = layerRotationRad(item);
  ctx.translate(center.x, center.y);
  if (rotation) ctx.rotate(rotation);
  if (item.flipX) ctx.scale(-1, 1);
  if (item.flipY) ctx.scale(1, -1);
  ctx.translate(-center.x, -center.y);
}

function buildShapePath(ctx, item) {
  const x = Number(item.x) || 0;
  const y = Number(item.y) || 0;
  const w = Math.max(2, Number(item.width) || 2);
  const h = Math.max(2, Number(item.height) || 2);
  const kind = item.shapeKind || 'rect';
  ctx.beginPath();
  if (kind === 'ellipse') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    return;
  }
  if (kind === 'triangle') {
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    return;
  }
  if (kind === 'diamond') {
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
    return;
  }
  if (kind === 'hexagon') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = cx + (w / 2) * Math.cos(angle);
      const py = cy + (h / 2) * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    return;
  }
  if (kind === 'star') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const spikes = 5;
    const outerX = w / 2;
    const outerY = h / 2;
    const innerX = outerX * 0.45;
    const innerY = outerY * 0.45;
    for (let i = 0; i < spikes * 2; i += 1) {
      const angle = (Math.PI * i) / spikes - Math.PI / 2;
      const radiusX = i % 2 === 0 ? outerX : innerX;
      const radiusY = i % 2 === 0 ? outerY : innerY;
      const px = cx + Math.cos(angle) * radiusX;
      const py = cy + Math.sin(angle) * radiusY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    return;
  }
  if (kind === 'line') {
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    return;
  }
  if (kind === 'arrow') {
    const shaft = h * 0.34;
    const head = Math.min(w * 0.32, h);
    ctx.moveTo(x, y + (h - shaft) / 2);
    ctx.lineTo(x + w - head, y + (h - shaft) / 2);
    ctx.lineTo(x + w - head, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w - head, y + h);
    ctx.lineTo(x + w - head, y + (h + shaft) / 2);
    ctx.lineTo(x, y + (h + shaft) / 2);
    ctx.closePath();
    return;
  }
  roundedRect(ctx, x, y, w, h, item.radius ?? 24);
}

function paintShape(ctx, item) {
  buildShapePath(ctx, item);
  const kind = item.shapeKind || 'rect';
  if (kind === 'line') {
    ctx.strokeStyle = item.stroke || item.fill || '#ffffff';
    ctx.lineWidth = Math.max(2, Number(item.strokeWidth) || Math.max(4, (Number(item.height) || 8) * 0.55));
    ctx.lineCap = 'round';
    ctx.stroke();
    return;
  }
  if (item.fill && item.fill !== 'transparent') {
    ctx.fillStyle = item.fill;
    ctx.fill();
  }
  if (item.stroke) {
    ctx.strokeStyle = item.stroke;
    ctx.lineWidth = Math.max(1, Number(item.strokeWidth) || 2);
    ctx.stroke();
  }
}

function shapeDefaults(shapeDef, canvasW = DEFAULT_CANVAS_WIDTH, canvasH = DEFAULT_CANVAS_HEIGHT) {
  const width = shapeDef.width;
  const height = shapeDef.height;
  return {
    id: `shape-${shapeDef.shapeKind}-${Date.now()}`,
    type: 'shape',
    shapeKind: shapeDef.shapeKind,
    x: Math.round((canvasW - width) / 2),
    y: Math.round((canvasH - height) / 2),
    width,
    height,
    opacity: 1,
    rotation: 0,
    radius: shapeDef.radius ?? 0,
    fill: shapeDef.fill,
    stroke: shapeDef.stroke,
    strokeWidth: shapeDef.strokeWidth ?? 2,
  };
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapTextLines(ctx, text, maxWidth) {
  const lines = [];
  String(text || '').split('\n').forEach((part) => {
    let line = '';
    part.split(/\s+/).filter(Boolean).forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
  });
  return lines.length ? lines : [''];
}

function fitTextLayout(ctx, item, config) {
  const paddingX = item.paddingX ?? 0;
  const paddingY = item.paddingY ?? 0;
  const textWidth = Math.max(20, item.width - paddingX * 2);
  const textHeight = Math.max(20, item.height - paddingY * 2);
  const minFontSize = Math.min(18, item.fontSize || 32);
  let fontSize = item.fontSize || 32;
  let lineHeight = fontSize * (item.lineHeight || 1.08);
  let lines = [];

  while (fontSize >= minFontSize) {
    ctx.font = layerFont(item, config, fontSize);
    lineHeight = fontSize * (item.lineHeight || 1.08);
    lines = wrapTextLines(ctx, item.text, textWidth);
    if (lines.length * lineHeight <= textHeight) break;
    fontSize -= 1;
  }

  return { lines, lineHeight, paddingX, paddingY, fontSize };
}

function drawWrappedText(ctx, item, config) {
  const { lines, lineHeight, paddingX, paddingY } = fitTextLayout(ctx, item, config);
  const blockHeight = lines.length * lineHeight;
  let y = item.y + paddingY + Math.max(0, item.height - paddingY * 2) / 2 - blockHeight / 2 + lineHeight * 0.78;
  ctx.textAlign = item.align || 'center';
  ctx.textBaseline = 'alphabetic';
  const x = item.align === 'left'
    ? item.x + paddingX
    : item.align === 'right'
      ? item.x + item.width - paddingX
      : item.x + item.width / 2;
  lines.forEach((line) => {
    ctx.fillText(line, x, y);
    y += lineHeight;
  });
}

async function drawLayer(ctx, item, config, cache, layerTime = 0, playing = false) {
  ctx.save();
  const entrance = item.animation || {};
  let entranceAlpha = 1;
  let shiftY = 0;
  let entranceScale = 1;
  if (entrance.type && entrance.type !== 'none') {
    const entranceDuration = Math.max(0.05, Number(entrance.duration) || 0.5);
    const progress = smoothstep(layerTime / entranceDuration);
    entranceAlpha = progress;
    if (entrance.type === 'slideUp') shiftY = (1 - progress) * 90;
    if (entrance.type === 'slideDown') shiftY = -(1 - progress) * 90;
    if (entrance.type === 'zoomIn') entranceScale = 0.82 + 0.18 * progress;
  }
  ctx.globalAlpha = (item.opacity ?? 1) * entranceAlpha;
  if (shiftY) ctx.translate(0, shiftY);
  applyLayerBoxTransform(ctx, item);
  if (entranceScale !== 1) {
    const centerX = item.x + item.width / 2;
    const centerY = item.y + item.height / 2;
    ctx.translate(centerX, centerY);
    ctx.scale(entranceScale, entranceScale);
    ctx.translate(-centerX, -centerY);
  }
  if (item.type === 'text') {
    ctx.fillStyle = item.color || '#ffffff';
    drawWrappedText(ctx, item, config);
  }
  const rendersAsVideo = item.type === 'video' || (item.type === 'image' && isVideoPath(item.source));
  if (rendersAsVideo) {
    const video = await loadVideo(cache, item.source);
    if (video) {
      const localTime = Math.max(0, layerTime || 0);
      if (Number.isFinite(video.duration) && video.duration > 0) {
        const targetTime = localTime % video.duration;
        syncVideoToTime(video, targetTime, { playing, force: !playing });
      }
      ctx.drawImage(video, item.x, item.y, item.width, item.height);
    }
  } else if (item.type === 'image') {
    const image = await loadImage(cache, item.source);
    if (image) ctx.drawImage(image, item.x, item.y, item.width, item.height);
  }
  if (item.type === 'shape') {
    paintShape(ctx, item);
  }
  if (item.type === 'pill' || item.type === 'card') {
    roundedRect(ctx, item.x, item.y, item.width, item.height, item.radius || (item.type === 'pill' ? item.height / 2 : 36));
    ctx.fillStyle = item.fill || 'rgba(243,232,255,0.16)';
    ctx.fill();
    ctx.strokeStyle = item.stroke || 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(1, Number(item.strokeWidth) || 2);
    ctx.stroke();
    if (item.type === 'pill') {
      ctx.fillStyle = item.color || '#ffffff';
      drawWrappedText(ctx, item, config);
    }
  }
  ctx.restore();
}

function activeSceneInfo(state) {
  const scene = sceneAtTime(state.config, state.currentTime) || state.config.scenes[state.selectedSceneIndex];
  return { scene, sceneIndex: Math.max(0, state.config.scenes.indexOf(scene)) };
}

function pointInLayer(layer, point) {
  const local = worldToLocal(layer, point);
  return local.x >= layer.x && local.x <= layer.x + layer.width && local.y >= layer.y && local.y <= layer.y + layer.height;
}

const RESIZE_HANDLE_RADIUS = 28;
const ROTATE_HANDLE_OFFSET = 48;

function layerHandlePoints(layer) {
  const x = Number(layer.x) || 0;
  const y = Number(layer.y) || 0;
  const w = Number(layer.width) || 0;
  const h = Number(layer.height) || 0;
  const locals = {
    tl: { x, y },
    tr: { x: x + w, y },
    bl: { x, y: y + h },
    br: { x: x + w, y: y + h },
    t: { x: x + w / 2, y },
    b: { x: x + w / 2, y: y + h },
    l: { x, y: y + h / 2 },
    r: { x: x + w, y: y + h / 2 },
    rotate: { x: x + w / 2, y: y - ROTATE_HANDLE_OFFSET },
  };
  return Object.fromEntries(Object.entries(locals).map(([id, local]) => [id, localToWorld(layer, local)]));
}

function handleAtPoint(layer, point) {
  if (!layer) return null;
  const handles = layerHandlePoints(layer);
  let best = null;
  let bestDist = RESIZE_HANDLE_RADIUS;
  for (const [id, handle] of Object.entries(handles)) {
    const dist = Math.hypot(point.x - handle.x, point.y - handle.y);
    const radius = id === 'rotate' ? RESIZE_HANDLE_RADIUS + 8 : RESIZE_HANDLE_RADIUS;
    if (dist <= radius && dist <= bestDist) {
      best = id;
      bestDist = dist;
    }
  }
  return best;
}

function hitTestScene(scene, point) {
  const layers = scene?.layers || [];
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index];
    if (layer.hidden || layer.locked) continue;
    if (pointInLayer(layer, point)) return index;
  }
  return -1;
}

function selectedTargetLabel(target, scene) {
  if (target === 'scene') return `${scene?.name || 'Scene'} timing`;
  if (target === 'background') return `${scene?.name || 'Scene'} background`;
  return selectedLabel[target] || 'Selection';
}

function drawSelection(ctx, state, scene, sceneIndex) {
  if (!scene) return;
  const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = getCanvasSize(state.config);
  ctx.save();
  const orangeStroke = '#FF5C00';
  ctx.lineWidth = 4;
  ctx.strokeStyle = orangeStroke;
  ctx.fillStyle = 'rgba(255, 92, 0, 0.05)';

  if (state.selectedTarget === 'background' && sceneIndex === state.selectedSceneIndex) {
    const bg = scene.background || {};
    if (bg.image) {
      ctx.strokeRect(6, 6, CANVAS_WIDTH - 12, CANVAS_HEIGHT - 12);
      ctx.fillRect(6, 6, CANVAS_WIDTH - 12, CANVAS_HEIGHT - 12);
      
      // Draw corner circular nodes
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = orangeStroke;
      ctx.lineWidth = 3;
      for (const [cx, cy] of [[6, 6], [CANVAS_WIDTH - 6, 6], [6, CANVAS_HEIGHT - 6], [CANVAS_WIDTH - 6, CANVAS_HEIGHT - 6]]) {
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  if (state.selectedTarget === 'layer' && sceneIndex === state.selectedSceneIndex) {
    const layer = scene?.layers?.[state.selectedLayerIndex];
    if (layer) {
      ctx.save();
      applyLayerBoxTransform(ctx, layer);
      ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
      ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
      ctx.restore();
      
      const handles = layerHandlePoints(layer);
      ctx.strokeStyle = orangeStroke;
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 3;
      
      // Rotate stem + knob
      ctx.beginPath();
      ctx.moveTo(handles.t.x, handles.t.y);
      ctx.lineTo(handles.rotate.x, handles.rotate.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(handles.rotate.x, handles.rotate.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      for (const id of ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r']) {
        const handle = handles[id];
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawCoverMedia(ctx, media, mediaWidth, mediaHeight, motion, canvasW = DEFAULT_CANVAS_WIDTH, canvasH = DEFAULT_CANVAS_HEIGHT) {
  if (!mediaWidth || !mediaHeight) return;
  const scale = Math.max(canvasW / mediaWidth, canvasH / mediaHeight) * (motion.zoom || 1);
  const drawWidth = mediaWidth * scale;
  const drawHeight = mediaHeight * scale;
  const drawX = (motion.x || 0) + (canvasW - drawWidth) / 2;
  const drawY = (motion.y || 0) + (canvasH - drawHeight) / 2;
  ctx.drawImage(media, drawX, drawY, drawWidth, drawHeight);
}

async function drawBackground(ctx, item, config, time, cache, playing = false) {
  const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = getCanvasSize(config);
  const bg = item?.background || {};
  const source = bg.image ?? config.assets?.background;
  const motion = backgroundMotion(item, time);
  const treatAsVideo = bg.mediaKind === 'video' || isVideoPath(source);

  let rendered = false;
  if (source) {
    if (treatAsVideo) {
      const resolved = resolveAssetPath(source);
      let video = resolved ? cache.get(`video_el:${resolved}`) : null;
      if (!video) video = await loadVideo(cache, source);
      if (video && (video.readyState >= 2 || video.videoWidth > 0)) {
        const localTime = Math.max(0, (time || 0) - (item?.start || 0));
        const clipIn = Number(bg.clipIn) || 0;
        const clipOut = bg.clipOut != null && bg.clipOut !== ''
          ? Number(bg.clipOut)
          : (Number.isFinite(video.duration) ? video.duration : clipIn + localTime);
        const span = Math.max(0.1, clipOut - clipIn);
        const targetTime = clipIn + Math.min(localTime, span - 0.01);
        syncVideoToTime(video, targetTime, { playing, force: !playing, volume: bg.volume ?? 1.0, muted: Boolean(bg.muted) });
        drawCoverMedia(ctx, video, video.videoWidth, video.videoHeight, motion, CANVAS_WIDTH, CANVAS_HEIGHT);
        rendered = true;
      }
    } else {
      const resolved = resolveAssetPath(source);
      let image = resolved ? cache.get(`image_el:${resolved}`) : null;
      if (!image) image = await loadImage(cache, source);
      if (image && (image.naturalWidth || image.width)) {
        drawCoverMedia(ctx, image, image.naturalWidth || image.width, image.naturalHeight || image.height, motion, CANVAS_WIDTH, CANVAS_HEIGHT);
        rendered = true;
      }
    }
  }

  if (!rendered) {
    ctx.fillStyle = bg.color || config.theme?.backgroundColor || '#0B0D0E';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  if (bg.noOverlay) return;
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, config.theme?.overlayTop || 'rgba(11,13,14,0.56)');
  gradient.addColorStop(0.5, config.theme?.overlayMid || 'rgba(11,13,14,0.76)');
  gradient.addColorStop(1, config.theme?.overlayBottom || 'rgba(11,13,14,0.95)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

async function drawScene(ctx, item, config, time, cache, alpha = 1, offsetX = 0, offsetY = 0, playing = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(offsetX, offsetY);
  await drawBackground(ctx, item, config, time, cache, playing);
  const sceneLocal = (time || 0) - (item.start || 0);
  for (const layer of item.layers || []) {
    if (layer.hidden) continue;
    const layerOffset = Math.max(0, Number(layer.offset) || 0);
    const layerWindow = layer.duration != null && layer.duration !== '' ? Math.max(0.1, Number(layer.duration)) : null;
    if (sceneLocal < layerOffset) continue;
    if (layerWindow != null && sceneLocal > layerOffset + layerWindow) continue;
    await drawLayer(ctx, layer, config, cache, sceneLocal - layerOffset, playing);
  }
  ctx.restore();
}

function sceneAtTime(config, time) {
  return config.scenes.find((item) => time >= item.start && time < item.end) || config.scenes.at(-1);
}

// Land the playhead just past the incoming transition so the scene being
// edited shows fully instead of blended with the previous scene.
function sceneEditTime(scene) {
  if (!scene) return 0;
  const transition = scene.transition?.type && scene.transition.type !== 'none' ? Number(scene.transition.duration) || 0 : 0;
  const target = scene.start + Math.min(transition + 0.05, Math.max(0, sceneDuration(scene) - 0.1));
  return Number(target.toFixed(2));
}

function isGifPath(path) {
  if (!path) return false;
  const value = String(path).toLowerCase();
  return value.startsWith('data:image/gif') || value.includes('.gif') || value.includes('image/gif');
}

function isVideoPath(path) {
  if (!path) return false;
  const value = String(path).toLowerCase();
  return value.startsWith('data:video/') || value.includes('.mp4') || value.includes('.mov') || value.includes('.m4v') || value.includes('.webm') || value.includes('video/');
}

function isMotionPath(path) {
  return isGifPath(path) || isVideoPath(path);
}

function sceneHasMotionBackground(scene) {
  const bg = scene?.background;
  if (!bg) return false;
  return isGifPath(bg.image ?? '');
}

function sceneHasMotionLayers(scene) {
  return (scene?.layers || []).some((layer) => isGifPath(layer.source));
}

const AVAILABLE_VIDEOS = [
  { value: '', label: 'No video (solid color)' },
];

const STOCK_BACKGROUND_VIDEOS = [
  'assets/videos/water-ripples.mp4',
  'assets/videos/glowing-particle-cloud.mp4',
];

function stripStockBackgrounds(config) {
  if (!config || typeof config !== 'object') return config;
  if (STOCK_BACKGROUND_VIDEOS.includes(config.assets?.background)) {
    config.assets.background = '';
  }
  (config.scenes || []).forEach((scene) => {
    if (STOCK_BACKGROUND_VIDEOS.includes(scene?.background?.image)) {
      scene.background.image = '';
    }
  });
  return config;
}

const BACKGROUND_SWATCHES = ['#FFFFFF', '#000000', '#0B0D0E', '#FF5C00', '#FC4D04', '#FFD3B8'];

function activeBackgroundPath(state) {
  const { scene } = activeSceneInfo(state);
  return scene?.background?.image ?? state.config.assets?.background ?? '';
}

function pickRecorderMimeType(withAudio = false) {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = withAudio
    ? ['video/mp4;codecs=avc1.64002A,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
    : ['video/mp4;codecs=avc1.64002A', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

async function recordTimeline(config, cache, onProgress) {
  const hasAudio = Boolean(config.audio?.source);
  const mimeType = pickRecorderMimeType(hasAudio);
  if (!mimeType) throw new Error('This browser does not support video recording. Try Chrome or Edge.');

  const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = getCanvasSize(config);
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const fps = Math.min(60, Math.max(10, Number(config.fps) || 30));
  const duration = timelineDuration(config);
  const frameState = {
    config,
    currentTime: 0,
    selectedTarget: 'none',
    selectedSceneIndex: -1,
    selectedLayerIndex: -1,
  };

  // Warm caches so the recording does not open on a black frame
  await paintPreview(canvas, frameState, cache);

  const stream = canvas.captureStream(fps);

  let audioElement = null;
  let audioContext = null;
  if (hasAudio) {
    audioElement = document.createElement('audio');
    audioElement.src = resolveAssetPath(config.audio.source);
    audioElement.loop = true;
    await new Promise((resolve) => {
      audioElement.oncanplaythrough = resolve;
      audioElement.onerror = resolve;
      audioElement.load();
    });
    try {
      audioContext = new AudioContext();
      const sourceNode = audioContext.createMediaElementSource(audioElement);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = Math.min(1, Math.max(0, config.audio.volume ?? 1));
      const destination = audioContext.createMediaStreamDestination();
      sourceNode.connect(gainNode);
      gainNode.connect(destination);
      destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    } catch {
      audioElement = null;
    }
  }

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };
  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = (event) => reject(event.error || new Error('Recording failed.'));
  });

  recorder.start(250);
  if (audioElement) {
    audioElement.currentTime = 0;
    audioElement.play().catch(() => {});
  }
  const startedAt = performance.now();
  let painting = false;
  await new Promise((resolve) => {
    const tick = (now) => {
      const elapsed = (now - startedAt) / 1000;
      if (elapsed >= duration) {
        resolve();
        return;
      }
      if (!painting) {
        painting = true;
        frameState.currentTime = elapsed;
        paintPreview(canvas, frameState, cache).finally(() => {
          painting = false;
        });
        onProgress?.(elapsed, duration);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  await stopped;
  if (audioElement) audioElement.pause();
  if (audioContext) audioContext.close().catch(() => {});
  stream.getTracks().forEach((track) => track.stop());
  return {
    blob: new Blob(chunks, { type: mimeType.split(';')[0] }),
    extension: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm',
  };
}

async function paintPreview(canvas, state, cache) {
  if (!canvas) return;
  const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = getCanvasSize(state.config);
  if (canvas.width !== CANVAS_WIDTH) canvas.width = CANVAS_WIDTH;
  if (canvas.height !== CANVAS_HEIGHT) canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const item = sceneAtTime(state.config, state.currentTime);
  if (!item) return;
  const playing = Boolean(state.isPlaying);
  const index = state.config.scenes.indexOf(item);
  const transition = item.transition || {};
  const transitionDuration = transition.type === 'none' ? 0 : Number(transition.duration || 0);
  const progress = transitionDuration > 0 ? clamp01((state.currentTime - item.start) / transitionDuration) : 1;
  if (index > 0 && transitionDuration > 0 && progress < 1) {
    const previous = state.config.scenes[index - 1];
    if (transition.type === 'crossfade' || transition.type === 'fade') {
      await drawScene(ctx, previous, state.config, Math.max(previous.start, item.start - 0.01), cache, 1 - progress, 0, 0, playing);
      await drawScene(ctx, item, state.config, state.currentTime, cache, progress, 0, 0, playing);
      return;
    }
    if (transition.type === 'slide-up') {
      await drawScene(ctx, previous, state.config, Math.max(previous.start, item.start - 0.01), cache, 1, 0, -CANVAS_HEIGHT * progress, playing);
      await drawScene(ctx, item, state.config, state.currentTime, cache, 1, 0, CANVAS_HEIGHT * (1 - progress), playing);
      return;
    }
    if (transition.type === 'slide-left') {
      await drawScene(ctx, previous, state.config, Math.max(previous.start, item.start - 0.01), cache, 1, -CANVAS_WIDTH * progress, 0, playing);
      await drawScene(ctx, item, state.config, state.currentTime, cache, 1, CANVAS_WIDTH * (1 - progress), 0, playing);
      return;
    }
  }
  await drawScene(ctx, item, state.config, state.currentTime, cache, 1, 0, 0, playing);
  drawSelection(ctx, state, item, state.config.scenes.indexOf(item));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function saveDataUrlAsset(dataUrl, filename) {
  const response = await fetch('/api/save-asset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, filename }),
  });
  if (!response.ok) throw new Error('Failed to save asset');
  const result = await response.json();
  return result.path;
}

// Store uploads on disk via the dev server so large files (videos) don't
// Native IndexedDB media storage to persist large video blobs across browser reloads
const DB_NAME = 'muvidb_studio_store';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

function openMediaDB() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function setMediaBlob(key, blob) {
  try {
    const db = await openMediaDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

async function getMediaBlob(key) {
  try {
    const db = await openMediaDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function clearMediaBlobs() {
  try {
    const db = await openMediaDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch {
    // ignore
  }
}

// Store uploads on disk via the dev server so large files (videos) don't
// blow the localStorage quota; fall back to inline data URLs if it fails.
async function persistUpload(file) {
  const dataUrl = await readFileAsDataUrl(file);
  try {
    return await saveDataUrlAsset(dataUrl, file.name);
  } catch {
    return dataUrl;
  }
}

function loadSavedProject() {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed?.title === 'MuviDB Weekly Picks Reel') {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stripStockBackgrounds(normalizeTimeline(parsed));
  } catch {
    return null;
  }
}

function saveProject(config) {
  if (typeof window === 'undefined' || !config) return null;
  try {
    const saved = normalizeTimeline(config);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    return saved;
  } catch {
    return null;
  }
}

function clearSavedProject() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadJson(config) {
  const exportConfig = normalizeTimeline(config);
  const blob = new Blob([JSON.stringify(exportConfig, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'config.json');
}

const RAIL_ITEMS = [
  { id: 'clip', label: 'Clip / Trim' },
  { id: 'media', label: 'Media' },
  { id: 'text', label: 'Text' },
  { id: 'elements', label: 'Elements' },
  { id: 'audio', label: 'Audio' },
  { id: 'layers', label: 'Layers' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'project', label: 'Project' },
  { id: 'settings', label: 'Settings' },
];

const PREVIEW_ZOOMS = [0.5, 0.75, 1, 1.25, 1.5];
const TRACK_LABEL_WIDTH = 156;
const TRACK_COLORS = {
  text: '#a78bfa',
  image: '#34d399',
  video: '#fb923c',
  pill: '#fbbf24',
  card: '#64748b',
  shape: '#38bdf8',
};

const TEXT_PRESETS = [
  { id: 'headline', label: 'Headline', preset: { text: 'Headline text', fontSize: 84, weight: 'heavy', x: 84, y: 470, width: 912, height: 280, lineHeight: 0.92 } },
  { id: 'subheading', label: 'Subheading', preset: { text: 'Subheading', fontSize: 52, weight: 'bold', x: 84, y: 800, width: 912, height: 140 } },
  { id: 'body', label: 'Body', preset: { text: 'Body copy goes here', fontSize: 38, weight: 'medium', x: 120, y: 980, width: 840, height: 160, lineHeight: 1.05 } },
  { id: 'caption', label: 'Caption', preset: { text: 'caption', fontSize: 30, weight: 'semiBold', x: 84, y: 1330, width: 912, height: 80 } },
];

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
  const wholeSeconds = String(Math.floor(safe % 60)).padStart(2, '0');
  const centiseconds = String(Math.floor((safe % 1) * 100)).padStart(2, '0');
  return `${minutes}:${wholeSeconds}.${centiseconds}`;
}

function layerDisplayName(layer) {
  if (!layer) return 'Layer';
  if (layer.type === 'shape') {
    const label = SHAPE_LIBRARY.find((shape) => shape.shapeKind === layer.shapeKind)?.label;
    return label || layer.shapeKind || 'Shape';
  }
  if (layer.text) return layer.text.length > 20 ? `${layer.text.slice(0, 20)}...` : layer.text;
  return layer.id || layer.type;
}

function ShapeThumb({ kind, className = 'h-10 w-10' }) {
  const common = 'stroke-current fill-current';
  if (kind === 'ellipse') return <svg viewBox="0 0 40 40" className={className}><ellipse cx="20" cy="20" rx="14" ry="12" className={common} opacity="0.85" /></svg>;
  if (kind === 'triangle') return <svg viewBox="0 0 40 40" className={className}><polygon points="20,6 34,32 6,32" className={common} opacity="0.85" /></svg>;
  if (kind === 'diamond') return <svg viewBox="0 0 40 40" className={className}><polygon points="20,5 35,20 20,35 5,20" className={common} opacity="0.85" /></svg>;
  if (kind === 'hexagon') return <svg viewBox="0 0 40 40" className={className}><polygon points="20,5 33,12 33,28 20,35 7,28 7,12" className={common} opacity="0.85" /></svg>;
  if (kind === 'star') return <svg viewBox="0 0 40 40" className={className}><polygon points="20,4 24,15 36,15 26,22 30,34 20,27 10,34 14,22 4,15 16,15" className={common} opacity="0.9" /></svg>;
  if (kind === 'line') return <svg viewBox="0 0 40 40" className={className}><line x1="6" y1="20" x2="34" y2="20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>;
  if (kind === 'arrow') return <svg viewBox="0 0 40 40" className={className}><polygon points="4,15 24,15 24,8 36,20 24,32 24,25 4,25" className={common} opacity="0.9" /></svg>;
  return <svg viewBox="0 0 40 40" className={className}><rect x="7" y="10" width="26" height="20" rx={kind === 'round-rect' ? 8 : 4} className={common} opacity="0.85" /></svg>;
}

function Icon({ name, className = 'h-5 w-5' }) {
  const icons = {
    project: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />,
    scenes: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 15h18M8 4v16M16 4v16" /></>,
    layers: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>,
    media: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M5 17l5-5 4 4 3-3 3 3" /></>,
    text: <path d="M5 6h14M12 6v12M9 18h6" />,
    elements: <><circle cx="8" cy="8" r="4" /><rect x="12" y="12" width="8" height="8" rx="1" /></>,
    audio: <><path d="M9 17V6l10-2v11" /><circle cx="7" cy="17" r="2.5" /><circle cx="17" cy="15" r="2.5" /></>,
    clip: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3V9z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></>,
    eyeOff: <><path d="M4 4l16 16" /><path d="M2 12s3.5-6 10-6c1.8 0 3.4.4 4.8 1M22 12s-3.5 6-10 6c-1.8 0-3.4-.4-4.8-1" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    unlock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.5-2" /></>,
    undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
    redo: <path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h-3" />,
    play: <path d="M7 5l12 7-12 7V5z" />,
    pause: <path d="M7 5h4v14H7zM13 5h4v14h-4z" />,
    skipBack: <path d="M19 5l-9 7 9 7V5zM7 5v14H5V5h2z" />,
    skipFwd: <path d="M5 5l9 7-9 7V5zM17 5v14h2V5h-2z" />,
    trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
    grip: <><circle cx="9" cy="7" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="7" r="1.2" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="9" cy="17" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="1.2" fill="currentColor" stroke="none" /></>,
    rotate: <path d="M20 12a8 8 0 1 1-2.3-5.5M20 4v5h-5" />,
    align: <path d="M4 6h16M7 12h10M5 18h14" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name] || null}
    </svg>
  );
}

function parseTimecodeToSeconds(str) {
  if (!str) return 0;
  const clean = String(str).trim();
  const parts = clean.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

function formatSecondsToTimecode(sec) {
  const safe = Math.max(0, Number(sec) || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [saveStatus, setSaveStatus] = useState('Not saved yet');
  const [renderStatus, setRenderStatus] = useState('Ready to export');
  const [isRendering, setIsRendering] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [activePanel, setActivePanel] = useState('media');
  const [inspectorTab, setInspectorTab] = useState('inspector');
  const [inspectorSubTab, setInspectorSubTab] = useState('basic'); // 'basic' | 'background' | 'audio' | 'speed' | 'animation'
  const [ratioMenuOpen, setRatioMenuOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineDropIndex, setTimelineDropIndex] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeFetchMode, setYoutubeFetchMode] = useState('whole'); // 'whole' | 'clip'
  const [youtubeStartTime, setYoutubeStartTime] = useState('00:00:00');
  const [youtubeEndTime, setYoutubeEndTime] = useState('00:00:30');
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const [clipDraft, setClipDraft] = useState(null);
  const [clipStatus, setClipStatus] = useState('');
  const [clipBusy, setClipBusy] = useState(false);
  const [clipProgress, setClipProgress] = useState(null);
  const [socialOpen, setSocialOpen] = useState(false);
  const [socialCaption, setSocialCaption] = useState('');
  const [socialPlatforms, setSocialPlatforms] = useState(['instagram', 'facebook', 'threads', 'tiktok']);
  const [socialSchedule, setSocialSchedule] = useState('');
  const [socialPostNow, setSocialPostNow] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialStatus, setSocialStatus] = useState('');
  const clipBlobUrlsRef = useRef(new Set());
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const barDragRef = useRef(null);
  const clipTrimRef = useRef(null);
  const layerDragRef = useRef(null);
  const sceneDragRef = useRef(null);
  const audioRef = useRef(null);
  const imageCacheRef = useRef(new Map());
  const latestStateRef = useRef(state);

  const selectedScene = state.config.scenes[state.selectedSceneIndex];
  const selectedLayer = selectedScene?.layers?.[state.selectedLayerIndex];
  const bg = selectedScene?.background || {};
  const animation = bg.animation || {};
  const fontOptions = state.config.fonts?.families || families;
  const totalDuration = timelineDuration(state.config);
  // A small editable tail makes a one-clip timeline behave like an editor:
  // dragging the yellow trim handle visibly exposes empty time after the clip.
  const timelineViewportDuration = Math.max(totalDuration + 1, totalDuration * 1.12);
  const sceneDur = Math.max(0.2, sceneDuration(selectedScene));
  const audioTrack = state.config.audio;
  const { width: canvasW, height: canvasH } = getCanvasSize(state.config);
  const activeFrameId = matchFramePreset(state.config);
  const selectedName = state.selectedTarget === 'layer'
    ? layerDisplayName(selectedLayer)
    : selectedTargetLabel(state.selectedTarget, selectedScene);

  useEffect(() => {
    (async () => {
      const saved = loadSavedProject();
      if (saved && (saved.scenes?.length > 0 || (saved.title && saved.title !== 'Untitled Video Project'))) {
        try {
          const restoredBlob = await getMediaBlob('main_video_blob');
          if (restoredBlob) {
            const restoredUrl = URL.createObjectURL(restoredBlob);
            clipBlobUrlsRef.current.add(restoredUrl);
            if (saved.scenes) {
              for (const sc of saved.scenes) {
                if (sc.background?.image && (sc.background.image.startsWith('blob:') || sc.background.image === 'indexeddb:main_video_blob')) {
                  sc.background.image = restoredUrl;
                }
                for (const l of (sc.layers || [])) {
                  if (l.source && (l.source.startsWith('blob:') || l.source === 'indexeddb:main_video_blob')) {
                    l.source = restoredUrl;
                  }
                }
              }
            }
          }
        } catch {
          // ignore
        }
        dispatch({ type: 'replace-config', config: saved });
        setSaveStatus('Restored last session');
      }
      refreshUploads();
    })();
  }, []);

  // Auto-save project changes to browser localStorage
  useEffect(() => {
    if (state.config && state.config.scenes) {
      const timer = setTimeout(() => {
        saveProject(state.config);
        setSaveStatus('Saved in browser');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state.config]);

  async function handleNewProject() {
    if (window.confirm('Start a new project? This will clear your current canvas session.')) {
      clearSavedProject();
      await clearMediaBlobs();
      revokeClipBlobs();
      dispatch({ type: 'replace-config', config: clone(initialConfig) });
      setClipDraft(null);
      setClipStatus('');
      setSaveStatus('New project started');
    }
  }

  async function refreshUploads() {
    try {
      const response = await fetch('/api/list-assets');
      if (response.ok) setUploads(await response.json());
    } catch {
      // dev server endpoint unavailable; the panel just stays empty
    }
  }

  useEffect(() => {
    latestStateRef.current = state;
    paintPreview(canvasRef.current, state, imageCacheRef.current);
  }, [state]);

  const previewNeedsAnimation = sceneHasMotionBackground(activeSceneInfo(state).scene) || sceneHasMotionLayers(activeSceneInfo(state).scene);

  useEffect(() => {
    if (!previewNeedsAnimation) return undefined;
    let frame = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      paintPreview(canvasRef.current, latestStateRef.current, imageCacheRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [previewNeedsAnimation, state.currentTime, state.selectedSceneIndex, selectedScene?.background?.image, state.config.assets?.background]);

  useEffect(() => {
    if (!state.isPlaying) return undefined;
    const scene = sceneAtTime(state.config, state.currentTime) || selectedScene;
    const bg = scene?.background;
    const isClipVideo = Boolean(bg?.mediaKind === 'video' && bg?.image && bg?.clipOut != null);
    let frame = 0;
    let cancelled = false;

    if (isClipVideo) {
      const clipIn = Number(bg.clipIn) || 0;
      const clipOut = Number(bg.clipOut);
      const span = Math.max(0.2, clipOut - clipIn);
      const startLocal = Math.max(0, Math.min(span - 0.05, state.currentTime - (scene.start || 0)));
      (async () => {
        const video = await loadVideo(imageCacheRef.current, bg.image);
        if (!video || cancelled) return;
        video.loop = false;
        video.muted = false;
        video.volume = 1.0;
        try { video.currentTime = clipIn + startLocal; } catch { /* ignore */ }
        await video.play().catch(() => {
          video.muted = true;
          return video.play().catch(() => {});
        });
        const tick = () => {
          if (cancelled) return;
          const local = Math.max(0, (video.currentTime || 0) - clipIn);
          if (video.ended || video.currentTime >= clipOut - 0.05) {
            dispatch({ type: 'ui', patch: { currentTime: Number(((scene.start || 0) + span).toFixed(2)), isPlaying: false } });
            video.pause();
            return;
          }
          dispatch({ type: 'ui', patch: { currentTime: Number(((scene.start || 0) + Math.min(span, local)).toFixed(2)) } });
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })();
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        loadVideo(imageCacheRef.current, bg.image).then((video) => video?.pause());
      };
    }

    const startedAt = performance.now();
    const startTime = state.currentTime;
    const tick = (now) => {
      const elapsed = (now - startedAt) / 1000;
      const nextTime = (startTime + elapsed) % Math.max(1, timelineDuration(state.config));
      dispatch({ type: 'ui', patch: { currentTime: Number(nextTime.toFixed(2)) } });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.isPlaying]);

  function nudgePlayhead(deltaSeconds) {
    seekTo(state.currentTime + deltaSeconds);
  }

  function jumpPlayheadToSource(sourceSeconds) {
    if (!bg || bg.mediaKind !== 'video') {
      seekTo(Number(sourceSeconds) || 0);
      return;
    }
    const clipIn = Number(bg.clipIn) || 0;
    const clipOut = bg.clipOut != null ? Number(bg.clipOut) : clipIn + totalDuration;
    const absolute = Math.max(clipIn, Math.min(clipOut - 0.05, Number(sourceSeconds) || 0));
    seekTo(Math.max(0, absolute - clipIn));
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioTrack?.source) {
      audio.pause();
      return;
    }
    const resolved = resolveAssetPath(audioTrack.source);
    if (audio.dataset.src !== resolved) {
      audio.src = resolved;
      audio.dataset.src = resolved;
    }
    audio.loop = true;
    audio.volume = Math.min(1, Math.max(0, audioTrack.volume ?? 1));
    if (state.isPlaying) {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = latestStateRef.current.currentTime % audio.duration;
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [state.isPlaying, audioTrack?.source, audioTrack?.volume]);

  async function togglePlay() {
    const willPlay = !latestStateRef.current.isPlaying;
    const currentScene = sceneAtTime(latestStateRef.current.config, latestStateRef.current.currentTime) || selectedScene;
    const bgImg = currentScene?.background?.image;
    if (bgImg) {
      const resolved = resolveAssetPath(bgImg);
      const video = imageCacheRef.current.get(`video_el:${resolved}`);
      if (video) {
        if (willPlay) {
          video.muted = Boolean(currentScene?.background?.muted);
          video.volume = Math.max(0, Math.min(1, currentScene?.background?.volume ?? 1.0));
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    }
    const audio = audioRef.current;
    if (audio && audioTrack?.source) {
      if (willPlay) audio.play().catch(() => {});
      else audio.pause();
    }
    dispatch({ type: 'ui', patch: { isPlaying: willPlay } });
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.target.closest('input, textarea, select')) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault();
        dispatch({ type: 'redo' });
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        togglePlay();
        return;
      }
      if (key === 's') handleSplitScene();
      if (key === 'd') handleDuplicate();
      if (key === 'delete' || key === 'backspace') handleDelete();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectedLayerFields = useMemo(() => selectedLayer || {}, [selectedLayer]);

  async function importJson(file) {
    const text = await file.text();
    const config = JSON.parse(text);
    dispatch({ type: 'replace-config', config });
  }

  async function importAsset(file, action) {
    const source = await persistUpload(file);
    imageCacheRef.current.clear();
    dispatch(action(source));
    refreshUploads();
  }

  async function importMediaLayer(file, layerType) {
    const source = await persistUpload(file);
    imageCacheRef.current.clear();
    dispatch({ type: 'add-media-layer', layerType, source });
    refreshUploads();
  }

  async function handleUploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadStatus(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`);
    for (const file of files) await persistUpload(file);
    await refreshUploads();
    setUploadStatus(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`);
  }

  function addUploadToScene(item) {
    imageCacheRef.current.clear();
    dispatch({ type: 'add-media-layer', layerType: item.kind === 'video' ? 'video' : 'image', source: item.path });
  }

  function setUploadAsBackground(item) {
    imageCacheRef.current.clear();
    dispatch({ type: 'background', key: 'image', value: item.path });
  }

  async function importAudio(file) {
    const source = await persistUpload(file);
    dispatch({ type: 'set-audio', audio: { source, name: file.name, volume: 0.9 } });
    refreshUploads();
  }

  function revokeClipBlobs(source = null) {
    const urls = clipBlobUrlsRef.current;
    if (source) {
      if (urls.has(source)) URL.revokeObjectURL(source);
      urls.delete(source);
      return;
    }
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls.clear();
  }

  useEffect(() => () => revokeClipBlobs(), []);

  function probeVideoMeta(source) {
    return new Promise((resolveMeta, rejectMeta) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        video.removeAttribute('src');
        video.load();
        callback(value);
      };
      const timeout = setTimeout(() => finish(rejectMeta, new Error('The video took too long to become playable. Try MP4/WebM or another source.')), 12000);
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) {
          finish(rejectMeta, new Error('This source did not provide playable video metadata.'));
          return;
        }
        finish(resolveMeta, {
          duration: video.duration,
          width: video.videoWidth || 0,
          height: video.videoHeight || 0,
        });
      };
      video.onerror = () => finish(rejectMeta, new Error('The selected source is not a playable video or blocks canvas playback.'));
      video.src = resolveAssetPath(source);
      video.load();
    });
  }

  async function warmClipVideo(source, targetTime = 0) {
    const video = await loadVideo(imageCacheRef.current, source);
    if (!video || !video.videoWidth || !video.videoHeight) {
      throw new Error('The video could not be decoded for canvas playback.');
    }
    video.pause();
    const safeTarget = Math.max(0, Math.min(Number(targetTime) || 0, Math.max(0, (video.duration || 0) - 0.05)));
    if (Math.abs((video.currentTime || 0) - safeTarget) <= 0.05) return video;
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        if (error) reject(error);
        else resolve(video);
      };
      const onSeeked = () => finish();
      const onError = () => finish(new Error('The video failed while preparing the selected start time.'));
      const timeout = setTimeout(() => finish(new Error('The selected video position could not be buffered.')), 10000);
      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });
      try {
        video.currentTime = safeTarget;
      } catch {
        finish(new Error('The browser could not seek this video.'));
      }
    });
    return video;
  }

  async function applyClipToEditor({ source, title, duration, clipIn = 0, clipOut = null, insertion = 'append' }) {
    const safeIn = Math.max(0, Number(clipIn) || 0);
    const safeOut = Math.max(safeIn + 0.2, clipOut != null ? Number(clipOut) : Number(duration) || safeIn + 0.2);
    setClipProgress({ stage: 'loading', percent: 82, message: 'Checking playable frames…' });
    await warmClipVideo(source, safeIn);
    const hasTimeline = latestStateRef.current.config.scenes.length > 0;
    dispatch({
      type: insertion === 'replace' || !hasTimeline ? 'apply-clip' : 'append-clip',
      source,
      title: title || 'Clip',
      clipIn: safeIn,
      clipOut: safeOut,
      sourceDuration: duration,
      outputName: `${(title || 'muvidb-clip').replace(/[^\w\-]+/g, '-').slice(0, 40)}.mp4`,
    });
    setClipDraft({
      source,
      title: title || 'Clip',
      temporary: true,
      duration: Number(Number(duration).toFixed(2)),
      clipIn: safeIn,
      clipOut: safeOut,
      applied: true,
    });
    setClipStatus(`${hasTimeline && insertion !== 'replace' ? 'Added as the next clip' : 'On the editor'} · drag clips to reorder, trim their edges, then Export.`);
    setActivePanel('clip');
    setClipProgress(null);
  }

  async function loadClipSource({ source, title, temporary, duration: knownDuration, clipIn = 0, clipOut = null, autoApply = false, insertion = 'append' }) {
    const meta = await probeVideoMeta(source);
    const duration = meta.duration || (knownDuration && knownDuration > 0 ? knownDuration : 0);
    if (!(duration > 0.2)) throw new Error('The selected video is too short or unreadable.');
    const requestedIn = Math.max(0, Number(clipIn) || 0);
    if (requestedIn >= duration - 0.2) {
      throw new Error(`The selected start time (${formatTime(requestedIn)}) is after this video's ${formatTime(duration)} duration.`);
    }
    const safeIn = Math.min(requestedIn, duration - 0.2);
    const requestedOut = clipOut != null ? Number(clipOut) : duration;
    const safeOut = Math.min(duration, Math.max(safeIn + 0.2, requestedOut));
    const draft = {
      source,
      title: title || 'Clip',
      temporary: Boolean(temporary),
        duration: Number(duration.toFixed(2)),
      clipIn: safeIn,
      clipOut: safeOut,
    };
    setClipDraft(draft);
    if (autoApply) {
      await applyClipToEditor({ ...draft, insertion });
    } else {
      setClipStatus(`Loaded · ${formatTime(duration)} total. Open in editor to trim.`);
    }
  }

  async function handleFetchYoutube(urlOverride = '') {
    // React passes the click event as the first argument. Only a caller that
    // deliberately supplies a URL should override the controlled input.
    const overrideUrl = typeof urlOverride === 'string' ? urlOverride : '';
    const rawUrl = (overrideUrl || youtubeUrl).trim();
    if (!rawUrl) {
      setClipStatus('Paste a video or YouTube URL first.');
      return;
    }

    setClipBusy(true);
    setClipProgress({ stage: 'loading', percent: 20, message: 'Loading video...' });
    setClipStatus('Processing video request...');

    // 1. Direct video URL fast path (.mp4, .webm, .mov, Supabase, Cloudinary)
    const isDirect = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(rawUrl) || rawUrl.includes('supabase.co') || rawUrl.includes('cloudinary');
    if (isDirect) {
      try {
        const safeIn = youtubeFetchMode === 'clip' ? parseTimecodeToSeconds(youtubeStartTime) : 0;
        const parsedOut = youtubeFetchMode === 'clip' && youtubeEndTime ? parseTimecodeToSeconds(youtubeEndTime) : null;

        await loadClipSource({
          source: rawUrl,
          title: 'Video Clip',
          temporary: true,
          duration: null,
          clipIn: safeIn,
          clipOut: parsedOut,
          autoApply: true,
        });
        setClipProgress(null);
        setClipStatus('Video loaded directly onto canvas!');
      } catch (err) {
        setClipProgress({ stage: 'error', percent: 0, message: err.message });
        setClipStatus(`Could not load video: ${err.message}`);
      } finally {
        setClipBusy(false);
      }
      return;
    }

    // 2. YouTube URL fetching via API / Dev server
    try {
      const apiEndpoint = typeof window !== 'undefined' && window.location.hostname.endsWith('muvidb.com')
        ? 'https://muvidb.com/api/data?_r=fetch-youtube'
        : '/api/fetch-youtube';

      const start = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl }),
      });
      const contentType = start.headers.get('content-type') || '';
      let started;
      if (contentType.includes('application/json')) {
        started = await start.json();
      } else {
        const text = await start.text();
        throw new Error(start.ok ? 'Unexpected response format' : `Server response (${start.status}): ${text.slice(0, 80)}`);
      }
      if (!start.ok) throw new Error(started.error || 'Fetch failed');

      let result = null;
      if (started.done && started.result) {
        result = started.result;
      } else {
        const jobId = started.jobId;
        setClipProgress({
          stage: started.stage || 'queued',
          percent: started.percent || 25,
          message: started.message || 'Queued...',
        });

        for (let i = 0; i < 60; i++) {
          await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
          const statusResponse = await fetch(`${apiEndpoint}&jobId=${encodeURIComponent(jobId)}`);
          const statusContentType = statusResponse.headers.get('content-type') || '';
          let status;
          if (statusContentType.includes('application/json')) {
            status = await statusResponse.json();
          } else {
            const text = await statusResponse.text();
            throw new Error(`Server error (${statusResponse.status}): ${text.slice(0, 80)}`);
          }
          if (!statusResponse.ok) throw new Error(status.error || 'Lost fetch progress.');
          setClipProgress({
            stage: status.stage,
            percent: Number(status.percent) || 50,
            message: status.message || 'Working...',
          });
          setClipStatus(status.message || 'Fetching...');
          if (status.done) {
            if (status.error) throw new Error(status.error);
            result = status.result;
            break;
          }
        }
      }

      if (!result?.path || !result?.isDirectStream) {
        throw new Error('YouTube metadata loaded, but Render did not return a playable video stream. Nothing was added to the canvas.');
      }

      const safeIn = youtubeFetchMode === 'clip' ? parseTimecodeToSeconds(youtubeStartTime) : 0;
      const parsedOut = youtubeFetchMode === 'clip' && youtubeEndTime ? parseTimecodeToSeconds(youtubeEndTime) : null;
      const safeOut = parsedOut != null && parsedOut > safeIn ? parsedOut : (result.duration || safeIn + 30);

      await loadClipSource({
        source: result.path,
        title: result.title,
        temporary: true,
        duration: result.duration,
        clipIn: safeIn,
        clipOut: safeOut,
        autoApply: true,
      });
      setClipProgress(null);
      setClipStatus('Video attached to canvas and ready for trimming!');
    } catch (error) {
      setClipProgress({
        stage: 'error',
        percent: 0,
        message: error.message || 'Fetch failed',
      });
      setClipStatus(
        'YouTube restricts direct stream ripping on public web servers. You can load any video file instantly by clicking "Upload a video instead" below or dragging an MP4/MOV directly onto the canvas.'
      );
    } finally {
      setClipBusy(false);
    }
  }

  async function handleOptionalClipUpload(file, insertion = 'append', applyYoutubeTrim = false) {
    if (!file) return;
    let pendingBlobUrl = null;
    setClipBusy(true);
    setClipProgress({ stage: 'loading', percent: 20, message: 'Loading local file...' });
    setClipStatus('Loading local file into memory...');
    try {
      // Preview from the device immediately. Persisting a large gallery video
      // must never hold up editing or look like a cloud upload.
      setMediaBlob('main_video_blob', file).catch(() => {});
      const blobUrl = URL.createObjectURL(file);
      pendingBlobUrl = blobUrl;
      clipBlobUrlsRef.current.add(blobUrl);

      const safeIn = applyYoutubeTrim && youtubeFetchMode === 'clip' ? parseTimecodeToSeconds(youtubeStartTime) : 0;
      const parsedOut = applyYoutubeTrim && youtubeFetchMode === 'clip' && youtubeEndTime ? parseTimecodeToSeconds(youtubeEndTime) : null;

      await loadClipSource({
        source: blobUrl,
        title: file.name.replace(/\.[^.]+$/, ''),
        temporary: true,
        clipIn: safeIn,
        clipOut: parsedOut,
        autoApply: true,
        insertion,
      });
      setClipProgress(null);
      setClipStatus(applyYoutubeTrim && youtubeFetchMode === 'clip'
        ? `Playable clip loaded with trim ${youtubeStartTime} to ${youtubeEndTime}.`
        : 'Playable video loaded at its full duration.');
    } catch (error) {
      if (pendingBlobUrl && !latestStateRef.current.config.scenes.some((scene) => scene.background?.image === pendingBlobUrl)) {
        revokeClipBlobs(pendingBlobUrl);
      }
      setClipProgress(null);
      setClipStatus(error.message || 'Could not load that file.');
    } finally {
      setClipBusy(false);
    }
  }

  function handleCanvasDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      handleOptionalClipUpload(file);
      return;
    }
    const url = event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain');
    if (url && /^https?:\/\//i.test(url.trim())) {
      setYoutubeUrl(url.trim());
      handleFetchYoutube(url.trim());
    }
  }

  function handleCanvasPaste(event) {
    const file = event.clipboardData?.files?.[0];
    if (file) {
      event.preventDefault();
      handleOptionalClipUpload(file);
      return;
    }
    const text = event.clipboardData?.getData('text/plain')?.trim();
    if (text && /^https?:\/\//i.test(text)) {
      event.preventDefault();
      setYoutubeUrl(text);
      handleFetchYoutube(text);
    }
  }

  function applyClipDraft() {
    if (!clipDraft?.source) return;
    applyClipToEditor(clipDraft);
  }

  function setClipMark(kind) {
    if (!bg || bg.mediaKind !== 'video' || bg.clipOut == null) return;
    const sourceIn = Number(bg.clipIn) || 0;
    const sourceOut = Number(bg.clipOut);
    const absolute = sourceIn + Math.max(0, state.currentTime);
    if (kind === 'in') {
      const nextIn = Math.min(absolute, sourceOut - 0.2);
      dispatch({ type: 'clip-window', clipIn: nextIn, clipOut: sourceOut });
      seekTo(0);
    } else {
      const nextOut = Math.max(absolute, sourceIn + 0.2);
      dispatch({ type: 'clip-window', clipIn: sourceIn, clipOut: nextOut });
    }
  }

  async function clearClipDraft() {
    const path = clipDraft?.source;
    const inUse = latestStateRef.current.config.scenes.some((scene) =>
      scene.background?.image === path || (scene.layers || []).some((layer) => layer.source === path));
    if (path && !inUse) revokeClipBlobs(path);
    setClipDraft(null);
    setClipStatus('Cleared temporary clip.');
    if (path && String(path).startsWith('output/temp-clips/')) {
      try {
        await fetch('/api/clear-temp-clip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        });
      } catch {
        // ignore cleanup failures
      }
    }
  }

  function handleSave() {
    const hasTempBlob = state.config.scenes.some((scene) => {
      if (String(scene.background?.image || '').startsWith('blob:')) return true;
      return (scene.layers || []).some((layer) => String(layer.source || '').startsWith('blob:'));
    });
    const saved = saveProject(state.config);
    if (saved) {
      dispatch({ type: 'replace-config', config: saved });
      setSaveStatus(hasTempBlob
        ? 'Saved text/layout. Temporary clip blob will not survive a refresh — Export first.'
        : 'All changes saved');
    }
  }

  function handleReset() {
    clearSavedProject();
    imageCacheRef.current.clear();
    dispatch({ type: 'reset' });
    setSaveStatus('Reset to default');
    setRenderStatus('Ready to export');
  }

  async function handleExportVideo() {
    setIsRendering(true);
    setRenderStatus('Starting recording...');
    try {
      const exportConfig = normalizeTimeline(state.config);
      const result = await recordTimeline(exportConfig, imageCacheRef.current, (elapsed, duration) => {
        setRenderStatus(`Recording ${elapsed.toFixed(1)}s of ${duration.toFixed(1)}s...`);
      });
      const baseName = (exportConfig.outputName || 'muvidb-reel.mp4').replace(/\.[a-z0-9]+$/i, '');
      downloadBlob(result.blob, `${baseName}.${result.extension}`);
      setRenderStatus(`Video downloaded as .${result.extension}`);
    } catch (error) {
      setRenderStatus(error.message || 'Recording failed.');
    } finally {
      setIsRendering(false);
    }
  }

  function handleSplitScene() {
    const current = latestStateRef.current;
    const scene = sceneAtTime(current.config, current.currentTime);
    const index = current.config.scenes.indexOf(scene);
    dispatch({ type: 'split-scene', index, time: current.currentTime });
  }

  function handleDuplicate() {
    const current = latestStateRef.current;
    dispatch({ type: current.selectedTarget === 'layer' ? 'duplicate-layer' : 'duplicate-scene' });
  }

  function handleDelete() {
    const current = latestStateRef.current;
    dispatch({ type: current.selectedTarget === 'layer' ? 'delete-layer' : 'delete-scene' });
  }

  function seekTo(time) {
    dispatch({ type: 'ui', patch: { currentTime: Number(Math.max(0, Math.min(totalDuration, time)).toFixed(2)), isPlaying: false } });
  }

  function canvasPoint(event) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const { width: canvasW, height: canvasH } = getCanvasSize(state.config);
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvasW,
      y: ((event.clientY - rect.top) / rect.height) * canvasH,
    };
  }

  function handleCanvasPointerDown(event) {
    const point = canvasPoint(event);
    const { scene, sceneIndex } = activeSceneInfo(state);
    if (!scene) return;
    if (state.selectedTarget === 'layer' && sceneIndex === state.selectedSceneIndex) {
      const layer = scene.layers?.[state.selectedLayerIndex];
      const handle = layer && !layer.locked ? handleAtPoint(layer, point) : null;
      if (handle === 'rotate') {
        dispatch({ type: 'begin-interaction' });
        const center = layerCenter(layer);
        dragRef.current = {
          mode: 'rotate',
          sceneIndex,
          layerIndex: state.selectedLayerIndex,
          center,
          startAngle: Math.atan2(point.y - center.y, point.x - center.x),
          startRotation: Number(layer.rotation) || 0,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      if (handle) {
        dispatch({ type: 'begin-interaction' });
        dragRef.current = {
          mode: 'resize',
          sceneIndex,
          layerIndex: state.selectedLayerIndex,
          handle,
          startBox: { x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotation: Number(layer.rotation) || 0 },
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }
    const layerIndex = hitTestScene(scene, point);
    dispatch({ type: 'begin-interaction' });
    if (layerIndex >= 0) {
      const layer = scene.layers[layerIndex];
      dispatch({ type: 'select-layer', sceneIndex, layerIndex });
      dragRef.current = {
        mode: 'layer',
        sceneIndex,
        layerIndex,
        offsetX: point.x - layer.x,
        offsetY: point.y - layer.y,
      };
    } else {
      const sceneBg = scene.background || {};
      dispatch({ type: 'select-background', sceneIndex });
      dragRef.current = {
        mode: 'background',
        sceneIndex,
        startPointerX: point.x,
        startPointerY: point.y,
        startX: sceneBg.x ?? 0,
        startY: sceneBg.y ?? 0,
      };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCanvasPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = canvasPoint(event);
    if (drag.mode === 'rotate') {
      const angle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x);
      let degrees = drag.startRotation + ((angle - drag.startAngle) * 180) / Math.PI;
      if (event.shiftKey) degrees = Math.round(degrees / 15) * 15;
      dispatch({ type: 'rotate-layer', sceneIndex: drag.sceneIndex, layerIndex: drag.layerIndex, rotation: degrees });
      return;
    }
    if (drag.mode === 'resize') {
      const box = drag.startBox;
      const local = worldToLocal(box, point);
      const right = box.x + box.width;
      const bottom = box.y + box.height;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      let { x, y, width, height } = box;
      const handle = drag.handle || '';
      const fixedLocal = {
        tl: { x: right, y: bottom },
        tr: { x: box.x, y: bottom },
        bl: { x: right, y: box.y },
        br: { x: box.x, y: box.y },
        t: { x: cx, y: bottom },
        b: { x: cx, y: box.y },
        l: { x: right, y: cy },
        r: { x: box.x, y: cy },
      }[handle];
      const fixedWorld = fixedLocal ? localToWorld(box, fixedLocal) : null;
      if (handle.includes('l')) {
        x = Math.min(local.x, right - 20);
        width = right - x;
      }
      if (handle.includes('r')) width = Math.max(20, local.x - box.x);
      if (handle.includes('t')) {
        y = Math.min(local.y, bottom - 20);
        height = bottom - y;
      }
      if (handle.includes('b')) height = Math.max(20, local.y - box.y);
      if (fixedWorld) {
        const nextFixedLocal = {
          tl: { x: x + width, y: y + height },
          tr: { x, y: y + height },
          bl: { x: x + width, y },
          br: { x, y },
          t: { x: x + width / 2, y: y + height },
          b: { x: x + width / 2, y },
          l: { x: x + width, y: y + height / 2 },
          r: { x, y: y + height / 2 },
        }[handle];
        const nextFixedWorld = localToWorld({ ...box, x, y, width, height }, nextFixedLocal);
        x += fixedWorld.x - nextFixedWorld.x;
        y += fixedWorld.y - nextFixedWorld.y;
      }
      dispatch({ type: 'resize-layer', sceneIndex: drag.sceneIndex, layerIndex: drag.layerIndex, x, y, width, height });
      return;
    }
    if (drag.mode === 'layer') {
      dispatch({
        type: 'drag-layer',
        sceneIndex: drag.sceneIndex,
        layerIndex: drag.layerIndex,
        x: point.x - drag.offsetX,
        y: point.y - drag.offsetY,
      });
    }
    if (drag.mode === 'background') {
      const nextX = drag.startX + (point.x - drag.startPointerX);
      const nextY = drag.startY + (point.y - drag.startPointerY);
      dispatch({
        type: 'drag-background',
        sceneIndex: drag.sceneIndex,
        x: nextX,
        y: nextY,
        previousX: drag.startX,
        previousY: drag.startY,
      });
    }
  }

  function handleCanvasPointerUp(event) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleBarPointerDown(event, layerIndex, mode) {
    event.stopPropagation();
    const track = event.currentTarget.closest('[data-track]');
    const layer = selectedScene?.layers?.[layerIndex];
    if (!track || !layer || layer.locked) return;
    const rect = track.getBoundingClientRect();
    dispatch({ type: 'begin-interaction' });
    dispatch({ type: 'select-layer', layerIndex });
    barDragRef.current = {
      mode,
      layerIndex,
      startX: event.clientX,
      width: Math.max(1, rect.width),
      sceneDur,
      startOffset: Math.max(0, Number(layer.offset) || 0),
      startDuration: layer.duration != null ? Number(layer.duration) : sceneDur - (Number(layer.offset) || 0),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleBarPointerMove(event) {
    const drag = barDragRef.current;
    if (!drag) return;
    const deltaSeconds = ((event.clientX - drag.startX) / drag.width) * drag.sceneDur;
    if (drag.mode === 'move') {
      const maxOffset = Math.max(0, drag.sceneDur - drag.startDuration);
      const offset = Math.min(maxOffset, Math.max(0, drag.startOffset + deltaSeconds));
      dispatch({ type: 'layer-window', sceneIndex: state.selectedSceneIndex, layerIndex: drag.layerIndex, offset });
    } else {
      const duration = Math.min(drag.sceneDur - drag.startOffset, Math.max(0.2, drag.startDuration + deltaSeconds));
      dispatch({ type: 'layer-window', sceneIndex: state.selectedSceneIndex, layerIndex: drag.layerIndex, duration });
    }
  }

  function handleBarPointerUp() {
    barDragRef.current = null;
  }

  async function handleExportToSocial() {
    if (!socialPlatforms.length) { setSocialStatus('Choose at least one platform.'); return; }
    setSocialBusy(true);
    setSocialStatus('Rendering your edit…');
    try {
      const exportConfig = normalizeTimeline(state.config);
      const result = await recordTimeline(exportConfig, imageCacheRef.current, (elapsed, duration) => {
        setSocialStatus(`Rendering ${elapsed.toFixed(1)}s of ${duration.toFixed(1)}s…`);
      });
      const extension = result.extension || 'webm';
      const fileName = `studio/${crypto.randomUUID()}.${extension}`;
      setSocialStatus('Uploading the rendered video to Social Studio…');
      const { error: uploadError } = await socialStorage.storage.from(SOCIAL_BUCKET).upload(fileName, result.blob, {
        contentType: result.blob.type || `video/${extension}`, upsert: false, cacheControl: '31536000',
      });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = socialStorage.storage.from(SOCIAL_BUCKET).getPublicUrl(fileName);
      const { data: sessionData } = await socialStorage.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sign in to MuviDB as an admin before sending a video to the scheduler.');
      setSocialStatus('Creating your platform drafts…');
      const captions = Object.fromEntries(socialPlatforms.map(platform => [platform, socialCaption || exportConfig.title || 'New video from MuviDB Studio']));
      const response = await fetch('/api/social?task=create_editor_video_draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: exportConfig.title, publicUrl: urlData.publicUrl, storagePath: fileName, mimeType: result.blob.type, fileSizeBytes: result.blob.size, width: exportConfig.width, height: exportConfig.height, captions, platforms: socialPlatforms }),
      });
      const draft = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(draft.error || `Could not create Social Studio draft (${response.status})`);
      if (socialPostNow) {
        setSocialStatus('Sending the video to your connected accounts…');
        const published = await fetch('/api/social?task=publish_editor_video_now', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ contentItemId: draft.id }),
        });
        const publishResult = await published.json().catch(() => ({}));
        if (!published.ok) throw new Error(publishResult.error || 'Draft created but could not be published immediately. Open Social Studio to retry.');
        setSocialStatus('Sent to the existing publisher. Check Social Studio for each platform result.');
      } else if (socialSchedule) {
        setSocialStatus('Adding the video to the publishing schedule…');
        const scheduled = await fetch('/api/social?task=schedule', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ contentItemId: draft.id, scheduledFor: new Date(socialSchedule).toISOString() }),
        });
        const scheduleResult = await scheduled.json().catch(() => ({}));
        if (!scheduled.ok) throw new Error(scheduleResult.error || 'Draft created but could not be scheduled. Open Social Studio to schedule it.');
        setSocialStatus(`Scheduled for ${new Date(socialSchedule).toLocaleString()}. The existing cron publisher will post it.`);
      } else {
        setSocialStatus('Draft ready in Social Studio. Review it and choose Post now or a schedule time.');
      }
    } catch (error) {
      setSocialStatus(error.message || 'Could not send the video to Social Studio.');
    } finally { setSocialBusy(false); }
  }

  function handleClipTrimPointerDown(event, sceneIndex, edge) {
    event.preventDefault();
    event.stopPropagation();
    const track = event.currentTarget.closest('[data-video-track]');
    const scene = state.config.scenes[sceneIndex];
    if (!track || !scene?.background?.image) return;
    const rect = track.getBoundingClientRect();
    dispatch({ type: 'ui', patch: { selectedSceneIndex: sceneIndex, selectedLayerIndex: 0, selectedTarget: 'background', isPlaying: false } });
    const trim = {
      edge, sceneIndex, startX: event.clientX, width: Math.max(1, rect.width),
      clipIn: Number(scene.background.clipIn) || 0,
      clipOut: Number(scene.background.clipOut) || scene.end - scene.start,
      sourceDuration: Number(scene.background.sourceDuration) || 99999,
      timelineDuration: Math.max(0.2, timelineViewportDuration),
      handle: event.currentTarget,
      pointerId: event.pointerId,
    };
    const move = (moveEvent) => {
      if (clipTrimRef.current !== trim) return;
      moveEvent.preventDefault();
      const seconds = ((moveEvent.clientX - trim.startX) / trim.width) * trim.timelineDuration;
      const minimum = 0.2;
      const clipIn = trim.edge === 'left'
        ? Math.max(0, Math.min(trim.clipOut - minimum, trim.clipIn + seconds))
        : trim.clipIn;
      const clipOut = trim.edge === 'right'
        ? Math.min(trim.sourceDuration, Math.max(trim.clipIn + minimum, trim.clipOut + seconds))
        : trim.clipOut;
      dispatch({ type: 'clip-window', sceneIndex: trim.sceneIndex, clipIn, clipOut });
    };
    const finish = (upEvent) => {
      if (clipTrimRef.current !== trim) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (trim.handle?.hasPointerCapture?.(trim.pointerId)) {
        try { trim.handle.releasePointerCapture(trim.pointerId); } catch { /* ignore */ }
      }
      if (clipTrimRef.current === trim) clipTrimRef.current = null;
    };
    trim.finish = finish;
    trim.move = move;
    clipTrimRef.current?.finish?.();
    clipTrimRef.current = trim;
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* global listeners remain active */ }
  }

  function handleClipTrimPointerMove(event) {
    const trim = clipTrimRef.current;
    if (!trim) return;
    event.preventDefault();
    const seconds = ((event.clientX - trim.startX) / trim.width) * trim.timelineDuration;
    const minimum = 0.2;
    const clipIn = trim.edge === 'left'
      ? Math.max(0, Math.min(trim.clipOut - minimum, trim.clipIn + seconds))
      : trim.clipIn;
    const clipOut = trim.edge === 'right'
      ? Math.min(trim.sourceDuration, Math.max(trim.clipIn + minimum, trim.clipOut + seconds))
      : trim.clipOut;
    dispatch({ type: 'clip-window', sceneIndex: trim.sceneIndex, clipIn, clipOut });
  }

  function seekFromTimelineClientX(clientX, trackEl) {
    if (!selectedScene || !trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    if (!rect.width) return;
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seekTo(Math.min(totalDuration, fraction * timelineViewportDuration));
  }

  function handleRulerSeek(event) {
    const track = event.currentTarget;
    seekFromTimelineClientX(event.clientX, track);
    if (event.pointerId != null && track.setPointerCapture) {
      try { track.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    }
  }

  function handleRulerScrub(event) {
    if (event.buttons !== 1 && event.pressure === 0) return;
    seekFromTimelineClientX(event.clientX, event.currentTarget);
  }

  function beginLayerReorder(fromIndex, event) {
    layerDragRef.current = { fromIndex };
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(fromIndex));
    }
    dispatch({ type: 'select-layer', layerIndex: fromIndex });
  }

  function completeLayerReorder(toIndex) {
    const fromIndex = layerDragRef.current?.fromIndex;
    layerDragRef.current = null;
    setTimelineDropIndex(null);
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex === toIndex) return;
    dispatch({ type: 'reorder-layer', fromIndex, toIndex });
  }

  function renderScenesList() {
    return (
      <section className="mt-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Scenes</h2>
          <button className="btn px-3" onClick={() => dispatch({ type: 'add-scene' })}>Add</button>
        </div>
        <div className="grid gap-2">
          {state.config.scenes.map((item, index) => (
            <button key={item.id} className={`rounded-lg border px-3 py-2 text-left ${index === state.selectedSceneIndex ? 'border-muvi-accent bg-muvi-accent/15' : 'border-white/10 bg-white/5'}`} onClick={() => dispatch({ type: 'ui', patch: { selectedSceneIndex: index, selectedLayerIndex: 0, selectedTarget: 'scene', isPlaying: false, currentTime: sceneEditTime(item) } })}>
              <span className="flex items-center justify-between gap-3 text-sm font-bold">
                {item.name || item.id}
                <span className="text-xs text-muvi-muted">{sceneDuration(item).toFixed(1)}s</span>
              </span>
              <span className="mt-1 block text-xs text-muvi-muted">{item.start}s to {item.end}s</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  function renderLeftPanel() {
    if (activePanel === 'clip') {
      const activeClipIn = bg.clipIn;
      const activeClipOut = bg.clipOut;
      const hasActiveClip = Boolean(bg.mediaKind === 'video' && bg.clipOut != null);
      return (
        <>
          <h2 className="mb-1 text-sm font-bold">YouTube / Clip Studio</h2>
          <p className="mb-3 text-xs text-muvi-muted">Paste a YouTube link to fetch straight into the canvas. Download the whole video or specify start and end time.</p>

          <label className="label">YouTube URL
            <input data-testid="youtube-url" className="control" placeholder="https://www.youtube.com/watch?v=..." value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleFetchYoutube(); }} />
          </label>

          {/* Dual Option Mode Selector */}
          <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muvi-muted">Fetch & Import Mode</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setYoutubeFetchMode('whole')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                  youtubeFetchMode === 'whole'
                    ? 'bg-muvi-accent text-white shadow-sm'
                    : 'bg-white/5 text-muvi-muted hover:bg-white/10 hover:text-white'
                }`}
              >
                1. Whole Video
              </button>
              <button
                type="button"
                data-testid="youtube-mode-clip"
                onClick={() => setYoutubeFetchMode('clip')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                  youtubeFetchMode === 'clip'
                    ? 'bg-muvi-accent text-white shadow-sm'
                    : 'bg-white/5 text-muvi-muted hover:bg-white/10 hover:text-white'
                }`}
              >
                2. Start & End Time
              </button>
            </div>

            {/* Option 2 Timecode Inputs */}
            {youtubeFetchMode === 'clip' && (
              <div className="mt-3 space-y-2.5 border-t border-white/10 pt-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muvi-muted">
                    Start Time
                    <input
                      data-testid="youtube-start"
                      type="text"
                      placeholder="00:00:00"
                      value={youtubeStartTime}
                      onChange={(e) => setYoutubeStartTime(e.target.value)}
                      className="control mt-1 font-mono text-xs"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muvi-muted">
                    End Time
                    <input
                      data-testid="youtube-end"
                      type="text"
                      placeholder="00:00:30"
                      value={youtubeEndTime}
                      onChange={(e) => setYoutubeEndTime(e.target.value)}
                      className="control mt-1 font-mono text-xs"
                    />
                  </label>
                </div>

                {/* Duration Readout */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muvi-muted">Segment Length:</span>
                  <span className="font-mono font-bold text-muvi-accent">
                    {Math.max(0, parseTimecodeToSeconds(youtubeEndTime) - parseTimecodeToSeconds(youtubeStartTime)).toFixed(1)}s
                  </span>
                </div>

                {/* Preset Quick Trim Pills */}
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-muvi-muted">Presets:</span>
                  {[
                    { label: '15s Hook', sec: 15 },
                    { label: '30s Reel', sec: 30 },
                    { label: '60s TikTok', sec: 60 },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const start = parseTimecodeToSeconds(youtubeStartTime);
                        setYoutubeEndTime(formatSecondsToTimecode(start + preset.sec));
                      }}
                      className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-white/20"
                    >
                      +{preset.sec}s
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button data-testid="youtube-download" className="btn mb-3 w-full bg-muvi-accent/90 hover:bg-muvi-accent disabled:cursor-wait disabled:opacity-70 font-bold" disabled={clipBusy} onClick={handleFetchYoutube}>
            {clipBusy ? '⏳ Download in progress — please keep this tab open' : youtubeFetchMode === 'clip' ? '⚡ Download Clip to Canvas' : '⬇️ Download Whole Video'}
          </button>

          {(clipBusy || clipProgress) && (
            <div className={`mb-3 rounded-xl border p-3 shadow-[0_8px_24px_rgba(255,92,0,0.12)] ${clipProgress?.stage === 'error' ? 'border-red-500/40 bg-red-500/10' : 'border-muvi-accent/50 bg-muvi-accent/10'}`} role="status" aria-live="polite">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2 font-bold text-white">
                  {clipProgress?.stage === 'error' ? '⚠️' : <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-muvi-accent" />}
                  <span className="truncate">{clipProgress?.message || 'Starting your YouTube download…'}</span>
                </span>
                <span className="shrink-0 tabular-nums font-bold text-muvi-accent">{Math.round(clipProgress?.percent || 0)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full transition-[width] duration-300 ease-out ${clipProgress?.stage === 'error' ? 'bg-red-400' : 'bg-muvi-accent'}`} style={{ width: `${Math.max(3, Math.min(100, clipProgress?.percent || 3))}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-white/70">{clipProgress?.stage === 'error' ? 'The reason is shown below. You can correct the link and try again.' : 'Status updates automatically while the clip is prepared for the canvas.'}</p>
            </div>
          )}

          {clipStatus && (
            <div className={`mb-3 rounded-lg border p-3 text-xs leading-relaxed ${
              clipProgress?.stage === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-white/10 bg-white/[0.04] text-white/80'
            }`}>
              <p>{clipStatus}</p>
            </div>
          )}

          {/* Online Segment Trimmer & Downloader Helpers */}
          {clipProgress?.stage === 'error' && youtubeUrl.trim() && (
            <div className="mb-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-blue-400">✂️ Online Segment Cutters</span>
                <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-300">
                  {youtubeStartTime} → {youtubeEndTime}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-white/80">
                Clip just this {Math.max(0, parseTimecodeToSeconds(youtubeEndTime) - parseTimecodeToSeconds(youtubeStartTime)).toFixed(0)}s segment directly online without downloading the entire video:
              </p>
              <div className="grid grid-cols-1 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const url = youtubeUrl.trim();
                    if (!url) return;
                    const startSec = parseTimecodeToSeconds(youtubeStartTime) || 0;
                    const endSec = parseTimecodeToSeconds(youtubeEndTime) || startSec + 30;
                    window.open(`https://www.slicetube.io/?url=${encodeURIComponent(url)}&start=${startSec}&end=${endSec}`, '_blank');
                  }}
                  className="btn w-full bg-blue-600 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 flex items-center justify-center gap-1.5"
                >
                  <span>✂️ 1. SliceTube.io Trimmer ({youtubeStartTime} → {youtubeEndTime})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = youtubeUrl.trim();
                    if (!url) return;
                    const startSec = parseTimecodeToSeconds(youtubeStartTime) || 0;
                    const endSec = parseTimecodeToSeconds(youtubeEndTime) || startSec + 30;
                    window.open(`https://openreplay.com/tools/youtube-clipper/?url=${encodeURIComponent(url)}&start=${startSec}&end=${endSec}`, '_blank');
                  }}
                  className="btn w-full bg-indigo-600/90 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-600 flex items-center justify-center gap-1.5"
                >
                  <span>🎬 2. OpenReplay Clipper ({youtubeStartTime} → {youtubeEndTime})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = youtubeUrl.trim();
                    if (!url) return;
                    const target = url.includes('youtube.com')
                      ? url.replace(/youtube\.com/i, 'ssyoutube.com')
                      : `https://en1.savefrom.net/1-youtube-video-downloader-4vA/?url=${encodeURIComponent(url)}`;
                    window.open(target, '_blank');
                  }}
                  className="btn w-full bg-emerald-700/80 py-1 text-[11px] font-medium text-white/90 shadow-sm hover:bg-emerald-600 flex items-center justify-center gap-1.5"
                >
                  <span>⬇️ 3. SaveFrom.net (Full High-Res Video)</span>
                </button>
              </div>
            </div>
          )}

          {/* Primary Canvas Ingestion Dropzone */}
          <div className="mb-3 rounded-lg border-2 border-dashed border-muvi-accent/40 bg-muvi-accent/10 p-3 text-center">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white">📂 Select or Drop Video to Canvas</p>
            <label className="btn block text-center text-xs font-bold bg-muvi-accent hover:bg-muvi-accent/90 text-white cursor-pointer py-2.5 shadow-md">
              ⚡ Choose Video File (MP4, MOV, WebM)
              <input data-testid="youtube-file-fallback" className="hidden" type="file" accept="video/*,.mp4,.mov,.m4v,.webm" onChange={(event) => { handleOptionalClipUpload(event.target.files?.[0], 'append', true); event.target.value = ''; }} />
            </label>
            <p className="mt-2 text-[10px] text-white/70">
              {youtubeFetchMode === 'clip'
                ? `Automatically applies your trim (${youtubeStartTime} to ${youtubeEndTime}) into the canvas!`
                : 'Loads full video straight into canvas and timeline.'}
            </p>
          </div>

          <div className="mb-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muvi-muted">Frame size</p>
            <div className="grid grid-cols-1 gap-1.5">
              {FRAME_PRESETS.map((preset) => (
                <button
                  key={`clip-frame-${preset.id}`}
                  type="button"
                  aria-label={`Frame ${preset.label}`}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition ${activeFrameId === preset.id ? 'border-muvi-accent bg-muvi-accent/15 text-white' : 'border-white/10 bg-white/5 text-muvi-muted hover:bg-white/10 hover:text-white'}`}
                  onClick={() => dispatch({ type: 'set-frame', id: preset.id, width: preset.width, height: preset.height })}
                >
                  <span className="font-bold text-white">{preset.label}</span>
                  <span className="mt-0.5 block text-[10px]">{preset.ratio} · {preset.width}×{preset.height}</span>
                </button>
              ))}
            </div>
          </div>

          {clipDraft && !hasActiveClip && (
            <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="truncate text-xs font-bold">{clipDraft.title}</p>
              <p className="mt-1 text-[11px] text-muvi-muted">Source length {formatTime(clipDraft.duration)}</p>
              <button className="btn mt-3 w-full bg-muvi-accent/80 hover:bg-muvi-accent" onClick={applyClipDraft}>Open in editor</button>
              <button className="btn mt-2 w-full" onClick={clearClipDraft}>Clear</button>
            </div>
          )}

          {hasActiveClip && (
            <div className="mb-3 rounded-lg border border-muvi-accent/30 bg-muvi-accent/10 p-3">
              <p className="text-xs font-bold">Trim on the editor</p>
              <p className="mt-1 text-[11px] text-muvi-muted">Play or jump through the film, then mark In/Out. Export records only this cut.</p>
              <p className="mt-2 text-[11px] text-muvi-muted">Source window {formatTime(activeClipIn || 0)} → {formatTime(activeClipOut || 0)} · playhead {formatTime((Number(activeClipIn) || 0) + state.currentTime)}</p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                <button type="button" className="btn px-1 text-[11px]" onClick={() => nudgePlayhead(-60)}>-1m</button>
                <button type="button" className="btn px-1 text-[11px]" onClick={() => nudgePlayhead(-10)}>-10s</button>
                <button type="button" className="btn px-1 text-[11px]" onClick={() => nudgePlayhead(10)}>+10s</button>
                <button type="button" className="btn px-1 text-[11px]" onClick={() => nudgePlayhead(60)}>+1m</button>
              </div>
              <label className="label mt-2">Jump to source time (seconds)
                <div className="flex gap-2">
                  <input
                    className="control"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 90"
                    id="clip-jump-input"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') jumpPlayheadToSource(Number(event.currentTarget.value));
                    }}
                  />
                  <button type="button" className="btn shrink-0 px-3 text-xs" onClick={() => {
                    const input = document.getElementById('clip-jump-input');
                    jumpPlayheadToSource(Number(input?.value));
                  }}>Go</button>
                </div>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button className="btn px-2 text-xs" onClick={() => setClipMark('in')}>Set In here</button>
                <button className="btn px-2 text-xs" onClick={() => setClipMark('out')}>Set Out here</button>
              </div>
              <label className="label mt-2">In (source seconds)
                <input className="control" type="number" min="0" step="0.1" value={activeClipIn ?? 0} onChange={(event) => dispatch({ type: 'clip-window', clipIn: Number(event.target.value) })} />
              </label>
              <label className="label">Out (source seconds)
                <input className="control" type="number" min="0.2" step="0.1" value={activeClipOut ?? 1} onChange={(event) => dispatch({ type: 'clip-window', clipOut: Number(event.target.value) })} />
              </label>
              <button className="btn mt-2 w-full" onClick={clearClipDraft}>Clear temp source</button>
            </div>
          )}

          {clipStatus && <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-muvi-muted">{clipStatus}</p>}
        </>
      );
    }
    if (activePanel === 'project') {
      return (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">Project</h2>
            <button className="btn px-3" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })}>Undo</button>
          </div>
          <label className="label">Title<input className="control" value={state.config.title || ''} onChange={(event) => dispatch({ type: 'project', key: 'title', value: event.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="label">Duration<input className="control" type="number" min="1" step="0.5" value={totalDuration} onChange={(event) => dispatch({ type: 'project', key: 'duration', value: event.target.value })} /></label>
            <label className="label">FPS<input className="control" type="number" min="1" step="1" value={state.config.fps || 30} onChange={(event) => dispatch({ type: 'project', key: 'fps', value: event.target.value })} /></label>
          </div>
          <label className="label">Output file<input className="control" value={state.config.outputName || ''} onChange={(event) => dispatch({ type: 'project', key: 'outputName', value: event.target.value })} /></label>
          <label className="label">Project font
            <select className="control" value={state.config.fonts?.defaultFamily || 'Manrope'} onChange={(event) => dispatch({ type: 'default-font', value: event.target.value })}>
              {fontOptions.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button className="btn bg-muvi-accent/80 hover:bg-muvi-accent" onClick={handleSave}>Save</button>
            <label className="btn text-center">Import JSON<input className="hidden" type="file" accept="application/json" onChange={(event) => event.target.files?.[0] && importJson(event.target.files[0])} /></label>
            <button className="btn" onClick={handleReset}>Reset</button>
          </div>
          <button className="btn mt-2 w-full" onClick={() => downloadJson(state.config)}>Export JSON</button>
          <p className={`mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-xs ${saveStatus === 'All changes saved' ? 'text-emerald-400' : 'text-muvi-muted'}`}>{saveStatus}</p>
          <div className="section">{renderScenesList()}</div>
        </>
      );
    }
    if (activePanel === 'scenes') {
      return (
        <>
          {renderScenesList()}
          <div className="section grid grid-cols-2 gap-2">
            <button className="btn" onClick={() => dispatch({ type: 'duplicate-scene' })}>Duplicate</button>
            <button className="btn border-muvi-danger/30 text-muvi-danger" onClick={() => dispatch({ type: 'delete-scene' })}>Delete</button>
          </div>
        </>
      );
    }
    if (activePanel === 'layers') {
      const layers = selectedScene?.layers || [];
      // CapCut-style: top of list = front (drawn last)
      const rows = layers.map((layer, index) => ({ layer, index })).reverse();
      return (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Layers</h2>
            <span className="text-xs text-muvi-muted">{selectedScene?.name}</span>
          </div>
          <p className="mb-2 text-[11px] text-muvi-muted">Drag to reorder · top = front</p>
          {layers.length === 0 && <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-muvi-muted">No layers yet. Add shapes from Elements, or text/media from those panels.</p>}
          <div className="grid gap-1">
            {rows.map(({ layer, index }) => {
              const selected = state.selectedTarget === 'layer' && index === state.selectedLayerIndex;
              return (
                <div
                  key={layer.id || index}
                  draggable={!layer.locked}
                  onDragStart={(event) => beginLayerReorder(index, event)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    completeLayerReorder(index);
                  }}
                  onDragEnd={() => { layerDragRef.current = null; setTimelineDropIndex(null); }}
                  className={`flex cursor-grab items-center gap-1 rounded-lg border px-2 py-1.5 active:cursor-grabbing ${selected ? 'border-muvi-accent bg-muvi-accent/15' : 'border-white/[0.08] bg-white/[0.04]'} ${layer.locked ? 'opacity-60' : ''}`}
                >
                  <span className="text-muvi-muted" title="Drag to reorder"><Icon name="grip" className="h-3.5 w-3.5" /></span>
                  <button className="text-muvi-muted hover:text-white" title={layer.hidden ? 'Show layer' : 'Hide layer'} onClick={() => dispatch({ type: 'toggle-layer-flag', layerIndex: index, key: 'hidden' })}><Icon name={layer.hidden ? 'eyeOff' : 'eye'} className="h-4 w-4" /></button>
                  <button className="text-muvi-muted hover:text-white" title={layer.locked ? 'Unlock layer' : 'Lock layer'} onClick={() => dispatch({ type: 'toggle-layer-flag', layerIndex: index, key: 'locked' })}><Icon name={layer.locked ? 'lock' : 'unlock'} className="h-4 w-4" /></button>
                  <button className="min-w-0 flex-1 truncate text-left text-xs font-semibold" onClick={() => dispatch({ type: 'select-layer', layerIndex: index })}>{layerDisplayName(layer)}</button>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-muvi-muted">{layer.type === 'shape' ? layer.shapeKind : layer.type}</span>
                </div>
              );
            })}
          </div>
          {state.selectedTarget === 'layer' && selectedLayer && (
            <div className="section grid grid-cols-2 gap-2">
              <button className="btn px-2 text-sm" onClick={() => dispatch({ type: 'reorder-layer', fromIndex: state.selectedLayerIndex, toIndex: layers.length - 1 })}>Bring front</button>
              <button className="btn px-2 text-sm" onClick={() => dispatch({ type: 'reorder-layer', fromIndex: state.selectedLayerIndex, toIndex: 0 })}>Send back</button>
              <button className="btn px-2 text-sm" onClick={() => dispatch({ type: 'duplicate-layer' })}>Duplicate</button>
              <button className="btn px-2 text-sm border-muvi-danger/30 text-muvi-danger" onClick={() => dispatch({ type: 'delete-layer' })}>Delete</button>
            </div>
          )}
        </>
      );
    }
    if (activePanel === 'media') {
      return (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Media</h2>
            <label className="btn px-3">Upload<input className="hidden" type="file" multiple accept="image/*,video/*,audio/*,.gif,.mp4,.mov,.m4v,.webm,.mp3,.wav,.m4a,.ogg" onChange={(event) => { handleUploadFiles(event.target.files); event.target.value = ''; }} /></label>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="btn text-center text-sm">Import image<input className="hidden" type="file" accept="image/*,.gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) importMediaLayer(file, 'image'); event.target.value = ''; }} /></label>
            <label className="btn text-center text-sm">Import video<input data-testid="media-import-video" className="hidden" type="file" accept="video/*,.mp4,.mov,.m4v,.webm" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleOptionalClipUpload(file); event.target.value = ''; }} /></label>
          </div>
          {uploads.length === 0 ? (
            <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-muvi-muted">No uploads yet. Click Upload to add images, videos, or music.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {uploads.map((item) => (
                <div key={item.path} className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
                  {item.kind === 'video' && <video src={resolveAssetPath(item.path)} muted preload="metadata" className="h-16 w-full object-cover" />}
                  {item.kind === 'image' && <img src={resolveAssetPath(item.path)} alt={item.name} className="h-16 w-full object-cover" />}
                  {item.kind === 'audio' && <div className="grid h-16 w-full place-items-center text-muvi-muted"><Icon name="audio" className="h-7 w-7" /></div>}
                  {item.kind === 'audio' ? (
                    <button className="w-full bg-white/10 px-1 py-1 text-[11px] font-bold transition hover:bg-muvi-accent/40" onClick={() => dispatch({ type: 'set-audio', audio: { source: item.path, name: item.name, volume: 0.9 } })}>Use as music</button>
                  ) : (
                    <div className="grid grid-cols-2">
                      <button className="bg-white/10 px-1 py-1 text-[11px] font-bold transition hover:bg-muvi-accent/40" title="Add to selected scene as a layer" onClick={() => addUploadToScene(item)}>+ Scene</button>
                      <button className="bg-white/5 px-1 py-1 text-[11px] font-bold transition hover:bg-muvi-accent/40" title="Use as the selected scene's background" onClick={() => setUploadAsBackground(item)}>BG</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {uploadStatus && <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-muvi-muted">{uploadStatus}</p>}
        </>
      );
    }
    if (activePanel === 'text') {
      return (
        <>
          <h2 className="mb-3 text-sm font-bold">Text</h2>
          <div className="grid gap-2">
            {TEXT_PRESETS.map((preset) => (
              <button key={preset.id} className="btn text-left" onClick={() => dispatch({ type: 'add-layer', layerType: 'text', preset: preset.preset })}>
                <span className="block text-sm font-bold">{preset.label}</span>
                <span className="block text-xs text-muvi-muted">{preset.preset.fontSize}px {preset.preset.weight}</span>
              </button>
            ))}
          </div>
        </>
      );
    }
    if (activePanel === 'elements') {
      return (
        <>
          <h2 className="mb-1 text-sm font-bold">Elements</h2>
          <p className="mb-3 text-[11px] text-muvi-muted">Tap a shape, then stretch or rotate it on the canvas.</p>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muvi-muted">Shapes</p>
          <div className="grid grid-cols-3 gap-2">
            {SHAPE_LIBRARY.map((shape) => (
              <button
                key={shape.id}
                className="group flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-3 transition hover:border-muvi-accent/50 hover:bg-muvi-accent/10"
                title={shape.label}
                onClick={() => dispatch({ type: 'add-layer', layerType: 'shape', shapeId: shape.id, shapeKind: shape.shapeKind })}
              >
                <span className="text-muvi-accent transition group-hover:scale-110"><ShapeThumb kind={shape.id === 'round-rect' ? 'round-rect' : shape.shapeKind} /></span>
                <span className="text-[11px] font-semibold text-white/90">{shape.label}</span>
              </button>
            ))}
          </div>
          <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muvi-muted">Extras</p>
          <div className="grid gap-2">
            {ELEMENT_EXTRAS.map((item) => (
              <button key={item.id} className="btn text-left" onClick={() => dispatch({ type: 'add-layer', layerType: item.layerType })}>
                <span className="block text-sm font-bold">{item.label}</span>
                <span className="block text-xs text-muvi-muted">{item.hint}</span>
              </button>
            ))}
          </div>
        </>
      );
    }
    if (activePanel === 'audio') {
      return (
        <>
          <h2 className="mb-3 text-sm font-bold">Audio</h2>
          {audioTrack?.source ? (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <Icon name="audio" className="h-5 w-5 text-muvi-accent" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{audioTrack.name || audioTrack.source.split('/').pop()}</span>
              </div>
              <label className="label mt-3">Volume ({Math.round((audioTrack.volume ?? 1) * 100)}%)
                <input className="accent-[#ff5c00]" type="range" min="0" max="1" step="0.05" value={audioTrack.volume ?? 1} onChange={(event) => dispatch({ type: 'set-audio', audio: { volume: Number(event.target.value) } })} />
              </label>
              <button className="btn mt-2 w-full border-muvi-danger/30 text-muvi-danger" onClick={() => dispatch({ type: 'set-audio', audio: null })}>Remove music</button>
            </>
          ) : (
            <label className="btn block text-center">Import music<input className="hidden" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" onChange={(event) => { const file = event.target.files?.[0]; if (file) importAudio(file); event.target.value = ''; }} /></label>
          )}
          <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-muvi-muted">The music plays during preview and is mixed into the exported video, looping to fill the full duration.</p>
        </>
      );
    }
    if (activePanel === 'settings') {
      const theme = state.config.theme || {};
      return (
        <>
          <h2 className="mb-3 text-sm font-bold">Theme</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="label">Background<input className="control h-[42px]" type="color" value={theme.backgroundColor || '#0B0D0E'} onChange={(event) => dispatch({ type: 'theme', key: 'backgroundColor', value: event.target.value })} /></label>
            <label className="label">Accent<input className="control h-[42px]" type="color" value={theme.accent || '#FF5C00'} onChange={(event) => dispatch({ type: 'theme', key: 'accent', value: event.target.value })} /></label>
            <label className="label">Text<input className="control h-[42px]" type="color" value={theme.text || '#FFFFFF'} onChange={(event) => dispatch({ type: 'theme', key: 'text', value: event.target.value })} /></label>
            <label className="label">Muted<input className="control h-[42px]" type="color" value={theme.muted || '#FFD3B8'} onChange={(event) => dispatch({ type: 'theme', key: 'muted', value: event.target.value })} /></label>
          </div>
          <label className="label">Overlay top<input className="control" value={theme.overlayTop || ''} onChange={(event) => dispatch({ type: 'theme', key: 'overlayTop', value: event.target.value })} /></label>
          <label className="label">Overlay middle<input className="control" value={theme.overlayMid || ''} onChange={(event) => dispatch({ type: 'theme', key: 'overlayMid', value: event.target.value })} /></label>
          <label className="label">Overlay bottom<input className="control" value={theme.overlayBottom || ''} onChange={(event) => dispatch({ type: 'theme', key: 'overlayBottom', value: event.target.value })} /></label>
          <p className="mt-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-muvi-muted">Overlays are CSS colors (e.g. rgba(11,13,14,0.7)) drawn as a gradient over every background.</p>
        </>
      );
    }
    return null;
  }

  function renderInspectorTab() {
    const isLayer = state.selectedTarget === 'layer' && Boolean(selectedLayer);

    if (isCanvasEmpty && !isLayer) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-white/50 space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF5C00]/10 text-[#FF5C00]">
            <Icon name="media" className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">No Video on Canvas</h4>
            <p className="mt-1 text-xs text-white/40">Upload or import a video to scale, crop, reposition, and transform it.</p>
          </div>
          <label className="cursor-pointer rounded-xl bg-[#FF5C00] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#FF7A30] shadow-[0_0_20px_rgba(255,92,0,0.35)]">
            Upload Video
            <input className="hidden" type="file" accept="video/*,.mp4,.mov,.webm" onChange={(e) => { handleOptionalClipUpload(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      );
    }

    if (inspectorSubTab === 'background') {
      return (
        <section className="space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Background Settings</h3>
            <p className="mt-0.5 text-xs text-white/50">Configure canvas background video, image, or backdrop color.</p>
          </div>

          <div>
            <label className="label text-xs font-semibold text-white/80">Video Preset</label>
            <select
              className="control mt-1 text-xs"
              value={AVAILABLE_VIDEOS.some((v) => v.value === (bg.image || '')) ? (bg.image || '') : '__custom__'}
              onChange={(event) => {
                if (event.target.value !== '__custom__') {
                  imageCacheRef.current.clear();
                  dispatch({ type: 'background', key: 'image', value: event.target.value });
                }
              }}
            >
              {AVAILABLE_VIDEOS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              {!AVAILABLE_VIDEOS.some((v) => v.value === (bg.image || '')) && <option value="__custom__">Custom ({(bg.image || '').substring(0, 30)}...)</option>}
            </select>
          </div>

          <div>
            <label className="label text-xs font-semibold text-white/80">Background Color</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                className="control h-8 w-12 cursor-pointer p-0.5 rounded-lg border border-white/10"
                type="color"
                value={bg.color || state.config.theme?.backgroundColor || '#0B0D0E'}
                onChange={(event) => dispatch({ type: 'background', key: 'color', value: event.target.value })}
              />
              <div className="flex flex-wrap gap-1.5">
                {BACKGROUND_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    title={swatch}
                    className={`h-6 w-6 rounded-md border transition hover:scale-110 ${(bg.color || '').toLowerCase() === swatch.toLowerCase() ? 'border-[#FF5C00] ring-1 ring-[#FF5C00]' : 'border-white/20'}`}
                    style={{ background: swatch }}
                    onClick={() => dispatch({ type: 'background', key: 'color', value: swatch })}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label text-xs font-semibold text-white/80">Media File</label>
            <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 py-2.5 text-xs font-bold text-[#FF5C00] hover:bg-white/10">
              <Icon name="media" className="h-4 w-4" />
              <span>Replace Media File</span>
              <input className="hidden" type="file" accept="image/*,video/*,.gif,.mp4,.mov,.m4v,.webm" onChange={(event) => { const file = event.target.files?.[0]; if (file) importAsset(file, (value) => ({ type: 'background', key: 'image', value })); event.target.value = ''; }} />
            </label>
          </div>
        </section>
      );
    }

    if (inspectorSubTab === 'audio') {
      const volumeVal = bg?.volume != null ? Math.round(Number(bg.volume) * 100) : 100;
      const isMuted = Boolean(bg?.muted);
      return (
        <section className="space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Audio Controls</h3>
            <p className="mt-0.5 text-xs text-white/50">Manage playback volume and video soundtrack levels.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white/80">Media Volume</span>
              <span className="font-mono text-[#FF5C00] font-bold">{isMuted ? 'Muted (0%)' : `${volumeVal}%`}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volumeVal}
              onChange={(e) => {
                const vol = Number(e.target.value) / 100;
                dispatch({ type: 'background', key: 'volume', value: vol });
                if (isMuted && vol > 0) dispatch({ type: 'background', key: 'muted', value: false });
              }}
              className="w-full accent-[#FF5C00]"
            />
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'background', key: 'muted', value: !isMuted })}
              className={`btn w-full text-xs font-bold transition ${isMuted ? 'border-[#FF5C00] text-[#FF5C00] bg-[#FF5C00]/10' : ''}`}
            >
              {isMuted ? '🔈 Unmute Audio' : '🔇 Mute Video Audio'}
            </button>
          </div>
        </section>
      );
    }

    if (inspectorSubTab === 'speed') {
      return (
        <section className="space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Playback Speed</h3>
            <p className="mt-0.5 text-xs text-white/50">Speed up or slow down the current video segment.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['0.5x', '0.75x', '1.0x', '1.25x', '1.5x', '2.0x'].map((spd) => (
              <button
                key={spd}
                type="button"
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${spd === '1.0x' ? 'border-[#FF5C00] bg-[#FF5C00]/20 text-[#FF5C00]' : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'}`}
              >
                {spd}
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (inspectorSubTab === 'animation') {
      const layerAnimation = selectedLayer?.animation || bg?.animation || {};
      return (
        <section className="space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Entrance Animation</h3>
            <p className="mt-0.5 text-xs text-white/50">Add dynamic entrance motion when media appears.</p>
          </div>
          <div>
            <label className="label text-xs font-semibold text-white/80">Animation Style</label>
            <select
              className="control mt-1 text-xs"
              value={layerAnimation.type || 'none'}
              onChange={(event) => {
                if (isLayer) dispatch({ type: 'layer-animation', key: 'type', value: event.target.value });
                else dispatch({ type: 'background-animation', key: 'type', value: event.target.value });
              }}
            >
              <option value="none">None (Immediate)</option>
              <option value="fadeIn">Fade In</option>
              <option value="slideUp">Slide Up</option>
              <option value="slideDown">Slide Down</option>
              <option value="zoomIn">Zoom In</option>
              <option value="kenBurns">Slow Motion Pan & Zoom</option>
            </select>
          </div>
          <div>
            <label className="label text-xs font-semibold text-white/80">Duration (seconds)</label>
            <input
              className="control mt-1 text-xs"
              type="number"
              min="0.1"
              max="3"
              step="0.1"
              value={layerAnimation.duration ?? 0.5}
              onChange={(event) => {
                if (isLayer) dispatch({ type: 'layer-animation', key: 'duration', value: event.target.value });
              }}
            />
          </div>
        </section>
      );
    }

    // Default: 'basic' (Transform & Layout)
    return (
      <section className="space-y-4">
        {/* Scale Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white/80">Scale</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#FF5C00]">
                {Math.round((isLayer ? (selectedLayerFields.scale || 1) : (bg.zoom || 1)) * 100)}%
              </span>
              <button
                type="button"
                title="Reset Scale (100%)"
                onClick={() => {
                  if (isLayer) dispatch({ type: 'layer', key: 'scale', value: 1 });
                  else dispatch({ type: 'background', key: 'zoom', value: 1 });
                }}
                className="text-white/40 hover:text-[#FF5C00] font-bold"
              >
                ◇
              </button>
            </div>
          </div>
          <input
            type="range"
            min="0.2"
            max="3.0"
            step="0.01"
            value={isLayer ? (selectedLayerFields.scale || 1) : (bg.zoom || 1)}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (isLayer) dispatch({ type: 'layer', key: 'scale', value: val });
              else dispatch({ type: 'background', key: 'zoom', value: val });
            }}
            className="w-full accent-[#FF5C00]"
          />
        </div>

        {/* Position X & Y */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white/80">Position</span>
            <button
              type="button"
              title="Reset Position (0, 0)"
              onClick={() => {
                if (isLayer) {
                  dispatch({ type: 'layer', key: 'x', value: 0 });
                  dispatch({ type: 'layer', key: 'y', value: 0 });
                } else {
                  dispatch({ type: 'background', key: 'x', value: 0 });
                  dispatch({ type: 'background', key: 'y', value: 0 });
                }
              }}
              className="text-white/40 hover:text-[#FF5C00] font-bold"
            >
              ◇
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">
              <span className="font-mono text-white/40">X</span>
              <input
                type="number"
                value={isLayer ? (selectedLayerFields.x ?? 0) : (bg.x ?? 0)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (isLayer) dispatch({ type: 'layer', key: 'x', value: val });
                  else dispatch({ type: 'background', key: 'x', value: val });
                }}
                className="w-full bg-transparent text-right font-mono text-xs outline-none"
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">
              <span className="font-mono text-white/40">Y</span>
              <input
                type="number"
                value={isLayer ? (selectedLayerFields.y ?? 0) : (bg.y ?? 0)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (isLayer) dispatch({ type: 'layer', key: 'y', value: val });
                  else dispatch({ type: 'background', key: 'y', value: val });
                }}
                className="w-full bg-transparent text-right font-mono text-xs outline-none"
              />
            </label>
          </div>
        </div>

        {/* Rotate & Flip */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white/80">Rotate & Flip</span>
            <span className="font-mono text-xs font-bold text-white/60">
              {isLayer ? (selectedLayerFields.rotation || 0) : 0}°
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isLayer) {
                  const cur = Number(selectedLayerFields.rotation) || 0;
                  dispatch({ type: 'layer', key: 'rotation', value: (cur + 90) % 360 });
                }
              }}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              ⟳ +90° Rotate
            </button>
            <button
              type="button"
              className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${selectedLayer?.flipX ? 'border-[#FF5C00] bg-[#FF5C00]/20 text-[#FF5C00]' : 'border-white/10 bg-white/5 text-white/80'}`}
              onClick={() => {
                if (isLayer) dispatch({ type: 'layer', key: 'flipX', value: !selectedLayer.flipX });
              }}
            >
              ↔ Flip H
            </button>
            <button
              type="button"
              className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${selectedLayer?.flipY ? 'border-[#FF5C00] bg-[#FF5C00]/20 text-[#FF5C00]' : 'border-white/10 bg-white/5 text-white/80'}`}
              onClick={() => {
                if (isLayer) dispatch({ type: 'layer', key: 'flipY', value: !selectedLayer.flipY });
              }}
            >
              ↕ Flip V
            </button>
          </div>
        </div>

        {/* Framing Presets */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white hover:bg-white/10"
            onClick={() => dispatch({ type: 'fit-bg', mode: 'fit' })}
          >
            Fit Frame
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#FF5C00]/20 border border-[#FF5C00]/40 py-2.5 text-xs font-bold text-[#FF5C00] hover:bg-[#FF5C00]/30"
            onClick={() => dispatch({ type: 'fit-bg', mode: 'fill' })}
          >
            Fill Screen
          </button>
        </div>

        {/* Text Layer Settings if applicable */}
        {isLayer && ['text', 'pill'].includes(selectedLayer.type) && (
          <div className="space-y-3 border-t border-white/10 pt-3">
            <div>
              <label className="label text-xs font-semibold text-white/80">Text Content</label>
              <textarea
                className="control mt-1 min-h-[72px] text-xs"
                value={selectedLayerFields.text || ''}
                onChange={(event) => dispatch({ type: 'layer', key: 'text', value: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs font-semibold text-white/80">Font Size</label>
                <input
                  className="control mt-1 text-xs"
                  type="number"
                  value={selectedLayerFields.fontSize ?? 32}
                  onChange={(event) => dispatch({ type: 'layer', key: 'fontSize', value: event.target.value })}
                />
              </div>
              <div>
                <label className="label text-xs font-semibold text-white/80">Color</label>
                <input
                  className="control mt-1 h-9 w-full cursor-pointer p-0.5"
                  type="color"
                  value={selectedLayerFields.color || '#ffffff'}
                  onChange={(event) => dispatch({ type: 'layer', key: 'color', value: event.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  function renderTimeline() {
    if (!selectedScene || state.config.scenes.length === 0) {
      return (
        <div className="flex h-[200px] shrink-0 flex-col items-center justify-center border-t border-white/[0.08] bg-[#121417] text-white/40 p-6 text-center">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] px-10 py-6 max-w-lg w-full transition hover:border-[#FF5C00]/40 hover:bg-white/[0.04]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF5C00]/10 text-[#FF5C00]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                <line x1="7" y1="2" x2="7" y2="22"></line>
                <line x1="17" y1="2" x2="17" y2="22"></line>
                <line x1="2" y1="12" x2="22" y2="12"></line>
              </svg>
            </div>
            <p className="mt-2 text-xs font-bold text-white/80">🎬 Drag and drop media here</p>
            <p className="text-[11px] text-white/35">Or click (+) in the canvas to upload your video</p>
            <input className="hidden" type="file" accept="video/*,.mp4,.mov,.m4v,.webm" onChange={(e) => { handleOptionalClipUpload(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      );
    }

    const layers = selectedScene.layers || [];
    const trackRows = layers.map((layer, index) => ({ layer, index })).reverse();
    // The ruler and video rail represent the complete edit. Limit tick density
    // so a long source video does not turn the ruler into an unreadable blur.
    const playheadFraction = state.currentTime / timelineViewportDuration;
    const tickCount = Math.min(30, Math.max(1, Math.ceil(timelineViewportDuration / 5)));
    const bgSource = bg?.image ?? state.config.assets?.background;
    const isVideoBg = Boolean(bg?.mediaKind === 'video' || isVideoPath(bgSource));
    const bgLabel = !bgSource
      ? `Solid · ${bg?.color || state.config.theme?.backgroundColor || '#0B0D0E'}`
      : isVideoBg
        ? (clipDraft?.title || selectedScene?.name || 'Video Clip')
        : String(bgSource).startsWith('blob:')
          ? 'Image Layer'
          : String(bgSource).split('/').pop();

    return (
      <div className="flex h-[260px] shrink-0 flex-col border-t border-white/[0.08] bg-[#121417]">
        {/* CapCut Timeline Action Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-1.5 bg-[#14161a]">
          {/* Left Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white"
              title="Split Video at Playhead"
              onClick={handleSplitScene}
            >
              <span>✂️ Split</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white"
              title="Duplicate Segment"
              onClick={handleDuplicate}
            >
              <span>📋 Duplicate</span>
            </button>
            <button
              type="button"
              data-testid="timeline-delete"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-400 hover:bg-red-500/20"
              title="Delete Selected"
              onClick={handleDelete}
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
            <span className="mx-1 h-3.5 w-px bg-white/15" />
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => {
                if (state.selectedTarget === 'layer') {
                  const rot = Number(selectedLayer?.rotation) || 0;
                  dispatch({ type: 'layer', key: 'rotation', value: (rot + 90) % 360 });
                }
              }}
            >
              <span>⟳ Rotate</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => dispatch({ type: 'fit-bg', mode: 'fill' })}
            >
              <span>📐 Fill</span>
            </button>
          </div>

          {/* Center Playhead Counter */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="timeline-play"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF5C00] text-black transition hover:scale-105"
              onClick={togglePlay}
              title="Play / Pause (Space)"
            >
              <Icon name={state.isPlaying ? 'pause' : 'play'} className="h-4 w-4 fill-current" />
            </button>
            <span className="font-mono text-xs font-bold text-white">
              {formatSecondsToTimecode(state.currentTime)}
            </span>
            <span className="text-xs text-white/30">/</span>
            <span className="font-mono text-xs font-medium text-white/50">
              {formatSecondsToTimecode(totalDuration)}
            </span>
          </div>

          {/* Right Zoom & Fit Controls */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-white/40">Zoom</span>
            <input
              className="w-20 accent-[#FF5C00]"
              type="range"
              min="1"
              max="4"
              step="0.25"
              value={timelineZoom}
              onChange={(event) => setTimelineZoom(Number(event.target.value))}
            />
          </div>
        </div>

        {/* Tracks Area */}
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-2 pt-1">
          <div style={{ width: `${timelineZoom * 100}%`, minWidth: '100%' }}>
            {/* Timeline Ruler */}
            <div className="flex">
              <div style={{ width: TRACK_LABEL_WIDTH }} className="flex shrink-0 items-end px-2 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">Tracks</span>
              </div>
              <div
                className="relative h-6 flex-1 cursor-pointer select-none rounded-t-md bg-black/20"
                onPointerDown={handleRulerSeek}
                onPointerMove={handleRulerScrub}
              >
                {Array.from({ length: tickCount + 1 }, (_, tick) => {
                  const second = Math.round((tick / tickCount) * timelineViewportDuration);
                  return (
                  <span
                    key={second}
                    className="absolute top-1 border-l border-white/15 pl-1 font-mono text-[9px] text-white/40"
                    style={{ left: `${(tick / tickCount) * 100}%` }}
                  >
                    {formatSecondsToTimecode(second)}
                  </span>
                  );
                })}
              </div>
            </div>

            <div className="relative rounded-b-md bg-black/15">
              {/* Layer Tracks */}
              {trackRows.map(({ layer, index }) => {
                const offset = Math.max(0, Number(layer.offset) || 0);
                const windowDuration = layer.duration != null ? Number(layer.duration) : sceneDur - offset;
                const color = TRACK_COLORS[layer.type] || '#64748b';
                const isSelected = state.selectedTarget === 'layer' && index === state.selectedLayerIndex;
                const showDrop = timelineDropIndex === index;
                return (
                  <div
                    key={layer.id || index}
                    className={`track-row h-8 border-b border-white/[0.04] ${showDrop ? 'track-row-drop' : ''} ${isSelected ? 'bg-[#FF5C00]/[0.08]' : 'hover:bg-white/[0.02]'}`}
                    onDragOver={(event) => {
                      if (layer.locked) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setTimelineDropIndex(index);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      completeLayerReorder(index);
                    }}
                  >
                    <div
                      style={{ width: TRACK_LABEL_WIDTH }}
                      className={`flex shrink-0 items-center gap-1 border-r border-white/[0.05] px-1.5 ${layer.locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
                      draggable={!layer.locked}
                      onDragStart={(event) => beginLayerReorder(index, event)}
                      onDragEnd={() => { layerDragRef.current = null; setTimelineDropIndex(null); }}
                      title="Drag to reorder layers"
                    >
                      <Icon name="grip" className="h-3.5 w-3.5 shrink-0 text-white/30" />
                      <button type="button" className="text-white/40 hover:text-white" title={layer.hidden ? 'Show' : 'Hide'} onClick={() => dispatch({ type: 'toggle-layer-flag', layerIndex: index, key: 'hidden' })}><Icon name={layer.hidden ? 'eyeOff' : 'eye'} className="h-3.5 w-3.5" /></button>
                      <button type="button" className="text-white/40 hover:text-white" title={layer.locked ? 'Unlock' : 'Lock'} onClick={() => dispatch({ type: 'toggle-layer-flag', layerIndex: index, key: 'locked' })}><Icon name={layer.locked ? 'lock' : 'unlock'} className="h-3.5 w-3.5" /></button>
                      <button
                        type="button"
                        className={`min-w-0 flex-1 truncate text-left text-[11px] font-semibold ${isSelected ? 'text-[#FF5C00]' : 'text-white/80'}`}
                        onClick={() => dispatch({ type: 'select-layer', layerIndex: index })}
                      >
                        {layerDisplayName(layer)}
                      </button>
                    </div>
                    <div className="relative h-8 flex-1" data-track>
                      <div
                        className={`clip-bar ${layer.hidden ? 'opacity-35' : ''} ${isSelected ? 'ring-2 ring-[#FF5C00]' : 'ring-1 ring-black/20'}`}
                        style={{
                          left: `${(offset / sceneDur) * 100}%`,
                          width: `${Math.max(2.5, (windowDuration / sceneDur) * 100)}%`,
                          background: `linear-gradient(180deg, ${color}, ${color}cc)`,
                        }}
                        onPointerDown={(event) => handleBarPointerDown(event, index, 'move')}
                        onPointerMove={handleBarPointerMove}
                        onPointerUp={handleBarPointerUp}
                      >
                        <span className="truncate text-[10px] font-bold text-black/75">{layerDisplayName(layer)}</span>
                        <div
                          className="absolute right-0 top-0 h-full w-2.5 cursor-ew-resize bg-black/20 hover:bg-black/35"
                          onPointerDown={(event) => handleBarPointerDown(event, index, 'resize')}
                          onPointerMove={handleBarPointerMove}
                          onPointerUp={handleBarPointerUp}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Main Video Track */}
              <div className={`track-row h-12 ${state.selectedTarget === 'background' ? 'bg-[#FF5C00]/[0.08]' : ''}`}>
                <div style={{ width: TRACK_LABEL_WIDTH }} className="flex shrink-0 items-center gap-2 border-r border-white/[0.05] px-2">
                  <span className="grid h-6 w-6 place-items-center rounded bg-[#FF5C00]/20 text-xs text-[#FF8A45]">▶</span>
                  <button
                    type="button"
                    className={`min-w-0 flex-1 truncate text-left text-[11px] font-bold ${state.selectedTarget === 'background' ? 'text-[#FF5C00]' : 'text-white/90'}`}
                    onClick={() => dispatch({ type: 'select-background' })}
                  >
                    Video · timeline
                  </button>
                </div>
                <div className="relative h-12 flex-1" data-video-track>
                  {state.config.scenes.map((scene, index) => {
                    const duration = Math.max(0.2, sceneDuration(scene));
                    const source = scene.background?.image;
                    const active = index === state.selectedSceneIndex;
                    return (
                      <button
                        key={scene.id || index}
                        data-testid={`timeline-video-clip-${index}`}
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          sceneDragRef.current = index;
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const fromIndex = sceneDragRef.current;
                          sceneDragRef.current = null;
                          if (Number.isInteger(fromIndex)) dispatch({ type: 'reorder-scene', fromIndex, toIndex: index });
                        }}
                        onDragEnd={() => { sceneDragRef.current = null; }}
                        onClick={() => dispatch({ type: 'ui', patch: { selectedSceneIndex: index, selectedLayerIndex: 0, selectedTarget: 'background', isPlaying: false, currentTime: scene.start } })}
                        className={`clip-bar top-1 bottom-1 cursor-grab justify-between rounded-md px-3 text-left active:cursor-grabbing ${active ? 'ring-2 ring-[#FF5C00] shadow-lg z-10' : 'ring-1 ring-black/30 hover:brightness-110'}`}
                        style={{
                          left: `${(scene.start / timelineViewportDuration) * 100}%`,
                          width: `${Math.max(3, (duration / timelineViewportDuration) * 100)}%`,
                          background: active ? 'linear-gradient(180deg, #ea580c, #9a3412)' : 'linear-gradient(180deg, #7c2d12, #431407)',
                        }}
                        title="Click to edit · drag a clip onto another clip to reorder"
                      >
                        {scene.background?.mediaKind === 'video' && (
                          <div
                            data-testid={`trim-left-${index}`}
                            data-trim-edge="left"
                            draggable={false}
                            className={`absolute inset-y-0 left-0 z-20 w-2 cursor-ew-resize border-r-2 border-[#fff3a3] bg-[#facc15] shadow-[2px_0_8px_rgba(250,204,21,0.7)] transition-opacity ${active ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
                            title="Yellow handle: drag to crop the beginning"
                            onPointerDownCapture={(event) => handleClipTrimPointerDown(event, index, 'left')}
                            onDragStartCapture={(event) => event.preventDefault()}
                            onPointerMove={handleClipTrimPointerMove}
                          />
                        )}
                        <span className="truncate text-[10px] font-bold text-white">🎬 {scene.name || (source ? 'Video clip' : 'Scene')}</span>
                        <span className="ml-1 shrink-0 font-mono text-[9px] text-orange-100/80">{duration.toFixed(1)}s</span>
                        {scene.background?.mediaKind === 'video' && (
                          <div
                            data-testid={`trim-right-${index}`}
                            data-trim-edge="right"
                            draggable={false}
                            className={`absolute inset-y-0 right-0 z-20 w-2 cursor-ew-resize border-l-2 border-[#fff3a3] bg-[#facc15] shadow-[-2px_0_8px_rgba(250,204,21,0.7)] transition-opacity ${active ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
                            title="Yellow handle: drag to crop the end"
                            onPointerDownCapture={(event) => handleClipTrimPointerDown(event, index, 'right')}
                            onDragStartCapture={(event) => event.preventDefault()}
                            onPointerMove={handleClipTrimPointerMove}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {audioTrack?.source && (
                <div className="track-row h-9 border-t border-white/[0.05] bg-cyan-500/[0.03]">
                  <div style={{ width: TRACK_LABEL_WIDTH }} className="flex shrink-0 items-center gap-2 border-r border-white/[0.05] px-2">
                    <span className="grid h-5 w-5 place-items-center rounded bg-cyan-400/15 text-[10px] text-cyan-300">♫</span>
                    <button type="button" className="min-w-0 flex-1 truncate text-left text-[11px] font-bold text-cyan-100" onClick={() => setActivePanel('audio')}>
                      Audio · {audioTrack.name || 'Soundtrack'}
                    </button>
                  </div>
                  <div className="relative h-9 flex-1">
                    <div className="absolute inset-x-1 top-1.5 bottom-1.5 flex items-center overflow-hidden rounded bg-gradient-to-r from-cyan-500/70 via-sky-500/55 to-cyan-500/70 px-2">
                      <span className="truncate text-[10px] font-bold text-cyan-950">♫ {audioTrack.name || 'Audio track'} · {Math.round((audioTrack.volume ?? 1) * 100)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Playhead Needle */}
              {playheadFraction >= 0 && playheadFraction <= 1 && (
                <div className="pointer-events-none absolute bottom-0 top-0 z-20" style={{ left: TRACK_LABEL_WIDTH, right: 0 }}>
                  <div
                    className="pointer-events-auto absolute bottom-0 top-0 w-5 -translate-x-1/2 cursor-ew-resize"
                    style={{ left: `${playheadFraction * 100}%` }}
                    onPointerDown={(event) => {
                      const track = event.currentTarget.parentElement;
                      seekFromTimelineClientX(event.clientX, track);
                      if (event.pointerId != null) {
                        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
                      }
                    }}
                    onPointerMove={(event) => {
                      if (event.buttons !== 1) return;
                      seekFromTimelineClientX(event.clientX, event.currentTarget.parentElement);
                    }}
                  >
                    <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-[#FF5C00] shadow-[0_0_10px_rgba(255,92,0,0.9)]" />
                    <span className="absolute left-1/2 top-0 h-3.5 w-3.5 -translate-x-1/2 rounded-sm bg-[#FF5C00] shadow" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderEditToolbar() {
    if (!selectedScene || (!selectedScene.background?.image && !selectedLayer)) return null;
    return (
      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/10 bg-[#16181c]/95 px-2 py-1.5 shadow-2xl backdrop-blur">
          <label className="flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white" title="Replace Video/Media">
            <Icon name="media" className="h-3.5 w-3.5 text-cyan-400" />
            <span>Replace</span>
            <input className="hidden" type="file" accept="video/*,image/*,.mp4,.mov,.webm" onChange={(e) => { handleOptionalClipUpload(e.target.files?.[0], 'replace'); e.target.value = ''; }} />
          </label>
          <span className="h-3.5 w-px bg-white/15" />
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            title="Split Video at Playhead"
            onClick={handleSplitScene}
          >
            <span>✂️ Split</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            title="Rotate"
            onClick={() => {
              if (state.selectedTarget === 'layer') {
                const rot = Number(selectedLayer?.rotation) || 0;
                dispatch({ type: 'layer', key: 'rotation', value: (rot + 90) % 360 });
              }
            }}
          >
            <span>⟳ Rotate</span>
          </button>
          <span className="h-3.5 w-px bg-white/15" />
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20"
            title="Delete"
            onClick={handleDelete}
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    );
  }

  const handleViewportWheel = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setPreviewZoom(prev => Math.max(0.3, Math.min(3.0, Number((prev + delta).toFixed(2)))));
    }
  };

  const handlePanStart = (e) => {
    if (isPanMode || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    }
  };

  const handlePanMove = (e) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  const isCanvasEmpty = !selectedScene || (!selectedScene.background?.image && (selectedScene.layers || []).length === 0);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-muvi-bg text-[13px]">
      {/* Global Video Import / Uploading Progress Modal */}
      {clipBusy && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-white/10 bg-[#16181c] p-6 text-center shadow-2xl">
            {/* Animated Glowing Orange Spinner */}
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF5C00] opacity-25"></span>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FF5C00] text-black shadow-[0_0_30px_rgba(255,92,0,0.6)]">
                <svg className="h-7 w-7 animate-spin text-black" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-85" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              </div>
            </div>

            <h3 className="mt-4 text-base font-bold text-white">
              {clipProgress?.stage === 'error' ? 'Import Failed' : (clipProgress?.stage ? `Importing Video (${Math.round(clipProgress.percent || 50)}%)` : 'Importing Video…')}
            </h3>
            <p className="mt-1 text-xs text-white/60">
              {clipProgress?.message || 'Processing video file and preparing canvas...'}
            </p>

            {/* Live Progress Bar */}
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#FF5C00] transition-all duration-300 shadow-[0_0_10px_rgba(255,92,0,0.8)]"
                style={{ width: `${Math.max(5, Math.min(100, clipProgress?.percent || 45))}%` }}
              />
            </div>

            {clipProgress?.stage === 'error' && (
              <button
                type="button"
                onClick={() => { setClipBusy(false); setClipProgress(null); }}
                className="mt-4 rounded-xl bg-white/10 px-5 py-2 text-xs font-bold text-white hover:bg-white/20"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] bg-muvi-panel/90 px-2 sm:px-3 py-1.5 sm:py-2 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img src="/assets/images/muvidb-logo.svg" alt="MuviDB" className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-white/5 p-1 shrink-0" />
          <div className="min-w-0">
            <input
              className="w-full max-w-[130px] sm:max-w-[240px] truncate border-0 bg-transparent text-xs sm:text-sm font-black outline-none placeholder:text-white/30 focus:text-[#FF5C00]"
              value={state.config.title || ''}
              placeholder="Untitled project"
              onChange={(event) => dispatch({ type: 'project', key: 'title', value: event.target.value })}
            />
            <p className="hidden sm:block text-[10px] text-muvi-muted">MuviDB Studio · Premium Video Editor</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            className="btn-ghost px-2 sm:px-2.5 py-1 text-xs font-bold text-white/70 hover:text-white"
            title="Start a new project (clears current canvas session)"
            onClick={handleNewProject}
          >
            + New
          </button>
          <span className="mx-0.5 sm:mx-1 h-4 sm:h-5 w-px bg-white/10" />
          <button className="btn-ghost p-1 sm:p-1.5" title="Undo (Ctrl+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })}><Icon name="undo" className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
          <button className="btn-ghost p-1 sm:p-1.5" title="Redo (Ctrl+Shift+Z)" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })}><Icon name="redo" className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
          <span className="mx-0.5 sm:mx-1 h-4 sm:h-5 w-px bg-white/10" />
          
          {/* Sidebars Toggle Buttons */}
          <button
            type="button"
            className={`btn-ghost px-2 sm:px-2.5 py-1 text-xs font-bold ${leftPanelOpen ? 'bg-white/10 text-white' : 'text-muvi-muted'}`}
            title={leftPanelOpen ? 'Collapse Tools Panel' : 'Expand Tools Panel'}
            onClick={() => setLeftPanelOpen(prev => !prev)}
          >
            Tools {leftPanelOpen ? '◀' : '▶'}
          </button>
          <button
            type="button"
            className={`btn-ghost px-2 sm:px-2.5 py-1 text-xs font-bold ${rightPanelOpen ? 'bg-white/10 text-white' : 'text-muvi-muted'}`}
            title={rightPanelOpen ? 'Collapse Inspector' : 'Expand Inspector'}
            onClick={() => setRightPanelOpen(prev => !prev)}
          >
            Inspector {rightPanelOpen ? '▶' : '◀'}
          </button>

          <span className="mx-0.5 sm:mx-1 h-4 sm:h-5 w-px bg-white/10" />
          <button className="rounded-xl bg-[#FF5C00] px-3 sm:px-5 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-black shadow-[0_0_20px_rgba(255,92,0,0.4)] transition hover:bg-[#FF7A30] disabled:opacity-50" disabled={isRendering} onClick={handleExportVideo}>
            {isRendering ? 'Exporting…' : 'Export'}
          </button>
          <button className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/20" onClick={() => setSocialOpen(true)}>
            Post / Schedule
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 relative overflow-hidden">
        {/* Navigation Rail (Desktop) */}
        <nav className="hidden md:flex w-[64px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-white/[0.08] bg-muvi-panel py-2 z-10">
          {RAIL_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`studio-rail-btn ${activePanel === item.id && leftPanelOpen ? 'bg-[#FF5C00]/20 text-[#FF5C00]' : 'text-muvi-muted hover:bg-white/[0.06] hover:text-white'}`}
              onClick={() => {
                setActivePanel(item.id);
                if (!leftPanelOpen) setLeftPanelOpen(true);
              }}
            >
              <Icon name={item.id} className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Collapsible Left Panel (Responsive Drawer) */}
        {leftPanelOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setLeftPanelOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px] overflow-y-auto border-r border-white/10 bg-[#14161a] p-3 shadow-2xl transition-all md:relative md:inset-auto md:z-auto md:w-[290px] md:shrink-0 md:bg-muvi-panel/70 md:shadow-none">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 md:hidden">
                <span className="text-xs font-bold text-white/90">Tools Menu</span>
                <button
                  type="button"
                  onClick={() => setLeftPanelOpen(false)}
                  className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-2 mb-2 border-b border-white/10 md:hidden">
                {RAIL_ITEMS.map((item) => (
                  <button
                    key={`mob-${item.id}`}
                    type="button"
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition shrink-0 ${
                      activePanel === item.id ? 'bg-[#FF5C00]/20 text-[#FF5C00]' : 'text-white/60 hover:bg-white/5'
                    }`}
                    onClick={() => setActivePanel(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {renderLeftPanel()}
            </aside>
          </>
        )}

        {/* Main Flexible Canvas Section */}
        <section className="flex min-w-0 flex-1 flex-col bg-[#0c0d10] relative overflow-hidden">
          {/* Canvas Viewport Area with Zoom & Pan */}
          <div
            className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-4 select-none ${
              isPanMode || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
            onWheel={handleViewportWheel}
            onMouseDown={handlePanStart}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop}
            onPaste={handleCanvasPaste}
            tabIndex={0}
          >
            {/* Floating Ratio Card (Top Left) */}
            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-30">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRatioMenuOpen(prev => !prev)}
                  className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-white/10 bg-[#16181c]/90 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white shadow-2xl backdrop-blur transition hover:bg-white/15"
                >
                  <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#FF5C00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3"></rect>
                  </svg>
                  <span>Ratio</span>
                  <span className="text-[10px] text-white/50">{FRAME_PRESETS.find(p => p.id === activeFrameId)?.label || '9:16'}</span>
                </button>
                {ratioMenuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-[#16181c]/95 p-1.5 shadow-2xl backdrop-blur z-40">
                    {FRAME_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          dispatch({ type: 'set-frame', id: preset.id, width: preset.width, height: preset.height });
                          setRatioMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                          activeFrameId === preset.id ? 'bg-[#FF5C00]/20 text-[#FF5C00]' : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span>{preset.label}</span>
                        <span className="font-mono text-[10px] text-white/40">{preset.ratio}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Floating Viewport Toolbar (Top Right) */}
            <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-30 flex items-center gap-0.5 sm:gap-1 rounded-xl border border-white/10 bg-[#16181c]/90 px-1.5 sm:px-2 py-1 shadow-2xl backdrop-blur">
              <button
                type="button"
                onClick={() => setPreviewZoom(prev => Math.max(0.3, Number((prev - 0.1).toFixed(2))))}
                className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white text-xs"
                title="Zoom Out (-)"
              >
                -
              </button>
              <span className="min-w-[36px] sm:min-w-[44px] text-center font-mono text-[10px] sm:text-[11px] font-bold text-white">
                {Math.round(previewZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setPreviewZoom(prev => Math.min(3.0, Number((prev + 0.1).toFixed(2))))}
                className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white text-xs"
                title="Zoom In (+)"
              >
                +
              </button>
              <span className="mx-0.5 sm:mx-1 h-3.5 w-px bg-white/15" />
              <button
                type="button"
                onClick={() => { setPreviewZoom(0.85); setPanOffset({ x: 0, y: 0 }); }}
                className="rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
                title="Fit Canvas"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() => { setPreviewZoom(1.0); setPanOffset({ x: 0, y: 0 }); }}
                className="hidden sm:inline-block rounded px-1.5 py-0.5 text-[10px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
                title="Reset Zoom (100%)"
              >
                100%
              </button>
              <span className="mx-0.5 sm:mx-1 h-3.5 w-px bg-white/15" />
              <button
                type="button"
                onClick={() => setIsPanMode(prev => !prev)}
                className={`rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold transition ${
                  isPanMode ? 'bg-[#FF5C00] text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
                title="Hand / Pan tool (Drag view space)"
              >
                ✋ Pan
              </button>
            </div>

            {renderEditToolbar()}

            {/* Viewport Center: Empty State or Active Canvas */}
            {isCanvasEmpty ? (
              <div data-testid="empty-canvas" className="flex w-full max-w-md flex-col items-center justify-center p-4 sm:p-6 text-center select-none z-10">
                {/* Glowing MuviDB Orange (+) Button */}
                <label className="group relative flex h-20 w-20 sm:h-24 sm:w-24 cursor-pointer items-center justify-center rounded-2xl sm:rounded-3xl bg-[#FF5C00] text-black shadow-[0_0_50px_rgba(255,92,0,0.5)] transition-all duration-300 hover:scale-105 hover:bg-[#FF7A30] hover:shadow-[0_0_70px_rgba(255,92,0,0.7)]">
                  <svg className="h-10 w-10 sm:h-12 sm:w-12 transition-transform group-hover:rotate-90 duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <input className="hidden" type="file" accept="video/*,image/*,.mp4,.mov,.m4v,.webm" onChange={(e) => { handleOptionalClipUpload(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                
                <h3 className="mt-4 sm:mt-5 text-lg sm:text-xl font-black text-white tracking-wide">Click to upload</h3>
                <p className="mt-1 text-[11px] sm:text-xs text-white/50">Or drag and drop your video file here</p>

                {/* Quick YouTube / URL Input Bar */}
                <div className="mt-4 sm:mt-6 flex w-full items-center gap-1.5 sm:gap-2 rounded-xl border border-white/15 bg-white/5 p-1 sm:p-1.5 shadow-xl backdrop-blur focus-within:border-[#FF5C00]">
                  <input
                    type="text"
                    placeholder="Paste video URL (https://...)"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleFetchYoutube(); }}
                    className="flex-1 bg-transparent px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs text-white placeholder-white/40 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleFetchYoutube}
                    disabled={clipBusy}
                    className="rounded-lg bg-[#FF5C00] px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-black transition hover:bg-[#FF7A30] disabled:opacity-50"
                  >
                    Import
                  </button>
                </div>
              </div>
            ) : (
              /* Scaled & Panned Canvas Container */
              <div
                className="max-h-full max-w-full transition-transform duration-75 relative"
                style={{
                  aspectRatio: `${canvasW} / ${canvasH}`,
                  height: canvasH >= canvasW ? '100%' : 'auto',
                  width: canvasH >= canvasW ? 'auto' : '100%',
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${previewZoom})`,
                  transformOrigin: 'center center',
                }}
              >
                <div className="h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-phone ring-1 ring-white/5 relative">
                  <canvas
                    data-testid="preview-canvas"
                    ref={canvasRef}
                    width={canvasW}
                    height={canvasH}
                    className="h-full w-full cursor-move touch-none"
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                    onPointerCancel={handleCanvasPointerUp}
                  />
                </div>
              </div>
            )}
          </div>

          {renderTimeline()}
        </section>

        {/* Collapsible Right Inspector (Responsive Drawer) */}
        {rightPanelOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setRightPanelOpen(false)}
            />
            <aside className="fixed inset-y-0 right-0 z-50 flex w-[88vw] max-w-[340px] shrink-0 flex-col border-l border-white/10 bg-[#14161a] shadow-2xl transition-all md:relative md:inset-auto md:z-auto md:w-[310px] md:shadow-none">
              {/* Sub-Tabs Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-3 py-2">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {[
                    { id: 'basic', label: 'Basic' },
                    { id: 'background', label: 'Background' },
                    { id: 'audio', label: 'Audio' },
                    { id: 'speed', label: 'Speed' },
                    { id: 'animation', label: 'Animation' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        inspectorSubTab === tab.id
                          ? 'bg-[#FF5C00]/20 text-[#FF5C00]'
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                      }`}
                      onClick={() => setInspectorSubTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white text-xs"
                  onClick={() => setRightPanelOpen(false)}
                  title="Close Inspector"
                >
                  ✕
                </button>
              </div>

              <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 flex items-center justify-between">
                <span className="truncate text-xs font-bold text-white/90">{selectedName || 'Canvas Media'}</span>
                <span className="font-mono text-[10px] text-white/40">
                  {state.selectedTarget === 'layer' ? 'Layer' : 'Main Video'}
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {renderInspectorTab()}
              </div>
            </aside>
          </>
        )}
      </div>

      <audio ref={audioRef} className="hidden" />
      {socialOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#17191d] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-black text-white">Export to Social Studio</h2><p className="mt-1 text-xs text-white/55">Render this edit, create platform drafts, then post now or let the existing cron scheduler publish it.</p></div>
              <button className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white" onClick={() => setSocialOpen(false)}>✕</button>
            </div>
            <label className="label mt-4">Caption
              <textarea className="control min-h-24 resize-y" value={socialCaption} onChange={(event) => setSocialCaption(event.target.value)} placeholder="Write one caption for the selected platforms…" />
            </label>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/45">Publish to</p>
            <div className="grid grid-cols-2 gap-2">
              {['instagram', 'facebook', 'threads', 'tiktok'].map(platform => (
                <label key={platform} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold capitalize ${socialPlatforms.includes(platform) ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-100' : 'border-white/10 text-white/60'}`}>
                  <input type="checkbox" checked={socialPlatforms.includes(platform)} onChange={() => setSocialPlatforms(current => current.includes(platform) ? current.filter(item => item !== platform) : [...current, platform])} /> {platform}
                </label>
              ))}
            </div>
            <label className="label mt-4">Schedule (leave blank to save a reviewable draft)
              <input className="control" type="datetime-local" disabled={socialPostNow} value={socialSchedule} onChange={(event) => setSocialSchedule(event.target.value)} />
            </label>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-white/80"><input type="checkbox" checked={socialPostNow} onChange={(event) => setSocialPostNow(event.target.checked)} /> Post immediately after exporting</label>
            {socialStatus && <div className="mt-3 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3 text-xs text-cyan-50" role="status">{socialBusy && <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-100/30 border-t-cyan-100" />}{socialStatus}</div>}
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" disabled={socialBusy} onClick={() => setSocialOpen(false)}>Cancel</button>
              <button className="btn-accent" disabled={socialBusy || !socialPlatforms.length} onClick={handleExportToSocial}>{socialBusy ? 'Preparing…' : socialPostNow ? 'Export & post now' : socialSchedule ? 'Export & schedule' : 'Export to drafts'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);


