import { canonicalObservation } from '../provider-contract.mjs';
export const GOLD_API_XAU_URL='https://api.gold-api.com/price/XAU';
export function parseGoldApiXau({payload,receivedAt}){
 if(!(receivedAt instanceof Date)||Number.isNaN(receivedAt.valueOf()))throw new TypeError('receivedAt must be a valid Date');
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new TypeError('payload must be an object');
 if(payload.symbol!=='XAU'||payload.currency!=='USD')throw new RangeError('expected XAU in USD');
 const price=typeof payload.price==='string'&&payload.price.trim()?Number(payload.price):payload.price;
 if(!Number.isFinite(price)||price<=0)throw new RangeError('price must be positive');
 if(typeof payload.updatedAt!=='string'||!payload.updatedAt.trim())throw new TypeError('updatedAt is required');
 const timestamp=new Date(payload.updatedAt);
 if(Number.isNaN(timestamp.valueOf()))throw new TypeError('invalid updatedAt');
 const observation=canonicalObservation({providerCode:'gold_api',canonicalSymbol:'XAU_USD',providerTimestamp:timestamp,receivedAt,price,rawUnit:'USD_PER_TROY_OUNCE'});
 return {...observation,raw:{symbol:payload.symbol,currency:payload.currency,price:payload.price,updatedAt:payload.updatedAt}};
}
