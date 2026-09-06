import UIKit
import WebKit
import AVFoundation

/// JFlix iOS — in-app downloads. Mirrors Android DownloadBridge + Electron
/// download-manager over the same `window.jflixDownloads` contract the site
/// already uses (see js/ios-downloads.js for the promise adapter).
///
/// Flow: hidden full-screen ghost WebView loads the embed URL; the injected
/// scraper hook (compact twin of js/stream-hook.js) reports the stream URL
/// back over the "jflixStream" message channel. Direct files download with
/// URLSession; HLS goes through a Flickv4-style segment pipeline (variant
/// pick <=1080p AVC-preferred, retries, AES-128 keys, local playlist) and is
/// then remuxed to MP4 on-device with AVAssetExportSession so plain <video>
/// can play it offline. Everything lives in Application Support (invisible
/// to other apps) and plays only through the Downloads page over jflixdl://.
final class DownloadBridge: NSObject, WKScriptMessageHandler {

    typealias WebViewProvider = () -> WKWebView?
    typealias HostViewProvider = () -> UIView?

    // MARK: - Record model (matches downloads.js expectations)

    private struct Rec: Codable {
        var id: String
        var title: String
        var type: String
        var tmdbId: String
        var season: Int?
        var episode: Int?
        var embedUrl: String
        var server: String
        var status: String
        var progress: Int
        var file: String?
        var size: Int64
        var error: String?
        var createdAt: Int64
    }

    private static let chromeUA =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
    private static let captureTimeout: TimeInterval = 30
    private static let hlsConcurrency = 4
    private static let hlsRetries = 3

    private let filesRoot: URL
    private let indexFile: URL
    private let mainWebView: WebViewProvider
    private let hostView: HostViewProvider

    private let lock = NSLock()
    private var library: [String: Rec] = [:]
    private var order: [String] = []

    private final class Capture {
        var ghost: WKWebView?
        var timeout: DispatchWorkItem?
    }
    private var captures: [String: Capture] = [:]

    private lazy var session: URLSession = {
        URLSession(configuration: .default, delegate: self, delegateQueue: nil)
    }()
    private var dlTaskForId: [String: URLSessionDownloadTask] = [:]
    private var dlProgress: [String: (written: Int64, total: Int64)] = [:]

    private var hlsCancel: Set<String> = []
    private var hlsTasks: [String: [URLSessionTask]] = [:]

    init(filesRoot: URL, mainWebView: @escaping WebViewProvider, hostView: @escaping HostViewProvider) {
        self.filesRoot = filesRoot
        self.indexFile = SchemeHandler.indexFile()
        self.mainWebView = mainWebView
        self.hostView = hostView
        super.init()
        self.loadIndex()
    }

    func destroy() {
        lock.lock()
        let ids = Array(captures.keys)
        let tasks = Array(dlTaskForId.values)
        let hls = Array(hlsTasks.keys)
        lock.unlock()
        for id in ids { stopCapture(id) }
        for task in tasks { task.cancel() }
        for id in hls { cancelHls(id) }
        session.invalidateAndCancel()
    }

