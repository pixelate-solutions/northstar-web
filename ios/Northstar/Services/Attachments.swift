import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// A photo or file attached to an Ask message. Uploads start as soon as it's added.
@Observable
@MainActor
final class ChatAttachment: Identifiable {
    let id = UUID()
    let filename: String
    let mimeType: String
    let data: Data
    let thumbnail: UIImage?
    var progress: Double = 0
    var error: String?
    private(set) var ref: String?
    private var task: Task<String, Error>?

    var isImage: Bool { mimeType.hasPrefix("image/") }

    init(filename: String, mimeType: String, data: Data, thumbnail: UIImage?) {
        self.filename = filename
        self.mimeType = mimeType
        self.data = data
        self.thumbnail = thumbnail
    }

    func startUpload() {
        guard task == nil else { return }
        task = Task { try await AttachmentUploader.upload(self) }
    }

    /// Waits for the upload and returns the signed reference to send with the message.
    func uploadedRef() async throws -> String {
        startUpload()
        let ref = try await task!.value
        self.ref = ref
        return ref
    }

    // MARK: Making attachments

    /// Photos: converted to JPEG (HEIC isn't readable by the model) and capped at 2048 px on the long side.
    static func image(_ image: UIImage, name: String = "Photo") -> ChatAttachment? {
        let scaled = image.scaledToFit(maxEdge: 2048)
        guard let jpeg = scaled.jpegData(compressionQuality: 0.86) else { return nil }
        let base = name.replacingOccurrences(of: "\\.[^.]+$", with: "", options: .regularExpression)
        return ChatAttachment(filename: "\(base.isEmpty ? "Photo" : base).jpg", mimeType: "image/jpeg", data: jpeg, thumbnail: scaled.scaledToFit(maxEdge: 240))
    }

    /// Files (from Files, paste or share). Images inside are treated as photos.
    static func file(data: Data, filename: String, type: UTType?) -> ChatAttachment? {
        let type = type ?? UTType(filenameExtension: (filename as NSString).pathExtension)
        if let type, type.conforms(to: .image), let image = UIImage(data: data) {
            return Self.image(image, name: filename)
        }
        let mime = type?.preferredMIMEType ?? "application/octet-stream"
        return ChatAttachment(filename: filename, mimeType: mime, data: data, thumbnail: nil)
    }

    static func file(at url: URL) -> ChatAttachment? {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { return nil }
        return file(data: data, filename: url.lastPathComponent, type: UTType(filenameExtension: url.pathExtension))
    }

    /// File types the model can read (images, PDFs, Office/iWork exports, text and code).
    static let importableTypes: [UTType] = {
        var types: [UTType] = [.image, .pdf, .plainText, .commaSeparatedText, .tabSeparatedText, .json, .html, .xml, .rtf, .sourceCode, .text]
        for ext in ["doc", "docx", "odt", "ppt", "pptx", "xls", "xlsx", "md", "markdown", "yaml", "yml"] {
            if let type = UTType(filenameExtension: ext) { types.append(type) }
        }
        return types
    }()
}

enum AttachmentUploader {
    private struct Start: Decodable { let token: String; let partBytes: Int }
    private struct Part: Decodable { let partId: String }
    private struct Done: Decodable { let ref: String }

    static let maxBytes = 50 * 1024 * 1024
    static let maxPerMessage = 10

    /// Uploads in parts small enough for the server's request limit; reports progress on the attachment.
    static func upload(_ attachment: ChatAttachment) async throws -> String {
        let api = APIClient.shared
        let data = attachment.data
        guard data.count <= maxBytes else {
            let message = "\(attachment.filename) is too large. Files can be up to 50 MB."
            await MainActor.run { attachment.error = message }
            throw APIError(message: message, status: 413)
        }
        do {
            let start: Start = try await api.send("/api/ai/uploads", method: "POST", body: [
                "filename": .string(attachment.filename), "mimeType": .string(attachment.mimeType), "bytes": .int(data.count),
            ])
            var partIds: [String] = []
            var offset = 0
            while offset < data.count {
                let end = min(offset + start.partBytes, data.count)
                var request = try await api.request("/api/ai/uploads/parts", method: "POST", headers: ["x-upload-token": start.token])
                request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
                request.httpBody = data.subdata(in: offset..<end)
                let (body, response) = try await URLSession.shared.data(for: request)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                guard (200..<300).contains(status) else {
                    let message = (try? JSONSerialization.jsonObject(with: body) as? [String: Any])?["error"] as? String
                    throw APIError(message: message ?? "Upload failed.", status: status)
                }
                partIds.append(try JSONDecoder().decode(Part.self, from: body).partId)
                offset = end
                let fraction = min(0.95, Double(offset) / Double(data.count))
                await MainActor.run { attachment.progress = fraction }
            }
            let done: Done = try await api.send("/api/ai/uploads/complete", method: "POST", body: [
                "token": .string(start.token), "partIds": .array(partIds.map { .string($0) }),
            ])
            await MainActor.run { attachment.progress = 1 }
            return done.ref
        } catch {
            await MainActor.run {
                attachment.error = isOfflineError(error) ? "No connection. Attachments need the internet." : error.localizedDescription
            }
            throw error
        }
    }
}

extension UIImage {
    /// Redraws into a plain 8-bit sRGB, opaque bitmap (transparent areas become white), at most `maxEdge` pixels on
    /// the long side. Photos and screenshots are often wide-color/HDR with alpha, which can encode to a JPEG the
    /// model misreads (a red test image came back "black").
    func scaledToFit(maxEdge: CGFloat) -> UIImage {
        let pixels = CGSize(width: size.width * scale, height: size.height * scale)
        let factor = min(1, maxEdge / max(pixels.width, pixels.height, 1))
        let target = CGSize(width: max(1, (pixels.width * factor).rounded()), height: max(1, (pixels.height * factor).rounded()))
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        format.preferredRange = .standard
        return UIGraphicsImageRenderer(size: target, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: target))
            draw(in: CGRect(origin: .zero, size: target))
        }
    }
}

