import SwiftUI

enum AppTab: Hashable { case plan, lists, budget, ask }

struct MainView: View {
    @Environment(TripStore.self) private var store
    @State private var tab: AppTab = .plan

    var body: some View {
        @Bindable var store = store
        Group {
            if store.bundle == nil {
                if let message = store.errorMessage {
                    ErrorStateView(message: message) { Task { await store.load() } }
                } else {
                    LaunchView()
                }
            } else {
                TabView(selection: $tab) {
                    PlanScreen(onAsk: { draft in store.pendingAskDraft = draft; tab = .ask })
                        .tabItem { Label("Plan", systemImage: "map") }
                        .tag(AppTab.plan)
                    ListsScreen()
                        .tabItem { Label("Lists", systemImage: "checklist") }
                        .tag(AppTab.lists)
                    BudgetScreen()
                        .tabItem { Label("Budget", systemImage: "creditcard") }
                        .tag(AppTab.budget)
                    if store.canEdit {
                        AskScreen()
                            .tabItem { Label("Ask", systemImage: "sparkles") }
                            .tag(AppTab.ask)
                    }
                }
            }
        }
        .onChange(of: store.canEdit) { _, canEdit in if !canEdit && tab == .ask { tab = .plan } }
        .alert("Something went wrong", isPresented: Binding(
            get: { store.errorMessage != nil && store.bundle != nil },
            set: { if !$0 { store.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "")
        }
    }
}

struct AskDraft: Identifiable, Equatable {
    let id = UUID()
    let text: String
    let autoSend: Bool
}

struct ErrorStateView: View {
    let message: String
    let retry: () -> Void
    var body: some View {
        VStack(spacing: 16) {
            Text("Couldn't load your trip").font(NS.sans(20, .bold))
            Text(message).font(NS.sans(15)).foregroundStyle(NS.muted).multilineTextAlignment(.center)
            Button("Try again", action: retry).buttonStyle(PillButtonStyle(tone: .ink))
        }
        .padding(32)
    }
}