    // MARK: - JS bridge (WKScriptMessageHandler "iosDownloads")

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "iosDownloads",
              let body = message.body as? [String: Any],
              let cb = body["cb"] as? String,
              let method = body["method"] as? String else { return }
        let params = body["params"]
        switch method {
        case "start":
            let id = self.startDownload(params: params)
            self.reply(cb, value: id)
        case "list":
            self.reply(cb, value: self.listDownloads())
        case "cancel":
            if let id = params as? String { self.cancelDownload(id) }
            self.reply(cb, value: true)
        case "remove":
            if let id = params as? String { self.removeDownload(id) }
            self.reply(cb, value: true)
        case "openFolder":
            self.reply(cb, value: true)
        default:
            break
        }
    }

    private func reply(_ cb: String, value: Any) {
        let payload: Any = ["cb": cb, "value": value]
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
              let json = String(data: data, encoding: .utf8) else { return }
        let js = "window.__iosDlCb && window.__iosDlCb(\(json));"
        DispatchQueue.main.async { [weak self] in
            self?.mainWebView()?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    // MARK: - Library state

    private func find(_ id: String) -> Rec? {
        lock.lock(); defer { lock.unlock() }
        return library[id]
    }

    private func saveIndex() {
        let recs: [Rec] = {
            lock.lock(); defer { lock.unlock() }
            return order.compactMap { library[$0] }
        }()
        do {
            let data = try JSONEncoder().encode(recs)
            try data.write(to: indexFile, options: .atomic)
        } catch {
            NSLog("[Downloads] saveIndex failed: \(error)")
        }
    }

    private func loadIndex() {
        do {
            let data = try Data(contentsOf: indexFile)
            let recs = try JSONDecoder().decode([Rec].self, from: data)
            lock.lock()
            for var r in recs {
                // Anything mid-flight when the app died goes back to a clean error.
                if r.status == "starting" || r.status == "connecting" || r.status == "downloading" {
                    r.status = "error"
                    r.progress = 0
                    r.error = "Interrupted — please download again."
                }
                library[r.id] = r
                order.append(r.id)
            }
            lock.unlock()
        } catch {
            // Fresh install / no index yet.
        }
    }

    private func setStatus(_ id: String, status: String, progress: Int, error: String?) {
        lock.lock()
        if var r = library[id] {
            r.status = status
            r.progress = progress
            r.error = error
            library[id] = r
        }
        lock.unlock()
        saveIndex()
        notify()
    }

    private func notify() {
        DispatchQueue.main.async { [weak self] in
            self?.mainWebView()?.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('jflix-dl-event'));",
                completionHandler: nil
            )
        }
    }

    private func listDownloads() -> [[String: Any]] {
        lock.lock()
        let recs = order.compactMap { library[$0] }
        lock.unlock()
        return recs.map { r in
            var d: [String: Any] = [
                "id": r.id, "title": r.title, "type": r.type,
                "tmdbId": r.tmdbId, "server": r.server,
                "status": r.status, "progress": r.progress,
                "size": r.size, "createdAt": r.createdAt,
            ]
            if let s = r.season { d["season"] = s }
            if let e = r.episode { d["episode"] = e }
            if let f = r.file { d["file"] = f } else { d["file"] = NSNull() }
            if let e = r.error { d["error"] = e }
            if r.status == "completed", let f = r.file {
                let full = jobDir(id: r.id).appendingPathComponent(f).path
                if FileManager.default.fileExists(atPath: full) {
                    d["fileUrl"] = "jflixdl://\(r.id)/\(f)"
                } else {
                    d["fileUrl"] = NSNull()
                }
            } else {
                d["fileUrl"] = NSNull()
            }
            return d
        }
    }

    private func jobDir(id: String) -> URL {
        let dir = filesRoot.appendingPathComponent(id, isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    // MARK: - Start / cancel / remove

    @discardableResult
    private func startDownload(params: Any?) -> String {
        let id = "dl_\(Int(Date().timeIntervalSince1970 * 1000))_\(Int.random(in: 0..<1_000_000))"
        var p: [String: Any] = [:]
        if let s = params as? String,
           let data = s.data(using: .utf8),
           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            p = obj
        } else if let obj = params as? [String: Any] {
            p = obj
        }
        func str(_ v: Any?) -> String { v.map { String(describing: $0) } ?? "" }
        let rec = Rec(
            id: id,
            title: str(p["title"]).isEmpty ? "Media" : str(p["title"]),
            type: str(p["type"]).isEmpty ? "movie" : str(p["type"]),
            tmdbId: str(p["tmdbId"]),
            season: (p["season"] as? NSNumber)?.intValue,
            episode: (p["episode"] as? NSNumber)?.intValue,
            embedUrl: str(p["embedUrl"]),
            server: str(p["serverLabel"]).isEmpty ? str(p["server"]) : str(p["serverLabel"]),
            status: "starting", progress: 0, file: nil, size: 0, error: nil,
            createdAt: Int64(Date().timeIntervalSince1970 * 1000)
        )
        lock.lock()
        library[id] = rec
        order.insert(id, at: 0)
        lock.unlock()
        saveIndex()
        notify()

        guard rec.embedUrl.hasPrefix("http") else {
            setStatus(id, status: "error", progress: 0,
                      error: "No stream page available for this server yet — play the video first, then download.")
            return id
        }
        DispatchQueue.main.async { [weak self] in self?.beginCapture(id) }
        return id
    }

    private func cancelDownload(_ id: String) {
        let rec = find(id)
        guard let r = rec, r.status == "downloading" || r.status == "starting" || r.status == "connecting" else { return }
        cancelHls(id)
        lock.lock()
        let task = dlTaskForId.removeValue(forKey: id)
        lock.unlock()
        task?.cancel()
        stopCapture(id)
        setStatus(id, status: "canceled", progress: 0, error: nil)
    }

    private func removeDownload(_ id: String) {
        cancelHls(id)
        lock.lock()
        if let task = dlTaskForId.removeValue(forKey: id) { task.cancel() }
        lock.unlock()
        stopCapture(id)
        try? FileManager.default.removeItem(at: jobDir(id: id))
        lock.lock()
        library.removeValue(forKey: id)
        order.removeAll { $0 == id }
        lock.unlock()
        saveIndex()
        notify()
    }

    private func cancelHls(_ id: String) {
        lock.lock()
        hlsCancel.insert(id)
        let tasks = hlsTasks.removeValue(forKey: id) ?? []
        lock.unlock()
        for t in tasks { t.cancel() }
    }

    // MARK: - Capture (hidden ghost WebView + injected hook)

    private final class StreamForwarder: NSObject, WKScriptMessageHandler {
        weak var bridge: DownloadBridge?
        let id: String
        init(bridge: DownloadBridge, id: String) {
            self.bridge = bridge
            self.id = id
        }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "jflixStream" else { return }
            var url: String?
            if let s = message.body as? String {
                url = s
            } else if let d = message.body as? [String: Any], let u = d["url"] as? String {
                url = u
            }
            if let url = url { bridge?.onHookUrl(id, url: url) }
        }
    }

    private func beginCapture(_ id: String) {
        guard let host = hostView(), find(id)?.status == "starting" else { return }
        let ucc = WKUserContentController()
        ucc.addUserScript(WKUserScript(source: Self.hookJS, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        ucc.add(StreamForwarder(bridge: self, id: id), name: "jflixStream")
        let config = WKWebViewConfiguration()
        config.userContentController = ucc
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let ghost = WKWebView(frame: host.bounds, configuration: config)
        ghost.alpha = 0.01 // invisible but rendering (1x1 boxes get bot-flagged)
        ghost.isUserInteractionEnabled = false
        ghost.navigationDelegate = self
        host.addSubview(ghost)

        let cap = Capture()
        cap.ghost = ghost
        lock.lock()
        captures[id] = cap
        lock.unlock()

        let timeout = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            let stillStarting = self.find(id)?.status == "starting"
            self.stopCapture(id)
            if stillStarting {
                self.setStatus(id, status: "error", progress: 0,
                               error: "Could not find a downloadable file on this server (may be DRM-protected or unsupported). Try another server.")
            }
        }
        cap.timeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.captureTimeout, execute: timeout)

        if let url = URL(string: find(id)?.embedUrl ?? "") {
            ghost.load(URLRequest(url: url))
        } else {
            stopCapture(id)
            setStatus(id, status: "error", progress: 0, error: "Could not load the video server page.")
        }
    }

    private func stopCapture(_ id: String) {
        lock.lock()
        let cap = captures.removeValue(forKey: id)
        lock.unlock()
        cap?.timeout?.cancel()
        if let ghost = cap?.ghost {
            DispatchQueue.main.async {
                ghost.stopLoading()
                ghost.removeFromSuperview()
            }
        }
    }

    private func onHookUrl(_ id: String, url: String) {
        lock.lock()
        let watching = captures[id] != nil
        let rec = library[id]
        lock.unlock()
        guard watching, let r = rec, r.status == "starting" else { return }
        let lower = url.lowercased()
        func hasExt(_ exts: String...) -> Bool {
            exts.contains { lower.range(of: "\\.\($0)([?#]|$)", options: .regularExpression) != nil }
        }
        let isMp4 = hasExt("mp4") && !lower.contains(".m3u8")
        let isHls = hasExt("m3u8") || lower.contains("m3u8") || lower.contains("mpegurl") || hasExt("mpd")
        guard isMp4 || isHls else { return }
        stopCapture(id)
        NSLog("[Downloads] stream found (\(isHls ? "hls" : "mp4")): \(url.prefix(160))")
        setStatus(id, status: "connecting", progress: 0, error: nil)
        // Grab session cookies (Cloudflare clearance, signed-URL sessions) first.
        let ghostStore = WKWebsiteDataStore.default().httpCookieStore
        ghostStore.getAllCookies { [weak self] cookies in
            guard let self = self else { return }
            var headers: [String: String] = [
                "User-Agent": Self.chromeUA,
            ]
            if let embed = self.find(id)?.embedUrl, let eu = URL(string: embed) {
                let origin = "\(eu.scheme ?? "https")://\(eu.host ?? "")/"
                headers["Referer"] = origin
                headers["Origin"] = String(origin.dropLast())
            }
            let jar = cookies.filter { c in
                guard let host = URL(string: url)?.host else { return true }
                return host.hasSuffix(c.domain.hasPrefix(".") ? String(c.domain.dropFirst()) : c.domain)
                    || c.domain.hasSuffix(host)
            }
            if !jar.isEmpty {
                headers["Cookie"] = jar.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
            }
            if isHls {
                self.runHlsJob(id: id, streamUrl: url, headers: headers)
            } else {
                self.startMp4Download(id: id, url: url, headers: headers)
            }
        }
    }

    // MARK: - Direct MP4 download (no remuxing needed)

    private func startMp4Download(id: String, url: String, headers: [String: String]) {
        guard let req = self.makeRequest(url: url, headers: headers) else {
            setStatus(id, status: "error", progress: 0, error: "Bad stream URL.")
            return
        }
        // Cache-bust duplicate enqueues from double reports.
        lock.lock()
        if dlTaskForId[id] != nil {
            lock.unlock()
            return
        }
        let task = session.downloadTask(with: req)
        dlTaskForId[id] = task
        dlProgress[id] = (0, 0)
        lock.unlock()
        setStatus(id, status: "downloading", progress: 1, error: nil)
        task.resume()
    }

    private func makeRequest(url: String, headers: [String: String]) -> URLRequest? {
        guard let u = URL(string: url) else { return nil }
        var req = URLRequest(url: u, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
        return req
    }

    // MARK: - HLS segment pipeline (no ffmpeg on device)

    private func runHlsJob(id: String, streamUrl: String, headers: [String: String]) {
        lock.lock()
        hlsCancel.remove(id)
        lock.unlock()
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self = self else { return }
            do {
                try self.downloadHlsJob(id: id, streamUrl: streamUrl, headers: headers)
            } catch let e as HlsCancel {
                _ = e
                // cancelDownload already marked the record.
            } catch {
                if self.isHlsCancelled(id) { return }
                self.setStatus(id, status: "error", progress: 0, error: error.localizedDescription)
            }
        }
    }

    private struct HlsCancel: Error {}

    private func isHlsCancelled(_ id: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return hlsCancel.contains(id)
    }

    private func checkHlsCancelled(_ id: String) throws {
        if isHlsCancelled(id) { throw HlsCancel() }
    }

    private func trackHlsTask(_ id: String, _ task: URLSessionTask) {
        lock.lock()
        hlsTasks[id, default: []].append(task)
        lock.unlock()
    }

    private func untrackHlsTask(_ id: String, _ task: URLSessionTask) {
        lock.lock()
        hlsTasks[id]?.removeAll { $0 === task }
        if hlsTasks[id]?.isEmpty == true { hlsTasks.removeValue(forKey: id) }
        lock.unlock()
    }

    private func syncFetch(id: String, url: String, headers: [String: String]) throws -> (Data, HTTPURLResponse) {
        try checkHlsCancelled(id)
        guard let u = URL(string: url) else { throw HlsError.badURL(url) }
        var req = URLRequest(url: u, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 25)
        for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
        var result: (Data, HTTPURLResponse)?
        var taskError: Error?
        let sem = DispatchSemaphore(value: 0)
        let task = URLSession.shared.dataTask(with: req) { data, response, error in
            if let error = error {
                taskError = error
            } else if let data = data, let http = response as? HTTPURLResponse {
                result = (data, http)
            } else {
                taskError = HlsError.network("Empty response")
            }
            sem.signal()
        }
        trackHlsTask(id, task)
        task.resume()
        sem.wait()
        untrackHlsTask(id, task)
        try checkHlsCancelled(id)
        if let e = taskError { throw e }
        guard let r = result else { throw HlsError.network("No data") }
        return r
    }

    private enum HlsError: Error, LocalizedError {
        case badURL(String)
        case network(String)
        case parse(String)
        case unsupported(String)
        var errorDescription: String? {
            switch self {
            case .badURL(let u): return "Bad URL: \(u)"
            case .network(let m): return m
            case .parse(let m): return m
            case .unsupported(let m): return m
            }
        }
    }

    private struct Variant {
        var uri: String
        var width: Int
        var height: Int
        var bandwidth: Int
        var codecs: String?
    }

    private func downloadHlsJob(id: String, streamUrl: String, headers: [String: String]) throws {
        guard find(id) != nil else { return }
        let dir = jobDir(id: id)
        let segDir = dir.appendingPathComponent("segments", isDirectory: true)
        try FileManager.default.createDirectory(at: segDir, withIntermediateDirectories: true)

        setStatus(id, status: "downloading", progress: 1, error: nil)

        // 1) Master playlist -> best variant (<=1080p, AVC preferred).
        let (masterData, _) = try fetchOK(id: id, url: streamUrl, headers: headers)
        guard let masterText = String(data: masterData, encoding: .utf8) else {
            throw HlsError.parse("Playlist is not text.")
        }
        var variantUrl = streamUrl
        let variants = parseMaster(masterText, base: streamUrl)
        if !variants.isEmpty {
            guard let picked = pickVariant(variants) else {
                throw HlsError.parse("No playable variant in master playlist.")
            }
            variantUrl = picked.uri
        } else if !masterText.hasPrefix("#EXTM3U") {
            throw HlsError.unsupported("URL did not return an HLS playlist.")
        }

        // 2) Media playlist.
        let mediaText: String
        if variants.isEmpty && variantUrl == streamUrl {
            mediaText = masterText
        } else {
            let (d, _) = try fetchOK(id: id, url: variantUrl, headers: headers)
            guard let t = String(data: d, encoding: .utf8), t.hasPrefix("#EXTM3U") else {
                throw HlsError.parse("URL did not return an HLS playlist.")
            }
            mediaText = t
        }
        let media = parseMedia(mediaText, base: variantUrl)
        guard !media.segs.isEmpty else { throw HlsError.parse("No segments in playlist.") }
        for k in media.keys where k.method.uppercased() != "AES-128" && k.method.uppercased() != "NONE" {
            throw HlsError.unsupported("HLS encryption \(k.method) cannot be saved for offline play.")
        }

        // 3) URL map: remote -> local file.
        var localFor: [String: URL] = [:]
        for (i, uri) in media.inits.enumerated() {
            localFor[uri] = segDir.appendingPathComponent("init-\(i).\(Self.extOf(uri, fb: "mp4"))")
        }
        for (i, k) in media.keys.enumerated() {
            localFor[k.uri] = segDir.appendingPathComponent("key-\(i).bin")
        }
        var segRels: [String] = []
        for (i, uri) in media.segs.enumerated() {
            let rel = "segments/\(Self.pad5(i)).\(Self.extOf(uri, fb: "ts"))"
            segRels.append(rel)
            localFor[uri] = dir.appendingPathComponent(rel)
        }
        let total = media.segs.count
        var done = 0
        func report() {
            let pct = total > 0 ? min(99, done * 100 / max(1, total)) : 1
            self.setStatus(id, status: "downloading", progress: pct, error: nil)
        }

        // 4) Sidecars first.
        var sidecars = media.inits
        sidecars.append(contentsOf: media.keys.map { $0.uri })
        for uri in sidecars {
            try checkHlsCancelled(id)
            try downloadOne(id: id, url: uri, dest: localFor[uri]!, headers: headers, kind: "sidecar")
            report()
        }

        // 5) Segments, 4 at a time.
        let queue = OperationQueue()
        queue.maxConcurrentOperationCount = Self.hlsConcurrency
        var failures: [String] = []
        let failuresLock = NSLock()
        let countLock = NSLock()
        for (idx, uri) in media.segs.enumerated() {
            queue.addOperation {
                do {
                    try self.checkHlsCancelled(id)
                    if let dest = localFor[uri], FileManager.default.fileExists(atPath: dest.path),
                       self.isPlausibleFile(dest, kind: "segment") {
                        countLock.lock()
                        done += 1
                        countLock.unlock()
                        report()
                        return
                    } else if let dest = localFor[uri], FileManager.default.fileExists(atPath: dest.path) {
                        try? FileManager.default.removeItem(at: dest)
                    }
                    try self.downloadOne(id: id, url: uri, dest: localFor[uri]!, headers: headers, kind: "segment")
                    countLock.lock()
                    done += 1
                    countLock.unlock()
                    report()
                } catch is HlsCancel {
                    // Pool drains; outer check handles it.
                } catch {
                    failuresLock.lock()
                    failures.append("seg \(idx): \(error.localizedDescription)")
                    failuresLock.unlock()
                }
            }
        }
        queue.waitUntilAllOperationsAreFinished()
        try checkHlsCancelled(id)
        guard done >= total else {
            throw HlsError.network("Only \(done)/\(total) segments downloaded" +
                (failures.first.map { " (\($0))" } ?? "") + ".")
        }

        // 6) Rewrite playlist to absolute file:// URIs and save local.m3u8.
        var uriMap: [String: String] = [:]
        for (remote, local) in localFor {
            uriMap[remote] = local.absoluteString
        }
        let rw = rewriteAbsolute(mediaText, base: variantUrl, urlMap: uriMap)
        guard rw.leftovers.isEmpty else {
            throw HlsError.unsupported("Playlist still needs the network (\(rw.leftovers.first ?? "")).")
        }
        let localPl = dir.appendingPathComponent("local.m3u8")
        try rw.playlist.write(to: localPl, atomically: true, encoding: .utf8)

        // 7) Remux to MP4 on-device so plain <video> plays it. Falls back to
        // local.m3u8 (hls.js on the Downloads page) if export fails.
        let mp4 = dir.appendingPathComponent("video.mp4")
        try? FileManager.default.removeItem(at: mp4)
        let exported = exportToMp4(playlist: localPl, dest: mp4)
        if exported {
            try? FileManager.default.removeItem(at: segDir)
            try? FileManager.default.removeItem(at: localPl)
            try checkHlsCancelled(id)
            let size = (try? FileManager.default.attributesOfItem(atPath: mp4.path)[.size] as? NSNumber)?.int64Value ?? 0
            self.finishCompleted(id: id, file: "video.mp4", size: size)
        } else {
            try checkHlsCancelled(id)
            self.finishCompleted(id: id, file: "local.m3u8", size: self.dirSize(dir))
        }
    }

    private func finishCompleted(id: String, file: String, size: Int64) {
        lock.lock()
        if var r = library[id] {
            if r.status == "canceled" {
                lock.unlock()
                return
            }
            r.file = file
            r.size = size
            library[id] = r
        }
        lock.unlock()
        setStatus(id, status: "completed", progress: 100, error: nil)
    }

    private func exportToMp4(playlist: URL, dest: URL) -> Bool {
        let asset = AVURLAsset(url: playlist)
        guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetPassthrough) else {
            return false
        }
        session.outputURL = dest
        session.outputFileType = .mp4
        session.shouldOptimizeForNetworkUse = true
        let sem = DispatchSemaphore(value: 0)
        var ok = false
        session.exportAsynchronously {
            ok = (session.status == .completed) && FileManager.default.fileExists(atPath: dest.path)
            if !ok, let e = session.error {
                NSLog("[Downloads] remux failed: \(e.localizedDescription)")
            }
            sem.signal()
        }
        sem.wait()
        return ok
    }

    private func fetchOK(id: String, url: String, headers: [String: String]) throws -> (Data, HTTPURLResponse) {
        var lastError: Error = HlsError.network("HTTP error")
        for attempt in 1...Self.hlsRetries {
            try checkHlsCancelled(id)
            do {
                let (data, http) = try syncFetch(id: id, url: url, headers: headers)
                let status = http.statusCode
                if status == 429 || status == 500 || status == 502 || status == 503 || status == 504 {
                    var wait = min(15.0, 1.5 * Double(attempt) * Double(attempt))
                    if let ra = http.value(forHTTPHeaderField: "Retry-After"), let secs = Int(ra.trimmingCharacters(in: .whitespaces)), secs >= 0 && secs <= 300 {
                        wait = Double(secs)
                    }
                    Thread.sleep(forTimeInterval: wait)
                    lastError = HlsError.network("HTTP \(status) for \(url)")
                    continue
                }
                guard (200..<300).contains(status) else {
                    throw HlsError.network("HTTP \(status) for \(url)")
                }
                return (data, http)
            } catch is HlsCancel {
                throw HlsCancel()
            } catch {
                lastError = error
                if isHlsCancelled(id) { throw HlsCancel() }
                Thread.sleep(forTimeInterval: 0.3 * Double(attempt))
            }
        }
        throw lastError
    }

    private func downloadOne(id: String, url: String, dest: URL, headers: [String: String], kind: String) throws {
        if FileManager.default.fileExists(atPath: dest.path) {
            if isPlausibleFile(dest, kind: kind) { return }
            try? FileManager.default.removeItem(at: dest)
        }
        var lastError: Error = HlsError.network("Download failed: \(url)")
        for _ in 1...Self.hlsRetries {
            try checkHlsCancelled(id)
            do {
                let (data, _) = try fetchOK(id: id, url: url, headers: headers)
                guard isPlausibleBytes(data, kind: kind) else {
                    throw HlsError.network("Server returned an error page (\(data.count) bytes).")
                }
                try data.write(to: dest, options: .atomic)
                return
            } catch is HlsCancel {
                throw HlsCancel()
            } catch {
                lastError = error
                try? FileManager.default.removeItem(at: dest)
                if isHlsCancelled(id) { throw HlsCancel() }
            }
        }
        throw lastError
    }

    // MARK: - HLS parsing (ports of js/hls-offline.js)

    private struct HlsVariant {
        var uri: String
        var width: Int
        var height: Int
        var bandwidth: Int
        var codecs: String?
    }

    private struct HlsKey {
        var method: String
        var uri: String
    }

    private struct HlsMedia {
        var segs: [String] = []
        var keys: [HlsKey] = []
        var inits: [String] = []
    }

    private static func attrOf(_ line: String, _ key: String) -> String? {
        guard let re = try? NSRegularExpression(pattern: key + "=(\"[^\"]*\"|[^,]+)", options: .caseInsensitive) else {
            return nil
        }
        let ns = line as NSString
        guard let m = re.firstMatch(in: line, options: [], range: NSRange(location: 0, length: ns.length)) else {
            return nil
        }
        return ns.substring(with: m.range(at: 1)).trimmingCharacters(in: CharacterSet(charactersIn: "\""))
    }

    private static func absUrl(_ base: String, _ rel: String) -> String {
        guard let b = URL(string: base), let u = URL(string: rel, relativeTo: b) else { return rel }
        return u.absoluteString
    }

    private static func codecRank(_ codecs: String?) -> Int {
        let c = (codecs ?? "").lowercased()
        if c.contains("avc1") || c.contains("avc3") { return 0 }
        if c.contains("dvh1") || c.contains("dvhe") || c.contains("dvav") { return 2 }
        if c.contains("hev1") || c.contains("hvc1") { return 1 }
        return 1
    }

    private func parseMaster(_ text: String, base: String) -> [HlsVariant] {
        guard text.hasPrefix("#EXTM3U"), text.contains("#EXT-X-STREAM-INF") else { return [] }
        let lines = text.components(separatedBy: .newlines)
        var out: [HlsVariant] = []
        for (i, line) in lines.enumerated() {
            guard line.hasPrefix("#EXT-X-STREAM-INF") else { continue }
            var uriLine: String?
            for j in (i + 1)..<lines.count {
                let cand = lines[j].trimmingCharacters(in: .whitespaces)
                if cand.isEmpty || cand.hasPrefix("#") { continue }
                uriLine = cand
                break
            }
            guard let uri = uriLine else { continue }
            var w = 0, h = 0
            if let res = Self.attrOf(line, "RESOLUTION")?.lowercased(), res.contains("x") {
                let wh = res.split(separator: "x")
                w = wh.count > 0 ? Int(wh[0]) ?? 0 : 0
                h = wh.count > 1 ? Int(wh[1]) ?? 0 : 0
            }
            let bw = Int(Self.attrOf(line, "BANDWIDTH") ?? "0") ?? 0
            out.append(HlsVariant(uri: Self.absUrl(base, uri), width: w, height: h, bandwidth: bw,
                                  codecs: Self.attrOf(line, "CODECS")))
        }
        var byHeight: [Int: HlsVariant] = [:]
        for v in out {
            if let cur = byHeight[v.height] {
                let ra = Self.codecRank(v.codecs), rb = Self.codecRank(cur.codecs)
                if ra < rb || (ra == rb && v.bandwidth > cur.bandwidth) { byHeight[v.height] = v }
            } else {
                byHeight[v.height] = v
            }
        }
        return byHeight.values.sorted { $0.height > $1.height }
    }

    private func pickVariant(_ variants: [HlsVariant]) -> HlsVariant? {
        let eligible = variants.filter { $0.height > 0 && $0.height <= 1080 }
        let pool = eligible.isEmpty ? variants : eligible
        let maxH = pool.map { $0.height }.max() ?? 0
        let atH = pool.filter { $0.height == maxH }
        var best: HlsVariant?
        for v in atH {
            guard let b = best else { best = v; continue }
            let ra = Self.codecRank(v.codecs), rb = Self.codecRank(b.codecs)
            if ra < rb || (ra == rb && v.bandwidth > b.bandwidth) { best = v }
        }
        return best
    }

    private func parseMedia(_ text: String, base: String) -> HlsMedia {
        var m = HlsMedia()
        for rawLine in text.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.isEmpty { continue }
            if line.hasPrefix("#EXT-X-KEY:") {
                let method = Self.attrOf(line, "METHOD") ?? "NONE"
                if let uri = Self.attrOf(line, "URI") {
                    m.keys.append(HlsKey(method: method, uri: Self.absUrl(base, uri)))
                }
                continue
            }
            if line.hasPrefix("#EXT-X-MAP:") {
                if let uri = Self.attrOf(line, "URI") {
                    m.inits.append(Self.absUrl(base, uri))
                }
                continue
            }
            if line.hasPrefix("#") { continue }
            m.segs.append(Self.absUrl(base, line))
        }
        return m
    }

    private func rewriteAbsolute(_ rawText: String, base: String, urlMap: [String: String]) -> (playlist: String, leftovers: [String]) {
        var leftovers: [String] = []
        var outLines: [String] = []
        let uriRe = try? NSRegularExpression(pattern: "URI=\"([^\"]+)\"", options: [])
        for rawLine in rawText.components(separatedBy: "\n") {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.isEmpty {
                outLines.append(rawLine)
                continue
            }
            if !line.hasPrefix("#") {
                if let mapped = urlMap[Self.absUrl(base, line)] {
                    outLines.append(mapped)
                } else {
                    leftovers.append(line)
                    outLines.append(rawLine)
                }
                continue
            }
            guard let re = uriRe else {
                outLines.append(rawLine)
                continue
            }
            let ns = rawLine as NSString
            var result = ""
            var last = 0
            let matches = re.matches(in: rawLine, options: [], range: NSRange(location: 0, length: ns.length))
            for mt in matches {
                let full = ns.substring(with: mt.range(at: 0))
                let u = ns.substring(with: mt.range(at: 1))
                let key = Self.absUrl(base, u)
                result += ns.substring(with: NSRange(location: last, length: mt.range.location - last))
                if !key.lowercased().hasPrefix("http") {
                    result += full
                } else if let mapped = urlMap[key] {
                    result += "URI=\"\(mapped)\""
                } else {
                    leftovers.append(u)
                    result += full
                }
                last = mt.range.location + mt.range.length
            }
            result += ns.substring(from: last)
            outLines.append(result)
        }
        return (outLines.joined(separator: "\n"), leftovers)
    }

    private static func pad5(_ n: Int) -> String {
        String(format: "%05d", n)
    }

    private static func extOf(_ url: String, fb: String) -> String {
        let clean = url.split(separator: "?")[0].lowercased()
        guard let dot = clean.lastIndex(of: ".") else { return fb }
        let ext = String(clean[clean.index(after: dot)...])
        if ext.isEmpty || ext.count > 5 || ext.contains("/") { return fb }
        return ext
    }

    private static func looksLikeError(_ data: Data) -> Bool {
        guard !data.isEmpty else { return true }
        let bytes = [UInt8](data.prefix(64))
        var i = 0
        if bytes.count >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF { i = 3 }
        while i < bytes.count && (bytes[i] == 0x20 || bytes[i] == 0x09 || bytes[i] == 0x0A || bytes[i] == 0x0D) { i += 1 }
        if i >= bytes.count { return true }
        let head = String(bytes: bytes[i...].prefix(32), encoding: .ascii)?.lowercased() ?? ""
        return head.hasPrefix("<") || head.hasPrefix("{") || head.hasPrefix("[") || head.hasPrefix("error")
    }

    private func isPlausibleFile(_ url: URL, kind: String) -> Bool {
        do {
            let attrs = try FileManager.default.attributesOfItem(atPath: url.path)
            let len = (attrs[.size] as? NSNumber)?.intValue ?? 0
            if len <= 0 || len > 500 * 1024 * 1024 { return false }
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            let head = handle.readData(ofLength: 64)
            if Self.looksLikeError(head) { return false }
            if kind == "sidecar" { return len >= 16 }
            return len >= 32
        } catch {
            return false
        }
    }

    private func isPlausibleBytes(_ data: Data, kind: String) -> Bool {
        if data.isEmpty || Self.looksLikeError(data) { return false }
        if kind == "sidecar" { return data.count >= 16 }
        return data.count >= 32
    }

    private func dirSize(_ dir: URL) -> Int64 {
        var total: Int64 = 0
        guard let items = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.fileSizeKey, .isDirectoryKey]) else {
            return 0
        }
        for item in items {
            do {
                let vals = try item.resourceValues(forKeys: [.fileSizeKey, .isDirectoryKey])
                if vals.isDirectory == true {
                    total += dirSize(item)
                } else {
                    total += Int64(vals.fileSize ?? 0)
                }
            } catch { /* ignore */ }
        }
        return total
    }

    // MARK: - Injected scraper hook (compact twin of js/stream-hook.js)

    // swiftlint:disable line_length
    private static let hookJS = """
    (function(){
    function post(u){try{console.log('[JFLIX-STREAM] '+u);}catch(e){}try{if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.jflixStream){window.webkit.messageHandlers.jflixStream.postMessage({url:u});}}catch(e){}}
    var VR=/\\.(m3u8|mpd|mp4|webm|mkv)($|\\?)/i,HR=/m3u8|mpegurl|\\.mpd($|\\?)/i;
    var SR=/\\.(jpe?g|png|gif|webp|svg|ico|css|woff2?|js|vtt|srt)($|\\?)/i;
    var SH=/image\\.tmdb\\.org|wsrv\\.nl|googletagmanager|doubleclick|adsystem|google-analytics|clarity\\.ms/i;
    function F(){return !!window.__jflixStreamFound;}
    function H(u){return typeof u==='string'&&/^https?:\\/\\//i.test(u);}
    function S(u){return !H(u)||SR.test(u)||SH.test(u);}
    function E(u,src){if(F()||S(u))return;window.__jflixStreamFound=true;post(u);}
    function R(u,src){if(u&&(VR.test(u)||HR.test(u)))E(u,src);}
    function W(n){if(!n||F())return;if(typeof n==='string'){R(n,'json');return;}
    if(n instanceof Array){for(var i=0;i<n.length&&!F();i++)W(n[i]);return;}
    if(typeof n!=='object')return;
    if(typeof n.playlist==='string'&&n.requiresProxy!==true){if(!S(n.playlist))E(n.playlist,'json.playlist');if(F())return;}
    if(typeof n.file==='string')R(n.file,'json.file');if(F())return;
    if(typeof n.url==='string'&&H(n.url)){var k=String(n.type||n.kind||n.format||'').toLowerCase();
    if(VR.test(n.url)||HR.test(n.url)||/^(hls|dash|mp4|mpegurl|m3u8|mpd)$/i.test(k))E(n.url,'json.url');if(F())return;}
    for(var key in n){if(!n.hasOwnProperty(key)||key==='playlist'||key==='file')continue;W(n[key]);if(F())return;}}
    function B(t,u,src){if(!t||F())return;var s=String(t).trim();
    if(s.indexOf('#EXTM3U')===0){E(u,src+'-hls');return;}
    if(s.charAt(0)!=='{'&&s.charAt(0)!=='[')return;
    try{W(JSON.parse(s));}catch(e){}}
    function M(){var ns=document.querySelectorAll('video,audio');
    for(var i=0;i<ns.length;i++){ns[i].muted=true;try{ns[i].volume=0;}catch(e){}}}
    if(!window.__jflixM){window.__jflixM=true;M();setInterval(M,1000);}
    function A(u){if(!u||u==='about:blank')return u;
    try{var x=new URL(u,location.href);if(x.protocol!=='http:'&&x.protocol!=='https:')return u;
    if(x.searchParams.get('autoplay')==='true')return u;x.searchParams.set('autoplay','true');return x.toString();}
    catch(e){return u;}}
    function V(){if(F())return;var ns=document.querySelectorAll('video');
    for(var i=0;i<ns.length;i++){var v=ns[i],u=v.currentSrc||v.getAttribute('src')||'';
    if(!u||u.indexOf('blob:')===0)continue;R(u,'video.currentSrc');
    if(!v.paused&&H(u)&&!S(u)&&u.split('#')[0]!==location.href.split('#')[0])E(u,'video.playing');}}
    if(!window.__jflixH){window.__jflixH=true;
    var OO=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(){this.addEventListener('load',function(){
    try{var r=this.responseURL;if(!r)return;R(r,'xhr');
    var t=typeof this.responseText==='string'?this.responseText:'';B(t,r,'xhr');}catch(e){}});
    OO.apply(this,arguments);};
    if(window.fetch){var OF=window.fetch;window.fetch=function(inp,init){
    var ru=typeof inp==='string'?inp:(inp&&inp.url);
    return OF.apply(this,arguments).then(function(rs){
    try{var r2=rs.url||ru;R(r2,'fetch');
    rs.clone().text().then(function(t){B(t,r2,'fetch');}).catch(function(){});}catch(e){}
    return rs;});};}
    try{var mp=window.HTMLMediaElement&&window.HTMLMediaElement.prototype;
    if(mp&&!mp.__jflixS){mp.__jflixS=true;var d=Object.getOwnPropertyDescriptor(mp,'src');
    if(d&&d.set)Object.defineProperty(mp,'src',{configurable:true,enumerable:d.enumerable,
    get:function(){return d.get.call(this);},
    set:function(v){if(v)R(String(v),'video.src');d.set.call(this,v);}});}}catch(e){}
    try{new PerformanceObserver(function(l){var es=l.getEntries();
    for(var i=0;i<es.length;i++)R(es[i].name,'perf');}).observe({type:'resource',buffered:true});}catch(e){}
    }
    var SEL=['.vjs-big-play-button','.jw-icon-playback','.jw-display-icon-container',
    '.plyr__control--overlaid','.mejs-overlay-play','.fluid_initial_play','.vjs-poster','[aria-label*=\"play\" i]'];
    function CN(el){var c=el.className;if(!c)return '';if(typeof c==='string')return c;
    if(typeof c.baseVal==='string')return c.baseVal;return String(c);}
    function PC(el){var n=el;while(n&&n!==document){var c=CN(n).toLowerCase();
    if(c.indexOf('control-bar')!==-1||c.indexOf('vjs-control')!==-1)return true;n=n.parentElement;}return false;}
    function VIS(el){var r=el.getBoundingClientRect();if(r.width<8||r.height<8)return false;
    var st=window.getComputedStyle(el);
    return !(st.display==='none'||st.visibility==='hidden'||parseFloat(st.opacity)===0);}
    function PB(){for(var i=0;i<SEL.length;i++){try{var ms=document.querySelectorAll(SEL[i]);
    for(var j=0;j<ms.length;j++)if(VIS(ms[j])&&!PC(ms[j]))return ms[j];}catch(e){}}
    var vs=document.querySelectorAll('video');
    for(var k=0;k<vs.length;k++)if(VIS(vs[k])||vs[k].readyState>0)return vs[k];return null;}
    function CK(el){try{el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));}catch(e){}
    try{el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));}catch(e){}
    try{el.click();}catch(e){}
    try{el.dispatchEvent(new MouseEvent('click',{bubbles:true}));}catch(e){}}
    function PM(){var ns=document.querySelectorAll('video,audio');
    for(var i=0;i<ns.length;i++){var sr=ns[i].currentSrc||ns[i].getAttribute('src')||'';if(!sr)continue;
    try{var p=ns[i].play();if(p&&p.catch)p.catch(function(){});}catch(e){}}
    try{if(typeof window.jwplayer==='function'){var j=window.jwplayer();if(j&&j.play)j.play();}}catch(e){}}
    function UF(){var fs=document.querySelectorAll('iframe');
    for(var i=0;i<fs.length;i++){var f=fs[i];
    try{if(f.hasAttribute('sandbox'))f.removeAttribute('sandbox');}catch(e){}
    var s=f.getAttribute('src')||'';if(!s)continue;var nx=A(s);
    if(nx&&nx!==s)f.src=nx;}PI();}
    function PI(){if(F())return false;var c=window.__jflixPC||0;if(c>=3)return false;
    var vw=window.innerWidth||1,vh=window.innerHeight||1,fs=document.querySelectorAll('iframe'),best=null,bs=0;
    for(var i=0;i<fs.length;i++){var s=fs[i].src||fs[i].getAttribute('src')||'';
    if(!s||s==='about:blank')continue;try{s=new URL(s,location.href).href;}catch(e){continue;}
    if(!H(s)||SH.test(s))continue;if(s.split('#')[0]===location.href.split('#')[0])continue;
    var r=fs[i].getBoundingClientRect();
    var fill=r.width>=vw*0.45&&r.height>=vh*0.45;
    var pl=/\\/embed|\\/player|\\/watch|\\/tv\\/|\\/movie\\/|videasy|vidfast|vidsrc|vidlink/i.test(s);
    if(!fill&&!pl)continue;var sc=r.width*r.height+(pl?10000000:0);
    if(sc>bs){bs=sc;best=s;}}
    if(!best)return false;window.__jflixPC=c+1;try{location.replace(best);}catch(e){}return true;}
    var T0=Date.now(),TT=null;
    function TC(){if(F()){if(TT)clearInterval(TT);return;}
    if(Date.now()-T0>30000){if(TT)clearInterval(TT);return;}
    try{UF();if(PI())return;PM();V();
    var vs=document.querySelectorAll('video');var armed=false;
    for(var i=0;i<vs.length;i++){var vv=vs[i];if((vv.currentSrc&&!vv.paused)||vv.readyState>0){armed=true;break;}}
    if(armed)return;
    var t=PB();if(!t)return;CK(t);
    if((t.tagName||'').toLowerCase()==='video'){try{var p=t.play();if(p&&p.catch)p.catch(function(){});}catch(e){}}
    }catch(e){}}
    TC();TT=setInterval(TC,1000);V();setInterval(V,1000);
    })();
    """
}

