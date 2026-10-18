import SwiftUI

struct BudgetScreen: View {
    @Environment(TripStore.self) private var store
    @State private var adding = false
    @State private var pendingDelete: PendingDelete?
    @State private var settler = CheckSettler()
    @AppStorage(Prefs.checkedToBottomKey) private var checkedToBottom = false
    private let segmentColors: [Color] = [NS.ink, NS.lane, NS.faint, Color(red: 0.81, green: 0.81, blue: 0.79)]

    private func label(_ category: String) -> String {
        let text = category.replacingOccurrences(of: "_", with: " ").replacingOccurrences(of: "-", with: " ")
        return text.prefix(1).uppercased() + text.dropFirst()
    }

    var body: some View {
        let expenses = store.bundle?.expenses ?? []
        let total = expenses.reduce(0) { $0 + $1.amountValue }
        let paid = expenses.filter { $0.isPaid ?? false }.reduce(0) { $0 + $1.amountValue }
        let byCategory = Dictionary(grouping: expenses, by: \.category).mapValues { $0.reduce(0) { $0 + $1.amountValue } }.filter { $0.value > 0 }.sorted { $0.value > $1.value }
        let top = Array(byCategory.prefix(3))
        let rest = byCategory.dropFirst(3).reduce(0) { $0 + $1.value }
        let segments: [(String, Double)] = top.map { ($0.key, $0.value) } + (rest > 0 ? [("Everything else", rest)] : [])

        NavigationStack {
            List {
                VStack(alignment: .leading, spacing: 6) {
                    Text("TRIP TOTAL").font(NS.sans(12, .bold)).tracking(1).foregroundStyle(NS.muted)
                    Text(Fmt.money(total)).font(NS.display(56)).tracking(-2.4)
                    HStack(spacing: 20) {
                        HStack(spacing: 6) { Text(Fmt.money(paid)).font(NS.mono(15, .semibold)).foregroundStyle(NS.go); Text("paid").font(NS.sans(13, .semibold)).foregroundStyle(NS.muted) }
                        HStack(spacing: 6) { Text(Fmt.money(total - paid)).font(NS.mono(15, .semibold)); Text("to pay").font(NS.sans(13, .semibold)).foregroundStyle(NS.muted) }
                    }
                    if total > 0 {
                        GeometryReader { geo in
                            HStack(spacing: 3) {
                                ForEach(Array(segments.enumerated()), id: \.offset) { index, segment in
                                    RoundedRectangle(cornerRadius: 4).fill(segmentColors[index])
                                        .frame(width: max(4, (geo.size.width - CGFloat(segments.count - 1) * 3) * segment.1 / total))
                                }
                            }
                        }
                        .frame(height: 12)
                        .padding(.top, 14)
                        FlowLegend(items: segments.enumerated().map { (label($0.element.0), segmentColors[$0.offset]) })
                    }
                }
                .listRowSeparator(.hidden)
                .padding(.bottom, 6)

                ForEach(expenses.sorted {
                    if checkedToBottom {
                        let a = settler.sortState($0.id, $0.isPaid ?? false), b = settler.sortState($1.id, $1.isPaid ?? false)
                        if a != b { return !a }
                    }
                    return $0.id < $1.id
                }) { expense in
                    HStack(spacing: 14) {
                        Button {
                            let next = !(expense.isPaid ?? false)
                            settler.toggled(expense.id, from: !next)
                            Task { await store.updateExpense(expense.id, patch: ["isPaid": .bool(next)]) { $0.isPaid = next } }
                        } label: { CheckBox(checked: expense.isPaid ?? false) }
                        .buttonStyle(.plain)
                        .disabled(!store.canEdit)
                        .accessibilityLabel(expense.description)
                        Text(expense.description)
                            .font(NS.sans(16, .medium))
                            .strikethrough(expense.isPaid ?? false)
                            .foregroundStyle((expense.isPaid ?? false) ? NS.muted : NS.ink)
                            .lineLimit(1)
                        Spacer()
                        Text(Fmt.money(expense.amountValue, cents: true))
                            .font(NS.mono(14, .semibold))
                            .foregroundStyle((expense.isPaid ?? false) ? NS.muted : NS.ink)
                    }
                    .frame(minHeight: 40)
                    .swipeActions(allowsFullSwipe: false) {
                        if store.canEdit {
                            Button { pendingDelete = PendingDelete(title: expense.description) { Task { await store.deleteExpense(expense.id) } } } label: { Label("Delete", systemImage: "trash") }
                                .tint(NS.stop)
                        }
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Budget")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if store.canEdit {
                    ToolbarItem(placement: .primaryAction) {
                        Button { adding = true } label: { Image(systemName: "plus") }.accessibilityLabel("Add an expense")
                    }
                }
            }
            .confirmDelete($pendingDelete)
            .refreshable { await store.refresh() }
            .sheet(isPresented: $adding) { AddExpenseSheet().presentationDetents([.medium]).solidSheet() }
        }
    }
}

struct FlowLegend: View {
    let items: [(String, Color)]
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(stride(from: 0, to: items.count, by: 2)), id: \.self) { start in
                HStack(spacing: 16) {
                    ForEach(start..<min(start + 2, items.count), id: \.self) { i in
                        HStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 3).fill(items[i].1).frame(width: 9, height: 9)
                            Text(items[i].0).font(NS.sans(13, .semibold))
                        }
                    }
                }
            }
        }
        .padding(.top, 6)
    }
}

struct AddExpenseSheet: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var description = ""
    @State private var amount = ""
    @State private var category = "Other"
    private let categories = ["Stays", "Food", "Car & gas", "Flights", "Activities", "Other"]

    var body: some View {
        NavigationStack {
            Form {
                TextField("What", text: $description).accessibilityIdentifier("expense-what")
                TextField("Amount", text: $amount).keyboardType(.decimalPad)
                Picker("Category", selection: $category) { ForEach(categories, id: \.self) { Text($0) } }
            }
            .navigationTitle("Add an expense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let value = Double(amount), !description.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                        let text = description.trimmingCharacters(in: .whitespaces), cat = category
                        Task { await store.addExpense(text, amount: value, category: cat) }
                        dismiss()
                    }
                    .bold()
                }
            }
        }
        .tint(NS.ink)
    }
}
