import SwiftUI

struct CheckBox: View {
    let checked: Bool
    var body: some View {
        ZStack {
            if checked {
                RoundedRectangle(cornerRadius: 7, style: .continuous).fill(NS.go)
                Image(systemName: "checkmark").font(.system(size: 12, weight: .heavy)).foregroundStyle(.white)
            } else {
                RoundedRectangle(cornerRadius: 7, style: .continuous).strokeBorder(NS.ink, lineWidth: 2)
            }
        }
        .frame(width: 22, height: 22)
        .contentShape(Rectangle())
    }
}

struct AddField: View {
    let placeholder: String
    let onAdd: (String) -> Void
    @State private var text = ""
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "plus").font(.system(size: 15, weight: .bold)).foregroundStyle(NS.muted)
            TextField(placeholder, text: $text)
                .font(NS.sans(16, .medium))
                .submitLabel(.done)
                .onSubmit {
                    let value = text.trimmingCharacters(in: .whitespaces)
                    guard !value.isEmpty else { return }
                    onAdd(value)
                    text = ""
                }
        }
        .padding(.horizontal, 14)
        .frame(height: 48)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(NS.surface))
    }
}

struct ListsScreen: View {
    @Environment(TripStore.self) private var store
    @State private var tab = 0
    @State private var renaming: RenameTarget?
    @State private var pendingDelete: PendingDelete?
    @State private var reminderSettler = CheckSettler()
    @State private var packingSettler = CheckSettler()
    @AppStorage(Prefs.checkedToBottomKey) private var checkedToBottom = false

    struct RenameTarget: Identifiable { let id: Int; let isPacking: Bool; var text: String }

    var body: some View {
        let bundle = store.bundle
        let reminders = (bundle?.reminders ?? []).sorted {
            if checkedToBottom {
                let a = reminderSettler.sortState($0.id, $0.isDone ?? false), b = reminderSettler.sortState($1.id, $1.isDone ?? false)
                if a != b { return !a }
            }
            if ($0.dueDate ?? "9999") != ($1.dueDate ?? "9999") { return ($0.dueDate ?? "9999") < ($1.dueDate ?? "9999") }
            return $0.id < $1.id
        }
        let packing = bundle?.packingItems ?? []
        let groups = Dictionary(grouping: packing, by: { $0.category.isEmpty ? "other" : $0.category })
            .sorted { $0.key == "other" ? false : $1.key == "other" ? true : $0.key < $1.key }
        let today = Fmt.isoDate(Date())

        NavigationStack {
            List {
                Text("Lists")
                    .font(NS.display(34)).tracking(-1.2)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 4, trailing: 20))
                Section {
                    Picker("", selection: $tab) {
                        Text("To do  \(reminders.filter { !($0.isDone ?? false) }.count)").tag(0)
                        Text("Packing  \(packing.filter { $0.isPacked ?? false }.count)/\(packing.count)").tag(1)
                    }
                    .pickerStyle(.segmented)
                    .listRowSeparator(.hidden)
                    if store.canEdit {
                        AddField(placeholder: tab == 0 ? "Add a to-do" : "Add an item") { value in
                            Task { tab == 0 ? await store.addReminder(value) : await store.addPacking(value, category: "other") }
                        }
                        .listRowSeparator(.hidden)
                    }
                }
                if tab == 0 {
                    ForEach(reminders) { reminder in
                        HStack(spacing: 14) {
                            Button {
                                let next = !(reminder.isDone ?? false)
                                reminderSettler.toggled(reminder.id, from: !next)
                                Task { await store.updateReminder(reminder.id, patch: ["isDone": .bool(next)]) { $0.isDone = next } }
                            } label: { CheckBox(checked: reminder.isDone ?? false) }
                            .buttonStyle(.plain)
                            .disabled(!store.canEdit)
                            .accessibilityLabel(reminder.title)
                            Text(reminder.title)
                                .font(NS.sans(16, .medium))
                                .strikethrough(reminder.isDone ?? false)
                                .foregroundStyle((reminder.isDone ?? false) ? NS.muted : NS.ink)
                                .lineLimit(2)
                            Spacer()
                            if let due = reminder.dueDate, !(reminder.isDone ?? false) {
                                Text(Fmt.short(due)).font(NS.mono(13, due < today ? .semibold : .medium)).foregroundStyle(due < today ? NS.stop : NS.muted)
                            }
                        }
                        .frame(minHeight: 40)
                        .contentShape(Rectangle())
                        .onTapGesture { if store.canEdit { renaming = RenameTarget(id: reminder.id, isPacking: false, text: reminder.title) } }
                        .swipeActions(allowsFullSwipe: false) {
                            if store.canEdit {
                                Button { pendingDelete = PendingDelete(title: reminder.title) { Task { await store.deleteReminder(reminder.id) } } } label: { Label("Delete", systemImage: "trash") }
                                    .tint(NS.stop)
                            }
                        }
                    }
                } else {
                    ForEach(groups, id: \.key) { group in
                        Section(header: Text(group.key.uppercased()).font(NS.sans(12, .bold)).tracking(1).foregroundStyle(NS.muted)) {
                            ForEach(group.value.sorted {
                                if checkedToBottom {
                                    let a = packingSettler.sortState($0.id, $0.isPacked ?? false), b = packingSettler.sortState($1.id, $1.isPacked ?? false)
                                    if a != b { return !a }
                                }
                                return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
                            }) { item in
                                HStack(spacing: 14) {
                                    Button {
                                        let next = !(item.isPacked ?? false)
                                        packingSettler.toggled(item.id, from: !next)
                                        Task { await store.updatePacking(item.id, patch: ["isPacked": .bool(next)]) { $0.isPacked = next } }
                                    } label: { CheckBox(checked: item.isPacked ?? false) }
                                    .buttonStyle(.plain)
                                    .disabled(!store.canEdit)
                                    .accessibilityLabel(item.name)
                                    Text(item.name)
                                        .font(NS.sans(16, .medium))
                                        .strikethrough(item.isPacked ?? false)
                                        .foregroundStyle((item.isPacked ?? false) ? NS.muted : NS.ink)
                                    Spacer()
                                    Text("×\(item.quantity ?? 1)").font(NS.mono(13)).foregroundStyle(NS.muted)
                                }
                                .frame(minHeight: 40)
                                .contentShape(Rectangle())
                                .onTapGesture { if store.canEdit { renaming = RenameTarget(id: item.id, isPacking: true, text: item.name) } }
                                .swipeActions(allowsFullSwipe: false) {
                                    if store.canEdit {
                                        Button { pendingDelete = PendingDelete(title: item.name) { Task { await store.deletePacking(item.id) } } } label: { Label("Delete", systemImage: "trash") }
                                            .tint(NS.stop)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.plain)
            .toolbar(.hidden, for: .navigationBar)
            .scrollDismissesKeyboard(.interactively)
            .confirmDelete($pendingDelete)
            .refreshable { await store.refresh() }
            .alert("Rename", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
                TextField("Name", text: Binding(get: { renaming?.text ?? "" }, set: { renaming?.text = $0 }))
                Button("Save") {
                    guard let target = renaming else { return }
                    let value = target.text.trimmingCharacters(in: .whitespaces)
                    guard !value.isEmpty else { return }
                    Task {
                        if target.isPacking { await store.updatePacking(target.id, patch: ["name": .string(value)]) { $0.name = value } }
                        else { await store.updateReminder(target.id, patch: ["title": .string(value)]) { $0.title = value } }
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }
}
