import SwiftUI

struct AskScreen: View {
    @Environment(TripStore.self) private var store

    @State private var messages: [AIMessage] = []
    @State private var text = ""
    @State private var status: String?
    @State private var liveSteps: [AIMessage.Step] = []
    @State private var task: Task<Void, Never>?
    @State private var undoing: Int?
    @State private var conversations: [AIConversation] = []
    @State private var historyOpen = false
    @State private var loadedConversationId: Int?
    @State private var useOnDevice = false
    @State private var offerOnDevice: String?
    @State private var onDeviceAssistant: AnyObject?
    @FocusState private var focused: Bool

    private var running: Bool { status != nil }

    private var suggestions: [String] {
        if let followups = messages.last(where: { $0.role == "assistant" })?.followups, !followups.isEmpty { return Array(followups.prefix(3)) }
        let empty = store.days.first { $0.events.isEmpty }
        return [
            empty.map { "Plan Day \($0.dayNumber)\($0.location.isEmpty ? "" : " in \($0.location)")" } ?? "Tighten up tomorrow's plan",
            "Build a packing list for this trip",
            "What still needs to be booked?",
        ]
    }

    var body: some View {
        ZStack(alignment: .leading) {
            VStack(spacing: 0) {
                header
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            if messages.isEmpty && !running {
                                Text("What should we change?").font(NS.display(28)).tracking(-1).padding(.top, 40)
                            }
                            ForEach(messages) { message in
                                if message.role == "user" {
                                    HStack {
                                        Spacer(minLength: 40)
                                        Text(message.content)
                                            .font(NS.sans(16, .medium))
                                            .padding(.horizontal, 16).padding(.vertical, 12)
                                            .background(UnevenRoundedRectangle(topLeadingRadius: 18, bottomLeadingRadius: 18, bottomTrailingRadius: 4, topTrailingRadius: 18).fill(NS.surface))
                                    }
                                } else {
                                    AssistantMessageView(message: message, undoing: undoing == message.id) { Task { await undo(message) } }
                                }
                            }
                            if running {
                                ThinkingView(steps: liveSteps)
                            }
                            Color.clear.frame(height: 1).id("bottom")
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .fadedEdges(.vertical, length: 22)
                    .onChange(of: messages) { _, _ in withAnimation { proxy.scrollTo("bottom") } }
                    .onChange(of: liveSteps.count) { _, _ in withAnimation { proxy.scrollTo("bottom") } }
                    .onChange(of: status) { _, _ in withAnimation { proxy.scrollTo("bottom") } }
                }
                composer
            }
            .background(Color.white)

            if historyOpen {
                Color.black.opacity(0.25)
                    .ignoresSafeArea()
                    .onTapGesture { closeHistory() }
                    .transition(.opacity)
                HistoryDrawer(
                    conversations: conversations,
                    currentId: store.askConversationId,
                    onNew: { newChat(); closeHistory() },
                    onOpen: { id in closeHistory(); Task { await open(id) } },
                    onClose: closeHistory
                )
                .transition(.move(edge: .leading))
                .zIndex(1)
            }
        }
        .overlay(alignment: .leading) {
            // Swipe in from the left edge to open chats.
            if !historyOpen {
                Color.clear
                    .frame(width: 16)
                    .contentShape(Rectangle())
                    .gesture(DragGesture(minimumDistance: 10).onEnded { if $0.translation.width > 50 { openHistory() } })
            }
        }
        .task(id: store.bundle?.trip.id) {
            // A different trip has its own chats.
            if loadedConversationId != store.askConversationId {
                messages = []
                if let id = store.askConversationId { await open(id) }
            }
        }
        .onAppear(perform: consumeDraft)
        .onChange(of: store.pendingAskDraft) { _, _ in consumeDraft() }
        .onChange(of: Connectivity.shared.isOnline) { _, online in if online { useOnDevice = false } }
        .alert("You're offline", isPresented: Binding(get: { offerOnDevice != nil }, set: { if !$0 { offerOnDevice = nil } })) {
            Button("Use offline assistant") {
                let prompt = offerOnDevice ?? ""
                offerOnDevice = nil
                useOnDevice = true
                if let last = messages.last, last.role == "user", last.content == prompt { messages.removeLast() }
                send(prompt)
            }
            Button("Not now", role: .cancel) { offerOnDevice = nil }
        } message: {
            Text("Northstar's assistant needs the internet. Switch to the on-device assistant? It's simpler, but works offline and can still edit your plan.")
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            Button(action: openHistory) {
                Image(systemName: "line.3.horizontal").font(.system(size: 17, weight: .semibold)).frame(width: 40, height: 40)
            }
            .accessibilityLabel("Chats")
            Spacer()
            HStack(spacing: 8) {
                StarShape().fill(NS.ink).frame(width: 18, height: 18).overlay(Circle().fill(NS.lane).frame(width: 4, height: 4))
                Text("Ask Northstar").font(NS.sans(17, .bold))
            }
            Spacer()
            Button(action: newChat) {
                Image(systemName: "square.and.pencil").font(.system(size: 17, weight: .semibold)).frame(width: 40, height: 40)
            }
            .accessibilityLabel("New chat")
            .disabled(messages.isEmpty && !running)
        }
        .foregroundStyle(NS.ink)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
    }

    private var composer: some View {
        VStack(spacing: 10) {
            if !running {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(suggestions, id: \.self) { suggestion in
                            Button(suggestion) { send(suggestion) }
                                .font(NS.sans(14, .semibold))
                                .foregroundStyle(NS.ink)
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .overlay(Capsule().stroke(NS.line))
                        }
                    }
                    .padding(.horizontal, 12)
                }
                .fadedEdges(.horizontal, length: 12)
            }
            HStack(alignment: .bottom, spacing: 10) {
                TextField("", text: $text, prompt: Text("Ask Northstar").foregroundStyle(Color(white: 0.64)), axis: .vertical)
                    .lineLimit(1...6)
                    .font(NS.sans(16, .medium))
                    .foregroundStyle(.white)
                    .tint(NS.lane)
                    .focused($focused)
                    .padding(.vertical, 10)
                    .submitLabel(.send)
                    .onSubmit { send(text) }
                Button {
                    if running { task?.cancel(); status = nil; liveSteps = [] } else { send(text) }
                } label: {
                    Image(systemName: running ? "stop.fill" : "arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(NS.ink)
                        .frame(width: 40, height: 40)
                        .background(Circle().fill(running ? Color.white : NS.lane))
                }
                .accessibilityLabel(running ? "Stop" : "Send")
                .accessibilityIdentifier("ask-send")
            }
            .padding(.leading, 18).padding(.trailing, 6).padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(NS.ink))
            .padding(.horizontal, 12)
            .simultaneousGesture(
                // Swipe down on the input to put the keyboard away.
                DragGesture(minimumDistance: 12).onEnded { value in
                    if value.translation.height > 24 { focused = false }
                }
            )
        }
        .padding(.top, 8)
        .padding(.bottom, 8)
    }

    // MARK: History

    private func openHistory() {
        focused = false
        withAnimation(.spring(response: 0.32, dampingFraction: 0.9)) { historyOpen = true }
        Task { conversations = (try? await APIClient.shared.send("/api/ai/conversations")) ?? conversations }
    }

    private func closeHistory() {
        withAnimation(.spring(response: 0.32, dampingFraction: 0.9)) { historyOpen = false }
    }

    private func newChat() {
        task?.cancel()
        status = nil
        liveSteps = []
        store.askConversationId = nil
        loadedConversationId = nil
        messages = []
    }

    private func consumeDraft() {
        guard let draft = store.pendingAskDraft else { return }
        store.pendingAskDraft = nil
        if draft.autoSend {
            if running { task?.cancel(); status = nil }
            send(draft.text)
        } else {
            text = draft.text
        }
    }

    // MARK: Actions

    private func open(_ id: Int) async {
        task?.cancel()
        status = nil
        liveSteps = []
        store.askConversationId = id
        loadedConversationId = id
        messages = (try? await APIClient.shared.send("/api/ai/history/\(id)")) ?? []
    }

    private func send(_ raw: String) {
        let message = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty, !running else { return }
        text = ""
        messages.append(AIMessage(id: -Int(Date().timeIntervalSince1970), role: "user", content: message, cards: [], followups: [], metadata: nil))
        status = "Thinking"
        liveSteps = []
        let before = store.bundle
        if useOnDevice && !Connectivity.shared.isOnline {
            task = Task { await respondOnDevice(message) }
        } else {
            task = Task { await stream(message, before: before) }
        }
    }

    private func stream(_ message: String, before: TripBundle?) async {
        defer { if !Task.isCancelled { status = nil; liveSteps = [] } }
        do {
            var body: [String: JSON] = ["message": .string(message)]
            if let id = store.askConversationId { body["conversationId"] = .int(id) }
            let request = try await APIClient.shared.request("/api/ai/chat", method: "POST", body: body)
            let (bytes, response) = try await URLSession.shared.bytes(for: request)
            guard ((response as? HTTPURLResponse)?.statusCode ?? 0) < 300 else { throw APIError(message: "Northstar couldn't respond.", status: 0) }
            var assistantIndex: Int?
            for try await line in bytes.lines {
                guard let data = line.data(using: .utf8), let event = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let type = event["type"] as? String else { continue }
                switch type {
                case "status":
                    let value = event["value"] as? String ?? "Thinking"
                    status = value == "thinking" ? "Thinking" : value
                case "step":
                    if let step = event["step"] as? [String: Any], let kind = step["kind"] as? String, let text = step["text"] as? String {
                        liveSteps.append(.init(kind: kind, text: text))
                    }
                case "conversation":
                    if let conversation = event["conversation"] as? [String: Any], let id = conversation["id"] as? Int {
                        store.askConversationId = id
                        loadedConversationId = id
                    }
                case "message_start":
                    if let raw = event["message"], let json = try? JSONSerialization.data(withJSONObject: raw), var msg = try? JSONDecoder().decode(AIMessage.self, from: json) {
                        msg.content = ""
                        messages.append(msg)
                        assistantIndex = messages.count - 1
                        status = nil
                        liveSteps = []
                    }
                case "text_delta":
                    if let i = assistantIndex, let delta = event["delta"] as? String { messages[i].content += delta }
                case "cards":
                    if let i = assistantIndex, let raw = event["cards"], let json = try? JSONSerialization.data(withJSONObject: raw), let cards = try? JSONDecoder().decode([AICard].self, from: json) {
                        messages[i].cards = cards
                    }
                case "followups":
                    if let i = assistantIndex, let followups = event["followups"] as? [String] { messages[i].followups = followups }
                case "error":
                    throw APIError(message: event["error"] as? String ?? "Northstar couldn't respond.", status: 0)
                default:
                    break
                }
            }
            if let i = assistantIndex, messages[i].cards.contains(where: { $0.type == "mutation" }) {
                await store.refresh()
                store.highlightedStopIds = changedStops(before: before, after: store.bundle)
                Task {
                    try? await Task.sleep(for: .seconds(12))
                    store.highlightedStopIds = []
                }
            }
        } catch is CancellationError {
        } catch where isOfflineError(error) && !Task.isCancelled {
            // Offer the on-device model only when this phone can run it.
            if let reason = OfflineAI.unavailableReason {
                store.errorMessage = "You're offline. \(reason)"
            } else {
                offerOnDevice = message
            }
        } catch {
            if !Task.isCancelled { store.errorMessage = error.localizedDescription }
        }
    }

    private func respondOnDevice(_ message: String) async {
        guard #available(iOS 26.0, *) else { return }
        defer { if !Task.isCancelled { status = nil; liveSteps = [] } }
        let started = Date()
        let assistant: OfflineAssistant
        if let existing = onDeviceAssistant as? OfflineAssistant {
            assistant = existing
        } else {
            assistant = OfflineAssistant(store: store) { step in liveSteps.append(step) }
            onDeviceAssistant = assistant
        }
        var index: Int?
        do {
            _ = try await assistant.respond(to: message) { text in
                if let i = index {
                    messages[i].content = text
                } else {
                    let metadata = AIMessage.Metadata(onDevice: true)
                    messages.append(AIMessage(id: -Int(Date().timeIntervalSince1970 * 10), role: "assistant", content: text, cards: [], followups: [], metadata: metadata))
                    index = messages.count - 1
                }
            }
            if let i = index {
                messages[i].metadata?.steps = liveSteps
                messages[i].metadata?.thoughtMs = Date().timeIntervalSince(started) * 1000
            }
        } catch {
            if !Task.isCancelled { store.errorMessage = "The offline assistant couldn't answer. \(OfflineAI.describe(error))" }
        }
    }

    private func changedStops(before: TripBundle?, after: TripBundle?) -> Set<Int> {
        let old = Dictionary(uniqueKeysWithValues: (before?.days ?? []).flatMap(\.events).map { ($0.id, "\($0.updatedAt ?? "")|\($0.dayId)|\($0.sortOrder ?? 0)") })
        return Set((after?.days ?? []).flatMap(\.events).filter { old[$0.id] != "\($0.updatedAt ?? "")|\($0.dayId)|\($0.sortOrder ?? 0)" }.map(\.id))
    }

    private func undo(_ message: AIMessage) async {
        guard let conversationId = store.askConversationId else { return }
        undoing = message.id
        defer { undoing = nil }
        struct Response: Decodable { let message: AIMessage }
        do {
            let response: Response = try await APIClient.shared.send("/api/ai/messages/\(message.id)/undo", method: "POST", headers: ["x-ai-conversation-id": String(conversationId)])
            if let i = messages.firstIndex(where: { $0.id == message.id }) { messages[i].metadata = response.message.metadata }
            store.highlightedStopIds = []
            await store.refresh()
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }
}

