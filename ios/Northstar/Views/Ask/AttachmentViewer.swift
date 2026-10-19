import Photos
import QuickLook
import SwiftUI
import UIKit

/// A photo or file in the chat: still on this phone (just sent) or stored on the server.
struct ViewableAttachment: Identifiable, Hashable {
    let id: String
    let filename: String
    let isImage: Bool
    let local: Data?
    /// Server path that redirects to the stored copy. Attachments sent before copies were kept have none.
    let remotePath: String?
    let thumbnail: UIImage?

    var canOpen: Bool { local != nil || remotePath != nil }

    static func == (a: Self, b: Self) -> Bool { a.id == b.id && a.remotePath == b.remotePath }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    /// The attachments of a message, using this phone's copies where it has them.
    static func list(for message: AIMessage, local: [ChatAttachment]) -> [ViewableAttachment] {
        (message.metadata?.attachments ?? []).enumerated().map { index, attachment in
            let file = index < local.count ? local[index] : nil
            return ViewableAttachment(
                id: "\(message.id)-\(index)",
                filename: attachment.filename,
                isImage: attachment.kind == "image" || (attachment.mimeType ?? "").hasPrefix("image/"),
                local: file?.data,
                remotePath: attachment.url,
                thumbnail: file?.thumbnail
            )
        }
    }
}

enum AttachmentFiles {
    private static let cache = NSCache<NSString, NSData>()

    static func data(for item: ViewableAttachment) async throws -> Data {
        if let local = item.local { return local }
        guard let path = item.remotePath else { throw APIError(message: "Can't preview this file.", status: 404) }
        if let cached = cache.object(forKey: path as NSString) { return cached as Data }
        let request = try await APIClient.shared.request(path)
        let (data, response) = try await URLSession.shared.data(for: request, delegate: DropCredentialsOnRedirect())
        guard ((response as? HTTPURLResponse)?.statusCode ?? 0) < 300 else { throw APIError(message: "Can't open this file.", status: 0) }
        cache.setObject(data as NSData, forKey: path as NSString)
        return data
    }

    /// A temporary file with the original name, for sharing and Quick Look.
    static func fileURL(for item: ViewableAttachment) async throws -> URL {
        let data = try await data(for: item)
        let folder = FileManager.default.temporaryDirectory.appending(path: "attachments/\(item.id)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appending(path: item.filename)
        if !FileManager.default.fileExists(atPath: url.path) { try data.write(to: url) }
        return url
    }

    static func saveToPhotos(_ item: ViewableAttachment) async throws {
        let data = try await data(for: item)
        guard await PHPhotoLibrary.requestAuthorization(for: .addOnly) == .authorized else {
            throw APIError(message: "Allow Northstar to add photos in Settings to save this.", status: 0)
        }
        try await PHPhotoLibrary.shared().performChanges {
            PHAssetCreationRequest.forAsset().addResource(with: .photo, data: data, options: nil)
        }
        await MainActor.run { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    }

    static func copy(_ item: ViewableAttachment) async throws {
        let data = try await data(for: item)
        await MainActor.run {
            if item.isImage, let image = UIImage(data: data) { UIPasteboard.general.image = image } else { UIPasteboard.general.setData(data, forPasteboardType: "public.data") }
        }
    }

    @MainActor
    static func share(_ item: ViewableAttachment) async throws {
        let url = try await fileURL(for: item)
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        guard var top = UIApplication.shared.connectedScenes.compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first?.rootViewController else { return }
        while let presented = top.presentedViewController { top = presented }
        sheet.popoverPresentationController?.sourceView = top.view
        top.present(sheet, animated: true)
    }
}

/// The stored copy lives on another host; don't send it the Northstar session token.
private final class DropCredentialsOnRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest) async -> URLRequest? {
        var request = request
        request.setValue(nil, forHTTPHeaderField: "Authorization")
        request.setValue(nil, forHTTPHeaderField: "x-trip-id")
        return request
    }
}

/// Long-press actions for a photo or file.
struct AttachmentMenu: View {
    let item: ViewableAttachment
    let onError: (String) -> Void

    var body: some View {
        if item.canOpen {
            if item.isImage {
                Button { run { try await AttachmentFiles.saveToPhotos(item) } } label: { Label("Save to Photos", systemImage: "square.and.arrow.down") }
                Button { run { try await AttachmentFiles.copy(item) } } label: { Label("Copy", systemImage: "doc.on.doc") }
            }
            Button { run { try await AttachmentFiles.share(item) } } label: { Label(item.isImage ? "Share" : "Save or Share", systemImage: "square.and.arrow.up") }
        }
    }

    private func run(_ action: @escaping () async throws -> Void) {
        Task {
            do { try await action() } catch { await MainActor.run { onError(error.localizedDescription) } }
        }
    }
}

