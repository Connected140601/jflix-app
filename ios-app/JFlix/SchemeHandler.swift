import Foundation
import WebKit

/// Serves downloaded videos back to the Downloads page over `jflixdl://`,
/// mirroring the Electron protocol:
///   jflixdl://<jobId>/<path...>  per-job folder (HLS segments, mp4)
///   jflixdl://<file>             flat file (legacy shape)
/// Supports byte ranges so <video> can seek inside offline files.
final class SchemeHandler: NSObject, WKURLSchemeHandler {

    private static let mimeByExt: [String: String] = [
        "m3u8": "application/vnd.apple.mpegurl",
        "ts": "video/MP2T",
        "m4s": "video/iso.segment",
        "mp4": "video/mp4",
        "webm": "video/webm",
        "mkv": "video/x-matroska",
        "vtt": "text/vtt",
        "bin": "application/octet-stream",
        "key": "application/octet-stream",
    ]

    private let lock = NSLock()
    private var stopped: Set<ObjectIdentifier> = []

    /// Private on-device root for everything the downloader saves.
    /// Application Support is invisible to other apps and the Files app.
    static func filesRoot() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let root = base.appendingPathComponent("JFlix/files", isDirectory: true)
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }

    static func indexFile() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("JFlix", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("downloads-index.json")
    }

    // MARK: - WKURLSchemeHandler

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            self.fail(urlSchemeTask, status: 400)
            return
        }
        guard let fileURL = Self.resolve(url: url) else {
            self.fail(urlSchemeTask, status: 403)
            return
        }
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: fileURL.path, isDirectory: &isDir),
              !isDir.boolValue else {
            self.fail(urlSchemeTask, status: 404)
            return
        }
        let ext = fileURL.pathExtension.lowercased()
        let mime = Self.mimeByExt[ext] ?? "application/octet-stream"
        do {
            let attrs = try FileManager.default.attributesOfItem(atPath: fileURL.path)
            let size = (attrs[.size] as? NSNumber)?.intValue ?? 0
            let rangeHeader = urlSchemeTask.request.value(forHTTPHeaderField: "Range")
            if let range = Self.parseRange(rangeHeader, size: size) {
                let handle = try FileHandle(forReadingFrom: fileURL)
                defer { try? handle.close() }
                try handle.seek(toOffset: UInt64(range.lowerBound))
                let data = handle.readData(ofLength: range.upperBound - range.lowerBound + 1)
                let headers = [
                    "Content-Type": mime,
                    "Content-Length": String(data.count),
                    "Content-Range": "bytes \(range.lowerBound)-\(range.upperBound)/\(size)",
                    "Accept-Ranges": "bytes",
                ]
                let response = HTTPURLResponse(url: url, statusCode: 206, httpVersion: "HTTP/1.1", headerFields: headers)!
                urlSchemeTask.didReceive(response)
                urlSchemeTask.didReceive(data)
                urlSchemeTask.didFinish()
                return
            }
            let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
            let headers = [
                "Content-Type": mime,
                "Content-Length": String(size),
                "Accept-Ranges": "bytes",
            ]
            let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            self.fail(urlSchemeTask, status: 500)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        lock.lock()
        stopped.insert(ObjectIdentifier(urlSchemeTask))
        lock.unlock()
    }

    // MARK: - Helpers

    private static func resolve(url: URL) -> URL? {
        // jflixdl://<first>[/<rest...>] with traversal guard.
        let first = url.host?.removingPercentEncoding ?? ""
        if first.isEmpty || first == "." || first.contains("/") || first.contains("\\") {
            return nil
        }
        var parts = url.pathComponents.filter { $0 != "/" }
        parts = parts.map { $0.removingPercentEncoding ?? "" }
        if parts.contains(where: { $0.isEmpty || $0 == "." || $0 == ".." || $0.contains("/") || $0.contains("\\") }) {
            return nil
        }
        var resolved = filesRoot()
        resolved.appendPathComponent(first, isDirectory: parts.isEmpty ? false : true)
        for part in parts {
            resolved.appendPathComponent(part)
        }
        // Containment check against the private root.
        let root = filesRoot().standardized.path
        let full = resolved.standardized.path
        guard full == root || full.hasPrefix(root + "/") else { return nil }
        // Flat shape (jflixdl://<file>) must stay a file directly under root.
        if parts.isEmpty {
            guard resolved.deletingLastPathComponent().standardized.path == root else { return nil }
        }
        return resolved
    }

    private static func parseRange(_ header: String?, size: Int) -> ClosedRange<Int>? {
        guard let header = header, size > 0 else { return nil }
        // bytes=start-end, either side may be empty.
        let prefix = "bytes="
        guard header.hasPrefix(prefix) else { return nil }
        let spec = String(header.dropFirst(prefix.count))
        let dash = spec.firstIndex(of: "-") ?? spec.endIndex
        let startStr = String(spec[..<dash])
        let endStr = dash < spec.endIndex ? String(spec[spec.index(after: dash)...]) : ""
        var start = startStr.isEmpty ? 0 : (Int(startStr) ?? 0)
        var end = endStr.isEmpty ? size - 1 : (Int(endStr) ?? (size - 1))
        if start < 0 { start = 0 }
        if end >= size { end = size - 1 }
        guard start < size, end >= start else { return nil }
        return start...end
    }

    private func fail(_ task: WKURLSchemeTask, status: Int) {
        if let url = task.request.url,
           let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: [:]) {
            task.didReceive(response)
        }
        task.didFinish()
    }
}
