import XCTest
@testable import ChartNova

final class ChartNovaCoreTests: XCTestCase {
    func testDefaultsInclude18KGoldAndMultipleCurrencies() {
        let prefs = WidgetPreferences.initial
        XCTAssertEqual(prefs.selectedSymbols, ["USD-IRT", "GOLD18-IRT", "USDT-IRT", "EUR-IRT"])
        XCTAssertEqual(prefs.appearance, .glass)
    }

    func testMaximumSixAndNoDuplicateOrInvalidSymbols() {
        let raw = ["USD-IRT", "USD-IRT", "<script>", "GOLD18-IRT", "BTC-USD", "EUR-IRT", "USDT-IRT", "SEKE-IRT", "ETH-USD"]
        XCTAssertEqual(MarketSymbol.unique(raw), ["USD-IRT", "GOLD18-IRT", "BTC-USD", "EUR-IRT", "USDT-IRT", "SEKE-IRT"])
        XCTAssertFalse(MarketSymbol.isValid("foo/evil"))
    }

    func testFavoritesAndSelectionsCanToggle() {
        var prefs = WidgetPreferences.initial
        prefs.toggleFavorite("BTC-USD")
        XCTAssertTrue(prefs.favoriteSymbols.contains("BTC-USD"))
        prefs.toggleFavorite("BTC-USD")
        XCTAssertFalse(prefs.favoriteSymbols.contains("BTC-USD"))
        prefs.toggleSelection("GOLD18-IRT")
        XCTAssertFalse(prefs.selectedSymbols.contains("GOLD18-IRT"))
        prefs.toggleSelection("GOLD18-IRT")
        XCTAssertTrue(prefs.selectedSymbols.contains("GOLD18-IRT"))
    }

    func testProviderJSONDecodesCorrectQuoteCurrencyAndStaleState() throws {
        let json = #"""
        {
          "ok":true,"source":"gheymat.online","quoteSide":"sell",
          "fetchedAt":"2026-10-11T10:30:52.347Z","stale":false,
          "refreshAfterSeconds":900,"missingSymbols":[],
          "items":[
            {"symbol":"USD-IRT","name":"دلار آمریکا","quote":"IRT","price":265060,
             "changePercent":-0.3,"providerUpdatedAt":"2026-10-11T10:30:45.033191Z","providerSaysFresh":true},
            {"symbol":"GOLD18-IRT","name":"طلای ۱۸ عیار","quote":"IRT","price":26235860,
             "changePercent":0.7,"providerUpdatedAt":"2026-10-11T10:30:45.032870Z","providerSaysFresh":true},
            {"symbol":"BTC-USD","name":"بیت کوین","quote":"USD","price":100000,
             "changePercent":1.2,"providerUpdatedAt":null,"providerSaysFresh":true}
          ]
        }
        """#
        let feed = try JSONDecoder().decode(WidgetFeed.self, from: Data(json.utf8))
        XCTAssertEqual(feed.items.count, 3)
        XCTAssertEqual(feed.items[1].price, 26235860)
        XCTAssertEqual(feed.items[1].quoteLabel, "تومان")
        XCTAssertEqual(feed.items[2].quoteLabel, "دلار")
        XCTAssertEqual(feed.quoteSide, "sell")
        XCTAssertNotNil(MarketDate.parse(feed.fetchedAt!))
        XCTAssertTrue(feed.isStale(at: Date(timeIntervalSince1970: 2_000_000_000)))
    }

    func testNormalizationKeepsOrderAndBounds() {
        let prefs = WidgetPreferences(
            selectedSymbols: ["BTC-USD", "GOLD18-IRT", "BTC-USD", "FOO-IRT"],
            favoriteSymbols: ["USD-IRT", "USD-IRT", "EUR-IRT"],
            appearance: .dark
        ).normalized()
        XCTAssertEqual(prefs.selectedSymbols, ["BTC-USD", "GOLD18-IRT", "FOO-IRT"])
        XCTAssertEqual(prefs.favoriteSymbols, ["USD-IRT", "EUR-IRT"])
    }
}