/// A photo thumbnail that loads stored copies on demand.
struct AttachmentThumbnail: View {
    let item: ViewableAttachment
    let size: CGFloat
    /// A lone photo keeps its shape, like Messages; several are square tiles.
    var keepsShape = false
    @State private var image: UIImage?

    private var frameSize: CGSize {
        guard keepsShape, let shown = image ?? item.thumbnail, shown.size.width > 0, shown.size.height > 0 else { return CGSize(width: size, height: size) }
        let aspect = shown.size.width / shown.size.height
        return aspect >= 1 ? CGSize(width: size * 1.25, height: max(64, size * 1.25 / aspect)) : CGSize(width: max(64, size / aspect > size * 1.4 ? size * 1.4 * aspect : size), height: min(size * 1.4, size / aspect))
    }

    var body: some View {
        ZStack {
            NS.surface
            if let image = image ?? item.thumbnail {
                Image(uiImage: image).resizable().scaledToFill()
            }
        }
        .frame(width: frameSize.width, height: frameSize.height)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .contentShape(.contextMenuPreview, RoundedRectangle(cornerRadius: 14, style: .continuous))
        .task(id: item) {
            guard item.thumbnail == nil, image == nil, let data = try? await AttachmentFiles.data(for: item), let full = UIImage(data: data) else { return }
            image = await Task.detached { full.preparingThumbnail(of: CGSize(width: size * 3, height: size * 3)) ?? full }.value
        }
    }
}

/// Full screen, like Messages: swipe between a message's attachments, pinch to zoom, swipe down or X to close.
struct AttachmentViewer: View {
    let items: [ViewableAttachment]
    @State var index: Int
    let onError: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var zoomed = false
    @State private var chromeHidden = false
    @State private var drag: CGFloat = 0

    private var current: ViewableAttachment { items[min(index, items.count - 1)] }

    var body: some View {
        ZStack {
            Color.black.opacity(1 - min(abs(drag) / 400, 0.6)).ignoresSafeArea()
            TabView(selection: $index) {
                ForEach(Array(items.enumerated()), id: \.offset) { i, item in
                    AttachmentPage(item: item, zoomed: $zoomed, onError: onError) {
                        withAnimation(.easeInOut(duration: 0.2)) { chromeHidden.toggle() }
                    }
                    .tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()
            .offset(y: drag)
            .simultaneousGesture(
                DragGesture(minimumDistance: 20)
                    .onChanged { value in
                        guard abs(value.translation.height) > abs(value.translation.width) else { return }
                        drag = value.translation.height
                    }
                    .onEnded { value in
                        if abs(value.predictedEndTranslation.height) > 200 && abs(value.translation.height) > abs(value.translation.width) {
                            dismiss()
                        } else {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { drag = 0 }
                        }
                    },
                including: zoomed ? .subviews : .all
            )
        }
        .overlay(alignment: .top) {
            if !chromeHidden {
                HStack(spacing: 8) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 16, weight: .bold)).frame(width: 40, height: 40)
                            .background(Circle().fill(.ultraThinMaterial))
                    }
                    .accessibilityLabel("Close")
                    .accessibilityIdentifier("viewer-close")
                    Spacer(minLength: 8)
                    VStack(spacing: 1) {
                        Text(current.filename).font(NS.sans(15, .bold)).lineLimit(1)
                        if items.count > 1 { Text("\(index + 1) of \(items.count)").font(NS.mono(11)).opacity(0.7) }
                    }
                    Spacer(minLength: 8)
                    Button {
                        Task { do { try await AttachmentFiles.share(current) } catch { onError(error.localizedDescription) } }
                    } label: {
                        Image(systemName: "square.and.arrow.up").font(.system(size: 16, weight: .bold)).frame(width: 40, height: 40)
                            .background(Circle().fill(.ultraThinMaterial))
                    }
                    .accessibilityLabel("Share")
                    .opacity(current.canOpen ? 1 : 0)
                    .disabled(!current.canOpen)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.top, 4)
                .opacity(drag == 0 ? 1 : 0)
                .transition(.opacity)
            }
        }
        .statusBarHidden(chromeHidden)
    }
}

private struct AttachmentPage: View {
    enum Content { case loading, image(UIImage), document(URL), unavailable(canShare: Bool) }

    let item: ViewableAttachment
    @Binding var zoomed: Bool
    let onError: (String) -> Void
    let onTap: () -> Void
    @State private var content: Content = .loading

