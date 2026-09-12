import UIKit
import WebKit
import UniformTypeIdentifiers

/// JFlix iOS shell — full-screen WKWebView over https://jflix.uk,
/// mirroring the Android (com.jflix.app) wrapper:
/// unique app UA, platform flag injection, external-link policy,
/// offline overlay, and the in-app downloads bridge.
class ViewController: UIViewController {

    private static let homeURL = URL(string: "https://jflix.uk")!
    // Fixed app UA (stock iOS Safari shape + app tokens). The JFlixNativeApp
    // token matches the site's native detection (same as Android); JFlix-iOS
    // marks iOS. The version is read from the bundle, so it tracks
    // MARKETING_VERSION automatically on every release (never hardcode it).
    // Static on purpose: the first build read the UA back with an async
    // evaluateJavaScript before its first load — if that round-trip stalled,
    // nothing ever rendered (black screen). Load is now immediate, exactly
    // like the Android wrapper.
    private static var appVersionToken: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
        let version = (v?.isEmpty == false) ? v! : "1.0.0"
        return "JFlixNativeApp/\(version)-X7K9Q2M JFlix-iOS"
    }
    private static var appUserAgent: String {
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 " +
        appVersionToken
    }
    // Exact hosts always handled in-app.
    private static let allowedHosts = ["jflix.uk", "www.jflix.uk", "jflixuk.pages.dev", "accounts.google.com"]
    // Suffixes handled in-app (OAuth bounces). Covers Google, Supabase, Google APIs & CDNs.
    private static let allowedSuffixes = [
        "google.com", "supabase.co", "googleapis.com", "gstatic.com", "googleusercontent.com"
    ]

    private var webView: WKWebView!
    private var downloads: DownloadBridge!
    private var offlineView: UIView?
    private var loadingView: UIView!
    private var progressView: UIProgressView!
    private var progressObservation: NSKeyValueObservation?
    private var openPanelCompletion: (([URL]?) -> Void)?

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        showLoading("Loading JFlix…")
        setupWebView()
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        injectSafeAreaCSS()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        injectSafeAreaCSS()
    }

    private func injectSafeAreaCSS() {
        let insets = view.safeAreaInsets
        let js = """
        (function() {
            var root = document.documentElement;
            root.style.setProperty('--ios-safe-top', '\(insets.top)px');
            root.style.setProperty('--ios-safe-bottom', '\(insets.bottom)px');
            root.style.setProperty('--ios-safe-left', '\(insets.left)px');
            root.style.setProperty('--ios-safe-right', '\(insets.right)px');
            root.classList.add('is-ios-app');
        })();
        """
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    // MARK: - WebView setup

    private func setupWebView() {
        let contentController = WKUserContentController()

        // Platform flag so the site can detect the iOS wrapper immediately.
        let platformScript = WKUserScript(
            source: "window.IS_IOS_APP = true; window.IS_IOS_NATIVE = true; window.IS_NATIVE_APP = true; document.documentElement.classList.add('is-ios-app');",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        contentController.addUserScript(platformScript)
        contentController.add(self, name: "iosHaptic")

        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        config.allowsInlineMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Offline playback scheme for downloaded files (mirrors Electron jflixdl://).
        let schemeHandler = SchemeHandler()
        config.setURLSchemeHandler(schemeHandler, forURLScheme: "jflixdl")
        self.schemeHandler = schemeHandler

        let webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.customUserAgent = Self.appUserAgent
        view.addSubview(webView)
        // Thin loading progress bar (Android ProgressBar parity).
        let progress = UIProgressView(progressViewStyle: .bar)
        progress.translatesAutoresizingMaskIntoConstraints = false
        progress.trackTintColor = .clear
        progress.progressTintColor = UIColor(red: 0.898, green: 0.035, blue: 0.078, alpha: 1.0)
        progress.progress = 0
        view.addSubview(progress)
        NSLayoutConstraint.activate([
            progress.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progress.heightAnchor.constraint(equalToConstant: 2),
        ])
        progressView = progress
        progressObservation = webView.observe(\.estimatedProgress, options: .new) { [weak self] _, change in
            guard let self = self, let p = change.newValue else { return }
            self.progressView.isHidden = p >= 1.0
            self.progressView.setProgress(Float(p), animated: true)
        }
        // Pull-to-refresh (Android SwipeRefreshLayout parity).
        let refresh = UIRefreshControl()
        refresh.tintColor = .white
        refresh.addTarget(self, action: #selector(didPullRefresh), for: .valueChanged)
        webView.scrollView.refreshControl = refresh
        // Loading indicator must sit ABOVE the webview.
        view.bringSubviewToFront(loadingView)
        self.webView = webView

        // Downloads bridge (also registers the "iosDownloads" message handler).
        self.downloads = DownloadBridge(
            filesRoot: SchemeHandler.filesRoot(),
            mainWebView: { [weak self] in self?.webView },
            hostView: { [weak self] in self?.view }
        )
        contentController.add(self.downloads, name: "iosDownloads")

        // Load immediately (Android parity) — never gate the first load on JS.
        webView.load(URLRequest(url: Self.homeURL))
    }

    private var schemeHandler: SchemeHandler?

    /// Load a deep-link URL inside the app (same-origin only).
    func loadDeepLink(_ url: URL) {
        guard let host = url.host, Self.isAllowedHost(host) else { return }
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        components?.scheme = "https"
        if let target = components?.url {
            webView?.load(URLRequest(url: target))
        }
    }

    private static func isAllowedHost(_ host: String) -> Bool {
        let h = host.lowercased()
        if allowedHosts.contains(h) { return true }
        if allowedSuffixes.contains(where: { h == $0 || h.hasSuffix("." + $0) }) { return true }
        // Country-specific Google auth domains (e.g. accounts.google.com.ph, google.com.ph, accounts.google.co.uk)
        if h == "google" || h.contains(".google.") || h.hasPrefix("google.") || h.hasSuffix(".google") || h.contains("google.com") {
            return true
        }
        if h.contains("youtube.com") {
            return true
        }
        return false
    }

    /// Keep the screen awake on player/watch pages (main site + aniu).
    /// Web Wake Lock covers browsers that support it, but iOS Safari and
    /// WKWebView do not — so the shell holds the idle timer instead, exactly
    /// while a player page is open. Navigating away re-arms auto-lock.
    private func updateIdleTimer(for url: URL?) {
        let path = (url?.path ?? "").lowercased()
        let playing = path.contains("player") || path.contains("watch")
        if UIApplication.shared.isIdleTimerDisabled != playing {
            UIApplication.shared.isIdleTimerDisabled = playing
        }
    }

    // MARK: - Loading overlay (branded splash, never a bare black screen)

    private func showLoading(_ text: String) {
        hideLoading()
        let overlay = UIView(frame: view.bounds)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.backgroundColor = .black
        overlay.alpha = 1

        // JFlix logo with a gentle pulse while the site boots.
        let logo = UIImageView(image: UIImage(named: "Logo"))
        logo.contentMode = .scaleAspectFit
        logo.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(logo)

        let spinner = UIActivityIndicatorView(style: .large)
        spinner.color = UIColor(red: 0.898, green: 0.035, blue: 0.078, alpha: 1.0)
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()
        overlay.addSubview(spinner)

        let label = UILabel()
        label.text = text
        label.textColor = .lightGray
        label.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        label.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(label)

        NSLayoutConstraint.activate([
            logo.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            logo.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: -40),
            logo.widthAnchor.constraint(equalToConstant: 190),
            logo.heightAnchor.constraint(equalToConstant: 190),
            spinner.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            spinner.topAnchor.constraint(equalTo: logo.bottomAnchor, constant: 18),
            label.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            label.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 12),
        ])
        view.addSubview(overlay)
        loadingView = overlay

        UIView.animate(withDuration: 1.1, delay: 0,
                       options: [.autoreverse, .repeat, .allowUserInteraction],
                       animations: {
            logo.transform = CGAffineTransform(scaleX: 1.06, y: 1.06)
            logo.alpha = 0.92
        }, completion: nil)
    }

    private func hideLoading() {
        guard let overlay = loadingView else { return }
        loadingView = nil
        // Cross-fade into the loaded site (matches Android's fade-in feel).
        UIView.animate(withDuration: 0.35, animations: {
            overlay.alpha = 0
        }, completion: { _ in
            overlay.removeFromSuperview()
        })
    }

    // MARK: - Offline overlay

    private func showOffline() {
        if offlineView != nil { return }
        hideLoading()
        let overlay = UIView(frame: view.bounds)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.backgroundColor = UIColor(red: 0.08, green: 0.08, blue: 0.12, alpha: 1.0)

        let logo = UIImageView(image: UIImage(named: "Logo"))
        logo.contentMode = .scaleAspectFit
        logo.translatesAutoresizingMaskIntoConstraints = false
        logo.alpha = 0.9
        overlay.addSubview(logo)

        let emoji = UILabel()
        emoji.text = "📡"
        emoji.font = UIFont.systemFont(ofSize: 44)
        emoji.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(emoji)

        let title = UILabel()
        title.text = "No Internet Connection"
        title.textColor = .white
        title.font = UIFont.boldSystemFont(ofSize: 19)
        title.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(title)

        let sub = UILabel()
        sub.text = "Please check your connection and try again"
        sub.textColor = UIColor(white: 0.55, alpha: 1.0)
        sub.font = UIFont.systemFont(ofSize: 14)
        sub.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(sub)

        let button = UIButton(type: .system)
        button.setTitle("Try Again", for: .normal)
        button.titleLabel?.font = UIFont.boldSystemFont(ofSize: 16)
        button.setTitleColor(.white, for: .normal)
        button.backgroundColor = UIColor(red: 0.898, green: 0.035, blue: 0.078, alpha: 1.0)
        button.layer.cornerRadius = 12
        button.contentEdgeInsets = UIEdgeInsets(top: 14, left: 40, bottom: 14, right: 40)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(retryLoad), for: .touchUpInside)
        overlay.addSubview(button)

        NSLayoutConstraint.activate([
            logo.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            logo.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: -110),
            logo.widthAnchor.constraint(equalToConstant: 120),
            logo.heightAnchor.constraint(equalToConstant: 120),
            emoji.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            emoji.topAnchor.constraint(equalTo: logo.bottomAnchor, constant: 8),
            title.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            title.topAnchor.constraint(equalTo: emoji.bottomAnchor, constant: 10),
            sub.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            sub.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 6),
            button.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            button.topAnchor.constraint(equalTo: sub.bottomAnchor, constant: 26),
        ])
        view.addSubview(overlay)
        offlineView = overlay
    }

    private func hideOffline() {
        offlineView?.removeFromSuperview()
        offlineView = nil
    }

    @objc private func retryLoad() {
        hideOffline()
        showLoading("Loading JFlix…")
        if let url = webView?.url {
            webView?.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
        } else {
            webView?.load(URLRequest(url: Self.homeURL))
        }
    }

    @objc private func didPullRefresh() {
        webView?.reload()
    }

    private func endRefreshing() {
        if let refresh = webView?.scrollView.refreshControl, refresh.isRefreshing {
            refresh.endRefreshing()
        }
    }
}

