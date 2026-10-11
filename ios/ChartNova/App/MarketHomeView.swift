import SwiftUI
import WidgetKit

struct MarketHomeView: View {
    @StateObject private var model = MarketViewModel()

    var body: some View {
        TabView {
            NavigationStack {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("ChartNova").font(.title2.bold()).foregroundStyle(.cyan)
                            Text("ویجت چندنمادی آیفون").font(.subheadline)
                            Text("قیمت‌ها در میان آیکون‌های صفحه اصلی نمایش داده می‌شوند. اندازه کوچک ۲، متوسط ۴ و بزرگ ۶ نماد نشان می‌دهد.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }.padding(.vertical, 8)
                        if !WidgetSettingsStore.groupAvailable {
                            Label("اشتراک داده App Group فعال نیست. تنظیمات امضای اپ را بررسی کن.", systemImage: "exclamationmark.triangle")
                                .font(.footnote).foregroundStyle(.red)
                        }
                    }
                    Section("نمادهای انتخابی · حداکثر ۶") {
                        if model.preferences.selectedSymbols.isEmpty {
                            Text("از فهرست نمادها، حداقل یک مورد انتخاب کن.").foregroundStyle(.secondary)
                        }
                        ForEach(model.preferences.selectedSymbols, id: \.self) { symbol in
                            selectedRow(symbol)
                        }
                        .onMove(perform: model.moveSelected)
                    }
                    Section("ظاهر ویجت") {
                        Picker("رنگ‌بندی", selection: Binding(
                            get: { model.preferences.appearance },
                            set: { model.updateAppearance($0) }
                        )) {
                            ForEach(WidgetAppearance.allCases) { theme in
                                Text(theme.title).tag(theme)
                            }
                        }.pickerStyle(.segmented)
                    }
                    Section("وضعیت دریافت داده") {
                        if let feed = model.feed {
                            LabeledContent("منبع", value: feed.source ?? "نامشخص")
                            LabeledContent("زمان دریافت", value: MarketDate.format(feed.fetchedAt))
                            if feed.isStale() {
                                Label("قیمت‌ها ممکن است قدیمی باشند", systemImage: "clock.badge.exclamationmark")
                                    .foregroundStyle(.orange)
                            }
                        } else {
                            Text("در انتظار قیمت معتبر").foregroundStyle(.secondary)
                        }
                        if let error = model.errorMessage {
                            Text(error).font(.footnote).foregroundStyle(.orange)
                        }
                    }
                    Section("روش افزودن به صفحه اصلی") {
                        Text("پس از نصب و اجرای اپ: روی فضای خالی Home Screen لمس طولانی کن ← Edit ← Add Widget ← جست‌وجوی ChartNova ← انتخاب اندازه و افزودن.")
                            .font(.footnote)
                    }
                }
                .navigationTitle("ویجت چارت‌نوا")
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        EditButton()
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            Task { await model.refresh() }
                        } label: {
                            Image(systemName: "arrow.clockwise")
                        }
                        .disabled(model.refreshing)
                        .accessibilityLabel("تازه‌سازی قیمت")
                    }
                }
            }
            .tabItem { Label("ویجت من", systemImage: "square.grid.2x2") }

            NavigationStack {
                List {
                    Section("جست‌وجو و انتخاب") {
                        Text("ستاره: علاقه‌مندی · مربع: افزودن به ویجت. محدودیت ۶ نماد.")
                            .font(.footnote).foregroundStyle(.secondary)
                        ForEach(model.filteredMarkets) { instrument in
                            marketRow(instrument)
                        }
                        if model.markets.isEmpty {
                            ContentUnavailableView(
                                "دریافت نمادها",
                                systemImage: "wifi.exclamationmark",
                                description: Text(model.errorMessage ?? "در حال دریافت اطلاعات بازار")
                            )
                        }
                    }
                }
                .searchable(text: $model.search, prompt: "نام یا شناسه نماد، مثلاً GOLD18")
                .navigationTitle("نمادها")
            }
            .tabItem { Label("نمادها", systemImage: "star.circle") }
        }
        .task { await model.refresh() }
    }

    @ViewBuilder
    private func selectedRow(_ symbol: String) -> some View {
        let quote = model.quote(symbol)
        HStack(spacing: 12) {
            Image(systemName: "line.3.horizontal").foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 4) {
                Text(model.name(symbol)).font(.headline)
                Text(symbol).font(.caption.monospaced()).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                if let quote {
                    Text(quote.price.formatted(.number.precision(.fractionLength(0...2))))
                        .font(.subheadline.bold()).monospacedDigit()
                    Text(quote.quoteLabel).font(.caption2).foregroundStyle(.secondary)
                } else { Text("—").foregroundStyle(.secondary) }
            }
            Button {
                model.toggleSelection(symbol)
            } label: {
                Image(systemName: "minus.circle.fill").foregroundStyle(.red)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("حذف \(symbol) از ویجت")
        }
    }

    private func marketRow(_ instrument: CatalogInstrument) -> some View {
        let selected = model.preferences.selectedSymbols.contains(instrument.symbol)
        let favorite = model.preferences.favoriteSymbols.contains(instrument.symbol)
        return HStack(spacing: 10) {
            Button {
                model.toggleFavorite(instrument.symbol)
            } label: {
                Image(systemName: favorite ? "star.fill" : "star")
                    .foregroundStyle(favorite ? Color.yellow : Color.secondary)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel(favorite ? "حذف از علاقه‌مندی" : "افزودن به علاقه‌مندی")

            VStack(alignment: .leading, spacing: 3) {
                Text(instrument.name).font(.subheadline.bold())
                Text(instrument.symbol).font(.caption2.monospaced()).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(instrument.sellPrice.formatted(.number.precision(.fractionLength(0...2))))
                    .font(.subheadline.monospacedDigit())
                Text(instrument.quote == "IRT" ? "تومان" : instrument.quote)
                    .font(.caption2).foregroundStyle(.secondary)
            }
            Button {
                model.toggleSelection(instrument.symbol)
            } label: {
                Image(systemName: selected ? "checkmark.square.fill" : "plus.square")
                    .foregroundStyle(.cyan)
            }
            .buttonStyle(.borderless)
            .disabled(!selected && model.preferences.selectedSymbols.count >= MarketSymbol.maximum)
            .accessibilityLabel(selected ? "حذف از ویجت" : "افزودن به ویجت")
        }
        .padding(.vertical, 3)
    }
}