// MARK: - Ghost WebView navigation (hook re-injection)

extension DownloadBridge: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript(DownloadBridge.hookJS, completionHandler: nil)
    }
}

// MARK: - URLSessionDownloadDelegate (progressive MP4)

extension DownloadBridge: URLSessionDownloadDelegate {
    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        lock.lock()
        let id = dlTaskForId.first { $0.value === downloadTask }?.key
        lock.unlock()
        guard let id = id else { return }
        let pct: Int
        if totalBytesExpectedToWrite > 0 {
            pct = min(99, Int(totalBytesWritten * 100 / max(1, totalBytesExpectedToWrite)))
        } else {
            pct = min(99, Int(totalBytesWritten / (50 * 1024 * 1024) * 100))
        }
        setStatus(id, status: "downloading", progress: pct, error: nil)
    }

    private func idForTask(_ task: URLSessionTask) -> String? {
        lock.lock(); defer { lock.unlock() }
        return dlTaskForId.first { $0.value === task }?.key
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let id = idForTask(downloadTask) else { return }
        lock.lock()
        dlTaskForId.removeValue(forKey: id)
        lock.unlock()
        let dest = jobDir(id: id).appendingPathComponent("video.mp4")
        do {
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.moveItem(at: location, to: dest)
            guard isPlausibleFile(dest, kind: "file") else {
                try? FileManager.default.removeItem(at: dest)
                setStatus(id, status: "error", progress: 0, error: "Server returned an error page instead of the video.")
                return
            }
            let size = (try? FileManager.default.attributesOfItem(atPath: dest.path)[.size] as? NSNumber)?.int64Value ?? 0
            finishCompleted(id: id, file: "video.mp4", size: size)
        } catch {
            setStatus(id, status: "error", progress: 0, error: error.localizedDescription)
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let error = error else { return }
        let ns = error as NSError
        // Cancellation is expected (user pressed Cancel) — record already marked.
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return }
        lock.lock()
        let id = idForTask(task)
        if let id = id { dlTaskForId.removeValue(forKey: id) }
        let rec = id.flatMap { library[$0] }
        lock.unlock()
        guard let id = id, let r = rec, r.status == "downloading" || r.status == "connecting" else { return }
        setStatus(id, status: "error", progress: 0, error: error.localizedDescription)
    }
}
