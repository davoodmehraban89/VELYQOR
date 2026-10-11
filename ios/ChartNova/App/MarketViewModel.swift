import SwiftUI
import WidgetKit

@MainActor
final class MarketViewModel: ObservableObject {
    @Published private(set) var markets: [CatalogInstrument] = []
    @Published private(set) var feed: WidgetFeed?
    @Published private(set) var preferences: WidgetPreferences = WidgetSettingsStore.load()
    @Published private(set) var refreshing = false
    @Published var search = ""
    @Published var errorMessage: String?

    var filteredMarkets: [CatalogInstrument] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        let ordered = markets.sorted {
            let favA = preferences.favoriteSymbols.contains($0.symbol)
            let favB = preferences.favoriteSymbols.contains($1.symbol)
            return favA == favB ? $0.symbol < $1.symbol : favA
        }
        if query.isEmpty { return ordered }
        return ordered.filter {
            $0.symbol.localizedCaseInsensitiveContains(query) ||
            $0.name.localizedCaseInsensitiveContains(query)
        }
    }

    func quote(_ symbol: String) -> MarketQuote? {
        feed?.items.first(where: { $0.symbol == symbol })
    }

    func name(_ symbol: String) -> String {
        markets.first(where: { $0.symbol == symbol })?.name ?? symbol
    }

    func refresh() async {
        guard !refreshing else { return }
        refreshing = true
        defer { refreshing = false }
        errorMessage = nil

        do {
            markets = try await MarketAPI().fetchCatalog()
        } catch {
            errorMessage = "دریافت فهرست نمادها ناموفق بود: \(error.localizedDescription)"
        }
        do {
            let selected = preferences.selectedSymbols
            if !selected.isEmpty {
                feed = try await MarketAPI().fetchWidget(symbols: selected)
                if let feed { WidgetQuoteCache.save(feed) }
            } else { feed = nil }
        } catch {
            feed = WidgetQuoteCache.load()
            let detail = "قیمت تازه دریافت نشد؛ در صورت وجود آخرین داده ذخیره‌شده نمایش داده می‌شود."
            errorMessage = [errorMessage, detail].compactMap { $0 }.joined(separator: "\n")
        }
    }

    func toggleFavorite(_ symbol: String) {
        preferences.toggleFavorite(symbol)
        persist()
    }

    func toggleSelection(_ symbol: String) {
        preferences.toggleSelection(symbol)
        persist()
        Task { await refreshQuotesOnly() }
    }

    func updateAppearance(_ value: WidgetAppearance) {
        preferences.appearance = value
        persist()
    }

    func moveSelected(from indices: IndexSet, to destination: Int) {
        preferences.selectedSymbols.move(fromOffsets: indices, toOffset: destination)
        persist()
    }

    private func persist() {
        WidgetSettingsStore.save(preferences)
        WidgetCenter.shared.reloadTimelines(ofKind: "ChartNovaMultiAssetWidget")
    }

    private func refreshQuotesOnly() async {
        let symbols = preferences.selectedSymbols
        if symbols.isEmpty { feed = nil; return }
        do {
            let result = try await MarketAPI().fetchWidget(symbols: symbols)
            feed = result
            WidgetQuoteCache.save(result)
        } catch {
            feed = WidgetQuoteCache.load()
        }
        WidgetCenter.shared.reloadTimelines(ofKind: "ChartNovaMultiAssetWidget")
    }
}
