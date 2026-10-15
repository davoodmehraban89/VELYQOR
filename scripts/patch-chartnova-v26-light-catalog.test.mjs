import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { patchChartNovaV26 } from './patch-chartnova-v26-light-catalog.mjs';

const jsx=String.raw