struct AssistantMessageView: View {
    let message: AIMessage
    let undoing: Bool
    let onUndo: () -> Void

    var body: some View {
        let changes = message.cards.filter { $0.type == "mutation" }.flatMap { ($0.changes?.isEmpty == false ? $0.changes! : [$0.title ?? ""]) }
        let undone = message.metadata?.undoApplied ?? false
        VStack(alignment: .leading, spacing: 14) {
            if message.metadata?.onDevice == true {
                Label("On-device", systemImage: "iphone")
                    .font(NS.sans(12, .bold))
                    .foregroundStyle(NS.muted)
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .background(Capsule().fill(NS.surface))
            }
            if let ms = message.metadata?.thoughtMs {
                ThoughtDisclosure(seconds: Int((ms / 1000).rounded()), steps: message.metadata?.steps ?? [])
            }
            if !message.content.isEmpty {
                Text((try? AttributedString(markdown: message.content, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(message.content))
                    .font(NS.sans(16, .medium))
                    .lineSpacing(3)
            }
            if !changes.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Text("\(changes.count) change\(changes.count == 1 ? "" : "s")").font(NS.sans(15, .bold))
                        Spacer()
                        if undone { Text("Undone").font(NS.mono(12)).foregroundStyle(NS.muted) }
                    }
                    .padding(16)
                    Divider()
                    ForEach(Array(changes.prefix(12).enumerated()), id: \.offset) { _, change in
                        HStack(alignment: .top, spacing: 12) {
                            RoundedRectangle(cornerRadius: 5).fill(NS.lane).frame(width: 18, height: 18)
                                .overlay(Circle().fill(NS.ink).frame(width: 6, height: 6))
                            Text(change).font(NS.sans(14, .medium)).strikethrough(undone).foregroundStyle(undone ? NS.muted : NS.ink)
                        }
                        .padding(.horizontal, 16).padding(.vertical, 9)
                    }
                    if (message.metadata?.undoable ?? false) && !undone {
                        Button(action: onUndo) {
                            Label(undoing ? "Undoing…" : "Undo", systemImage: "arrow.uturn.backward")
                                .font(NS.sans(14, .semibold))
                                .padding(.horizontal, 18).padding(.vertical, 10)
                                .overlay(Capsule().stroke(NS.line))
                        }
                        .foregroundStyle(NS.ink)
                        .disabled(undoing)
                        .padding(16)
                    }
                }
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(NS.line))
            }
            if let sources = message.metadata?.sources, !sources.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(sources, id: \.url) { source in
                            if let url = URL(string: source.url) {
                                Link(url.host?.replacingOccurrences(of: "www.", with: "") ?? source.title, destination: url)
                                    .font(NS.sans(13, .semibold))
                                    .foregroundStyle(NS.ink)
                                    .padding(.horizontal, 10).padding(.vertical, 5)
                                    .background(Capsule().fill(NS.surface))
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Pulsing dot that stands in for a spinner.
struct PulsingDot: View {
    @State private var pulse = false
    var body: some View {
        Circle()
            .fill(NS.ink)
            .frame(width: 12, height: 12)
            .scaleEffect(pulse ? 1 : 0.6)
            .opacity(pulse ? 1 : 0.45)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) { pulse = true }
            }
            .accessibilityLabel("Thinking")
    }
}

/// Live view while the assistant works: a pulsing dot, then the actual reasoning and tool calls.
struct ThinkingView: View {
    let steps: [AIMessage.Step]
    @State private var started = Date()

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                PulsingDot()
                if !steps.isEmpty {
                    TimelineView(.periodic(from: started, by: 1)) { context in
                        Text("Thinking · \(Int(context.date.timeIntervalSince(started)))s").font(NS.sans(15, .semibold)).foregroundStyle(NS.muted)
                    }
                }
            }
            if !steps.isEmpty {
                StepList(steps: Array(steps.suffix(8)))
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.2), value: steps.count)
    }
}