// MARK: - Navigation policy (mirrors the Android wrapper)

extension ViewController: WKNavigationDelegate {

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        // Popups (no target frame): let createWebViewWith decide.
        guard let targetFrame = navigationAction.targetFrame else {
            decisionHandler(.cancel)
            return
        }

        // Subframes (video server embeds, players): ALWAYS allow. Policing
        // frame loads would break every video server, and frames cannot
        // navigate the user away. Android/Electron effectively allow embeds
        // too. No sandbox is applied to subframe content.
        if !targetFrame.isMainFrame {
            decisionHandler(.allow)
            return
        }

        updateIdleTimer(for: url)

        // ... main-frame policy below ...
        let scheme = (url.scheme ?? "").lowercased()

        // Non-http(s) schemes (tel:, mailto:, intent fallbacks) -> system handler.
        if scheme != "http" && scheme != "https" {
            if url.absoluteString == "about:blank" {
                decisionHandler(.allow)
                return
            }
            if UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            decisionHandler(.cancel)
            return
        }

        let host = (url.host ?? "").lowercased()
        if Self.isAllowedHost(host) {
            hideOffline()
            decisionHandler(.allow)
            return
        }

        // External destinations (download links, video hosts, Monetag ad clicks) go to Safari.
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hideOffline()
        hideLoading()
        endRefreshing()
        updateIdleTimer(for: webView.url)
        injectSafeAreaCSS()

