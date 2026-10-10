import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAlphaVantageGoldSpot} from '../src/adapters/alpha-vantage.mjs';
test('accepts observed GOLD_SILVER_SPOT response without explicit unit',()=>{const result=parseAlphaVantageGoldSpot({payload:{nominal:'1',timestamp:'2026-10-05T12:00:00Z',price:'4001.25'},receivedAt:new Date('2026-10-05T12:00:02Z')});assert.equal(result.canonicalSymbol,'XAU_USD');assert.equal(result.price,4001.25);assert.equal(result.canonicalUnit,'USD_PER_TROY_OUNCE')});
