import SwiftUI

struct AskScreen: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let draft: AskDraft?

    @State private var messages: [AIMessage] = []
    @State private var text = ""
    @State private var status: String?
    @State private var task: Task<Void, Never>?
    @State private var undoing: Int?
    @State private var conversations: [AIConversation] = []
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
                        if let status {
                            HStack(spacing: 10) {
                                ProgressView().tint(NS.ink)
                                Text("\(status)…").font(NS.sans(15, .semibold)).foregroundStyle(NS.muted)
                            }
                        }
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding(.horizontal, 16)
                }
                .onChange(of: messages) { _, _ in withAnimation { proxy.scrollTo("bottom") } }
                .onChange(of: status) { _, _ in withAnimation { proxy.scrollTo("bottom") } }
            }
            composer
        }
        .background(Color.white)
        .task {
            if let id = store.askConversationId, messages.isEmpty {
                messages = (try? await APIClient.shared.send("/api/ai/history/\(id)")) ?? []
            }
            if let draft {
                if draft.autoSend { send(draft.text) } else { text = draft.text }
            } else {
                focused = true
            }
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            StarShape().fill(NS.ink).frame(width: 20, height: 20).overlay(Circle().fill(NS.lane).frame(width: 4, height: 4))
            Text("Ask Northstar").font(NS.sans(17, .bold))
            Spacer()
            Menu {
                Button {
                    store.askConversationId = nil
                    messages = []
                } label: { Label("New chat", systemImage: "plus") }
                ForEach(conversations) { conversation in
                    Button(conversation.title) { Task { await open(conversation.id) } }
                }
            } label: {
                Image(systemName: "clock.arrow.circlepath").font(.system(size: 15, weight: .semibold)).frame(width: 34, height: 34).overlay(Circle().stroke(NS.line))
            }
            .accessibilityLabel("Chats")
            .simultaneousGesture(TapGesture().onEnded { Task { conversations = (try? await APIClient.shared.send("/api/ai/conversations")) ?? [] } })
            Button { task?.cancel(); dismiss() } label: {
                Image(systemName: "xmark").font(.system(size: 15, weight: .semibold)).frame(width: 34, height: 34).overlay(Circle().stroke(NS.line))
            }
            .accessibilityLabel("Close")
        }
        .foregroundStyle(NS.ink)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
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
                    if running { task?.cancel(); status = nil } else { send(text) }
                } label: {
                    Image(systemName: running ? "stop.fill" : "arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(NS.ink)
                        .frame(width: 40, height: 40)
                        .background(Circle().fill(running ? Color.white : NS.lane))
                }
                .accessibilityLabel(running ? "Stop" : "Send")
            }
            .padding(.leading, 18).padding(.trailing, 6).padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(NS.ink))
            .padding(.horizontal, 12)
        }
        .padding(.top, 8)
        .padding(.bottom, 8)
    }

    // MARK: Actions

    private func open(_ id: Int) async {
        store.askConversationId = id
        messages = (try? await APIClient.shared.send("/api/ai/history/\(id)")) ?? []
    }

    private func send(_ raw: String) {
        let message = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty, !running else { return }
        text = ""
        messages.append(AIMessage(id: -Int(Date().timeIntervalSince1970), role: "user", content: message, cards: [], followups: [], metadata: nil))
        status = "Thinking"
        let before = store.bundle
        task = Task { await stream(message, before: before) }
    }

    private func stream(_ message: String, before: TripBundle?) async {
        defer { status = nil }
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
                case "conversation":
                    if let conversation = event["conversation"] as? [String: Any], let id = conversation["id"] as? Int { store.askConversationId = id }
                case "message_start":
                    if let raw = event["message"], let json = try? JSONSerialization.data(withJSONObject: raw), var msg = try? JSONDecoder().decode(AIMessage.self, from: json) {
                        msg.content = ""
                        messages.append(msg)
                        assistantIndex = messages.count - 1
                        status = nil
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
        } catch {
            if !Task.isCancelled { store.errorMessage = error.localizedDescription }
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
