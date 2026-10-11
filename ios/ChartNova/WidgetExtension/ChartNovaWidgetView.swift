import SwiftUI
import WidgetKit

struct ChartNovaWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ChartNovaTimelineEntry

    private var capacity: Int {
        switch family {
        case .systemSmall: return 2
        case .systemMedium: return 4
        case .systemLarge: return 6
        default: return 2
        }
    }

    private var columns: [GridItem] {
        family == .systemSmall
            ? [GridItem(.flexible(), spacing: 6)]
            : [GridItem(.flexible(), spacing: 7), GridItem(.flexible(), spacing: 7)]
    }

    private var background: [Color] {
        switch entry.appearance {
        case .glass: return [Color(red: 0.89, green: 0.99, blue: 0.98), Color(red: 0.83, green: 0.93, blue: 0.97)]
        case .dark: return [Color(red: 0.07, green: 0.15, blue: 0.23), Color(red: 0.04, green: 0.09, blue: 0.15)]
        case .light: return [.white, Color(red: 0.94, green: 0.96, blue: 0.99)]
        }
    }

    private var foreground: Color { entry.appearance == .dark ? .white : Color(red: 0.09, green: 0.23, blue: 0.29) }
    private var subdued: Color { entry.appearance == .dark ? Color(red: 0.66, green: 0.78, blue: 0.82) : Color(red: 0.33, green: 0.48, blue: 0.53) }
    private var accent: Color { entry.appearance == .dark ? Color(red: 0.45, green: 0.91, blue: 0.86) : Color(red: 0.02, green: 0.58, blue: 0.64) }

    var body: some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 5 : 9) {
            header
            if entry.selectedSymbols.isEmpty {
                Text("نمادها را در اپ ChartNova انتخاب کن.")
                    .font(.caption2).foregroundStyle(subdued)
                Spacer(minLength: 0)
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: family == .systemSmall ? 7 : 10) {
                    ForEach(Array(entry.selectedSymbols.prefix(capacity)), id: \.self) { symbol in
                        quoteCell(symbol)
                    }
                }
                Spacer(minLength: 0)
            }
            footer
        }
        .padding(family == .systemSmall ? 11 : 14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .environment(\.layoutDirection, .rightToLeft)
        .containerBackground(for: .widget) {
            LinearGradient(colors: background, startPoint: .topLeading, endPoint: .bottomTrailing)
        }
        .widgetURL(URL(string: "chartnova://widget"))
    }

    private var header: some View {
        HStack(spacing: 4) {
            Image(systemName: "chart.bar.fill").font(.system(size: family == .systemSmall ? 12 : 15))
            Text("ChartNova").font(.system(size: family == .systemSmall ? 11 : 14, weight: .bold))
            Spacer(minLength: 0)
            if entry.stale {
                Image(systemName: "clock.badge.exclamationmark")
                    .font(.system(size: 10))
                    .accessibilityLabel("قیمت قدیمی")
            } else {
                Circle().fill(Color.green).frame(width: 6, height: 6)
            }
        }
        .foregroundStyle(accent)
    }

    private func quoteCell(_ symbol: String) -> some View {
        let quote = entry.quote(for: symbol)
        return VStack(alignment: .leading, spacing: family == .systemSmall ? 2 : 3) {
            Text(quote?.name ?? symbol)
                .font(.system(size: family == .systemSmall ? 10 : 11, weight: .semibold))
                .lineLimit(1)
                .foregroundStyle(foreground)

            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(quote.map { formatPrice($0.price) } ?? "—")
                    .font(.system(size: family == .systemSmall ? 13 : 15, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                    .monospacedDigit()
                    .foregroundStyle(foreground)
                Spacer(minLength: 0)
            }
            HStack(spacing: 4) {
                Text(quote?.quoteLabel ?? "—")
                    .font(.system(size: 8))
                    .foregroundStyle(subdued)
                    .lineLimit(1)
                if let change = quote?.changePercent {
                    Text(String(format: "%+.2f%%", change))
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(change >= 0 ? Color.green : Color.red)
                        .lineLimit(1)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(quote?.name ?? symbol)، \(quote.map { formatPrice($0.price) } ?? "ناموجود") \(quote?.quoteLabel ?? "")")
    }

    private var footer: some View {
        HStack(spacing: 4) {
            Text(entry.usedOfflineCache ? "آفلاین · آخرین قیمت ذخیره‌شده"
                 : entry.stale ? "داده قدیمی · غیرلحظه‌ای"
                 : "آخرین نرخ منبع · غیرلحظه‌ای")
                .lineLimit(1).minimumScaleFactor(0.72)
            Spacer(minLength: 0)
            if family != .systemSmall {
                Text(MarketDate.format(entry.fetchedAt))
                    .lineLimit(1)
            }
        }
        .font(.system(size: 8))
        .foregroundStyle(subdued)
    }

    private func formatPrice(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...2)))
    }
}