        // If webView finished on Supabase OAuth callback or blank redirect, route directly to home
        if let currentURL = webView.url {
            let host = (currentURL.host ?? "").lowercased()
            let path = currentURL.path.lowercased()
            if host.contains("supabase.co") && (path.contains("callback") || path.contains("/auth/v1/callback")) {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self, weak webView] in
                    guard let self = self, let wv = webView else { return }
                    if let u = wv.url, (u.host ?? "").lowercased().contains("supabase.co") {
                        wv.load(URLRequest(url: Self.homeURL))
                    }
                }
                return
            }
            if currentURL.absoluteString == "about:blank" {
                webView.load(URLRequest(url: Self.homeURL))
                return
            }
        }

        // Re-assert the platform flag after full load (parity with Android
        // onPageFinished injection) and ensure a mobile viewport exists.
        webView.evaluateJavaScript(
            "(function(){window.IS_IOS_APP=true;" +
            "document.documentElement.classList.add('is-ios-app');" +
            "if(!document.querySelector('meta[name=\"viewport\"]')){" +
            "var m=document.createElement('meta');m.name='viewport';" +
            "m.content='width=device-width,initial-scale=1,viewport-fit=cover';" +
            "document.getElementsByTagName('head')[0].appendChild(m);}" +
            "var st=document.createElement('style');" +
            "st.innerHTML='body{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;overflow-x:hidden!important;}.native-hidden{display:none!important;}.mobile-bottom-nav{display:none!important;}body.has-bottom-nav{padding-bottom:0!important;}';" +
            "document.getElementsByTagName('head')[0].appendChild(st);" +
            "var bn=document.querySelector('.mobile-bottom-nav');if(bn)bn.remove();if(document.body)document.body.classList.remove('has-bottom-nav');})();",
            completionHandler: nil
        )
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // Renderer crash (rare, e.g. heavy embed pages): self-heal by
        // reloading instead of sitting on a dead view.
        webView.reload()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        hideLoading()
        endRefreshing()
        let code = (error as NSError).code
        // NSURLErrorNotConnectedToInternet / timed out / cannot find host.
        if code == NSURLErrorNotConnectedToInternet || code == NSURLErrorTimedOut ||
            code == NSURLErrorCannotFindHost || code == NSURLErrorCannotConnectToHost {
            showOffline()
        }
    }
}

