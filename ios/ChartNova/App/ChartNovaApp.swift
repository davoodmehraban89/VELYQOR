import SwiftUI

@main
struct ChartNovaApp: App {
    var body: some Scene {
        WindowGroup {
            MarketHomeView()
                .environment(\.layoutDirection, .rightToLeft)
                .tint(Color(red: 0.02, green: 0.62, blue: 0.67))
        }
    }
}
