import SwiftUI
import WidgetKit

struct ChartNovaTimelineEntry: TimelineEntry {
    let date: Date
    let selectedSymbols: [String]
    let appearance: WidgetAppearance
    let quotes: [MarketQuote]
    let fetchedAt: String?
    let source: String
    let stale: Bool
    let usedOfflineCache: Bool

    func quote(for symbol: String) -> MarketQuote? {
        quotes.first(where: { $0.symbol == symbol })
    }
}

struct ChartNovaTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> ChartNovaTimelineEntry {
        entry(quotes: [], fetchedAt: nil, source: "ChartNova", stale: true, offline: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (ChartNovaTimelineEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
        } else {
            Task { completion(await downloadEntry()) }
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ChartNovaTimelineEntry>) -> Void) {
        Task {
            let current = await downloadEntry()
            // System decides when to honor this request; 15 minutes is not guaranteed.
            let earliestRefresh = Date().addingTimeInterval(current.usedOfflineCache ? 5 * 60 : 15 * 60)
            completion(Timeline(entries: [current], policy: .after(earliestRefresh)))
        }
    }

    private func downloadEntry() async -> ChartNovaTimelineEntry {
        let config = WidgetSettingsStore.load()
        guard !config.selectedSymbols.isEmpty else {
            return entry(quotes: [], fetchedAt: nil, source: "ChartNova", stale: true, offline: false)
        }
        do {
            let feed = try await MarketAPI().fetchWidget(symbols: config.selectedSymbols)
            WidgetQuoteCache.save(feed)
            return entry(quotes: feed.items, fetchedAt: feed.fetchedAt, source: feed.source ?? "ChartNova",
                         stale: feed.isStale() || feed.items.contains(where: { $0.providerSaysFresh == false }),
                         offline: false, prefs: config)
        } catch {
            let cached = WidgetQuoteCache.load()
            return entry(quotes: cached?.items ?? [], fetchedAt: cached?.fetchedAt, source: cached?.source ?? "ChartNova",
                         stale: true, offline: true, prefs: config)
        }
    }

    private func entry(quotes: [MarketQuote], fetchedAt: String?, source: String, stale: Bool,
                       offline: Bool, prefs: WidgetPreferences = WidgetSettingsStore.load()) -> ChartNovaTimelineEntry {
        ChartNovaTimelineEntry(date: Date(), selectedSymbols: prefs.selectedSymbols,
                              appearance: prefs.appearance, quotes: quotes, fetchedAt: fetchedAt,
                              source: source, stale: stale, usedOfflineCache: offline)
    }
}

struct ChartNovaWidget: Widget {
    let kind = "ChartNovaMultiAssetWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ChartNovaTimelineProvider()) { entry in
            ChartNovaWidgetView(entry: entry)
        }
        .configurationDisplayName("چارت‌نوا | قیمت‌های منتخب")
        .description("چند ارز، تتر، سکه و گرم طلا را در صفحه اصلی آیفون ببین.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

@main
struct ChartNovaWidgetBundle: WidgetBundle {
    var body: some Widget {
        ChartNovaWidget()
    }
}
