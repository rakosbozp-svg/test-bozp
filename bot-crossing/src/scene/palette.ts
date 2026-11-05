import type { SessionStatus } from '../api.ts';
import type { TileKind } from './layout.ts';

/** Warm desert / Mars palette. */
export const TERRAIN: Record<TileKind, string[]> = {
  ground: ['#d9a06c', '#d2955f', '#e0ad7b', '#c98a58', '#dba676'],
  path: ['#f0d9ae', '#ecd3a5'],
  pad: ['#ead6b4'],
  plaza: ['#f3e4c6'],
  hub: ['#f5e7cb'],
};

export const BASE_PLATE = '#a8673f';
export const SKY = '#f3d6b3';
export const ROCK = ['#a8613d', '#b87048', '#94553a'];

/** Accent colour per project (roof stripes, sign, flag). */
export const PROJECT_ACCENTS = ['#4f9d8f', '#e07a4f', '#6f86c9', '#d6a52b', '#9a6fb0', '#5f9e5a', '#c8566f'];

export const STATUS_COLOR: Record<SessionStatus, string> = {
  working: '#4fbf5f',
  needs_you: '#ffb81c',
  blocked: '#e0482f',
  idle: '#b9aa99',
  shipped: '#5b86d6',
};

export const POD = '#fbf1df';
export const POD_TRIM = '#e9d8bd';
export const METAL = '#9aa3ad';
export const PANEL = '#2f4b78';
export const WINDOW_LIT = '#ffd479';
export const WINDOW_DARK = '#5a6573';