// MARK: - File picker results

extension ViewController: UIDocumentPickerDelegate {

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        let completion = openPanelCompletion
        openPanelCompletion = nil
        completion?(urls)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        let completion = openPanelCompletion
        openPanelCompletion = nil
        completion?(nil)
    }
}

// MARK: - Popup targets (_blank links stay in-app unless external)

extension ViewController: WKUIDelegate {

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard let url = navigationAction.request.url,
              let host = url.host?.lowercased() else { return nil }
        // Same-domain popups stay in-app.
        if Self.isAllowedHost(host) {
            webView.load(navigationAction.request)
            return nil
        }
        // External popups (including Monetag ad popups and new tabs) go to Safari.
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
        return nil
    }

    func webViewDidClose(_ webView: WKWebView) {
        // When an OAuth auxiliary popup or window closes, navigate to homepage
        webView.load(URLRequest(url: Self.homeURL))
    }

    // MARK: - Dialog suppression (Electron parity)
    // Electron blocks alert()/confirm()/prompt() outright (embed ad-spam
    // dialogs); Android shows them. We match Electron: dismiss silently so
    // embeds can't trap the app in dialog loops.

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        completionHandler()
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        completionHandler(false)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        completionHandler(nil)
    }

    // MARK: - File chooser (avatar upload, etc.)
    // Android cancels file picks outright; iOS 18.4+ opens a real image
    // picker (document picker needs no photo-library permission). Older iOS
    // has no file-panel API, so picks there stay unsupported as before.
    @available(iOS 18.4, *)
    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        if openPanelCompletion != nil {
            completionHandler(nil)
            return
        }
        openPanelCompletion = completionHandler
        let picker: UIDocumentPickerViewController
        if #available(iOS 14.0, *) {
            picker = UIDocumentPickerViewController(forOpeningContentTypes: [.image], asCopy: true)
        } else {
            picker = UIDocumentPickerViewController(documentTypes: ["public.image"], in: .import)
        }
        picker.delegate = self
        picker.allowsMultipleSelection = parameters.allowsMultipleSelection
        present(picker, animated: true, completion: nil)
    }

    // MARK: - Media capture permission (camera/mic — Android grants these)

    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.grant)
    }
}

// MARK: - Native iOS Haptic Feedback Bridge

extension ViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "iosHaptic", let style = message.body as? String {
            switch style {
            case "light":
                let gen = UIImpactFeedbackGenerator(style: .light)
                gen.prepare()
                gen.impactOccurred()
            case "medium":
                let gen = UIImpactFeedbackGenerator(style: .medium)
                gen.prepare()
                gen.impactOccurred()
            case "heavy":
                let gen = UIImpactFeedbackGenerator(style: .heavy)
                gen.prepare()
                gen.impactOccurred()
            case "selection":
                let gen = UISelectionFeedbackGenerator()
                gen.prepare()
                gen.selectionChanged()
            case "success":
                let gen = UINotificationFeedbackGenerator()
                gen.prepare()
                gen.notificationOccurred(.success)
            case "warning":
                let gen = UINotificationFeedbackGenerator()
                gen.prepare()
                gen.notificationOccurred(.warning)
            default:
                let gen = UIImpactFeedbackGenerator(style: .light)
                gen.prepare()
                gen.impactOccurred()
            }
        }
    }
}

