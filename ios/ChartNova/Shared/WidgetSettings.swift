import Foundation

enum WidgetAppearance: String, Codable, CaseIterable, Identifiable {
    case glass, dark, light
    var id: String { rawValue }
    var title: String {
        switch self {
        case .glass: return "Nova Glass"
        case .dark: return "تیره"
        case .light: return "روشن"
        }
    }
}
struct WidgetPreferences: Codable, Equatable {
    var selectedSymbols: [String]
    var favoriteSymbols: [String]
    var appearance: WidgetAppearance
    static let initial = WidgetPreferences(selectedSymbols: MarketSymbol.defaults, favoriteSymbols: MarketSymbol.defaults, appearance: .glass)
    func normalized() -> WidgetPreferences {
        WidgetPreferences(selectedSymbols: MarketSymbol.unique(selectedSymbols), favoriteSymbols: MarketSymbol.unique(favoriteSymbols, limit: 100), appearance: appearance)
    }
    mutating func toggleFavorite(_ symbol: String) {
        guard MarketSymbol.isValid(symbol) else { return }
        if favoriteSymbols.contains(symbol) { favoriteSymbols.removeAll { $0 == symbol } }
        else { favoriteSymbols.append(symbol) }
        favoriteSymbols = MarketSymbol.unique(favoriteSymbols, limit: 100)
    }
    mutating func toggleSelection(_ symbol: String) {
        guard MarketSymbol.isValid(symbol) else { return }
        if selectedSymbols.contains(symbol) { selectedSymbols.removeAll { $0 == symbol } }
        else if selectedSymbols.count < MarketSymbol.maximum { selectedSymbols.append(symbol) }
    }
}
enum WidgetSettingsStore {
    static let appGroupID = "group.ir.chartnova.widgets"
    private static let preferencesKey = "chartnova.widget.preferences.v1"
    static var groupAvailable: Bool { UserDefaults(suiteName: appGroupID) != nil }
    static var defaults: UserDefaults { UserDefaults(suiteName: appGroupID) ?? .standard }

    static func load() -> WidgetPreferences {
        guard let data = defaults.data(forKey: preferencesKey),
              let result = try? JSONDecoder().decode(WidgetPreferences.self, from: data) else { return .initial }
        return result.normalized()
    }
    static func save(_ preferences: WidgetPreferences) {
        guard let data = try? JSONEncoder().encode(preferences.normalized()) else { return }
        defaults.set(data, forKey: preferencesKey)
    }
}