// MARK: Message input that accepts pasted photos and files

/// Multi-line input for Ask. Unlike a SwiftUI TextField, pasting a copied photo or file attaches it.
struct ComposerTextView: UIViewRepresentable {
    @Binding var text: String
    @Binding var height: CGFloat
    @Binding var isFocused: Bool
    let placeholder: String
    let onPasteAttachments: ([ChatAttachment]) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> PasteAwareTextView {
        let view = PasteAwareTextView()
        view.delegate = context.coordinator
        view.backgroundColor = .clear
        view.textColor = .white
        view.tintColor = UIColor(NS.lane)
        view.font = UIFont(descriptor: UIFontDescriptor(fontAttributes: [.family: "Inter Tight"]).addingAttributes([.traits: [UIFontDescriptor.TraitKey.weight: UIFont.Weight.medium]]), size: 16)
        view.textContainerInset = UIEdgeInsets(top: 10, left: 0, bottom: 10, right: 0)
        view.textContainer.lineFragmentPadding = 0
        view.isScrollEnabled = false
        view.accessibilityIdentifier = "ask-input"
        view.accessibilityLabel = placeholder
        view.placeholder = placeholder
        view.onPasteAttachments = { onPasteAttachments($0) }
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return view
    }

    func updateUIView(_ view: PasteAwareTextView, context: Context) {
        context.coordinator.parent = self
        if view.text != text {
            view.text = text
            view.refreshPlaceholder()
        }
        view.onPasteAttachments = { onPasteAttachments($0) }
        if isFocused && !view.isFirstResponder { DispatchQueue.main.async { view.becomeFirstResponder() } }
        if !isFocused && view.isFirstResponder { DispatchQueue.main.async { view.resignFirstResponder() } }
        DispatchQueue.main.async { recalculateHeight(view) }
    }

    private func recalculateHeight(_ view: UITextView) {
        let width = view.bounds.width > 0 ? view.bounds.width : 260
        let fitted = view.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude)).height
        let clamped = min(max(fitted, 44), 140)
        view.isScrollEnabled = fitted > 140
        if abs(clamped - height) > 0.5 { height = clamped }
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: ComposerTextView
        init(_ parent: ComposerTextView) { self.parent = parent }

        func textViewDidChange(_ textView: UITextView) {
            parent.text = textView.text
            (textView as? PasteAwareTextView)?.refreshPlaceholder()
            parent.recalculateHeight(textView)
        }

        func textViewDidBeginEditing(_ textView: UITextView) { if !parent.isFocused { parent.isFocused = true } }
        func textViewDidEndEditing(_ textView: UITextView) { if parent.isFocused { parent.isFocused = false } }
    }
}

final class PasteAwareTextView: UITextView {
    var onPasteAttachments: (([ChatAttachment]) -> Void)?
    var placeholder = "" { didSet { placeholderLabel.text = placeholder } }
    private let placeholderLabel = UILabel()

    override init(frame: CGRect, textContainer: NSTextContainer?) {
        super.init(frame: frame, textContainer: textContainer)
        placeholderLabel.textColor = UIColor(white: 0.64, alpha: 1)
        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(placeholderLabel)
        NSLayoutConstraint.activate([
            placeholderLabel.leadingAnchor.constraint(equalTo: leadingAnchor),
            placeholderLabel.topAnchor.constraint(equalTo: topAnchor, constant: 10),
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var font: UIFont? { didSet { placeholderLabel.font = font } }

    func refreshPlaceholder() { placeholderLabel.isHidden = !text.isEmpty }

    private var pasteboardHasAttachments: Bool {
        let board = UIPasteboard.general
        return board.hasImages || board.itemProviders.contains { provider in
            provider.registeredTypeIdentifiers.contains { id in
                guard let type = UTType(id) else { return false }
                return type.conforms(to: .pdf) || type.conforms(to: .fileURL) || ChatAttachment.importableTypes.contains { type.conforms(to: $0) && !type.conforms(to: .plainText) }
            }
        }
    }

    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        if action == #selector(paste(_:)) && pasteboardHasAttachments { return true }
        return super.canPerformAction(action, withSender: sender)
    }

    override func paste(_ sender: Any?) {
        let board = UIPasteboard.general
        var attachments: [ChatAttachment] = []
        if board.hasImages {
            attachments += (board.images ?? []).compactMap { ChatAttachment.image($0, name: "Pasted photo") }
        }
        for provider in board.itemProviders where attachments.isEmpty {
            if provider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier),
               let data = board.data(forPasteboardType: UTType.pdf.identifier),
               let attachment = ChatAttachment.file(data: data, filename: provider.suggestedName.map { $0.hasSuffix(".pdf") ? $0 : "\($0).pdf" } ?? "Pasted.pdf", type: .pdf) {
                attachments.append(attachment)
            }
        }
        if let urls = board.urls?.filter(\.isFileURL), !urls.isEmpty {
            attachments += urls.compactMap(ChatAttachment.file(at:))
        }
        if attachments.isEmpty {
            super.paste(sender)
        } else {
            onPasteAttachments?(attachments)
            // Text copied alongside a photo still pastes as text.
            if board.hasStrings, let string = board.string, !string.isEmpty, !board.hasImages { insertText(string) }
        }
    }
}
