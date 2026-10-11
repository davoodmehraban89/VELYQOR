import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

enum MarketAPIError: LocalizedError {
    case invalidSelection, invalidResponse, server(Int)
    var errorDescription: String? {
        switch self {
        case .invalidSelection: return "شناسه نمادهای انتخاب‌شده معتبر نیست."
        case .invalidResponse: return "پاسخ معتبر از ChartNova دریافت نشد."
        case .server(let code): return "سرویس بازار در دسترس نیست (HTTP \(code))."
        }
    }
}
struct MarketAPI {
    static let baseURL = URL(string: "https://app.chartnova.ir")!
    var session: URLSession = .shared

    func fetchWidget(symbols: [String]) async throws -> WidgetFeed {
        let clean = MarketSymbol.unique(symbols)
        guard !clean.isEmpty else { throw MarketAPIError.invalidSelection }
        var parts = URLComponents(url: Self.baseURL.appendingPathComponent("api/widget"), resolvingAgainstBaseURL: false)!
        parts.queryItems = [URLQueryItem(name: "symbols", value: clean.joined(separator: ","))]
        guard let url = parts.url else { throw MarketAPIError.invalidSelection }
        let req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 12)
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw MarketAPIError.invalidResponse }
        guard http.statusCode == 200 else { throw MarketAPIError.server(http.statusCode) }
        let feed = try JSONDecoder().decode(WidgetFeed.self, from: data)
        guard feed.ok, !feed.items.isEmpty, feed.items.count <= MarketSymbol.maximum,
              feed.items.allSatisfy({ MarketSymbol.isValid($0.symbol) && $0.price.isFinite && $0.price > 0 }) else { throw MarketAPIError.invalidResponse }
        return feed
    }

    func fetchCatalog() async throws -> [CatalogInstrument] {
        let req = URLRequest(url: Self.baseURL.appendingPathComponent("api/markets"), cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw MarketAPIError.invalidResponse }
        guard http.statusCode == 200 else { throw MarketAPIError.server(http.statusCode) }
        let catalog = try JSONDecoder().decode(MarketCatalogResponse.self, from: data)
        guard catalog.ok, !catalog.markets.isEmpty else { throw MarketAPIError.invalidResponse }
        return catalog.markets.filter { MarketSymbol.isValid($0.symbol) && $0.sellPrice.isFinite && $0.sellPrice > 0 }
    }
}
enum WidgetQuoteCache {
    private static let key = "chartnova.widget.lastValidFeed.v1"
    static func save(_ feed: WidgetFeed) {
        guard feed.ok, !feed.items.isEmpty, let data = try? JSONEncoder().encode(feed) else { return }
        WidgetSettingsStore.defaults.set(data, forKey: key)
    }
    static func load() -> WidgetFeed? {
        guard let data = WidgetSettingsStore.defaults.data(forKey: key),
              let feed = try? JSONDecoder().decode(WidgetFeed.self, from: data),
              feed.ok, !feed.items.isEmpty else { return nil }
        return feed
    }
}
