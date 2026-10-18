import ClerkKit
import ClerkKitUI
import SwiftUI

@main
struct NorthstarApp: App {
    init() {
        let key = (Bundle.main.object(forInfoDictionaryKey: "ClerkPublishableKey") as? String) ?? ""
        Clerk.configure(publishableKey: key)
        _ = Connectivity.shared
        APIClient.shared.tokenProvider = {
            try await Clerk.shared.auth.getToken()
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(Clerk.shared)
                .tint(NS.ink)
        }
    }
}

struct RootView: View {
    @Environment(Clerk.self) private var clerk
    @State private var store = TripStore()

    var body: some View {
        Group {
            if !clerk.isLoaded {
                LaunchView()
            } else if clerk.user != nil {
                MainView()
                    .environment(store)
                    .task(id: clerk.user?.id) { await store.load() }
            } else {
                SignInView()
            }
        }
        .onOpenURL { url in Task { try? await clerk.handle(url) } }
        .onAppear { KeyboardDismisser.shared.install() }
    }
}

struct LaunchView: View {
    var body: some View {
        ZStack {
            Color.white.ignoresSafeArea()
            StarShape().fill(NS.ink).frame(width: 44, height: 44)
                .overlay(Circle().fill(NS.lane).frame(width: 8, height: 8))
        }
    }
}