    var body: some View {
        Group {
            switch content {
            case .loading:
                ProgressView().tint(.white).frame(maxWidth: .infinity, maxHeight: .infinity)
            case .image(let image):
                ZoomableImage(image: image, zoomed: $zoomed, onTap: onTap)
                    .contextMenu { AttachmentMenu(item: item, onError: onError) }
                    .accessibilityIdentifier("viewer-image")
            case .document(let url):
                QuickLookPreview(url: url)
                    .padding(.top, 56)
                    .background(Color.white)
            case .unavailable(let canShare):
                VStack(spacing: 14) {
                    Image(systemName: item.isImage ? "photo" : "doc").font(.system(size: 44, weight: .regular)).opacity(0.6)
                    Text("Can't preview this file").font(NS.sans(17, .bold))
                    if canShare {
                        Button {
                            Task { do { try await AttachmentFiles.share(item) } catch { onError(error.localizedDescription) } }
                        } label: {
                            Label("Save or Share", systemImage: "square.and.arrow.up")
                                .font(NS.sans(15, .semibold))
                                .padding(.horizontal, 18).padding(.vertical, 10)
                                .background(Capsule().fill(Color.white.opacity(0.15)))
                        }
                    }
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
                .onTapGesture(perform: onTap)
            }
        }
        .task(id: item) { await load() }
    }

    private func load() async {
        guard item.canOpen else { content = .unavailable(canShare: false); return }
        do {
            if item.isImage, let image = UIImage(data: try await AttachmentFiles.data(for: item)) {
                content = .image(image)
                return
            }
            let url = try await AttachmentFiles.fileURL(for: item)
            content = QLPreviewController.canPreview(url as NSURL) ? .document(url) : .unavailable(canShare: true)
        } catch {
            content = .unavailable(canShare: false)
        }
    }
}

/// Pinch and double-tap zoom.
private struct ZoomableImage: UIViewRepresentable {
    let image: UIImage
    @Binding var zoomed: Bool
    let onTap: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> UIScrollView {
        let scroll = UIScrollView()
        scroll.delegate = context.coordinator
        scroll.minimumZoomScale = 1
        scroll.maximumZoomScale = 5
        scroll.showsVerticalScrollIndicator = false
        scroll.showsHorizontalScrollIndicator = false
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.backgroundColor = .clear
        let imageView = UIImageView(image: image)
        imageView.contentMode = .scaleAspectFit
        imageView.isUserInteractionEnabled = true
        imageView.isAccessibilityElement = true
        scroll.addSubview(imageView)
        context.coordinator.imageView = imageView
        let doubleTap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.doubleTapped(_:)))
        doubleTap.numberOfTapsRequired = 2
        scroll.addGestureRecognizer(doubleTap)
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tapped))
        tap.require(toFail: doubleTap)
        scroll.addGestureRecognizer(tap)
        return scroll
    }

    func updateUIView(_ scroll: UIScrollView, context: Context) {
        context.coordinator.parent = self
        DispatchQueue.main.async { context.coordinator.layout(scroll) }
    }

    final class Coordinator: NSObject, UIScrollViewDelegate {
        var parent: ZoomableImage
        weak var imageView: UIImageView?
        private var laidOutSize: CGSize = .zero
        init(_ parent: ZoomableImage) { self.parent = parent }

        func layout(_ scroll: UIScrollView) {
            guard let imageView, scroll.bounds.size != laidOutSize, scroll.bounds.width > 0 else { return }
            laidOutSize = scroll.bounds.size
            scroll.zoomScale = 1
            imageView.frame = CGRect(origin: .zero, size: scroll.bounds.size)
            scroll.contentSize = scroll.bounds.size
        }

        func viewForZooming(in scrollView: UIScrollView) -> UIView? { imageView }

        func scrollViewDidZoom(_ scrollView: UIScrollView) {
            let isZoomed = scrollView.zoomScale > 1.01
            if parent.zoomed != isZoomed { parent.zoomed = isZoomed }
        }

        @objc func tapped() { parent.onTap() }

        @objc func doubleTapped(_ gesture: UITapGestureRecognizer) {
            guard let scroll = gesture.view as? UIScrollView else { return }
            if scroll.zoomScale > 1.01 {
                scroll.setZoomScale(1, animated: true)
            } else {
                let point = gesture.location(in: imageView)
                let size = CGSize(width: scroll.bounds.width / 2.5, height: scroll.bounds.height / 2.5)
                scroll.zoom(to: CGRect(x: point.x - size.width / 2, y: point.y - size.height / 2, width: size.width, height: size.height), animated: true)
            }
        }
    }
}

private struct QuickLookPreview: UIViewControllerRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator(url: url) }

    func makeUIViewController(context: Context) -> QLPreviewController {
        let controller = QLPreviewController()
        controller.dataSource = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: QLPreviewController, context: Context) {
        if context.coordinator.url != url {
            context.coordinator.url = url
            controller.reloadData()
        }
    }

    final class Coordinator: NSObject, QLPreviewControllerDataSource {
        var url: URL
        init(url: URL) { self.url = url }
        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }
        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem { url as NSURL }
    }
}
