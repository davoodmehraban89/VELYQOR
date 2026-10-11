const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=__dirname;
const sw=['Shared/MarketModels.swift','Shared/WidgetSettings.swift','Shared/MarketAPI.swift','App/ChartNovaApp.swift','App/MarketViewModel.swift','App/MarketHomeView.swift','WidgetExtension/ChartNovaWidget.swift','WidgetExtension/ChartNovaWidgetView.swift','Tests/ChartNovaCoreTests.swift'];
for(const rel of sw){const s=fs.readFileSync(path.join(root,rel),'utf8');assert(s.length>100,'empty source '+rel);assert(!s.includes('API_KEY')&&!s.includes('Bearer '),'secret leak '+rel);console.log('PASS source',rel,s.split('\n').length,'lines')}
const y=fs.readFileSync(path.join(root,'project.yml'),'utf8');
for(const item of ['ChartNovaWidgets:','ChartNovaTests:','NSExtensionPointIdentifier: com.apple.widgetkit-extension','group.ir.chartnova.widgets','type: app-extension','iOS: "17.0"'])assert(y.includes(item),'project spec '+item);
console.log('PASS project targets, app group and iOS17 platform');
const a=fs.readFileSync(path.join(root,'Resources/Assets.xcassets/AppIcon.appiconset/Contents.json'),'utf8'),asset=JSON.parse(a);
const icon=path.join(root,'Resources/Assets.xcassets/AppIcon.appiconset/',asset.images[0].filename);
assert(fs.statSync(icon).size>10000,'app icon too small');const header=fs.readFileSync(icon).subarray(0,24);assert.equal(header.readUInt32BE(16),1024);assert.equal(header.readUInt32BE(20),1024);console.log('PASS icon PNG 1024x1024');
const web=fs.readFileSync(path.join(root,'Shared/MarketAPI.swift'),'utf8');
assert(web.includes('https://app.chartnova.ir')&&web.includes('api/widget')&&web.includes('api/markets'));
const ext=fs.readFileSync(path.join(root,'WidgetExtension/ChartNovaWidget.swift'),'utf8');
for(const family of ['.systemSmall','.systemMedium','.systemLarge'])assert(ext.includes(family));
assert(ext.includes('Timeline(entries:')&&ext.includes('WidgetQuoteCache.save'));
console.log('PASS widget families, timeline and API wiring');
const files=sw.length;
console.log('PASS',files,'Swift files');