/// "Thought for 12 seconds" — expands to the reasoning and tool calls behind the answer.
struct ThoughtDisclosure: View {
    let seconds: Int
    let steps: [AIMessage.Step]
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                guard !steps.isEmpty else { return }
                withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Text("Thought for \(max(1, seconds)) second\(max(1, seconds) == 1 ? "" : "s")")
                    if !steps.isEmpty {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .bold))
                            .rotationEffect(.degrees(expanded ? 90 : 0))
                    }
                }
                .font(NS.sans(14, .semibold))
                .foregroundStyle(NS.muted)
            }
            .buttonStyle(.plain)
            if expanded { StepList(steps: steps) }
        }
    }
}

struct StepList: View {
    let steps: [AIMessage.Step]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(steps.enumerated()), id: \.offset) { _, step in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: symbol(step.kind))
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(step.kind == "result" && step.text.hasPrefix("Error") ? NS.stop : NS.muted)
                        .frame(width: 16, height: 18)
                    if step.kind == "thought" {
                        Text(cleanThought(step.text))
                            .font(NS.sans(14))
                            .foregroundStyle(NS.muted)
                            .lineLimit(4)
                    } else {
                        Text(step.text)
                            .font(NS.mono(12))
                            .foregroundStyle(step.kind == "result" ? NS.muted : NS.ink)
                            .lineLimit(step.kind == "result" ? 2 : 3)
                    }
                }
            }
        }
        .padding(.leading, 2)
        .overlay(alignment: .leading) { Rectangle().fill(NS.line).frame(width: 2).padding(.leading, -8) }
        .padding(.leading, 8)
    }

    private func symbol(_ kind: String) -> String {
        switch kind {
        case "search": "magnifyingglass"
        case "tool": "wrench.and.screwdriver"
        case "result": "arrow.turn.down.right"
        default: "sparkle"
        }
    }

    private func cleanThought(_ text: String) -> String {
        text.replacingOccurrences(of: "**", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

/// Chats slide in from the left, with New chat at the top.
struct HistoryDrawer: View {
    let conversations: [AIConversation]
    let currentId: Int?
    let onNew: () -> Void
    let onOpen: (Int) -> Void
    let onClose: () -> Void
    @State private var drag: CGFloat = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onNew) {
                Label("New chat", systemImage: "square.and.pencil")
                    .font(NS.sans(16, .bold))
                    .foregroundStyle(NS.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .frame(height: 48)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(NS.lane))
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 8)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 2) {
                    ForEach(conversations) { conversation in
                        Button { onOpen(conversation.id) } label: {
                            Text(conversation.title)
                                .font(NS.sans(15, conversation.id == currentId ? .bold : .medium))
                                .foregroundStyle(NS.ink)
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 16)
                                .frame(height: 44)
                                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(conversation.id == currentId ? NS.surface : .clear))
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
            }
            .fadedEdges(.vertical, length: 12)
        }
        .frame(width: min(UIScreen.main.bounds.width * 0.82, 340))
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Color.white.shadow(.drop(color: .black.opacity(0.12), radius: 12, x: 4)))
        .offset(x: min(0, drag))
        .gesture(
            DragGesture(minimumDistance: 10)
                .onChanged { drag = $0.translation.width }
                .onEnded { value in
                    if value.predictedEndTranslation.width < -80 { onClose() }
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.9)) { drag = 0 }
                }
        )
        .accessibilityIdentifier("chat-history")
    }
}
