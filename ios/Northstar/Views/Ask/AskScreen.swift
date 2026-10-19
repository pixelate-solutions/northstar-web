import PhotosUI
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
    @State private var focused = false
    @State private var composerHeight: CGFloat = 44
    @State private var attachments: [ChatAttachment] = []
    /// Photos and files sent this session, so they open without downloading.
    @State private var sentFiles: [Int: [ChatAttachment]] = [:]
    @State private var viewing: Viewing?
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var choosingPhotos = false
    @State private var choosingFiles = false
    @State private var takingPhoto = false

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
                                    VStack(alignment: .trailing, spacing: 6) {
                                        let sent = ViewableAttachment.list(for: message, local: sentFiles[message.id] ?? [])
                                        if !sent.isEmpty {
                                            SentAttachmentsRow(items: sent, onOpen: { viewing = Viewing(items: sent, index: $0) }, onError: { store.errorMessage = $0 })
                                        }
                                        if !message.content.isEmpty {
                                            HStack {
                                                Spacer(minLength: 40)
                                                let bubble = UnevenRoundedRectangle(topLeadingRadius: 18, bottomLeadingRadius: 18, bottomTrailingRadius: 4, topTrailingRadius: 18)
                                                Text(message.content)
                                                    .font(NS.sans(16, .medium))
                                                    .padding(.horizontal, 16).padding(.vertical, 12)
                                                    .background(bubble.fill(NS.surface))
                                                    .contentShape(.contextMenuPreview, bubble)
                                                    .contextMenu { CopyButton(text: message.content) }
                                            }
                                        }
                                    }
                                    .frame(maxWidth: .infinity, alignment: .trailing)
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
        .fullScreenCover(item: $viewing) { viewing in
            AttachmentViewer(items: viewing.items, index: viewing.index) { store.errorMessage = $0 }
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
            if !attachments.isEmpty {
                PendingAttachmentsRow(attachments: attachments) { removed in attachments.removeAll { $0.id == removed.id } }
                    .padding(.horizontal, 12)
            }
            HStack(alignment: .bottom, spacing: 8) {
                Menu {
                    Button { choosingPhotos = true } label: { Label("Photo Library", systemImage: "photo.on.rectangle") }
                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        Button { takingPhoto = true } label: { Label("Take Photo", systemImage: "camera") }
                    }
                    Button { choosingFiles = true } label: { Label("Choose File", systemImage: "folder") }
                    if UIPasteboard.general.hasImages || UIPasteboard.general.hasURLs {
                        Button { pasteFromClipboard() } label: { Label("Paste", systemImage: "doc.on.clipboard") }
                    }
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Color(white: 0.75))
                        .frame(width: 34, height: 44)
                }
                .accessibilityLabel("Attach")
                .accessibilityIdentifier("ask-attach")
                ComposerTextView(text: $text, height: $composerHeight, isFocused: $focused, placeholder: "Ask Northstar") { pasted in
                    add(pasted)
                }
                .frame(height: composerHeight)
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
            .padding(.leading, 8).padding(.trailing, 6).padding(.vertical, 6)
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
        .photosPicker(isPresented: $choosingPhotos, selection: $photoItems, maxSelectionCount: AttachmentUploader.maxPerMessage, matching: .images)
        .onChange(of: photoItems) { _, items in
            guard !items.isEmpty else { return }
            photoItems = []
            Task {
                var added: [ChatAttachment] = []
                for item in items {
                    if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data), let attachment = ChatAttachment.image(image) {
                        added.append(attachment)
                    }
                }
                add(added)
            }
        }
        .fileImporter(isPresented: $choosingFiles, allowedContentTypes: ChatAttachment.importableTypes, allowsMultipleSelection: true) { result in
            if case .success(let urls) = result { add(urls.compactMap(ChatAttachment.file(at:))) }
        }
        .fullScreenCover(isPresented: $takingPhoto) {
            CameraPicker { image in if let attachment = ChatAttachment.image(image) { add([attachment]) } }
                .ignoresSafeArea()
        }
    }

    // MARK: Attachments

    private func add(_ new: [ChatAttachment]) {
        guard !new.isEmpty else { return }
        let room = AttachmentUploader.maxPerMessage - attachments.count
        if new.count > room { store.errorMessage = "Attach up to \(AttachmentUploader.maxPerMessage) files per message." }
        for attachment in new.prefix(max(0, room)) {
            attachments.append(attachment)
            attachment.startUpload()
        }
    }

    private func pasteFromClipboard() {
        let board = UIPasteboard.general
        var pasted = (board.images ?? []).compactMap { ChatAttachment.image($0, name: "Pasted photo") }
        pasted += (board.urls ?? []).filter(\.isFileURL).compactMap(ChatAttachment.file(at:))
        add(pasted)
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
        let sending = attachments
        guard !message.isEmpty || !sending.isEmpty, !running else { return }
        if let failed = sending.first(where: { $0.error != nil }) {
            store.errorMessage = "\(failed.filename) didn't upload. Remove it or attach it again."
            return
        }
        if !sending.isEmpty && useOnDevice && !Connectivity.shared.isOnline {
            store.errorMessage = "Photos and files need a connection; the offline assistant can't read them."
            return
        }
        text = ""
        attachments = []
        let messageId = -Int(Date().timeIntervalSince1970)
        var metadata: AIMessage.Metadata?
        if !sending.isEmpty {
            metadata = AIMessage.Metadata(attachments: sending.map { .init(filename: $0.filename, mimeType: $0.mimeType, kind: $0.isImage ? "image" : "file") })
            sentFiles[messageId] = sending
        }
        messages.append(AIMessage(id: messageId, role: "user", content: message, cards: [], followups: [], metadata: metadata))
        status = "Thinking"
        liveSteps = []
        let before = store.bundle
        if useOnDevice && !Connectivity.shared.isOnline {
            task = Task { await respondOnDevice(message) }
        } else {
            task = Task { await stream(message, attachments: sending, before: before) }
        }
    }

    private func stream(_ message: String, attachments sending: [ChatAttachment] = [], before: TripBundle?) async {
        defer { if !Task.isCancelled { status = nil; liveSteps = [] } }
        do {
            var body: [String: JSON] = ["message": .string(message)]
            if !sending.isEmpty {
                status = "Uploading"
                var refs: [JSON] = []
                for attachment in sending { refs.append(.string(try await attachment.uploadedRef())) }
                body["attachments"] = .array(refs)
                status = "Thinking"
            }
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
                let text = (try? AttributedString(markdown: message.content, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(message.content)
                Text(text)
                    .font(NS.sans(16, .medium))
                    .lineSpacing(3)
                    .contentShape(.contextMenuPreview, RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .contextMenu { CopyButton(text: String(text.characters)) }
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

// MARK: Attachment views

/// Attachments waiting to be sent: photo thumbnails or file chips, with upload progress and remove.
struct PendingAttachmentsRow: View {
    let attachments: [ChatAttachment]
    let onRemove: (ChatAttachment) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(attachments) { attachment in
                    ZStack(alignment: .topTrailing) {
                        Group {
                            if let thumbnail = attachment.thumbnail {
                                Image(uiImage: thumbnail).resizable().scaledToFill().frame(width: 64, height: 64)
                            } else {
                                HStack(spacing: 6) {
                                    Image(systemName: "doc.text").font(.system(size: 14, weight: .semibold)).foregroundStyle(NS.muted)
                                    Text(attachment.filename).font(NS.sans(13, .semibold)).lineLimit(1).frame(maxWidth: 150, alignment: .leading)
                                }
                                .padding(.horizontal, 10).frame(height: 64)
                            }
                        }
                        .background(NS.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(alignment: .bottom) {
                            if attachment.progress < 1 && attachment.error == nil {
                                ProgressView(value: attachment.progress).tint(NS.ink).padding(.horizontal, 6).padding(.bottom, 4)
                            }
                        }
                        .overlay {
                            if attachment.error != nil {
                                RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(NS.stop, lineWidth: 2)
                            }
                        }
                        Button { onRemove(attachment) } label: {
                            Image(systemName: "xmark").font(.system(size: 9, weight: .bold)).foregroundStyle(.white)
                                .frame(width: 20, height: 20).background(Circle().fill(NS.ink.opacity(0.8)))
                        }
                        .padding(4)
                        .accessibilityLabel("Remove \(attachment.filename)")
                    }
                    .accessibilityElement(children: .contain)
                    .accessibilityIdentifier("pending-attachment")
                }
            }
            .padding(.vertical, 2)
        }
    }
}

/// Photos and files shown with a sent message. Tap to open full screen; press and hold to save or share.
struct SentAttachmentsRow: View {
    let items: [ViewableAttachment]
    let onOpen: (Int) -> Void
    let onError: (String) -> Void

    @State private var content: CGRect = .zero
    @State private var visibleWidth: CGFloat = 0

    var body: some View {
        // Fits on one line when it can; scrolls when there are many, fading out at whichever edge has more to see.
        ViewThatFits(in: .horizontal) {
            row.padding(.leading, 40)
            ScrollView(.horizontal, showsIndicators: false) {
                row.onGeometryChange(for: CGRect.self) { $0.frame(in: .named("sent-row")) } action: { content = $0 }
            }
            .defaultScrollAnchor(.trailing)
            .coordinateSpace(.named("sent-row"))
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { visibleWidth = $0 }
            .mask(fade)
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    private var fade: some View {
        let leading = content.minX < -1
        let trailing = content.maxX > visibleWidth + 1
        return HStack(spacing: 0) {
            LinearGradient(colors: [.clear, .black], startPoint: .leading, endPoint: .trailing).frame(width: leading ? 36 : 0)
            Rectangle()
            LinearGradient(colors: [.black, .clear], startPoint: .leading, endPoint: .trailing).frame(width: trailing ? 36 : 0)
        }
        .animation(.easeOut(duration: 0.15), value: leading)
        .animation(.easeOut(duration: 0.15), value: trailing)
    }

    private var row: some View {
            HStack(spacing: 6) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    Button { onOpen(index) } label: {
                        if item.isImage && (item.thumbnail != nil || item.remotePath != nil) {
                            AttachmentThumbnail(item: item, size: items.count == 1 ? 180 : 96, keepsShape: items.count == 1)
                        } else {
                            HStack(spacing: 6) {
                                Image(systemName: item.isImage ? "photo" : "doc.text").font(.system(size: 13, weight: .semibold)).foregroundStyle(NS.muted)
                                Text(item.filename).font(NS.sans(13, .semibold)).lineLimit(1)
                            }
                            .foregroundStyle(NS.ink)
                            .padding(.horizontal, 10).frame(height: 36)
                            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(NS.surface))
                            .contentShape(.contextMenuPreview, RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                    }
                    .buttonStyle(.plain)
                    .contextMenu { AttachmentMenu(item: item, onError: onError) }
                    .accessibilityLabel(item.filename)
                    .accessibilityIdentifier("sent-attachment")
                }
            }
    }
}

struct Viewing: Identifiable {
    let id = UUID()
    let items: [ViewableAttachment]
    let index: Int
}

struct CopyButton: View {
    let text: String
    var body: some View {
        Button { UIPasteboard.general.string = text } label: { Label("Copy", systemImage: "doc.on.doc") }
    }
}

/// System camera for "Take Photo".
struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage { parent.onImage(image) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}
