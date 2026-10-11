import Foundation

enum MarketSymbol {
    static let defaults = ["USD-IRT", "GOLD18-IRT", "USDT-IRT", "EUR-IRT"]
    static let maximum = 6
    static func isValid(_ value: String) -> Bool {
        let components = value.split(separator: "-", omittingEmptySubsequences: false)
        guard components.count == 2,
              (1...20).contains(components[0].count),
              (2...10).contains(components[1].count) else { return false }
        return components.allSatisfy { part in
            part.utf8.allSatisfy { (65...90).contains($0) || (48...57).contains($0) }
        }
    }
    static func unique(_ symbols: [String], limit: Int = maximum) -> [String] {
        var seen = Set<String>()
        return Array(symbols.filter { isValid($0) && seen.insert($0).inserted }.prefix(limit))
    }
}

struct MarketQuote: Codable, Identifiable, Equatable {
    let symbol: String
    let name: String
    let quote: String
    let price: Double
    let changePercent: Double?
    let providerUpdatedAt: String?
    let providerSaysFresh: Bool?
    var id: String { symbol }
    var quoteLabel: String {
        switch quote {
        case "IRT": return "تومان"
        case "USD": return "دلار"
        default: return quote
        }
    }
}

struct WidgetFeed: Codable, Equatable {
    let ok: Bool
    let source: String?
    let quoteSide: String?
    let fetchedAt: String?
    let stale: Bool?
    let refreshAfterSeconds: Int?
    let items: [MarketQuote]
    let missingSymbols: [String]?

    func isStale(at now: Date = Date()) -> Bool {
        guard let fetchedAt, let fetched = MarketDate.parse(fetchedAt) else { return true }
        return stale == true || now.timeIntervalSince(fetched) > 45 * 60
    }
}
struct CatalogInstrument: Codable, Identifiable, Equatable {
    let symbol: String
    let name: String
    let quote: String
    let category: String?
    let sellPrice: Double
    let change: Double?
    let updatedAt: String?
    var id: String { symbol }
}
struct MarketCatalogResponse: Decodable {
    let ok: Bool
    let markets: [CatalogInstrument]
}
enum MarketDate {
    static func parse(_ text: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: text) { return date }
        let standard = ISO8601DateFormatter()
        standard.formatOptions = [.withInternetDateTime]
        return standard.date(from: text)
    }
    static func format(_ raw: String?) -> String {
        guard let raw, let date = parse(raw) else { return "زمان نامشخص" }
        return date.formatted(date: .omitted, time: .shortened)
    }
}
